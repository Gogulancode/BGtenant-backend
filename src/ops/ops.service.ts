import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../prisma/prisma.service";
import { ActionLogService } from "../action-log/action-log.service";
import { TelemetryService } from "../observability/telemetry.service";
import {
  AuditLogResponseDto,
  InsightsTelemetryDashboardDto,
  RateLimitOverviewDto,
  TelemetryOverviewDto,
} from "./dto/ops.dto";
import { AuditLogQueryDto } from "./dto/ops-query.dto";

@Injectable()
export class OpsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private actionLog: ActionLogService,
    private telemetry: TelemetryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getSystemHealth() {
    const dbStatus = await this.checkDatabase();
    const cacheStatus = await this.checkCache();
    const uptime = process.uptime();

    // Get recent activity stats
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentLogs = await this.prisma.actionLog.count({
      where: { createdAt: { gte: oneHourAgo } },
    });

    return {
      status: dbStatus && cacheStatus ? "healthy" : "degraded",
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? "connected" : "disconnected",
        cache: cacheStatus ? "connected" : "disconnected",
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        cpu: {
          usage: process.cpuUsage(),
        },
      },
      metrics: {
        requestsLastHour: recentLogs,
      },
    };
  }

  async getEnvironmentInfo() {
    return {
      nodeEnv: this.config.get("NODE_ENV"),
      port: this.config.get("PORT"),
      services: {
        database: await this.checkDatabase(),
        cache: await this.checkCache(),
        jwt: !!this.config.get("JWT_SECRET"),
        redis:
          this.config.get("NODE_ENV") === "production" &&
          !!this.config.get("REDIS_HOST"),
      },
      features: {
        caching: true,
        rateLimiting: true,
        actionLogging: true,
      },
    };
  }

  async triggerBackup(requesterId: string) {
    // Mock backup trigger - in production, implement actual DB backup to S3
    await this.actionLog.record(requesterId, null, "TRIGGER_BACKUP", "system");

    return {
      message: "Backup triggered successfully",
      timestamp: new Date().toISOString(),
      // In production: return S3 URL or backup file path
    };
  }

  async getTelemetryOverview(): Promise<TelemetryOverviewDto> {
    const jobs = this.telemetry.getAllTelemetry();
    const totals = jobs.reduce(
      (acc, job) => {
        acc.successCount += job.successCount;
        acc.failureCount += job.failureCount;
        return acc;
      },
      { successCount: 0, failureCount: 0 },
    );

    return {
      totals,
      jobs,
    };
  }

  async getInsightsTelemetryDashboard(): Promise<InsightsTelemetryDashboardDto> {
    const [insightCount, aggregates, flagGroups, topTenants] =
      await Promise.all([
        this.prisma.insight.count(),
        this.prisma.insight.aggregate({
          _avg: { momentumScore: true },
          _max: { updatedAt: true },
        }),
        this.prisma.insight.groupBy({
          by: ["flags"],
          _count: { _all: true },
        }),
        this.prisma.insight.groupBy({
          by: ["tenantId"],
          where: { tenantId: { not: null } },
          _avg: { momentumScore: true },
          _count: { _all: true },
          orderBy: { _avg: { momentumScore: "desc" } },
          take: 5,
        }),
      ]);

    const tenantLookupIds = topTenants
      .map((tenant) => tenant.tenantId)
      .filter((id): id is string => !!id);

    const tenantNames = tenantLookupIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: tenantLookupIds } },
          select: { id: true, name: true },
        })
      : [];
    const tenantNameMap = new Map(tenantNames.map((t) => [t.id, t.name]));

    const telemetrySnapshot =
      this.telemetry.getJobTelemetry("insights-refresh");

    return {
      summary: {
        totalInsights: insightCount,
        avgMomentum: Number((aggregates._avg.momentumScore ?? 0).toFixed(2)),
        lastRefreshAt: telemetrySnapshot?.lastSuccessAt ?? undefined,
        lastTelemetryError: telemetrySnapshot?.lastError,
      },
      flagDistribution: flagGroups.map((group) => ({
        flag: group.flags ?? "Unknown",
        count: group._count._all,
      })),
      topTenants: topTenants.map((tenant) => ({
        tenantId: tenant.tenantId,
        tenantName:
          (tenant.tenantId && tenantNameMap.get(tenant.tenantId)) || "Unknown",
        avgMomentum: Number((tenant._avg.momentumScore ?? 0).toFixed(2)),
        usersTracked: tenant._count._all,
      })),
      telemetry: telemetrySnapshot ?? null,
    };
  }

  async getRateLimitOverview(
    windowMinutes = 60,
  ): Promise<RateLimitOverviewDto> {
    const ttlMs = Number(this.config.get("THROTTLE_TTL_MS") ?? 60000);
    const limit = Number(this.config.get("THROTTLE_LIMIT") ?? 20);
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const windowLogs = await this.prisma.actionLog.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { tenantId: true, module: true },
    });

    const tenantTrafficMap = new Map<string, number>();
    const moduleTrafficMap = new Map<string, number>();

    for (const log of windowLogs) {
      if (log.tenantId) {
        tenantTrafficMap.set(
          log.tenantId,
          (tenantTrafficMap.get(log.tenantId) ?? 0) + 1,
        );
      }

      const moduleKey = log.module ?? "unknown";
      moduleTrafficMap.set(
        moduleKey,
        (moduleTrafficMap.get(moduleKey) ?? 0) + 1,
      );
    }

    const tenantTraffic = Array.from(tenantTrafficMap.entries())
      .map(([tenantId, count]) => ({ tenantId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const moduleHotspots = Array.from(moduleTrafficMap.entries())
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const tenantIds = tenantTraffic.map((entry) => entry.tenantId);

    const tenantNames = tenantIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const tenantMap = new Map(tenantNames.map((t) => [t.id, t.name]));

    return {
      config: { limit, ttlMs },
      window: {
        minutes: windowMinutes,
        since: windowStart.toISOString(),
      },
      topTenants: tenantTraffic.map((entry) => ({
        tenantId: entry.tenantId,
        tenantName: tenantMap.get(entry.tenantId) ?? "Unknown",
        requests: entry.count,
      })),
      moduleHotspots: moduleHotspots.map((entry) => ({
        module: entry.module,
        requests: entry.count,
      })),
    };
  }

  async getRecentAuditLogs(
    query: AuditLogQueryDto,
  ): Promise<AuditLogResponseDto> {
    const where: any = {};

    // Apply filters
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }
    if (query.module) {
      where.module = { contains: query.module, mode: "insensitive" };
    }
    if (query.action) {
      where.action = { contains: query.action, mode: "insensitive" };
    }
    if (query.search) {
      where.OR = [
        { module: { contains: query.search, mode: "insensitive" } },
        { action: { contains: query.search, mode: "insensitive" } },
        { userId: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.actionLog.findMany({
        where,
        orderBy: query.getOrderBy(
          ["createdat", "module", "action", "statuscode", "responsetime"],
          "createdAt",
          "desc",
        ),
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          tenantId: true,
          userId: true,
          module: true,
          action: true,
          statusCode: true,
          responseTime: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      this.prisma.actionLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return {
      data: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkCache(): Promise<boolean> {
    try {
      await this.cacheManager.set("health-check", "ok", 5);
      const value = await this.cacheManager.get("health-check");
      return value === "ok";
    } catch {
      return false;
    }
  }
}
