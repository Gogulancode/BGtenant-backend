import { CACHE_MANAGER } from "@nestjs/cache-manager";
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Cache } from "cache-manager";
import { authenticator } from "otplib";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MfaService {
  private readonly cacheTtlSeconds = 10 * 60;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async createEnrollment(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    const secret = authenticator.generateSecret();
    await this.cache.set(this.cacheKey(userId), secret, this.cacheTtlSeconds);

    const label = encodeURIComponent(
      user.name ? `${user.name} (${user.email})` : user.email,
    );
    const otpauthUrl = authenticator.keyuri(
      user.email,
      "Business Accountability",
      secret,
    );

    return { secret, otpauthUrl, label };
  }

  async enableMfa(userId: string, code: string) {
    const pendingSecret = await this.cache.get<string>(this.cacheKey(userId));
    if (!pendingSecret) {
      throw new BadRequestException(
        "Generate a new MFA secret before attempting to enable.",
      );
    }

    this.ensureValidToken(pendingSecret, code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaSecret: pendingSecret },
    });

    await this.cache.del(this.cacheKey(userId));
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException("MFA is not currently enabled");
    }

    this.ensureValidToken(user.mfaSecret, code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
  }

  async assertValidLogin(
    user: { id: string; mfaEnabled: boolean; mfaSecret: string | null },
    token?: string,
  ) {
    if (!user.mfaEnabled) {
      return;
    }

    if (!token) {
      throw new UnauthorizedException("MFA code is required");
    }

    if (!user.mfaSecret) {
      throw new UnauthorizedException("MFA secret missing for user");
    }

    this.ensureValidToken(user.mfaSecret, token, true);
  }

  private ensureValidToken(
    secret: string,
    token: string,
    unauthorized = false,
  ) {
    if (!secret) {
      if (unauthorized) {
        throw new UnauthorizedException("MFA secret missing");
      }
      throw new BadRequestException("MFA secret missing");
    }
    const isValid = authenticator.verify({ token, secret });
    if (!isValid) {
      if (unauthorized) {
        throw new UnauthorizedException("Invalid MFA code");
      }
      throw new BadRequestException("Invalid MFA code");
    }
  }

  private cacheKey(userId: string) {
    return `mfa:setup:${userId}`;
  }
}
