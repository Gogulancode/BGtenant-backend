import { Injectable } from "@nestjs/common";
import { BusinessService } from "../business/business.service";
import { MetricsService } from "../metrics/metrics.service";
import { OutcomesService } from "../outcomes/outcomes.service";
import { ReviewsService } from "../reviews/reviews.service";
import { SalesService } from "../sales/sales.service";
import { ActivitiesService } from "../activities/activities.service";
import { InsightsService } from "../insights/insights.service";
import { PrismaService } from "../prisma/prisma.service";
import { SalesProspectStatus } from "@prisma/client";

type ActivityTemplate = {
  category?: string;
  priority?: string;
  weeklyGoal?: number;
  reminderDays?: number[];
  measurability?: string;
  impact?: string;
  relevance?: string;
  enabled?: boolean;
};

function sum(values: Array<number | null | undefined>): number {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly businessService: BusinessService,
    private readonly metricsService: MetricsService,
    private readonly outcomesService: OutcomesService,
    private readonly reviewsService: ReviewsService,
    private readonly salesService: SalesService,
    private readonly activitiesService: ActivitiesService,
    private readonly insightsService: InsightsService,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const [
      business,
      metrics,
      outcomes,
      reviews,
      sales,
      activities,
      insights,
      user,
      setupChecklist,
      activityConfiguration,
      prospectGroups,
      nextFollowUps,
      achievementStages,
      weeklyActivity,
      weeklyOutcomes,
    ] = await Promise.all([
      this.businessService.getSummary(userId, tenantId),
      this.metricsService.getSummary(userId, tenantId),
      this.outcomesService.getSummary(userId, tenantId),
      this.reviewsService.getSummary(userId, tenantId),
      this.salesService.getSummary(userId, tenantId),
      this.activitiesService.getSummary(userId, tenantId),
      this.insightsService.getSummary(userId, tenantId),
      this.prisma.user.findFirst({
        where: { id: userId, tenantId: tenantId ?? undefined },
        select: { id: true, name: true },
      }),
      tenantId
        ? this.prisma.businessSetupChecklist.findUnique({
            where: { tenantId },
          })
        : Promise.resolve(null),
      tenantId
        ? this.prisma.activityConfiguration.findUnique({
            where: { tenantId },
          })
        : Promise.resolve(null),
      tenantId
        ? this.prisma.salesProspect.groupBy({
            by: ["status"],
            where: { tenantId },
            _count: { _all: true },
            _sum: { proposalValue: true },
          })
        : Promise.resolve([]),
      tenantId
        ? this.prisma.salesProspect.findMany({
            where: {
              tenantId,
              status: {
                in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT],
              },
            },
            orderBy: [{ lastFollowUpAt: "asc" }, { updatedAt: "desc" }],
            take: 5,
            select: {
              prospectName: true,
              status: true,
              proposalValue: true,
              lastFollowUpAt: true,
            },
          })
        : Promise.resolve([]),
      tenantId
        ? this.prisma.achievementStage.findMany({
            where: { tenantId, isActive: true },
            orderBy: { order: "asc" },
          })
        : Promise.resolve([]),
      this.activitiesService.getWeeklySummary(userId, tenantId, {}),
      this.outcomesService.getWeeklySummary(userId, tenantId, {}),
    ]);

    const setup = this.buildSetupCockpit(setupChecklist);
    const cockpit = {
      setup,
      sales: this.buildSalesCockpit(sales),
      activities: this.buildActivityCockpit(
        activities,
        weeklyActivity,
        activityConfiguration,
      ),
      outcomes: {
        planned: weeklyOutcomes.planned,
        completed: weeklyOutcomes.completed,
        completionPercent: weeklyOutcomes.completionPercent,
      },
      crm: this.buildCrmCockpit(prospectGroups, nextFollowUps),
      achievement: this.buildAchievementCockpit(
        achievementStages,
        sales?.targets?.monthlyAchievementPercent ?? 0,
      ),
      insights: {
        momentumScore: insights?.momentumScore ?? 0,
        streakCount: insights?.streakCount ?? 0,
        recommendations: insights?.recommendations ?? [],
      },
    };

    return {
      userName: user?.name ?? "there",
      business,
      metrics,
      outcomes,
      reviews,
      sales,
      activities,
      insights,
      cockpit,
      generatedAt: new Date(),
    };
  }

  private buildSetupCockpit(
    setupChecklist: {
      uspDefined: boolean;
      menuCardDefined: boolean;
      packagesDefined: boolean;
      customerSegmentDefined: boolean;
    } | null,
  ) {
    const items = [
      {
        key: "uspDefined",
        label: "Define USP",
        path: "/settings",
        completed: setupChecklist?.uspDefined ?? false,
      },
      {
        key: "menuCardDefined",
        label: "Create Menu Card",
        path: "/settings",
        completed: setupChecklist?.menuCardDefined ?? false,
      },
      {
        key: "packagesDefined",
        label: "Define Packages",
        path: "/settings",
        completed: setupChecklist?.packagesDefined ?? false,
      },
      {
        key: "customerSegmentDefined",
        label: "Define Customer Segments",
        path: "/settings",
        completed: setupChecklist?.customerSegmentDefined ?? false,
      },
    ];
    const completedCount = items.filter((item) => item.completed).length;
    const nextItem = items.find((item) => !item.completed);

    return {
      completionPercent: Math.round((completedCount / items.length) * 100),
      completedCount,
      totalCount: items.length,
      isComplete: completedCount === items.length,
      nextStepLabel: nextItem?.label ?? "Review Business Profile",
      nextStepPath: nextItem?.path ?? "/reports",
    };
  }

  private buildSalesCockpit(sales: any) {
    const targets = sales?.targets ?? {};
    const weeklyTarget = Number(targets.weeklyTarget) || 0;
    const achievedThisWeek = Number(targets.achievedThisWeek) || 0;
    const monthlyTarget = Number(targets.monthlyTarget) || 0;
    const achievedThisMonth = Number(targets.achievedThisMonth) || 0;

    return {
      monthlyTarget,
      achievedThisMonth,
      monthlyGap: Math.max(0, monthlyTarget - achievedThisMonth),
      monthlyAchievementPercent: Number(targets.monthlyAchievementPercent) || 0,
      weeklyTarget,
      achievedThisWeek,
      weeklyGap: Math.max(0, weeklyTarget - achievedThisWeek),
      weeklyAchievementPercent: Number(targets.weeklyAchievementPercent) || 0,
      daysRemainingInWeek: targets.daysRemainingInWeek ?? 0,
      weeksRemainingInMonth: targets.weeksRemainingInMonth ?? 0,
    };
  }

  private buildActivityCockpit(
    activities: any,
    weeklyActivity: {
      items: Array<{ category: string; target: number; actual: number }>;
      overallCompletionPercent: number;
    },
    activityConfiguration: {
      weeklyActivityGoal?: number | null;
      enableReminders?: boolean;
      reminderDays?: number[];
      activities?: unknown;
    } | null,
  ) {
    const today = new Date().getDay();
    const enabledActivities = toArray<ActivityTemplate>(
      activityConfiguration?.activities,
    ).filter((activity) => activity.enabled !== false);
    const dueToday = enabledActivities.filter((activity) =>
      toArray<number>(activity.reminderDays).includes(today),
    );

    return {
      active: activities?.active ?? 0,
      completed: activities?.completed ?? 0,
      weeklyActivityGoal: activityConfiguration?.weeklyActivityGoal ?? 0,
      targetThisWeek: sum(weeklyActivity.items.map((item) => item.target)),
      actualThisWeek: sum(weeklyActivity.items.map((item) => item.actual)),
      completionPercent: weeklyActivity.overallCompletionPercent,
      enableReminders: activityConfiguration?.enableReminders ?? false,
      reminderDays: activityConfiguration?.reminderDays ?? [],
      dueToday,
      weeklyItems: weeklyActivity.items,
    };
  }

  private buildCrmCockpit(
    prospectGroups: Array<{
      status: SalesProspectStatus;
      _count: { _all: number };
      _sum: { proposalValue: number | null };
    }>,
    nextFollowUps: Array<{
      prospectName: string;
      status: SalesProspectStatus;
      proposalValue: number | null;
      lastFollowUpAt: Date | null;
    }>,
  ) {
    const byStatus = prospectGroups.reduce<Record<string, number>>(
      (totals, group) => {
        totals[group.status] = group._count._all;
        return totals;
      },
      {},
    );

    return {
      totalProspects: sum(prospectGroups.map((group) => group._count._all)),
      pipelineValue: sum(
        prospectGroups.map((group) => group._sum.proposalValue),
      ),
      convertedValue: sum(
        prospectGroups
          .filter((group) => group.status === SalesProspectStatus.CONVERTED)
          .map((group) => group._sum.proposalValue),
      ),
      activeFollowUps:
        (byStatus[SalesProspectStatus.WARM] || 0) +
        (byStatus[SalesProspectStatus.HOT] || 0),
      byStatus,
      nextFollowUps,
    };
  }

  private buildAchievementCockpit(
    stages: Array<{
      id: string;
      name: string;
      order: number;
      targetValue: number;
      percentOfGoal: number | null;
      reward: string | null;
      isActive: boolean;
    }>,
    progressPercent: number,
  ) {
    const currentStage =
      stages
        .filter((stage) => (stage.percentOfGoal ?? 0) <= progressPercent)
        .at(-1) ?? null;
    const nextStage =
      stages.find((stage) => (stage.percentOfGoal ?? 0) > progressPercent) ??
      null;

    return {
      progressPercent,
      currentStage,
      nextStage,
      stages,
    };
  }
}
