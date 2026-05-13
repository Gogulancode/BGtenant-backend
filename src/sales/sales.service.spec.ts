import { SalesService } from "./sales.service";
import { SalesTargetsService } from "./sales-targets.service";
import { PrismaService } from "../prisma/prisma.service";

const userId = "user-sales";
const tenantId = "tenant-sales";

describe("SalesService summary validation", () => {
  let service: SalesService;
  let salesTargetsService: SalesTargetsService;
  let prisma: {
    salesPlanning: { findFirst: jest.Mock };
    salesTracker: { findFirst: jest.Mock };
    salesPlan: { findUnique: jest.Mock };
    weeklySalesEntry: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2025-02-15T12:00:00.000Z"));
    prisma = {
      salesPlanning: { findFirst: jest.fn() },
      salesTracker: { findFirst: jest.fn() },
      salesPlan: { findUnique: jest.fn() },
      weeklySalesEntry: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    salesTargetsService = new SalesTargetsService(prisma as unknown as PrismaService);
    service = new SalesService(
      prisma as unknown as PrismaService,
      salesTargetsService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("derives weekly, daily, and rollup insights when plan and tracker exist", async () => {
    const planning = {
      id: "plan-2025",
      year: 2025,
      q1: 52000,
      q2: 0,
      q3: 0,
      q4: 0,
      growthPct: 0,
    };
    const tracker = {
      id: "tracker-feb",
      month: "2025-02",
      target: 12000,
      achieved: 6000,
      orders: 12,
      asp: 450,
      profit: 1800,
    };

    prisma.salesPlanning.findFirst.mockResolvedValue(planning);
    prisma.salesTracker.findFirst.mockImplementation(({ where }) => {
      if (where.month === "2025-02") {
        return Promise.resolve(tracker);
      }
      return Promise.resolve(null);
    });

    const summary = await service.getSummary(userId, tenantId);

    expect(summary.validation.weeklyPlan).toMatchObject({
      status: "CONFIGURED",
      weeklyTarget: Number(((planning.q1 ?? 0) / 13).toFixed(2)),
      isConfigured: true,
    });
    expect(summary.validation.dailyTracker.status).toBe("CURRENT");
    expect(summary.validation.planVsActual.status).toBe("OFF_TRACK");
    expect(summary.validation.weeklyRollover.status).toBe("NOT_REQUIRED");
  });

  it("flags rollover gaps when moving into a new month without tracker data", async () => {
    jest.setSystemTime(new Date("2025-03-03T12:00:00.000Z"));
    const planning = {
      id: "plan-2025",
      year: 2025,
      q1: 26000,
      q2: 0,
      q3: 0,
      q4: 0,
      growthPct: 0,
    };
    const previousTracker = {
      id: "tracker-feb",
      month: "2025-02",
      target: 10000,
      achieved: 8000,
      orders: 15,
      asp: 500,
      profit: 2500,
    };

    prisma.salesPlanning.findFirst.mockResolvedValue(planning);
    prisma.salesTracker.findFirst.mockImplementation(({ where }) => {
      if (where.month === "2025-03") {
        return Promise.resolve(null);
      }
      if (where.month === "2025-02") {
        return Promise.resolve(previousTracker);
      }
      return Promise.resolve(null);
    });

    const summary = await service.getSummary(userId, tenantId);

    expect(summary.validation.weeklyRollover).toMatchObject({
      status: "BLOCKED",
      requiresRollover: true,
      currentMonth: "2025-03",
      previousMonth: "2025-02",
    });
    expect(summary.validation.dailyTracker.status).toBe("MISSING");
    expect(summary.validation.planVsActual.status).toBe("OFF_TRACK");
  });
});
