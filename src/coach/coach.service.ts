import { Injectable } from "@nestjs/common";
import { SalesProspectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { formatMonthKey, getWeekNumber } from "../common/utils/date.utils";
import {
  CoachActionDto,
  CoachActionPriority,
  CoachActionSource,
  CoachCatchUpDto,
  CoachGuidanceResponseDto,
  CoachState,
} from "./dto/coach.dto";

const WEEKS_PER_MONTH = [5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4];
const CATCH_UP_ACTION = "catch_up_completed";

type CoachSnapshot = {
  setupComplete: boolean;
  catchUpCompleted: boolean;
  completedAt?: Date | null;
  weeklyTarget: number;
  achievedSoFar: number;
  activityDone: number;
  activityGoal: number;
  followupsDue: number;
  prospectCount: number;
};

@Injectable()
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  async getToday(
    userId: string,
    tenantId: string | null | undefined,
    date = new Date(),
  ): Promise<CoachGuidanceResponseDto> {
    const scopedTenantId = assertTenantContext(tenantId);
    const snapshot = await this.loadSnapshot(userId, scopedTenantId, date);
    return this.buildGuidance(snapshot, date);
  }

  async getSales(userId: string, tenantId: string | null | undefined) {
    return this.getToday(userId, tenantId);
  }

  async getActivities(userId: string, tenantId: string | null | undefined) {
    return this.getToday(userId, tenantId);
  }

  async getCrm(userId: string, tenantId: string | null | undefined) {
    return this.getToday(userId, tenantId);
  }

  async saveCatchUp(
    userId: string,
    tenantId: string | null | undefined,
    dto: CoachCatchUpDto,
    date = new Date(),
  ): Promise<CoachGuidanceResponseDto> {
    const scopedTenantId = assertTenantContext(tenantId);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const month = formatMonthKey(date);
    const markerDetails = {
      year,
      week,
      ...(dto.salesRevenue !== undefined
        ? { salesRevenue: dto.salesRevenue }
        : {}),
      ...(dto.orderCount !== undefined ? { orderCount: dto.orderCount } : {}),
      activityCount: dto.activitiesCompleted?.length ?? 0,
      prospectCount: dto.prospects?.length ?? 0,
    };

    await this.prisma.$transaction(async (tx) => {
      if (dto.salesRevenue !== undefined || dto.orderCount !== undefined) {
        await tx.weeklySalesEntry.upsert({
          where: {
            tenantId_userId_year_week: {
              tenantId: scopedTenantId,
              userId,
              year,
              week,
            },
          },
          create: {
            tenantId: scopedTenantId,
            userId,
            year,
            week,
            achieved: dto.salesRevenue ?? 0,
            orders: dto.orderCount,
            notes: dto.notes,
          },
          update: {
            achieved: dto.salesRevenue ?? 0,
            orders: dto.orderCount,
            notes: dto.notes,
          },
        });
      }

      for (const activity of dto.activitiesCompleted ?? []) {
        await tx.activity.create({
          data: {
            tenantId: scopedTenantId,
            userId,
            title: activity.title,
            category: activity.category,
            status: "Completed",
            priority: "Medium",
            dueDate: new Date(activity.occurredOn),
            description: dto.notes,
          },
        });
      }

      for (const prospect of dto.prospects ?? []) {
        await tx.salesProspect.create({
          data: {
            tenantId: scopedTenantId,
            userId,
            month,
            prospectName: prospect.name,
            status: prospect.status,
            lastFollowUpAt: prospect.nextFollowUpDate
              ? new Date(prospect.nextFollowUpDate)
              : undefined,
            remarks: prospect.nextAction ?? dto.notes,
          },
        });
      }

      await tx.actionLog.create({
        data: {
          tenantId: scopedTenantId,
          userId,
          module: "coach",
          action: CATCH_UP_ACTION,
          method: "POST",
          endpoint: "/api/v1/coach/catch-up",
          details: markerDetails,
        },
      });
    });

    return this.getToday(userId, scopedTenantId, date);
  }

  private async loadSnapshot(
    userId: string,
    tenantId: string,
    date: Date,
  ): Promise<CoachSnapshot> {
    const weekStart = this.startOfMondayWeek(date);
    const weekEnd = this.endOfSundayWeek(date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const monthIndex = date.getMonth();

    const [
      onboarding,
      businessIdentity,
      salesPlan,
      weeklySalesEntry,
      activityConfiguration,
      activityDone,
      followupsDue,
      prospectCount,
      catchUpLog,
    ] = await Promise.all([
      this.prisma.onboardingProgress.findUnique({ where: { tenantId } }),
      this.prisma.businessIdentity.findUnique({ where: { tenantId } }),
      this.prisma.salesPlan.findUnique({ where: { tenantId } }),
      this.prisma.weeklySalesEntry.findUnique({
        where: {
          tenantId_userId_year_week: {
            tenantId,
            userId,
            year,
            week,
          },
        },
      }),
      this.prisma.activityConfiguration.findUnique({ where: { tenantId } }),
      this.prisma.activity.count({
        where: {
          tenantId,
          userId,
          status: "Completed",
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      }),
      this.prisma.salesProspect.count({
        where: {
          tenantId,
          userId,
          status: { in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT] },
        },
      }),
      this.prisma.salesProspect.count({ where: { tenantId, userId } }),
      this.prisma.actionLog.findFirst({
        where: {
          tenantId,
          userId,
          module: "coach",
          action: CATCH_UP_ACTION,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const setupComplete =
      Boolean(onboarding?.isCompleted) ||
      (Boolean(onboarding?.businessIdentityCompleted) &&
        Boolean(onboarding?.salesPlanCompleted) &&
        Boolean(onboarding?.activityConfigCompleted)) ||
      Boolean(
        businessIdentity?.companyName &&
          salesPlan?.projectedYearValue &&
          activityConfiguration?.weeklyActivityGoal,
      );

    const monthlyTarget = Number(salesPlan?.monthlyTargets?.[monthIndex]) || 0;
    const weeklyTarget =
      monthlyTarget > 0
        ? monthlyTarget / (WEEKS_PER_MONTH[monthIndex] || 4)
        : Number(salesPlan?.projectedYearValue || 0) / 52;

    return {
      setupComplete,
      catchUpCompleted: Boolean(catchUpLog),
      completedAt: onboarding?.completedAt,
      weeklyTarget: Math.round(weeklyTarget),
      achievedSoFar: Math.round(Number(weeklySalesEntry?.achieved) || 0),
      activityDone,
      activityGoal: Number(activityConfiguration?.weeklyActivityGoal) || 0,
      followupsDue,
      prospectCount,
    };
  }

  private buildGuidance(
    snapshot: CoachSnapshot,
    date: Date,
  ): CoachGuidanceResponseDto {
    const expectedByToday = Math.round(
      (snapshot.weeklyTarget * this.daysElapsedMondaySunday(date)) / 7,
    );
    const remaining = Math.max(
      0,
      snapshot.weeklyTarget - snapshot.achievedSoFar,
    );
    const state = this.resolveState(snapshot, expectedByToday, date);
    const actions = this.buildActions(snapshot, state, expectedByToday).slice(
      0,
      3,
    );

    return {
      state,
      message: this.messageFor(state, snapshot, expectedByToday),
      stats: {
        weeklyTarget: snapshot.weeklyTarget,
        achievedSoFar: snapshot.achievedSoFar,
        expectedByToday,
        remaining,
        activityDone: snapshot.activityDone,
        activityGoal: snapshot.activityGoal,
        followupsDue: snapshot.followupsDue,
      },
      actions,
      celebration:
        state === CoachState.ACHIEVED
          ? {
              type: "WEEKLY_TARGET_ACHIEVED",
              message:
                "Weekly target achieved. Strong work. Now protect next week by adding one warm prospect.",
            }
          : undefined,
      generatedAt: new Date(),
    };
  }

  private resolveState(
    snapshot: CoachSnapshot,
    expectedByToday: number,
    date: Date,
  ): CoachState {
    if (!snapshot.setupComplete) return CoachState.SETUP_INCOMPLETE;
    if (this.needsCatchUp(snapshot, date)) return CoachState.CATCH_UP_REQUIRED;
    if (
      snapshot.achievedSoFar === 0 &&
      snapshot.activityDone === 0 &&
      snapshot.prospectCount === 0
    ) {
      return CoachState.INACTIVE;
    }
    if (
      (snapshot.weeklyTarget > 0 &&
        snapshot.achievedSoFar >= snapshot.weeklyTarget) ||
      (snapshot.activityGoal > 0 &&
        snapshot.activityDone >= snapshot.activityGoal)
    ) {
      return CoachState.ACHIEVED;
    }
    if (
      snapshot.achievedSoFar < expectedByToday ||
      (snapshot.activityGoal > 0 &&
        snapshot.activityDone <
          Math.ceil(
            (snapshot.activityGoal * this.daysElapsedMondaySunday(date)) / 7,
          ))
    ) {
      return CoachState.BEHIND;
    }
    if (snapshot.achievedSoFar > expectedByToday * 1.15) {
      return CoachState.AHEAD;
    }
    return CoachState.ON_TRACK;
  }

  private needsCatchUp(snapshot: CoachSnapshot, date: Date): boolean {
    if (snapshot.catchUpCompleted) return false;
    if (!snapshot.completedAt) return false;
    const completedAt = new Date(snapshot.completedAt);
    const weekStart = this.startOfMondayWeek(date);
    const isMidWeek =
      completedAt >= weekStart && this.daysElapsedMondaySunday(date) > 1;
    const hasThisWeekData =
      snapshot.achievedSoFar > 0 ||
      snapshot.activityDone > 0 ||
      snapshot.prospectCount > 0;
    return isMidWeek && !hasThisWeekData;
  }

  private buildActions(
    snapshot: CoachSnapshot,
    state: CoachState,
    expectedByToday: number,
  ): CoachActionDto[] {
    const actions: CoachActionDto[] = [];

    if (state === CoachState.SETUP_INCOMPLETE) {
      actions.push({
        type: "FINISH_SETUP",
        title: "Finish your business setup",
        reason:
          "The coach needs your business model, targets, and activity rhythm before it can guide the week.",
        priority: CoachActionPriority.REQUIRED,
        cta: "Finish setup",
        route: "/onboarding",
        source: CoachActionSource.SETUP,
      });
      return actions;
    }

    if (state === CoachState.CATCH_UP_REQUIRED) {
      actions.push({
        type: "COMPLETE_CATCH_UP",
        title: "Catch up this week first",
        reason:
          "You joined mid-week. Add Monday-to-today sales, activities, and prospects so the plan is accurate.",
        priority: CoachActionPriority.REQUIRED,
        cta: "Start catch-up",
        source: CoachActionSource.CATCH_UP,
      });
    }

    if (snapshot.followupsDue > 0) {
      actions.push({
        type: "FOLLOW_UP_WARM_PROSPECTS",
        title: "Follow up with warm prospects",
        reason:
          "Warm and hot prospects need a clear next touch before they cool down.",
        priority: CoachActionPriority.REQUIRED,
        cta: "Open CRM",
        route: "/sales",
        source: CoachActionSource.CRM,
      });
    }

    if (
      snapshot.activityGoal > 0 &&
      snapshot.activityDone < snapshot.activityGoal
    ) {
      actions.push({
        type: "COMPLETE_ACTIVITY_RHYTHM",
        title: "Complete one business activity",
        reason: `You have completed ${snapshot.activityDone} of ${snapshot.activityGoal} weekly actions.`,
        priority: CoachActionPriority.REQUIRED,
        cta: "Add activity",
        route: "/activities",
        source: CoachActionSource.ACTIVITY,
      });
    }

    if (snapshot.weeklyTarget > 0 && snapshot.achievedSoFar < expectedByToday) {
      actions.push({
        type: "LOG_OR_CREATE_SALES_PROGRESS",
        title: "Move the sales gap with one revenue action",
        reason:
          "Sales is behind Monday-Sunday pace. The next useful move is a follow-up, proposal, or logged sale.",
        priority:
          actions.length < 2
            ? CoachActionPriority.REQUIRED
            : CoachActionPriority.STRETCH,
        cta: "Open sales",
        route: "/sales",
        source: CoachActionSource.SALES,
      });
    }

    if (snapshot.prospectCount < 3) {
      actions.push({
        type: "ADD_PIPELINE_PROSPECT",
        title: "Add one warm prospect",
        reason:
          "A small active pipeline gives the coach better follow-up actions for the week.",
        priority: CoachActionPriority.STRETCH,
        cta: "Add prospect",
        route: "/sales",
        source: CoachActionSource.CRM,
      });
    }

    if (actions.length === 0) {
      actions.push({
        type: "PROTECT_WEEKLY_RHYTHM",
        title: "Protect today's rhythm",
        reason:
          "You are on track. Keep it clean with one meaningful follow-up or proof action.",
        priority: CoachActionPriority.REQUIRED,
        cta: "Review Today",
        route: "/today",
        source: CoachActionSource.PROFILE,
      });
    }

    return actions;
  }

  private messageFor(
    state: CoachState,
    snapshot: CoachSnapshot,
    expectedByToday: number,
  ): string {
    switch (state) {
      case CoachState.SETUP_INCOMPLETE:
        return "Finish setup so the coach can guide activities, CRM, outcomes, and sales from your own business model.";
      case CoachState.CATCH_UP_REQUIRED:
        return "You're starting mid-week. Let's catch up Monday to today first, then I'll show the real weekly gap and next actions.";
      case CoachState.INACTIVE:
        return "Nothing is logged yet this week. Start small: complete one business action and log it.";
      case CoachState.ACHIEVED:
        return "Weekly target achieved. Strong work. Now protect next week by building pipeline.";
      case CoachState.BEHIND:
        return `You're behind pace, but this is recoverable. You have logged ${snapshot.achievedSoFar} against ${expectedByToday} expected by today.`;
      case CoachState.AHEAD:
        return "You're ahead this week. Good. Use today to build next week's pipeline.";
      case CoachState.ON_TRACK:
      default:
        return "You're on track. Keep the rhythm with one meaningful follow-up and one proof action.";
    }
  }

  private daysElapsedMondaySunday(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  private startOfMondayWeek(date: Date): Date {
    const copy = new Date(date);
    const day = copy.getDay();
    const offset = day === 0 ? 6 : day - 1;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - offset);
    return copy;
  }

  private endOfSundayWeek(date: Date): Date {
    const start = this.startOfMondayWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }
}
