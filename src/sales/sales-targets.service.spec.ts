import { SalesTargetsService } from "./sales-targets.service";
import { PrismaService } from "../prisma/prisma.service";

const userId = "user-sales-targets";
const tenantId = "tenant-sales-targets";

function createPrismaMock() {
  return {
    salesPlan: {
      findUnique: jest.fn().mockResolvedValue({
        projectedYearValue: 1200000,
        monthlyContribution: Array(12).fill(100 / 12),
        monthlyTargets: Array(12).fill(120000),
      }),
    },
    salesTracker: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    weeklySalesEntry: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    achievementStage: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe("SalesTargetsService", () => {
  let service: SalesTargetsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-13T12:00:00.000Z"));
    prisma = createPrismaMock();
    service = new SalesTargetsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses weekly sales entries for current dashboard achievement values", async () => {
    prisma.weeklySalesEntry.findMany.mockResolvedValue([
      { week: 20, achieved: 50000 },
    ]);

    const result = await service.getCurrentPeriodTargets(userId, tenantId);

    expect(result).toMatchObject({
      currentMonth: 5,
      currentWeek: 20,
      monthlyTarget: 120000,
      weeklyTarget: 30000,
      achievedThisMonth: 50000,
      achievedThisWeek: 50000,
      monthlyAchievementPercent: 41.67,
      weeklyAchievementPercent: 166.67,
    });
    expect(prisma.weeklySalesEntry.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        tenantId,
        year: 2026,
        week: { in: expect.arrayContaining([20]) },
      },
      select: { week: true, achieved: true },
    });
  });

  it("falls back to legacy monthly tracker values when weekly entries are absent", async () => {
    prisma.salesTracker.findFirst.mockResolvedValue({ achieved: 40000 });

    const result = await service.getCurrentPeriodTargets(userId, tenantId);

    expect(result.achievedThisMonth).toBe(40000);
    expect(result.achievedThisWeek).toBeGreaterThan(0);
  });

  it("uses weekly entries before monthly tracker distribution in weekly summaries", async () => {
    prisma.weeklySalesEntry.findMany.mockResolvedValue([
      { week: 20, achieved: 50000 },
    ]);
    prisma.salesTracker.findMany.mockResolvedValue([
      { month: "2026-05", achieved: 120000 },
    ]);

    const result = await service.getWeeklySummary(tenantId, 2026, 20, 20);

    expect(result.items).toEqual([
      {
        week: 20,
        target: 24000,
        achieved: 50000,
        achievementPercent: 208.33,
        stage: null,
      },
    ]);
  });
});
