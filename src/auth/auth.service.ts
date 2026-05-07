import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  GoneException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TokensService } from "./tokens.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import * as bcrypt from "bcrypt";
import { BusinessType, Role, TenantType } from "@prisma/client";
import * as crypto from "crypto";
import { PasswordPolicyService } from "./password-policy.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { MfaService } from "./mfa.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private tokensService: TokensService,
    private passwordPolicy: PasswordPolicyService,
    private onboardingService: OnboardingService,
    private mfaService: MfaService,
  ) {}

  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.passwordPolicy.assertStrong(registerDto.password);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: `${registerDto.name}'s Workspace`,
        type: this.resolveTenantType(registerDto.businessType),
        slug: this.generateTenantSlug(registerDto.email),
      },
    });

    const user = await this.prisma.user.create({
      data: {
        name: registerDto.name,
        email: registerDto.email,
        passwordHash,
        businessType: registerDto.businessType,
        tenantId: tenant.id,
        role: Role.TENANT_ADMIN,
        passwordUpdatedAt: new Date(),
      },
    });

    const { accessToken, refreshToken } = await this.tokensService.issueTokens(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      ipAddress,
      userAgent,
    );

    try {
      await this.onboardingService.seedNewTenantWorkspace({
        tenantId: tenant.id,
        tenantName: tenant.name,
        adminUserId: user.id,
        adminEmail: user.email,
        adminName: user.name,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to execute onboarding seed for tenant ${tenant.id}: ${error?.message ?? error}`,
      );
    }

    // Get initial onboarding progress for new registrations
    let onboardingProgress = null;
    try {
      onboardingProgress = await this.onboardingService.getOnboardingProgress(
        tenant.id,
      );
    } catch {
      // Non-critical, frontend can fetch separately
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        businessType: user.businessType,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: false,
        isOnboarded: false, // New tenants always start with onboarding
      },
      onboardingProgress,
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        businessType: true,
        role: true,
        tenantId: true,
        mfaEnabled: true,
        mfaSecret: true,
        tenant: {
          select: {
            isOnboarded: true,
          },
        },
      },
    });

    if (
      !user ||
      !(await bcrypt.compare(loginDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.mfaService.assertValidLogin(
      {
        id: user.id,
        mfaEnabled: user.mfaEnabled,
        mfaSecret: user.mfaSecret,
      },
      loginDto.mfaCode,
    );

    const { accessToken, refreshToken } = await this.tokensService.issueTokens(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      ipAddress,
      userAgent,
    );

    // Get onboarding progress for first-login redirect logic
    // Skip for SUPER_ADMIN as they don't have tenants
    let onboardingProgress = null;
    if (user.role !== Role.SUPER_ADMIN && user.tenantId && !user.tenant?.isOnboarded) {
      try {
        onboardingProgress = await this.onboardingService.getOnboardingProgress(
          user.tenantId,
        );
      } catch {
        // Non-critical, frontend can fetch separately
      }
    }

    // SUPER_ADMIN is always considered "onboarded" (they don't have onboarding)
    const isOnboarded = user.role === Role.SUPER_ADMIN ? true : (user.tenant?.isOnboarded ?? false);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        businessType: user.role === Role.SUPER_ADMIN ? null : user.businessType,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
        isOnboarded,
      },
      onboardingProgress,
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(
    dto: RefreshTokenDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const { userId, accessToken, refreshToken } =
        await this.tokensService.refreshTokens(
          dto.refreshToken,
          ipAddress,
          userAgent,
        );

      // Get additional user info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          businessType: true,
          role: true,
          tenantId: true,
          mfaEnabled: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      return {
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  async logout(userId: string) {
    await this.tokensService.revokeAllUserTokens(userId);
  }

  async generateMfaSetup(userId: string) {
    return this.mfaService.createEnrollment(userId);
  }

  async enableMfa(userId: string, code: string) {
    await this.mfaService.enableMfa(userId, code);
    return { message: "MFA enabled" };
  }

  async disableMfa(userId: string, code: string) {
    await this.mfaService.disableMfa(userId, code);
    return { message: "MFA disabled" };
  }

  async acceptInvite(
    dto: AcceptInviteDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.passwordPolicy.assertStrong(dto.password);
    const tokenHash = crypto
      .createHash("sha256")
      .update(dto.token)
      .digest("hex");
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        tenant: { select: { name: true } },
      },
    });

    if (!invitation || !invitation.user) {
      throw new UnauthorizedException("Invalid invitation token");
    }

    if (invitation.acceptedAt || invitation.revokedAt) {
      throw new GoneException("Invitation already used or revoked");
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneException("Invitation expired");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: invitation.userId },
      data: {
        passwordHash,
        isActive: true,
        passwordUpdatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        businessType: true,
        role: true,
        tenantId: true,
        mfaEnabled: true,
      },
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    const { accessToken, refreshToken } = await this.tokensService.issueTokens(
      {
        sub: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId,
      },
      ipAddress,
      userAgent,
    );

    try {
      await this.onboardingService.handleInviteAcceptance({
        tenantId: invitation.user?.tenantId ?? invitation.tenantId,
        tenantName: invitation.tenant?.name ?? "Your Workspace",
        userId: updatedUser.id,
        userEmail: updatedUser.email,
        userName: updatedUser.name,
        role: updatedUser.role,
      });
    } catch (error) {
      this.logger.warn(
        `Failed onboarding automation for invite ${invitation.id}: ${error?.message ?? error}`,
      );
    }

    return {
      user: updatedUser,
      accessToken,
      refreshToken,
    };
  }

  private resolveTenantType(businessType: BusinessType): TenantType {
    return businessType === BusinessType.Solopreneur
      ? TenantType.FREELANCER
      : TenantType.COMPANY;
  }

  private generateTenantSlug(email: string): string {
    const prefix = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    return `${prefix}-${Date.now()}`;
  }
}
