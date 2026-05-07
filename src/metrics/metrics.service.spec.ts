import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { Cache } from "cache-manager";

const mockMetric = {
  id: "metric-1",
  userId: "user-1",
  tenantId: "tenant-1",
  name: "Leads",
  target: 10,
  logs: [],
};

describe("MetricsService", () => {
  const prisma = {
    metric: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    metricLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fns) => Promise.all(fns.map((fn: any) => fn()))),
  } as any;

  const cache: Partial<Cache> = {
    del: jest.fn(),
  };

  const actionLog = {
    record: jest.fn(),
  } as any;

  let service: MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetricsService(prisma, cache as Cache, actionLog);
  });

  describe("getMetricById", () => {
    it("throws when metric missing", async () => {
      prisma.metric.findFirst.mockResolvedValue(null);
      await expect(
        service.getMetricById("user-1", "tenant-1", "metric-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws when accessing other tenant metric", async () => {
      prisma.metric.findFirst.mockResolvedValue({
        ...mockMetric,
        userId: "someone-else",
      });
      await expect(
        service.getMetricById("user-1", "tenant-1", "metric-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("updateMetric", () => {
    it("updates metric and logs action", async () => {
      prisma.metric.findFirst.mockResolvedValue(mockMetric);
      prisma.metric.update.mockResolvedValue({ ...mockMetric, target: 20 });

      const result = await service.updateMetric(
        "user-1",
        "tenant-1",
        "metric-1",
        { target: 20 },
      );

      expect(result.target).toBe(20);
      expect(prisma.metric.update).toHaveBeenCalledWith({
        where: { id: "metric-1" },
        data: { target: 20 },
      });
      expect(actionLog.record).toHaveBeenCalledWith(
        "user-1",
        "tenant-1",
        "UPDATE_METRIC",
        "metric-1",
        { target: 20 },
      );
    });
  });

  describe("getMetricLogs", () => {
    it("applies date filters when provided", async () => {
      prisma.metric.findFirst.mockResolvedValue(mockMetric);
      prisma.metricLog.findMany.mockResolvedValue([]);

      await service.getMetricLogs("user-1", "tenant-1", "metric-1", {
        from: "2025-01-01",
        to: "2025-01-31",
        limit: 10,
      });

      expect(prisma.metricLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          metricId: "metric-1",
          date: {
            gte: new Date("2025-01-01"),
            lte: new Date("2025-01-31"),
          },
        }),
        orderBy: { date: "desc" },
        take: 10,
        include: {
          metric: {
            select: { id: true, name: true, target: true },
          },
        },
      });
    });
  });
});
