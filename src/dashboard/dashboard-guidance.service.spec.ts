import { SalesProspectStatus } from "@prisma/client";
import { DashboardGuidanceService } from "./dashboard-guidance.service";
import { PrismaService } from "../prisma/prisma.service";

const userId = "user-guidance";
const tenantId = "tenant-guidance";

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  const prisma = {
    onboardingProgress: {
      findUnique: jest.fn().mockResolvedValue({
        tenantId,
        isCompleted: false,
        profileCompleted: true,
        businessIdentityCompleted: false,
        salesPlanCompleted: true,
        activityConfigCompleted: false,
        salesCycleCompleted: true,
        achievementStagesCompleted: true,
        subscriptionCompleted: true,
        visualSetupCompleted: false,
      }),
    },
    businessSetupChecklist: {
      findUnique: jest.fn().mockResolvedValue({
        uspDefined: true,
        menuCardDefined: true,
        packagesDefined: false,
        customerSegmentDefined: true,
      }),
    },
    businessIdentity: {
      findUnique: jest.fn().mockResolvedValue({
        companyName: "Bridge Gaps",
        usp: "Accountability operating system for growing businesses",
      }),
    },
    salesPlan: {
      findUnique: jest.fn().mockResolvedValue({
        projectedYearValue: 1200000,
        monthlyTargets: [
          100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000,
          100000, 100000, 100000, 100000,
        ],
        averageTicketSize: 25000,
        conversionRatio: 25,
        existingCustomerContribution: 40,
        newCustomerContribution: 60,
      }),
    },
    salesTracker: {
      findUnique: jest.fn().mockResolvedValue({
        target: 100000,
        achieved: 42000,
      }),
    },
    weeklySalesEntry: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    salesProspect: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    activity: {
      count: jest.fn().mockResolvedValue(1),
    },
    activityConfiguration: {
      findUnique: jest.fn().mockResolvedValue({
        weeklyActivityGoal: 5,
        enableReminders: true,
      }),
    },
    ...overrides,
  } as unknown as PrismaService;

  return prisma;
}

describe("DashboardGuidanceService", () => {
  it("returns setup guidance when onboarding or business setup is incomplete", async () => {
    const service = new DashboardGuidanceService(
      createPrismaMock({
        businessIdentity: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    const result = await service.getGuidance(userId, tenantId);

    expect(result.summary.title).toBe("Finish your setup next");
    expect(result.summary.journeyStage).toBe("Foundation");
    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "complete-business-setup",
          source: "setup",
          priority: "high",
          why: expect.any(String),
          impactMetric: "setup_completion",
          afterActionMessage: expect.any(String),
          actionRoute: "/setup",
        }),
      ]),
    );
  });

  it("returns starter CRM guidance when there are no prospects", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "add-first-prospects",
          source: "crm",
          actionLabel: "Add prospects",
          actionRoute: "/sales/prospects",
        }),
      ]),
    );
  });

  it("returns weekly sales guidance when setup is complete but current week sales are missing", async () => {
    const service = new DashboardGuidanceService(
      createPrismaMock({
        onboardingProgress: {
          findUnique: jest.fn().mockResolvedValue({
            tenantId,
            isCompleted: true,
            profileCompleted: true,
            businessIdentityCompleted: true,
            salesPlanCompleted: true,
            activityConfigCompleted: true,
            salesCycleCompleted: true,
            achievementStagesCompleted: true,
            subscriptionCompleted: true,
            visualSetupCompleted: true,
          }),
        },
      }),
    );

    const result = await service.getGuidance(userId, tenantId);

    expect(result.summary.journeyStage).toBe("Rhythm");
    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "log-weekly-sales",
          source: "sales",
          impactMetric: "weekly_sales",
          why: expect.any(String),
          afterActionMessage: expect.any(String),
        }),
      ]),
    );
  });

  it("returns sales gap guidance when monthly achievement is behind target", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sales-gap-followups",
          source: "sales",
          priority: "high",
          impactMetric: "sales_gap",
          why: expect.any(String),
          actionRoute: "/sales",
        }),
      ]),
    );
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "monthly_target_progress",
          value: 42,
          status: "watch",
        }),
      ]),
    );
  });

  it("returns CRM follow-up guidance for warm or hot prospects", async () => {
    const prisma = createPrismaMock({
      weeklySalesEntry: {
        findMany: jest.fn().mockResolvedValue([{ week: 20, achieved: 75000 }]),
      },
      salesProspect: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "prospect-1",
            prospectName: "Acme Traders",
            status: SalesProspectStatus.HOT,
            proposalValue: 75000,
            lastFollowUpAt: new Date("2026-05-07T00:00:00.000Z"),
          },
        ]),
      },
    });
    const service = new DashboardGuidanceService(prisma);

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crm-followup-acme-traders",
          source: "crm",
          actionLabel: "Follow up",
          why: expect.any(String),
        }),
      ]),
    );
  });

  it("returns activity rhythm guidance when weekly activity is below configured goal", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "activity-rhythm",
          source: "activity",
          actionRoute: "/activities",
        }),
      ]),
    );
  });

  it("uses tenant and user filters for tenant scoped data", async () => {
    const prisma = createPrismaMock() as unknown as {
      onboardingProgress: { findUnique: jest.Mock };
      businessSetupChecklist: { findUnique: jest.Mock };
      businessIdentity: { findUnique: jest.Mock };
      salesPlan: { findUnique: jest.Mock };
      salesTracker: { findUnique: jest.Mock };
      weeklySalesEntry: { findMany: jest.Mock };
      salesProspect: { count: jest.Mock; findMany: jest.Mock };
      activity: { count: jest.Mock };
      activityConfiguration: { findUnique: jest.Mock };
    };
    const service = new DashboardGuidanceService(
      prisma as unknown as PrismaService,
    );

    await service.getGuidance(userId, tenantId);

    expect(prisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
      where: { tenantId },
    });
    expect(prisma.businessIdentity.findUnique).toHaveBeenCalledWith({
      where: { tenantId },
    });
    expect(prisma.salesTracker.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_userId_month: expect.objectContaining({ tenantId, userId }),
      },
    });
    expect(prisma.weeklySalesEntry.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        userId,
        year: expect.any(Number),
        week: { in: expect.any(Array) },
      },
      select: { week: true, achieved: true },
    });
    expect(prisma.salesProspect.count).toHaveBeenCalledWith({
      where: { tenantId, userId },
    });
    expect(prisma.activity.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId, userId }),
    });
  });
});
