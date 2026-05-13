import { Injectable } from "@nestjs/common";
import { SalesProspectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DashboardGuidanceDto,
  GuidanceCardDto,
  GuidanceSignalDto,
} from "./dto/dashboard-guidance.dto";

function percent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfWeek(date = new Date()): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? 6 : day - 1;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function getWeekNumberInYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return Math.min(weekNo, 52);
}

function getIsoWeeksForMonth(year: number, month: number): number[] {
  const weeks = new Set<number>();
  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    weeks.add(getWeekNumberInYear(new Date(year, month - 1, day)));
  }

  return Array.from(weeks);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class DashboardGuidanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getGuidance(
    userId: string,
    tenantId: string | null | undefined,
  ): Promise<DashboardGuidanceDto> {
    if (!tenantId) {
      return {
        summary: {
          title: "Today's Focus",
          message: "Sign in with a tenant workspace to see your coaching focus.",
          tone: "encouraging",
          healthScore: 0,
        },
        cards: [],
        signals: [],
        generatedAt: new Date(),
      };
    }

    const month = currentMonthKey();
    const weekStart = startOfWeek();
    const now = new Date();
    const year = now.getFullYear();
    const monthNumber = now.getMonth() + 1;
    const monthWeeks = getIsoWeeksForMonth(year, monthNumber);

    const [
      onboarding,
      setup,
      businessIdentity,
      salesPlan,
      salesTracker,
      weeklySalesEntries,
      prospectCount,
      followUps,
      weeklyActivityCount,
      activityConfiguration,
    ] = await Promise.all([
      this.prisma.onboardingProgress.findUnique({ where: { tenantId } }),
      this.prisma.businessSetupChecklist.findUnique({ where: { tenantId } }),
      this.prisma.businessIdentity.findUnique({ where: { tenantId } }),
      this.prisma.salesPlan.findUnique({ where: { tenantId } }),
      this.prisma.salesTracker.findUnique({
        where: { tenantId_userId_month: { tenantId, userId, month } },
      }),
      this.prisma.weeklySalesEntry.findMany({
        where: {
          tenantId,
          userId,
          year,
          week: { in: monthWeeks },
        },
        select: { achieved: true },
      }),
      this.prisma.salesProspect.count({ where: { tenantId, userId } }),
      this.prisma.salesProspect.findMany({
        where: {
          tenantId,
          userId,
          status: { in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT] },
        },
        orderBy: [{ lastFollowUpAt: "asc" }, { updatedAt: "desc" }],
        take: 3,
        select: {
          prospectName: true,
          status: true,
          proposalValue: true,
          lastFollowUpAt: true,
        },
      }),
      this.prisma.activity.count({
        where: {
          tenantId,
          userId,
          createdAt: { gte: weekStart },
        },
      }),
      this.prisma.activityConfiguration.findUnique({ where: { tenantId } }),
    ]);

    const cards: GuidanceCardDto[] = [];
    const signals: GuidanceSignalDto[] = [];

    const legacySetupComplete =
      Boolean(setup?.uspDefined) &&
      Boolean(setup?.menuCardDefined) &&
      Boolean(setup?.packagesDefined) &&
      Boolean(setup?.customerSegmentDefined);
    const setupComplete =
      Boolean(onboarding?.isCompleted) ||
      (
        Boolean(onboarding?.businessIdentityCompleted) ||
        Boolean(businessIdentity?.companyName && businessIdentity?.usp) ||
        legacySetupComplete
      ) &&
        (
          Boolean(onboarding?.salesPlanCompleted) ||
          Boolean(salesPlan?.projectedYearValue)
        ) &&
        (
          Boolean(onboarding?.activityConfigCompleted) ||
          Boolean(activityConfiguration?.weeklyActivityGoal)
        );

    if (!setupComplete) {
      cards.push({
        id: "complete-business-setup",
        type: "next_action",
        priority: "high",
        title: "Finish your setup next",
        message:
          "A few setup details are still open. Complete them so your sales plan, activity rhythm, and profile stay aligned.",
        actionLabel: "Finish setup",
        actionRoute: "/setup",
        source: "setup",
      });
    }

    const monthlyTarget =
      Number(salesTracker?.target) ||
      Number(salesPlan?.monthlyTargets?.[new Date().getMonth()]) ||
      0;
    const monthlyAchieved =
      weeklySalesEntries.length > 0
        ? weeklySalesEntries.reduce(
            (total, entry) => total + (Number(entry.achieved) || 0),
            0,
          )
        : Number(salesTracker?.achieved) || 0;
    const monthlyProgress = percent(monthlyAchieved, monthlyTarget);

    if (monthlyTarget > 0) {
      signals.push({
        key: "monthly_target_progress",
        label: "Monthly target progress",
        value: monthlyProgress,
        unit: "percent",
        status:
          monthlyProgress >= 70
            ? "good"
            : monthlyProgress >= 35
              ? "watch"
              : "risk",
      });
    }

    if (monthlyTarget > 0 && monthlyProgress < 70) {
      cards.push({
        id: "sales-gap-followups",
        type: "next_action",
        priority: "high",
        title: "Close the sales gap",
        message: `You're ${monthlyProgress}% toward this month's target. A focused follow-up today can protect the month.`,
        actionLabel: "Log sales",
        actionRoute: "/sales",
        source: "sales",
      });
    }

    signals.push({
      key: "crm_prospect_count",
      label: "CRM prospects",
      value: prospectCount,
      unit: "count",
      status: prospectCount >= 3 ? "good" : "watch",
    });

    if (prospectCount === 0) {
      cards.push({
        id: "add-first-prospects",
        type: "next_action",
        priority: "medium",
        title: "Build your first follow-up list",
        message:
          "Start with three prospects you can contact this week. Small lists create real rhythm.",
        actionLabel: "Add prospects",
        actionRoute: "/sales/prospects",
        source: "crm",
      });
    } else if (followUps.length > 0) {
      const prospect = followUps[0];
      cards.push({
        id: `crm-followup-${slug(prospect.prospectName)}`,
        type: "next_action",
        priority:
          prospect.status === SalesProspectStatus.HOT ? "high" : "medium",
        title: `Follow up with ${prospect.prospectName}`,
        message:
          "This prospect is already warm. A timely follow-up can move the conversation forward.",
        actionLabel: "Follow up",
        actionRoute: "/sales/prospects",
        source: "crm",
      });
    }

    const weeklyGoal = Number(activityConfiguration?.weeklyActivityGoal) || 0;
    const activityProgress = percent(weeklyActivityCount, weeklyGoal);

    if (weeklyGoal > 0) {
      signals.push({
        key: "weekly_activity_progress",
        label: "Weekly activity rhythm",
        value: activityProgress,
        unit: "percent",
        status:
          activityProgress >= 70
            ? "good"
            : activityProgress >= 35
              ? "watch"
              : "risk",
      });
    }

    if (weeklyGoal > 0 && activityProgress < 70) {
      cards.push({
        id: "activity-rhythm",
        type: "next_action",
        priority: "medium",
        title: "Rebuild today's activity rhythm",
        message: `You've logged ${weeklyActivityCount} of ${weeklyGoal} planned activities this week. Add one useful action today.`,
        actionLabel: "Add activity",
        actionRoute: "/activities",
        source: "activity",
      });
    }

    if (cards.length === 0) {
      cards.push({
        id: "momentum-on-track",
        type: "celebration",
        priority: "low",
        title: "Your rhythm is on track",
        message:
          "You have the core pieces moving. Review your dashboard and keep one meaningful follow-up active today.",
        actionLabel: "Review dashboard",
        actionRoute: "/dashboard",
        source: "profile",
      });
    }

    const healthScore = Math.round(
      [
        setupComplete ? 100 : 50,
        monthlyTarget > 0 ? monthlyProgress : 50,
        prospectCount >= 3 ? 100 : prospectCount * 25,
        weeklyGoal > 0 ? activityProgress : 50,
      ].reduce((total, item) => total + item, 0) / 4,
    );
    const primaryCard = cards[0];

    return {
      summary: {
        title: primaryCard.title,
        message: primaryCard.message,
        tone: "encouraging",
        healthScore,
      },
      cards: cards.slice(0, 5),
      signals,
      generatedAt: new Date(),
    };
  }
}
