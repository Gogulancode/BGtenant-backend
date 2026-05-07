import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMetricDto } from "./dto/create-metric.dto";
import { CreateMetricLogDto } from "./dto/create-metric-log.dto";
import { UpdateMetricDto } from "./dto/update-metric.dto";
import { MetricLogQueryDto } from "./dto/metric-log-query.dto";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { Metric } from "@prisma/client";
import { ActionLogService } from "../action-log/action-log.service";
import {
  PaginationDto,
  createPaginatedResponse,
} from "../common/dto/pagination.dto";

@Injectable()
export class MetricsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private actionLog: ActionLogService,
  ) {}

  async getAllMetrics(
    userId: string,
    tenantId?: string | null,
    pagination?: PaginationDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where = { userId, tenantId: scopedTenantId };

    // Apply search filter if provided
    const searchWhere = pagination?.search
      ? {
          ...where,
          name: { contains: pagination.search, mode: "insensitive" as const },
        }
      : where;

    // Get total count for pagination
    const [metrics, total] = await this.prisma.$transaction([
      this.prisma.metric.findMany({
        where: searchWhere,
        include: { logs: { orderBy: { date: "desc" }, take: 10 } },
        orderBy: pagination?.getOrderBy(["name", "createdat"], "createdAt", "desc"),
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 20,
      }),
      this.prisma.metric.count({ where: searchWhere }),
    ]);

    if (pagination) {
      return createPaginatedResponse(metrics, total, pagination);
    }

    return metrics;
  }

  async createMetric(
    userId: string,
    tenantId: string | null | undefined,
    createMetricDto: CreateMetricDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const metric = await this.prisma.metric.create({
      data: {
        userId,
        tenantId: scopedTenantId,
        ...createMetricDto,
      },
    });

    // Invalidate metrics cache for this user
    await this.cacheManager.del(`/metrics?userId=${userId}`);

    await this.actionLog.record(userId, scopedTenantId, "CREATE_METRIC", metric.id, {
      name: metric.name,
      target: metric.target,
    });

    return metric;
  }

  async createLog(
    userId: string,
    tenantId: string | null | undefined,
    metricId: string,
    createMetricLogDto: CreateMetricLogDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const metric = await this.prisma.metric.findFirst({
      where: { id: metricId, userId, tenantId: scopedTenantId },
    });

    if (!metric) {
      throw new NotFoundException("Metric not found");
    }

    const log = await this.prisma.metricLog.create({
      data: {
        metricId: metricId,
        value: createMetricLogDto.value,
        date: createMetricLogDto.date
          ? new Date(createMetricLogDto.date)
          : new Date(),
      },
    });

    await this.cacheManager.del(`/metrics?userId=${userId}`);
    await this.cacheManager.del(`/insights?userId=${userId}`);

    await this.actionLog.record(userId, scopedTenantId, "LOG_METRIC", metricId, {
      value: log.value,
      date: log.date,
    });

    return log;
  }

  async getMetricById(
    userId: string,
    tenantId: string | null | undefined,
    metricId: string,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const metric = await this.prisma.metric.findFirst({
      where: { id: metricId, tenantId: scopedTenantId },
      include: { logs: { orderBy: { date: "desc" }, take: 5 } },
    });

    if (!metric) {
      throw new NotFoundException("Metric not found");
    }

    if (metric.userId !== userId) {
      throw new ForbiddenException("Metric outside your scope");
    }

    return metric;
  }

  async updateMetric(
    userId: string,
    tenantId: string | null | undefined,
    metricId: string,
    dto: UpdateMetricDto,
  ) {
    const metric = await this.getMetricById(userId, tenantId, metricId);

    const updated = await this.prisma.metric.update({
      where: { id: metric.id },
      data: dto,
    });

    await this.cacheManager.del(`/metrics?userId=${userId}`);
    await this.actionLog.record(userId, assertTenantContext(tenantId), "UPDATE_METRIC", metricId, { ...dto });

    return updated;
  }

  async deleteMetric(
    userId: string,
    tenantId: string | null | undefined,
    metricId: string,
  ) {
    const metric = await this.getMetricById(userId, tenantId, metricId);

    await this.prisma.metric.delete({ where: { id: metric.id } });
    await this.cacheManager.del(`/metrics?userId=${userId}`);
    await this.actionLog.record(userId, assertTenantContext(tenantId), "DELETE_METRIC", metricId);

    return { success: true };
  }

  async getMetricLogs(
    userId: string,
    tenantId: string | null | undefined,
    metricId: string,
    query: MetricLogQueryDto,
  ) {
    const metric = await this.getMetricById(userId, tenantId, metricId);

    const logs = await this.prisma.metricLog.findMany({
      where: {
        metricId: metric.id,
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "desc" },
      take: query.limit ?? 25,
      include: {
        metric: {
          select: {
            id: true,
            name: true,
            target: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      metricId: log.metricId,
      value: log.value,
      date: log.date,
      loggedAt: log.date,
      metric: log.metric,
    }));
  }

  async getMetricTrend(
    userId: string,
    tenantId: string | null | undefined,
    metricId: string,
  ) {
    const metric = await this.getMetricById(userId, tenantId, metricId);

    const logs = await this.prisma.metricLog.findMany({
      where: { metricId: metric.id },
      orderBy: { date: "asc" },
      take: 50,
    });

    return {
      metricId: metric.id,
      name: metric.name,
      target: metric.target,
      points: logs.map((log) => ({
        date: log.date,
        value: log.value,
      })),
    };
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [metrics, recentLogs] = await this.prisma.$transaction([
      this.prisma.metric.findMany({
        where: { userId, tenantId: scopedTenantId },
        select: {
          id: true,
          name: true,
          target: true,
          logs: { orderBy: { date: "desc" }, take: 1, select: { value: true } },
        },
      }),
      this.prisma.metricLog.findMany({
        where: {
          metric: { userId, tenantId: scopedTenantId },
          date: { gte: sevenDaysAgo },
        },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          value: true,
          date: true,
          metricId: true,
          metric: { select: { name: true } },
        },
      }),
    ]);

    const totalMetrics = metrics.length;
    const activeMetrics = metrics.filter(
      (metric) => metric.logs.length > 0,
    ).length;
    const averageProgress = this.calculateAverageProgress(metrics);

    return {
      totalMetrics,
      activeMetrics,
      averageProgress,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        metricId: log.metricId,
        metricName: log.metric.name,
        value: log.value,
        date: log.date,
      })),
    };
  }

  private calculateAverageProgress(
    metrics: Array<Pick<Metric, "target"> & { logs: { value: number }[] }>,
  ): number {
    const ratios = metrics
      .map((metric) => {
        if (!metric.target || metric.target === 0 || metric.logs.length === 0) {
          return null;
        }
        const latestValue = metric.logs[0].value;
        return (latestValue / metric.target) * 100;
      })
      .filter((value): value is number => value !== null);

    if (!ratios.length) {
      return 0;
    }

    const sum = ratios.reduce((total, value) => total + value, 0);
    return Number((sum / ratios.length).toFixed(2));
  }
}
