import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Insight, OutcomeStatus } from "@prisma/client";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { TelemetryService } from "../observability/telemetry.service";
import {
  startOfWeek,
  startOfPreviousWeek,
  getCurrentWeekNumber,
} from "../common/utils/date.utils";
import { SalesService } from "../sales/sales.service";
import { ActivitiesService } from "../activities/activities.service";
import { OutcomesService } from "../outcomes/outcomes.service";
import {
  WeeklyDiagnosticsQueryDto,
  WeeklyDiagnosticsResponseDto,
  DiagnosticItemDto,
  DiagnosticType,
  DiagnosticLevel,
} from "./dto/insights.dto";

export interface InsightAutomationSnapshot {
  weeklyFlag: string;
  momentumScore: number;
  streakCount: number;
  executionSummary: {
    weeklyCompletionRate: number;
    executionConsistency: number;
    activityCompletionRatio: number;
  };
  activitySummary: {
    active: number;
    completed: number;
    byCategory: Record<string, number>;
  };
  outcomeSummary: {
    done: number;
    planned: number;
    missed: number;
    total: number;
    completionRate: number;
  };
  trend: {
    direction: "up" | "down" | "flat";
    delta: number;
    currentMomentum: number;
    previousMomentum: number;
    history: Array<{ weekStart: string; completionRate: number }>;
  };
}

type InsightWithAutomation = Insight & {
  automationSnapshot: InsightAutomationSnapshot;
};

interface WeekWindowStats {
  weekStart: Date;
  totalOutcomes: number;
  completedOutcomes: number;
  missedOutcomes: number;
  plannedOutcomes: number;
  completionRate: number;
}

interface ActivitySummary {
  active: number;
  completed: number;
  byCategory: Record<string, number>;
  completionRatio: number;
}

interface MomentumSnapshot {
  scopedTenantId: string;
  weeklyHistory: WeekWindowStats[];
  currentWeekActiveDays: number;
  previousWeekActiveDays: number;
  streakCount: number;
  lastActiveDate: Date | null;
  activitySummary: ActivitySummary;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private prisma: PrismaService,
    private telemetry: TelemetryService,
    private salesService: SalesService,
    private activitiesService: ActivitiesService,
    private outcomesService: OutcomesService,
  ) {}

  async getInsights(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: scopedTenantId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found in tenant");
    }

    return this.calculateInsights(userId, scopedTenantId);
  }

  async refreshTenantInsights() {
    let processed = 0;
    try {
      const users = await this.prisma.user.findMany({
        where: { tenantId: { not: null } },
        select: { id: true, tenantId: true },
      });

      for (const user of users) {
        if (!user.tenantId) {
          continue;
        }
        try {
          await this.calculateInsights(user.id, user.tenantId);
          processed += 1;
        } catch (error) {
          this.logger.warn(
            `Failed to refresh insights for user ${user.id}: ${error?.message ?? error}`,
          );
        }
      }

      if (processed) {
        this.logger.log(`Refreshed insights for ${processed} tenant users`);
      }

      await this.telemetry.recordJobSuccess("insights-refresh", {
        usersProcessed: processed,
      });
    } catch (error) {
      await this.telemetry.recordJobFailure(
        "insights-refresh",
        error as Error,
        { usersProcessed: processed },
      );
      throw error;
    }
  }

  async calculateInsights(
    userId: string,
    tenantId: string | null | undefined,
  ): Promise<InsightWithAutomation> {
    const snapshot = await this.buildMomentumSnapshot(userId, tenantId);
    const currentWeek = snapshot.weeklyHistory[0];
    const previousWeek = snapshot.weeklyHistory[1] ?? this.emptyWeekStats();

    const outcomeScore =
      currentWeek.totalOutcomes > 0
        ? (currentWeek.completedOutcomes / currentWeek.totalOutcomes) * 50
        : 0;
    const activityScore = (snapshot.currentWeekActiveDays / 7) * 50;
    const momentumScore = Number((outcomeScore + activityScore).toFixed(2));

    const previousOutcomeScore =
      previousWeek.totalOutcomes > 0
        ? (previousWeek.completedOutcomes / previousWeek.totalOutcomes) * 50
        : 0;
    const previousActivityScore = (snapshot.previousWeekActiveDays / 7) * 50;
    const previousMomentum = Number(
      (previousOutcomeScore + previousActivityScore).toFixed(2),
    );
    const delta = Number((momentumScore - previousMomentum).toFixed(2));

    const weeklyFlag = this.determineFlag(currentWeek.completionRate);
    const executionConsistency = snapshot.weeklyHistory.length
      ? Number(
          (
            snapshot.weeklyHistory.reduce(
              (sum, week) => sum + week.completionRate,
              0,
            ) / snapshot.weeklyHistory.length
          ).toFixed(2),
        )
      : 0;
    const activityCompletionRatio = Number(
      (snapshot.activitySummary.completionRatio * 100).toFixed(2),
    );

    const automationSnapshot: InsightAutomationSnapshot = {
      weeklyFlag,
      momentumScore,
      streakCount: snapshot.streakCount,
      executionSummary: {
        weeklyCompletionRate: currentWeek.completionRate,
        executionConsistency,
        activityCompletionRatio,
      },
      activitySummary: {
        active: snapshot.activitySummary.active,
        completed: snapshot.activitySummary.completed,
        byCategory: snapshot.activitySummary.byCategory,
      },
      outcomeSummary: {
        done: currentWeek.completedOutcomes,
        planned: currentWeek.plannedOutcomes,
        missed: currentWeek.missedOutcomes,
        total: currentWeek.totalOutcomes,
        completionRate: currentWeek.completionRate,
      },
      trend: {
        direction: delta > 2 ? "up" : delta < -2 ? "down" : "flat",
        delta,
        currentMomentum: momentumScore,
        previousMomentum,
        history: snapshot.weeklyHistory.map((week) => ({
          weekStart: week.weekStart.toISOString(),
          completionRate: week.completionRate,
        })),
      },
    };

    const insight = await this.prisma.insight.upsert({
      where: { userId },
      update: {
        momentumScore,
        flags: weeklyFlag,
        streakCount: snapshot.streakCount,
        tenantId: snapshot.scopedTenantId,
      },
      create: {
        userId,
        tenantId: snapshot.scopedTenantId,
        momentumScore,
        flags: weeklyFlag,
        streakCount: snapshot.streakCount,
      },
    });

    return Object.assign(insight, {
      automationSnapshot,
    }) as InsightWithAutomation;
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const insight = await this.calculateInsights(userId, tenantId);

    const [recentWins, focusAreas] = await this.prisma.$transaction([
      this.prisma.outcome.findMany({
        where: { userId, tenantId: scopedTenantId, status: OutcomeStatus.Done },
        orderBy: { weekStartDate: "desc" },
        take: 3,
        select: { id: true, title: true, weekStartDate: true },
      }),
      this.prisma.activity.findMany({
        where: { userId, tenantId: scopedTenantId, status: "Active" },
        orderBy: { dueDate: "asc" },
        take: 3,
        select: { id: true, title: true, category: true, dueDate: true },
      }),
    ]);

    const flag = insight.flags ?? "Red";
    const streak = insight.streakCount ?? 0;

    return {
      momentumScore: Number((insight.momentumScore ?? 0).toFixed(2)),
      flag,
      streakCount: streak,
      updatedAt: insight.updatedAt,
      recommendations: this.getRecommendations(flag, streak),
      executionSummary: insight.automationSnapshot.executionSummary,
      activitySummary: insight.automationSnapshot.activitySummary,
      outcomeSummary: insight.automationSnapshot.outcomeSummary,
      trend: insight.automationSnapshot.trend,
      recentWins,
      focusAreas,
    };
  }

  async getMomentumSummary(
    userId: string,
    tenantId: string | null | undefined,
  ) {
    const snapshot = await this.buildMomentumSnapshot(userId, tenantId);
    const insight = await this.calculateInsights(userId, tenantId);

    return {
      momentumScore: Number((insight.momentumScore ?? 0).toFixed(2)),
      flag: insight.flags ?? "Red",
      completionRate: insight.automationSnapshot.outcomeSummary.completionRate,
      completedOutcomes: insight.automationSnapshot.outcomeSummary.done,
      totalOutcomes: insight.automationSnapshot.outcomeSummary.total,
      activeDays: snapshot.currentWeekActiveDays,
      executionSummary: insight.automationSnapshot.executionSummary,
      trend: insight.automationSnapshot.trend,
      updatedAt: insight.updatedAt,
    };
  }

  async getStreakSummary(userId: string, tenantId: string | null | undefined) {
    const snapshot = await this.buildMomentumSnapshot(userId, tenantId);
    const insight = await this.calculateInsights(userId, tenantId);
    const lastActiveDate = snapshot.lastActiveDate;
    const streakTarget = 7;
    const progressRatio = streakTarget
      ? Math.min(1, (insight.streakCount ?? 0) / streakTarget)
      : 0;

    return {
      streakCount: insight.streakCount ?? 0,
      lastActiveDate,
      progressToTarget: Number((progressRatio * 100).toFixed(2)),
      recommendations: this.getRecommendations(
        insight.flags ?? "Red",
        insight.streakCount ?? 0,
      ),
      trend: insight.automationSnapshot.trend,
      executionSummary: insight.automationSnapshot.executionSummary,
    };
  }

  private getRecommendations(flag: string, streakCount: number): string[] {
    if (flag === "Green") {
      return [
        "Keep logging key metrics daily to preserve this streak.",
        "Plan one stretch outcome for next week to capitalize on current momentum.",
      ];
    }

    if (flag === "Yellow") {
      return [
        "Schedule a quick daily review to boost consistency.",
        "Close at least one planned outcome this week to move momentum back to green.",
      ];
    }

    if (streakCount >= 3) {
      return [
        "Use the existing streak to rebuild confidence—log today’s metrics before noon.",
        "Tackle one overdue outcome to remove drag on momentum.",
      ];
    }

    return [
      "Log metrics for two consecutive days to restart the streak.",
      "Focus on completing a single planned outcome before adding new commitments.",
    ];
  }

  private async buildMomentumSnapshot(
    userId: string,
    tenantId: string | null | undefined,
  ): Promise<MomentumSnapshot> {
    const scopedTenantId = assertTenantContext(tenantId);
    const now = new Date();
    const metricsWindowStart = new Date(now);
    metricsWindowStart.setDate(metricsWindowStart.getDate() - 28);
    const historyWindowStart = startOfWeek(new Date(now));
    historyWindowStart.setDate(historyWindowStart.getDate() - 21);

    const [metricLogs, recentOutcomes, activities] =
      await this.prisma.$transaction([
        this.prisma.metricLog.findMany({
          where: {
            metric: { userId, tenantId: scopedTenantId },
            date: { gte: metricsWindowStart },
          },
          orderBy: { date: "desc" },
          select: { date: true },
        }),
        this.prisma.outcome.findMany({
          where: {
            userId,
            tenantId: scopedTenantId,
            weekStartDate: { gte: historyWindowStart },
          },
          select: { status: true, weekStartDate: true },
          orderBy: { weekStartDate: "desc" },
        }),
        this.prisma.activity.findMany({
          where: { userId, tenantId: scopedTenantId },
          select: { status: true, category: true },
        }),
      ]);

    const metricDayKeys = Array.from(
      new Set(metricLogs.map((log) => log.date.toISOString().split("T")[0])),
    ).sort((a, b) => b.localeCompare(a));
    const streakCount = this.calculateStreak(metricDayKeys);

    const trackedWeeks: Date[] = [];
    const currentWeekStart = startOfWeek(now);
    for (let offset = 0; offset < 4; offset += 1) {
      const week = new Date(currentWeekStart);
      week.setDate(week.getDate() - offset * 7);
      trackedWeeks.push(week);
    }

    const weeklyHistory = this.buildWeeklyHistory(recentOutcomes, trackedWeeks);
    const currentWeekActiveDays = this.countActiveDaysForWeek(
      metricLogs,
      currentWeekStart,
    );
    const previousWeekActiveDays = this.countActiveDaysForWeek(
      metricLogs,
      startOfPreviousWeek(now),
    );

    return {
      scopedTenantId,
      weeklyHistory,
      currentWeekActiveDays,
      previousWeekActiveDays,
      streakCount,
      lastActiveDate: metricLogs.length ? metricLogs[0].date : null,
      activitySummary: this.buildActivitySummary(activities),
    };
  }

  private determineFlag(completionRate: number): string {
    if (completionRate >= 70) return "Green";
    if (completionRate >= 40) return "Yellow";
    return "Red";
  }

  private buildActivitySummary(
    records: Array<{ status: string; category: string | null }>,
  ): ActivitySummary {
    let active = 0;
    let completed = 0;
    const byCategory: Record<string, number> = {};

    for (const record of records) {
      const category = record.category ?? "Uncategorized";
      byCategory[category] = (byCategory[category] ?? 0) + 1;
      if (record.status === "Completed") {
        completed += 1;
      } else {
        active += 1;
      }
    }

    const total = active + completed;
    const completionRatio = total ? completed / total : 0;

    return { active, completed, byCategory, completionRatio };
  }

  private buildWeeklyHistory(
    outcomes: Array<{ status: OutcomeStatus; weekStartDate: Date }>,
    trackedWeeks: Date[],
  ): WeekWindowStats[] {
    const weekBuckets = new Map<string, WeekWindowStats>();
    for (const week of trackedWeeks) {
      weekBuckets.set(this.weekKey(week), {
        weekStart: week,
        totalOutcomes: 0,
        completedOutcomes: 0,
        missedOutcomes: 0,
        plannedOutcomes: 0,
        completionRate: 0,
      });
    }

    for (const outcome of outcomes) {
      const key = this.weekKey(outcome.weekStartDate);
      const bucket = weekBuckets.get(key);
      if (!bucket) continue;
      bucket.totalOutcomes += 1;
      if (outcome.status === OutcomeStatus.Done) {
        bucket.completedOutcomes += 1;
      } else if (outcome.status === OutcomeStatus.Missed) {
        bucket.missedOutcomes += 1;
      } else {
        bucket.plannedOutcomes += 1;
      }
    }

    return trackedWeeks.map((week) => {
      const bucket = weekBuckets.get(this.weekKey(week));
      if (!bucket) {
        return this.emptyWeekStats(week);
      }
      bucket.completionRate = bucket.totalOutcomes
        ? Number(
            ((bucket.completedOutcomes / bucket.totalOutcomes) * 100).toFixed(
              2,
            ),
          )
        : 0;
      return bucket;
    });
  }

  private countActiveDaysForWeek(
    metricLogs: Array<{ date: Date }>,
    weekStart: Date,
  ): number {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const uniqueDays = new Set<string>();
    for (const log of metricLogs) {
      if (log.date < weekStart || log.date >= weekEnd) continue;
      uniqueDays.add(log.date.toISOString().split("T")[0]);
    }
    return uniqueDays.size;
  }

  private calculateStreak(dayKeys: string[]): number {
    if (!dayKeys.length) {
      return 0;
    }
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (const key of dayKeys) {
      const [year, month, day] = key.split("-").map((part) => Number(part));
      const date = new Date(year, month - 1, day);
      if (date.getTime() === cursor.getTime()) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (date.getTime() < cursor.getTime()) {
        break;
      }
    }
    return streak;
  }

  private weekKey(date: Date): string {
    return startOfWeek(date).toISOString();
  }

  private emptyWeekStats(weekStart = startOfWeek()): WeekWindowStats {
    return {
      weekStart,
      totalOutcomes: 0,
      completedOutcomes: 0,
      missedOutcomes: 0,
      plannedOutcomes: 0,
      completionRate: 0,
    };
  }

  // ============================================
  // WEEKLY DIAGNOSTICS ENGINE
  // ============================================

  /**
   * Get weekly diagnostics explaining WHY performance changed.
   * Rule-based diagnostic engine (not AI).
   */
  async getWeeklyDiagnostics(
    userId: string,
    tenantId: string | null | undefined,
    query: WeeklyDiagnosticsQueryDto,
  ): Promise<WeeklyDiagnosticsResponseDto> {
    const scopedTenantId = assertTenantContext(tenantId);

    // Determine year and week
    const year = query.year ?? new Date().getFullYear();
    const week = query.week ?? getCurrentWeekNumber();

    // Load all three metrics safely
    const [salesPercent, activityPercent, outcomePercent] = await Promise.all([
      this.getSalesAchievementPercent(userId, scopedTenantId),
      this.getActivityCompletionPercent(userId, scopedTenantId, year, week),
      this.getOutcomeCompletionPercent(userId, scopedTenantId, year, week),
    ]);

    // Apply rule engine
    const diagnostics = this.applyDiagnosticRules(
      salesPercent,
      activityPercent,
      outcomePercent,
    );

    // Compute momentum effect
    const momentumEffect = this.computeMomentumEffect(
      salesPercent,
      activityPercent,
      outcomePercent,
    );

    return {
      year,
      week,
      diagnostics,
      summary: {
        salesAchievementPercent: salesPercent,
        activityCompletionPercent: activityPercent,
        outcomeCompletionPercent: outcomePercent,
        momentumEffect,
      },
    };
  }

  /**
   * Get sales achievement percentage for current week.
   * Returns 0 if data is missing (never throws).
   */
  private async getSalesAchievementPercent(
    userId: string,
    tenantId: string,
  ): Promise<number> {
    try {
      const summary = await this.salesService.getSummary(userId, tenantId);
      return summary?.targets?.weeklyAchievementPercent ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get activity completion percentage for specified week.
   * Returns 0 if data is missing (never throws).
   */
  private async getActivityCompletionPercent(
    userId: string,
    tenantId: string,
    year: number,
    week: number,
  ): Promise<number> {
    try {
      const summary = await this.activitiesService.getWeeklySummary(
        userId,
        tenantId,
        { year, week },
      );
      return summary?.overallCompletionPercent ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get outcome completion percentage for specified week.
   * Returns 0 if data is missing (never throws).
   */
  private async getOutcomeCompletionPercent(
    userId: string,
    tenantId: string,
    year: number,
    week: number,
  ): Promise<number> {
    try {
      const summary = await this.outcomesService.getWeeklySummary(
        userId,
        tenantId,
        { year, week },
      );
      return summary?.completionPercent ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Apply diagnostic rules in order.
   * Rules may stack; all applicable messages are returned.
   */
  private applyDiagnosticRules(
    salesPercent: number,
    activityPercent: number,
    outcomePercent: number,
  ): DiagnosticItemDto[] {
    const diagnostics: DiagnosticItemDto[] = [];

    // Rule 1 — Effort issue:
    // IF sales < 80 AND activities < 80
    if (salesPercent < 80 && activityPercent < 80) {
      diagnostics.push({
        type: "SALES" as DiagnosticType,
        level: "CRITICAL" as DiagnosticLevel,
        message:
          "Low sales driven by insufficient activity. Increase outreach volume.",
      });
    }

    // Rule 2 — Pipeline issue:
    // IF sales < 80 AND activities >= 80
    if (salesPercent < 80 && activityPercent >= 80) {
      diagnostics.push({
        type: "SALES" as DiagnosticType,
        level: "WARNING" as DiagnosticLevel,
        message:
          "Activity levels are healthy, but conversions are low. Review lead quality.",
      });
    }

    // Rule 3 — Execution issue:
    // IF outcomes < 80
    if (outcomePercent < 80) {
      diagnostics.push({
        type: "OUTCOME" as DiagnosticType,
        level: "WARNING" as DiagnosticLevel,
        message:
          "Weekly commitments are not being completed. Improve execution discipline.",
      });
    }

    // Rule 4 — Momentum building:
    // IF sales >= 80 AND activities >= 80
    if (salesPercent >= 80 && activityPercent >= 80) {
      diagnostics.push({
        type: "ACTIVITY" as DiagnosticType,
        level: "SUCCESS" as DiagnosticLevel,
        message:
          "Strong activity and sales alignment. Momentum is building.",
      });
    }

    // Rule 5 — Exceptional:
    // IF sales >= 100
    if (salesPercent >= 100) {
      diagnostics.push({
        type: "SALES" as DiagnosticType,
        level: "SUCCESS" as DiagnosticLevel,
        message:
          "Sales exceeded target. Consider raising goals or scaling efforts.",
      });
    }

    return diagnostics;
  }

  /**
   * Compute momentum effect score (-10 to +10).
   * Lightweight calculation based on key metrics.
   */
  private computeMomentumEffect(
    salesPercent: number,
    activityPercent: number,
    outcomePercent: number,
  ): number {
    let effect = 0;

    // If sales >= 100 → +5
    if (salesPercent >= 100) {
      effect += 5;
    }

    // If sales < 80 → -5
    if (salesPercent < 80) {
      effect -= 5;
    }

    // If activities < 80 → -3
    if (activityPercent < 80) {
      effect -= 3;
    }

    // If outcomes < 80 → -2
    if (outcomePercent < 80) {
      effect -= 2;
    }

    // Clamp to [-10, +10]
    return Math.max(-10, Math.min(10, effect));
  }
}
