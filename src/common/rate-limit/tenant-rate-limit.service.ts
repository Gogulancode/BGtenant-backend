import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubscriptionPlan } from "@prisma/client";
import { Cache } from "cache-manager";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantRateLimitService {
  private readonly logger = new Logger(TenantRateLimitService.name);
  private readonly baseLimit: number;
  private readonly planMultipliers: Record<SubscriptionPlan, number> = {
    FREE: 1,
    STARTER: 2,
    PROFESSIONAL: 4,
    ENTERPRISE: 8,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.baseLimit = Number(this.configService.get("THROTTLE_LIMIT") ?? 20);
  }

  async getLimitForTenant(tenantId?: string | null): Promise<number> {
    if (!tenantId) {
      return this.baseLimit;
    }

    const cacheKey = this.getCacheKey(tenantId);
    const cached = await this.cache.get<number>(cacheKey);
    if (typeof cached === "number") {
      return cached;
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { plan: true },
    });

    const plan = subscription?.plan ?? SubscriptionPlan.FREE;
    const multiplier = this.planMultipliers[plan] ?? 1;
    const limit = Math.max(this.baseLimit, this.baseLimit * multiplier);
    await this.cache.set(cacheKey, limit, 300);
    return limit;
  }

  buildTracker(req: Record<string, any>): string {
    const tenantId = this.extractTenantId(req);
    if (tenantId) {
      return `tenant:${tenantId}`;
    }

    const userId = this.extractUserId(req);
    if (userId) {
      return `user:${userId}`;
    }

    const ip =
      (req.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      req.connection?.remoteAddress ??
      "anonymous";
    return `ip:${ip}`;
  }

  extractTenantId(req: Record<string, any>): string | null {
    const directTenant = this.extractDirectTenant(req);
    if (directTenant) {
      return directTenant;
    }

    const token = this.extractToken(req);
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.decode(token);
      if (decoded && typeof decoded === "object") {
        const tenantCandidate = (decoded as Record<string, unknown>)[
          "tenantId"
        ];
        if (typeof tenantCandidate === "string" && tenantCandidate.length) {
          return tenantCandidate;
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to decode token for tracker: ${error}`);
    }
    return null;
  }

  private extractDirectTenant(req: Record<string, any>): string | null {
    if (req.user && typeof req.user.tenantId === "string") {
      return req.user.tenantId;
    }
    const headerTenant = req.headers?.["x-tenant-id"];
    if (typeof headerTenant === "string" && headerTenant.length) {
      return headerTenant;
    }
    return null;
  }

  private extractUserId(req: Record<string, any>): string | null {
    if (req.user && typeof req.user.userId === "string") {
      return req.user.userId;
    }

    const token = this.extractToken(req);
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.decode(token);
      if (decoded && typeof decoded === "object") {
        const userCandidate = (decoded as Record<string, unknown>)["sub"];
        if (typeof userCandidate === "string" && userCandidate.length) {
          return userCandidate;
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to decode token for user extraction: ${error}`);
    }

    return null;
  }

  private extractToken(req: Record<string, any>): string | null {
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    return null;
  }

  private getCacheKey(tenantId: string) {
    return `tenant-rate-limit:${tenantId}`;
  }
}
