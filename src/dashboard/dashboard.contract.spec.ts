import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";
import { DashboardGuidanceService } from "./dashboard-guidance.service";
import { BusinessService } from "../business/business.service";
import { MetricsService } from "../metrics/metrics.service";
import { OutcomesService } from "../outcomes/outcomes.service";
import { ReviewsService } from "../reviews/reviews.service";
import { SalesService } from "../sales/sales.service";
import { ActivitiesService } from "../activities/activities.service";
import { InsightsService } from "../insights/insights.service";
import { PrismaService } from "../prisma/prisma.service";

const mockSummary = (label: string) => ({ label, timestamp: Date.now() });

function createService() {
  const dependencies = {
    businessService: {
      getSummary: jest.fn().mockResolvedValue(mockSummary("business")),
    } as unknown as BusinessService,
    metricsService: {
      getSummary: jest.fn().mockResolvedValue(mockSummary("metrics")),
    } as unknown as MetricsService,
    outcomesService: {
      getSummary: jest.fn().mockResolvedValue(mockSummary("outcomes")),
    } as unknown as OutcomesService,
    reviewsService: {
      getSummary: jest.fn().mockResolvedValue(mockSummary("reviews")),
    } as unknown as ReviewsService,
    salesService: {
      getSummary: jest.fn().mockResolvedValue(mockSummary("sales")),
    } as unknown as SalesService,
    activitiesService: {
      getSummary: jest.fn().mockResolvedValue(mockSummary("activities")),
    } as unknown as ActivitiesService,
    insightsService: {
      getSummary: jest.fn().mockResolvedValue({
        ...mockSummary("insights"),
        momentumScore: 68,
        streakCount: 4,
        recommendations: ["Complete the highest-impact sales follow-up today."],
      }),
    } as unknown as InsightsService,
    prisma: {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-contract",
          name: "Asha Owner",
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
      activityConfiguration: {
        findUnique: jest.fn().mockResolvedValue({
          weeklyActivityGoal: 7,
          enableReminders: true,
          reminderDays: [1, 3, 5],
          activities: [
            {
              category: "Sales follow-ups",
              priority: "HIGH",
              weeklyGoal: 5,
              reminderDays: [1, 3, 5],
              measurability: "Follow-ups completed",
              impact: "Move warm leads to closure",
              relevance: "BOTH",
              enabled: true,
            },
          ],
        }),
      },
      salesProspect: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: "WARM",
            _count: { _all: 2 },
            _sum: { proposalValue: 125000 },
          },
          {
            status: "CONVERTED",
            _count: { _all: 1 },
            _sum: { proposalValue: 50000 },
          },
        ]),
        findMany: jest.fn().mockResolvedValue([
          {
            prospectName: "Acme Traders",
            status: "WARM",
            proposalValue: 75000,
            lastFollowUpAt: new Date("2026-05-07T00:00:00.000Z"),
          },
        ]),
      },
      achievementStage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "stage-1",
            name: "Foundation",
            order: 1,
            targetValue: 300000,
            percentOfGoal: 25,
            reward: "Foundation systems active",
            isActive: true,
          },
          {
            id: "stage-2",
            name: "Growth",
            order: 2,
            targetValue: 600000,
            percentOfGoal: 50,
            reward: "Growth engine active",
            isActive: true,
          },
        ]),
      },
    } as unknown as PrismaService,
  } as const;

  (dependencies.salesService.getSummary as jest.Mock).mockResolvedValue({
    targets: {
      monthlyTarget: 200000,
      weeklyTarget: 50000,
      achievedThisMonth: 80000,
      achievedThisWeek: 25000,
      monthlyAchievementPercent: 40,
      weeklyAchievementPercent: 50,
      daysRemainingInWeek: 3,
      weeksRemainingInMonth: 3,
    },
  });

  (dependencies.activitiesService.getSummary as jest.Mock).mockResolvedValue({
    active: 5,
    completed: 2,
  });

  (dependencies.activitiesService as unknown as { getWeeklySummary: jest.Mock })
    .getWeeklySummary = jest.fn().mockResolvedValue({
    year: 2026,
    week: 19,
    items: [{ category: "Sales follow-ups", target: 7, actual: 3 }],
    overallCompletionPercent: 43,
  });

  (dependencies.outcomesService as unknown as { getWeeklySummary: jest.Mock })
    .getWeeklySummary = jest.fn().mockResolvedValue({
    planned: 5,
    completed: 3,
    completionPercent: 60,
  });

  const service = new DashboardService(
    dependencies.businessService,
    dependencies.metricsService,
    dependencies.outcomesService,
    dependencies.reviewsService,
    dependencies.salesService,
    dependencies.activitiesService,
    dependencies.insightsService,
    dependencies.prisma,
  );

  return { service, dependencies };
}

describe("Dashboard summary contract", () => {
  it("aggregates module summaries and preserves generated timestamp", async () => {
    const { service, dependencies } = createService();
    const result = await service.getSummary("user-contract", "tenant-contract");

    expect(result).toMatchObject({
      business: expect.any(Object),
      metrics: expect.any(Object),
      outcomes: expect.any(Object),
      reviews: expect.any(Object),
      sales: expect.any(Object),
      activities: expect.any(Object),
      insights: expect.any(Object),
    });
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.userName).toBe("Asha Owner");
    expect(result.cockpit).toMatchObject({
      setup: {
        completionPercent: 75,
        nextStepLabel: "Define Packages",
      },
      sales: {
        weeklyTarget: 50000,
        achievedThisWeek: 25000,
        weeklyGap: 25000,
        weeklyAchievementPercent: 50,
      },
      activities: {
        weeklyActivityGoal: 7,
        actualThisWeek: 3,
        completionPercent: 43,
        dueToday: expect.any(Array),
      },
      outcomes: {
        planned: 5,
        completed: 3,
        completionPercent: 60,
      },
      crm: {
        totalProspects: 3,
        pipelineValue: 175000,
        convertedValue: 50000,
        activeFollowUps: 2,
      },
      achievement: {
        currentStage: expect.objectContaining({ name: "Foundation" }),
        nextStage: expect.objectContaining({ name: "Growth" }),
      },
    });

    const modules = [
      dependencies.businessService,
      dependencies.metricsService,
      dependencies.outcomesService,
      dependencies.reviewsService,
      dependencies.salesService,
      dependencies.activitiesService,
      dependencies.insightsService,
    ];

    modules.forEach((dep) => {
      expect(dep.getSummary).toHaveBeenCalledWith(
        "user-contract",
        "tenant-contract",
      );
    });
  });

  it("delegates guidance requests to the guidance service with tenant context", async () => {
    const guidanceService = {
      getGuidance: jest.fn().mockResolvedValue({
        summary: {
          title: "Today's Focus",
          message: "Keep one meaningful follow-up active today.",
          tone: "encouraging",
          healthScore: 75,
        },
        cards: [],
        signals: [],
        generatedAt: new Date("2026-05-13T00:00:00.000Z"),
      }),
    } as unknown as DashboardGuidanceService;

    const controller = new DashboardController(
      {} as DashboardService,
      guidanceService,
    );

    await expect(
      controller.getGuidance({
        userId: "user-contract",
        email: "owner@example.com",
        role: "TENANT_ADMIN" as never,
        tenantId: "tenant-contract",
      }),
    ).resolves.toMatchObject({
      summary: {
        title: "Today's Focus",
        tone: "encouraging",
      },
    });

    expect(guidanceService.getGuidance).toHaveBeenCalledWith(
      "user-contract",
      "tenant-contract",
    );
  });
});
