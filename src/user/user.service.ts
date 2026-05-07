import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BusinessType, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import {
  InviteTenantUserDto,
  TenantUserQueryDto,
  TENANT_ASSIGNABLE_ROLES,
  UpdateTenantUserRoleDto,
  UpdateTenantUserStatusDto,
} from "./dto/manage-user.dto";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { EmailService } from "../notifications/email.service";

const MANAGEABLE_ROLES: Role[] = [
  Role.TENANT_ADMIN,
  ...TENANT_ASSIGNABLE_ROLES,
];

const userSelectFields = {
  id: true,
  name: true,
  email: true,
  businessType: true,
  role: true,
  isActive: true,
  timezone: true,
  notificationsEmail: true,
  notificationsPush: true,
  socialHandles: true,
  painPoints: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UserService {
  private readonly inviteTtlHours = Number(
    process.env.INVITE_TOKEN_TTL_HOURS ?? 72,
  );

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelectFields,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    // Convert DTO to Prisma-compatible data (JSON fields need casting)
    const data: any = {};
    if (updateProfileDto.name !== undefined) data.name = updateProfileDto.name;
    if (updateProfileDto.businessType !== undefined) data.businessType = updateProfileDto.businessType;
    if (updateProfileDto.socialHandles !== undefined) data.socialHandles = updateProfileDto.socialHandles;
    if (updateProfileDto.painPoints !== undefined) data.painPoints = updateProfileDto.painPoints;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: userSelectFields,
    });
  }

  async listTenantUsers(
    tenantId: string | null | undefined,
    query?: TenantUserQueryDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const includeInactive = query?.includeInactive ?? false;

    return this.prisma.user.findMany({
      where: {
        tenantId: scopedTenantId,
        ...(query?.role ? { role: query.role } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: "desc" },
      select: userSelectFields,
    });
  }

  async inviteTenantUser(
    requesterId: string,
    tenantId: string | null | undefined,
    dto: InviteTenantUserDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    this.assertAssignableRole(dto.role);

    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(
      this.generateTemporaryPassword(),
      10,
    );

    const invitedUser = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        passwordHash,
        businessType: dto.businessType ?? BusinessType.Solopreneur,
        role: dto.role,
        tenantId: scopedTenantId,
        isActive: false,
      },
      select: userSelectFields,
    });

    const token = this.generateInvitationToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + this.inviteTtlHours * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId: scopedTenantId,
        inviterId: requesterId,
        userId: invitedUser.id,
        email: normalizedEmail,
        role: dto.role,
        tokenHash,
        expiresAt,
      },
    });

    const [tenant, inviter] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: scopedTenantId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { name: true },
      }),
    ]);

    const inviteLink = `${this.getInviteBaseUrl()}?token=${token}`;
    await this.emailService.sendTenantInvite({
      email: normalizedEmail,
      inviteLink,
      tenantName: tenant?.name ?? "Your Workspace",
      inviterName: inviter?.name ?? "Admin",
      role: dto.role,
      expiresAt,
    });

    return {
      invitationId: invitation.id,
      user: invitedUser,
      expiresAt,
      token: process.env.NODE_ENV === "production" ? undefined : token,
    };
  }

  async updateTenantUserRole(
    requesterId: string,
    tenantId: string | null | undefined,
    userId: string,
    dto: UpdateTenantUserRoleDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    if (!MANAGEABLE_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        "Role is not assignable within tenant context",
      );
    }

    const targetUser = await this.findTenantUserOrThrow(scopedTenantId, userId);

    if (targetUser.id === requesterId) {
      throw new ForbiddenException("You cannot change your own role");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: userSelectFields,
    });
  }

  async updateTenantUserStatus(
    requesterId: string,
    tenantId: string | null | undefined,
    userId: string,
    dto: UpdateTenantUserStatusDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const targetUser = await this.findTenantUserOrThrow(scopedTenantId, userId);

    if (targetUser.id === requesterId) {
      throw new ForbiddenException("You cannot change your own status");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: userSelectFields,
    });
  }

  private assertAssignableRole(role: Role) {
    if (!TENANT_ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException("Role not allowed for invitations");
    }
  }

  private async findTenantUserOrThrow(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      select: userSelectFields,
    });

    if (!user) {
      throw new NotFoundException("User not found in your tenant");
    }

    return user;
  }

  private generateTemporaryPassword() {
    return Math.random().toString(36).slice(2, 10);
  }

  private generateInvitationToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  private hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private getInviteBaseUrl() {
    return (
      process.env.INVITE_ACCEPT_BASE_URL ??
      "http://localhost:3000/accept-invite"
    );
  }
}
