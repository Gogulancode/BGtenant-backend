import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { SalesPlanning, SalesTracker } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertSalesPlanningDto, UpsertSalesTrackerDto } from "./dto/sales.dto";
import { assertTenantContext } from "../common/utils/tenant.utils";
import {
  formatMonthKey,
  startOfPreviousWeek,
  startOfWeek,
} from "../common/utils/date.utils";
import {
  PaginationDto,
  createPaginatedResponse,
} from "../common/dto/pagination.dto";
import { SalesTargetsService } from "./sales-targets.service";

type QuarterKey = "q1" | "q2" | "q3" | "q4";

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => SalesTargetsService))
    private salesTargetsService: SalesTargetsService,
  ) {}

  async getSalesPlanning(
    userId: string,
    tenantId: string | null | undefined,
    year: number,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.salesPlanning.findFirst({
      where: { userId, tenantId: scopedTenantId, year },
    });
  }

  async upsertSalesPlanning(
    userId: string,
    tenantId: string | null | undefined,
    dto: UpsertSalesPlanningDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const hasQ1 = dto.q1 !== undefined && dto.q1 !== null;
    const hasQ4 = dto.q4 !== undefined && dto.q4 !== null;
    const growthPct =
      hasQ1 && hasQ4 ? ((dto.q4 - dto.q1) / Math.max(dto.q1 || 0, 1)) * 100 : 0;

    const existing = await this.prisma.salesPlanning.findFirst({
      where: { userId, tenantId: scopedTenantId, year: dto.year },
    });

    if (existing) {
      return this.prisma.salesPlanning.update({
        where: { id: existing.id },
        data: { ...dto, growthPct, tenantId: scopedTenantId },
      });
    }

    return this.prisma.salesPlanning.create({
      data: { userId, tenantId: scopedTenantId, ...dto, growthPct },
    });
  }

  async getSalesTracker(
    userId: string,
    tenantId: string | null | undefined,
    month: string,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.salesTracker.findFirst({
      where: { userId, tenantId: scopedTenantId, month },
    });
  }

  async upsertSalesTracker(
    userId: string,
    tenantId: string | null | undefined,
    dto: UpsertSalesTrackerDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const existing = await this.prisma.salesTracker.findFirst({
      where: { userId, tenantId: scopedTenantId, month: dto.month },
    });

    if (existing) {
      return this.prisma.salesTracker.update({
        where: { id: existing.id },
        data: { ...dto, tenantId: scopedTenantId },
      });
    }

    return this.prisma.salesTracker.create({
      data: { userId, tenantId: scopedTenantId, ...dto },
    });
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const now = new Date();
    const year = now.getFullYear();
    const monthKey = formatMonthKey(now);
    const previousWeekMonthKey = formatMonthKey(startOfPreviousWeek(now));

    const [planning, tracker, previousTracker] = await this.prisma.$transaction(
      [
        this.prisma.salesPlanning.findFirst({
          where: { userId, tenantId: scopedTenantId, year },
          select: {
            id: true,
            year: true,
            q1: true,
            q2: true,
            q3: true,
            q4: true,
            growthPct: true,
          },
        }),
        this.prisma.salesTracker.findFirst({
          where: { userId, tenantId: scopedTenantId, month: monthKey },
          select: {
            id: true,
            month: true,
            target: true,
            achieved: true,
            orders: true,
            asp: true,
            profit: true,
          },
        }),
        this.prisma.salesTracker.findFirst({
          where: {
            userId,
            tenantId: scopedTenantId,
            month: previousWeekMonthKey,
          },
          select: {
            id: true,
            month: true,
            target: true,
            achieved: true,
            orders: true,
            asp: true,
            profit: true,
          },
        }),
      ],
    );

    const validation = this.buildValidationSnapshot(
      now,
      planning,
      tracker,
      previousTracker,
      monthKey,
    );

    // Get current period targets from SalesPlan
    const targets = await this.salesTargetsService.getCurrentPeriodTargets(
      userId,
      tenantId,
    );
    const progress =
      targets.monthlyTarget > 0
        ? targets.monthlyAchievementPercent
        : tracker?.target
          ? Number(
              (((tracker.achieved ?? 0) / tracker.target) * 100).toFixed(2),
            )
          : 0;

    return {
      planning,
      tracker,
      progress,
      year,
      month: monthKey,
      validation,
      // Enhanced target data from SalesPlan
      targets: {
        monthlyTarget: targets.monthlyTarget,
        weeklyTarget: targets.weeklyTarget,
        achievedThisMonth: targets.achievedThisMonth,
        achievedThisWeek: targets.achievedThisWeek,
        monthlyAchievementPercent: targets.monthlyAchievementPercent,
        weeklyAchievementPercent: targets.weeklyAchievementPercent,
        daysRemainingInWeek: targets.daysRemainingInWeek,
        weeksRemainingInMonth: targets.weeksRemainingInMonth,
      },
    };
  }

  private buildValidationSnapshot(
    date: Date,
    planning: Pick<
      SalesPlanning,
      "year" | QuarterKey | "id" | "growthPct"
    > | null,
    tracker: Pick<
      SalesTracker,
      "month" | "target" | "achieved" | "orders" | "asp" | "profit" | "id"
    > | null,
    previousTracker: Pick<
      SalesTracker,
      "month" | "target" | "achieved" | "orders" | "asp" | "profit" | "id"
    > | null,
    currentMonthKey: string,
  ) {
    return {
      weeklyPlan: this.calculateWeeklyPlan(date, planning),
      dailyTracker: this.calculateDailyTracker(date, tracker, currentMonthKey),
      planVsActual: this.calculatePlanVsActual(date, planning, tracker),
      weeklyRollover: this.calculateWeeklyRollover(
        date,
        tracker,
        previousTracker,
        currentMonthKey,
      ),
    };
  }

  private calculateWeeklyPlan(
    date: Date,
    planning: Pick<SalesPlanning, QuarterKey> | null,
  ) {
    const quarter = this.getQuarter(date);
    const quarterKey = this.getQuarterKey(quarter);
    const quarterTarget = planning?.[quarterKey] ?? 0;
    const weeklyTarget = quarterTarget ? quarterTarget / 13 : 0;
    const weeksElapsed = this.getWeeksElapsedInQuarter(date);
    const expectedToDate = weeklyTarget * weeksElapsed;

    return {
      quarter,
      quarterKey,
      isConfigured: quarterTarget > 0,
      weeklyTarget: Number(weeklyTarget.toFixed(2)),
      weeksElapsed,
      expectedToDate: Number(expectedToDate.toFixed(2)),
      status: quarterTarget > 0 ? "CONFIGURED" : "MISSING_PLAN",
      message:
        quarterTarget > 0
          ? "Weekly targets derived from quarterly plan"
          : "Add a quarterly target to unlock weekly pacing",
    } as const;
  }

  private calculateDailyTracker(
    date: Date,
    tracker: Pick<SalesTracker, "month" | "target" | "achieved"> | null,
    currentMonthKey: string,
  ) {
    if (!tracker) {
      return {
        status: "MISSING",
        targetPerDay: 0,
        achievedPerDay: 0,
        variance: 0,
        isCurrentMonth: false,
      } as const;
    }

    const daysInMonth = this.getDaysInMonth(date);
    const dayOfMonth = date.getDate();
    const targetPerDay = tracker.target ? tracker.target / daysInMonth : 0;
    const achievedPerDay = tracker.achieved
      ? tracker.achieved / Math.max(dayOfMonth, 1)
      : 0;
    const variance = achievedPerDay - targetPerDay;
    const isCurrentMonth = tracker.month === currentMonthKey;

    return {
      status: isCurrentMonth ? "CURRENT" : "STALE",
      targetPerDay: Number(targetPerDay.toFixed(2)),
      achievedPerDay: Number(achievedPerDay.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      isCurrentMonth,
    } as const;
  }

  private calculatePlanVsActual(
    date: Date,
    planning: Pick<SalesPlanning, QuarterKey> | null,
    tracker: Pick<SalesTracker, "achieved"> | null,
  ) {
    const quarter = this.getQuarter(date);
    const quarterKey = this.getQuarterKey(quarter);
    const planned = planning?.[quarterKey] ?? 0;
    const actual = tracker?.achieved ?? 0;
    const variance = actual - planned;
    const attainment = planned ? (actual / planned) * 100 : 0;

    let status: "NO_PLAN" | "OFF_TRACK" | "AT_RISK" | "ON_TRACK" = "NO_PLAN";
    if (planned > 0) {
      if (attainment >= 95) {
        status = "ON_TRACK";
      } else if (attainment >= 80) {
        status = "AT_RISK";
      } else {
        status = "OFF_TRACK";
      }
    }

    return {
      quarter,
      planned: Number(planned.toFixed(2)),
      actual: Number(actual.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      attainment: Number(attainment.toFixed(2)),
      status,
    } as const;
  }

  private calculateWeeklyRollover(
    date: Date,
    tracker: Pick<SalesTracker, "month" | "target" | "achieved"> | null,
    previousTracker: Pick<SalesTracker, "month" | "target" | "achieved"> | null,
    currentMonthKey: string,
  ) {
    const previousWeekStart = startOfPreviousWeek(date);
    const previousWeekMonthKey = formatMonthKey(previousWeekStart);
    const requiresRollover = previousWeekMonthKey !== currentMonthKey;

    if (!requiresRollover) {
      return {
        status: tracker ? "NOT_REQUIRED" : "NO_CURRENT_TRACKER",
        requiresRollover: false,
        currentMonth: currentMonthKey,
        previousMonth: previousWeekMonthKey,
        carryForward: null,
      } as const;
    }

    if (!tracker || tracker.month !== currentMonthKey) {
      return {
        status: "BLOCKED",
        requiresRollover: true,
        currentMonth: currentMonthKey,
        previousMonth: previousWeekMonthKey,
        carryForward: previousTracker
          ? {
              month: previousTracker.month,
              target: previousTracker.target ?? 0,
              achieved: previousTracker.achieved ?? 0,
            }
          : null,
      } as const;
    }

    return {
      status: "ROLLED_OVER",
      requiresRollover: true,
      currentMonth: currentMonthKey,
      previousMonth: previousWeekMonthKey,
      carryForward: previousTracker
        ? {
            month: previousTracker.month,
            target: previousTracker.target ?? 0,
            achieved: previousTracker.achieved ?? 0,
          }
        : null,
    } as const;
  }

  private getQuarter(date: Date) {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  private getQuarterKey(quarter: number): QuarterKey {
    return `q${quarter}` as QuarterKey;
  }

  private getWeeksElapsedInQuarter(date: Date) {
    const quarter = this.getQuarter(date);
    const quarterStartMonth = (quarter - 1) * 3;
    const quarterStart = new Date(date.getFullYear(), quarterStartMonth, 1);
    const currentWeekStart = startOfWeek(date);
    const baselineWeekStart = startOfWeek(quarterStart);
    const diffMs = currentWeekStart.getTime() - baselineWeekStart.getTime();
    return Math.max(Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1, 1);
  }

  private getDaysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  async getAllSalesTrackers(
    userId: string,
    tenantId: string | null | undefined,
    pagination?: PaginationDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: any = { userId, tenantId: scopedTenantId };

    // Apply search filter if provided (search by month)
    if (pagination?.search) {
      where.month = { contains: pagination.search, mode: "insensitive" };
    }

    const [trackers, total] = await this.prisma.$transaction([
      this.prisma.salesTracker.findMany({
        where,
        orderBy: pagination?.getOrderBy(
          ["month", "target", "achieved", "profit"],
          "month",
          "desc",
        ) ?? { month: "desc" },
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 20,
      }),
      this.prisma.salesTracker.count({ where }),
    ]);

    if (pagination) {
      return createPaginatedResponse(trackers, total, pagination);
    }

    return trackers;
  }

  // ============================================
  // WEEKLY SALES ENTRY METHODS
  // ============================================

  async createWeeklySalesEntry(
    userId: string,
    tenantId: string | null | undefined,
    data: {
      year: number;
      week: number;
      achieved: number;
      orders?: number;
      notes?: string;
    },
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    // Check if entry already exists for this week
    const existing = await this.prisma.weeklySalesEntry.findUnique({
      where: {
        tenantId_userId_year_week: {
          tenantId: scopedTenantId,
          userId,
          year: data.year,
          week: data.week,
        },
      },
    });

    if (existing) {
      await this.prisma.weeklySalesEntry.update({
        where: { id: existing.id },
        data: {
          achieved: data.achieved,
          orders: data.orders,
          notes: data.notes,
        },
      });

      return this.getWeeklySalesEntry(
        userId,
        scopedTenantId,
        data.year,
        data.week,
      );
    }

    await this.prisma.weeklySalesEntry.create({
      data: {
        userId,
        tenantId: scopedTenantId,
        year: data.year,
        week: data.week,
        achieved: data.achieved,
        orders: data.orders,
        notes: data.notes,
      },
    });

    return this.getWeeklySalesEntry(
      userId,
      scopedTenantId,
      data.year,
      data.week,
    );
  }

  async getWeeklySalesEntry(
    userId: string,
    tenantId: string | null | undefined,
    year: number,
    week: number,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    const entry = await this.prisma.weeklySalesEntry.findUnique({
      where: {
        tenantId_userId_year_week: {
          tenantId: scopedTenantId,
          userId,
          year,
          week,
        },
      },
    });

    // Get target for this week
    const weeklyTarget = await this.salesTargetsService.getWeeklyTargetForWeek(
      tenantId,
      week,
    );

    const target = weeklyTarget?.weeklyTarget ?? 0;
    const achieved = entry?.achieved ?? 0;
    const achievementPercent = target > 0 ? (achieved / target) * 100 : 0;

    let status: "exceeded" | "achieved" | "below" = "below";
    if (achievementPercent >= 100) status = "exceeded";
    else if (achievementPercent >= 80) status = "achieved";

    return {
      id: entry?.id ?? null,
      year,
      week,
      achieved,
      orders: entry?.orders ?? 0,
      notes: entry?.notes ?? null,
      target,
      achievementPercent: Number(achievementPercent.toFixed(2)),
      status,
      createdAt: entry?.createdAt ?? null,
      updatedAt: entry?.updatedAt ?? null,
    };
  }

  async getWeeklySalesEntries(
    userId: string,
    tenantId: string | null | undefined,
    year: number,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    // Get all entries for the year
    const entries = await this.prisma.weeklySalesEntry.findMany({
      where: {
        userId,
        tenantId: scopedTenantId,
        year,
      },
      orderBy: { week: "desc" },
    });

    // Get all weekly targets
    const weeklyTargets =
      await this.salesTargetsService.getWeeklyTargets(tenantId);

    // Map entries with targets
    return entries.map((entry) => {
      const target = weeklyTargets[entry.week - 1]?.weeklyTarget ?? 0;
      const achievementPercent =
        target > 0 ? (entry.achieved / target) * 100 : 0;

      let status: "exceeded" | "achieved" | "below" = "below";
      if (achievementPercent >= 100) status = "exceeded";
      else if (achievementPercent >= 80) status = "achieved";

      return {
        ...entry,
        target,
        achievementPercent: Number(achievementPercent.toFixed(2)),
        status,
      };
    });
  }

  async updateWeeklySalesEntry(
    userId: string,
    tenantId: string | null | undefined,
    year: number,
    week: number,
    data: { achieved?: number; orders?: number; notes?: string },
  ) {
    const scopedTenantId = assertTenantContext(tenantId);

    const existing = await this.prisma.weeklySalesEntry.findUnique({
      where: {
        tenantId_userId_year_week: {
          tenantId: scopedTenantId,
          userId,
          year,
          week,
        },
      },
    });

    if (!existing) {
      throw new Error("Weekly sales entry not found");
    }

    return this.prisma.weeklySalesEntry.update({
      where: { id: existing.id },
      data,
    });
  }
}
