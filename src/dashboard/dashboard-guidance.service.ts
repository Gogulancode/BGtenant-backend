import { Injectable } from "@nestjs/common";
import { SalesProspectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DashboardGuidanceDto,
  GuidanceCardDto,
  GuidanceJourneyStage,
  GuidanceSignalDto,
} from "./dto/dashboard-guidance.dto";

const WEEKS_PER_MONTH = [5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4];

function percent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((numerator / denominator) * 100)),
  );
}

function formatCurrencyINR(value: number): string {
  return `Rs ${Math.round(Math.max(0, value)).toLocaleString("en-IN")}`;
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
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
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

function getJourneyStage(input: {
  setupComplete: boolean;
  hasCurrentWeeklySalesEntry: boolean;
  monthlyProgress: number;
  prospectCount: number;
  activityProgress: number;
  weeklyGoal: number;
}): GuidanceJourneyStage {
  if (!input.setupComplete) return "Foundation";
  if (!input.hasCurrentWeeklySalesEntry) return "Rhythm";
  if (input.prospectCount < 3) return "Pipeline";
  if (input.monthlyProgress < 70 || input.activityProgress < 70) {
    return "Growth";
  }
  if (input.weeklyGoal === 0) return "Rhythm";
  return "Scale";
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
          message:
            "Sign in with a tenant workspace to see your coaching focus.",
          tone: "encouraging",
          healthScore: 0,
          journeyStage: "Foundation",
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
        select: { week: true, achieved: true },
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
      ((Boolean(onboarding?.businessIdentityCompleted) ||
        Boolean(businessIdentity?.companyName && businessIdentity?.usp) ||
        legacySetupComplete) &&
        (Boolean(onboarding?.salesPlanCompleted) ||
          Boolean(salesPlan?.projectedYearValue)) &&
        (Boolean(onboarding?.activityConfigCompleted) ||
          Boolean(activityConfiguration?.weeklyActivityGoal)));

    if (!setupComplete) {
      cards.push({
        id: "complete-business-setup",
        type: "next_action",
        priority: "high",
        title: "Finish your setup next",
        message:
          "A few setup details are still open. Complete them so your sales plan, activity rhythm, and profile stay aligned.",
        why: "A complete setup lets the coach connect your goals, activity rhythm, and profile into one operating plan.",
        actionLabel: "Finish setup",
        actionRoute: "/setup",
        source: "setup",
        impactMetric: "setup_completion",
        afterActionMessage:
          "Good. Your foundation is stronger now. Next, keep the week moving with sales and activity rhythm.",
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
    const currentWeek = getWeekNumberInYear(now);
    const hasCurrentWeeklySalesEntry = weeklySalesEntries.some(
      (entry) => entry.week === currentWeek,
    );
    const currentWeekAchieved =
      weeklySalesEntries.find((entry) => entry.week === currentWeek)
        ?.achieved ?? 0;
    const weeklyTarget =
      monthlyTarget > 0
        ? monthlyTarget / (WEEKS_PER_MONTH[monthNumber - 1] || 4)
        : 0;
    const weeklyRemaining = Math.max(0, weeklyTarget - currentWeekAchieved);

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

    if (setupComplete && monthlyTarget > 0 && !hasCurrentWeeklySalesEntry) {
      cards.push({
        id: "log-weekly-sales",
        type: "next_action",
        priority: "high",
        title: "Log this week's sales",
        message:
          "Your setup is ready. Add this week's sales so the coach can show the true gap and next move.",
        why: "Weekly sales is the pulse check that keeps targets, reports, and next actions accurate.",
        actionLabel: "Log sales",
        actionRoute: "/sales",
        source: "sales",
        impactMetric: "weekly_sales",
        afterActionMessage:
          "Good. Your sales pulse is updated. Next, close the loop with one follow-up or activity.",
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
        why: "A visible pipeline gives every sales week a practical starting point.",
        actionLabel: "Add prospects",
        actionRoute: "/sales/prospects",
        source: "crm",
        impactMetric: "crm_pipeline",
        afterActionMessage:
          "Nice. Your pipeline has started. Next, add a follow-up date for the warmest prospect.",
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
        why: "Warm and hot prospects usually need a clear next touch before they cool down.",
        actionLabel: "Follow up",
        actionRoute: "/sales/prospects",
        source: "crm",
        impactMetric: "crm_pipeline",
        afterActionMessage:
          "Good follow-up. Next, log the outcome so your pipeline stays current.",
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
        why: "Activity rhythm is the habit layer that turns the sales plan into daily movement.",
        actionLabel: "Add activity",
        actionRoute: "/activities",
        source: "activity",
        impactMetric: "activity_rhythm",
        afterActionMessage:
          "Good. Your rhythm improved. Next, connect this action to a prospect or weekly outcome.",
      });
    }

    if (
      hasCurrentWeeklySalesEntry &&
      monthlyTarget > 0 &&
      monthlyProgress < 70
    ) {
      const hasProspectAction = prospectCount > 0 || followUps.length > 0;
      const needsActivityAction = weeklyGoal > 0 && activityProgress < 100;

      cards.push({
        id: "execution-gap-action",
        type: "next_action",
        priority: weeklyRemaining > 0 ? "high" : "medium",
        title:
          weeklyRemaining > 0
            ? "Turn the gap into follow-ups"
            : "Protect this week's momentum",
        message:
          weeklyRemaining > 0
            ? `Sales shows ${formatCurrencyINR(weeklyRemaining)} still pending this week. The next useful move is not more tracking; it is one follow-up or one activity that can create the next order.`
            : `Sales is logged and the weekly target is cleared. Keep momentum by creating the next follow-up or activity, so next week's sales has a source.`,
        why: "Sales is the result. Follow-ups, activities, and pipeline actions are the controllable inputs.",
        actionLabel: hasProspectAction
          ? "Follow up"
          : needsActivityAction
            ? "Add activity"
            : "Add prospects",
        actionRoute: hasProspectAction
          ? "/sales/prospects"
          : needsActivityAction
            ? "/activities"
            : "/sales/prospects",
        source: hasProspectAction
          ? "crm"
          : needsActivityAction
            ? "activity"
            : "crm",
        impactMetric: hasProspectAction ? "crm_pipeline" : "activity_rhythm",
        afterActionMessage:
          "Good. You moved the input that creates future sales. Keep the loop clean by logging the outcome.",
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
        why: "A healthy week is the right time to review the profile and raise the quality of your next actions.",
        actionLabel: "Review dashboard",
        actionRoute: "/dashboard",
        source: "profile",
        impactMetric: "business_profile",
        afterActionMessage:
          "Good. Keep the week clean by reviewing one growth action before the next check-in.",
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
    const journeyStage = getJourneyStage({
      setupComplete,
      hasCurrentWeeklySalesEntry,
      monthlyProgress,
      prospectCount,
      activityProgress,
      weeklyGoal,
    });

    return {
      summary: {
        title: primaryCard.title,
        message: primaryCard.message,
        tone: "encouraging",
        healthScore,
        journeyStage,
      },
      cards: cards.slice(0, 5),
      signals,
      generatedAt: new Date(),
    };
  }
}
