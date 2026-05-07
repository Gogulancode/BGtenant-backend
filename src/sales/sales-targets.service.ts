import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertTenantContext } from "../common/utils/tenant.utils";
import { getCurrentWeekNumber } from "../common/utils/date.utils";

/**
 * Excel-style week distribution per month
 * Based on 52 weeks in a year:
 * - Months 1-4 (Jan-Apr): 5 weeks each = 20 weeks
 * - Months 5-12 (May-Dec): 4 weeks each = 32 weeks
 * Total: 52 weeks
 */
const WEEKS_PER_MONTH = [5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4];

export interface MonthlyTarget {
  month: number; // 1-12
  monthName: string;
  contributionPercent: number;
  targetValue: number;
  weeksInMonth: number;
}

export interface WeeklyTarget {
  weekNumber: number; // 1-52
  month: number; // 1-12
  monthName: string;
  weekInMonth: number; // 1-5
  weeklyTarget: number;
  cumulativeTarget: number;
}

export interface CurrentPeriodTargets {
  year: number;
  currentMonth: number;
  currentWeek: number;
  monthlyTarget: number;
  weeklyTarget: number;
  achievedThisMonth: number;
  achievedThisWeek: number;
  monthlyAchievementPercent: number;
  weeklyAchievementPercent: number;
  daysRemainingInWeek: number;
  weeksRemainingInMonth: number;
}

export interface AchievementStageInfo {
  name: string;
  minPercentage: number;
  maxPercentage: number;
  color?: string;
}

export interface WeeklySummaryItem {
  week: number;
  target: number;
  achieved: number;
  achievementPercent: number;
  stage: AchievementStageInfo | null;
}

export interface WeeklySummaryResponse {
  year: number;
  fromWeek: number;
  toWeek: number;
  items: WeeklySummaryItem[];
}

@Injectable()
export class SalesTargetsService {
  private readonly monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get all monthly targets for the year based on SalesPlan
   */
  async getMonthlyTargets(
    tenantId: string | null | undefined,
  ): Promise<MonthlyTarget[]> {
    const scopedTenantId = assertTenantContext(tenantId);

    const salesPlan = await this.prisma.salesPlan.findUnique({
      where: { tenantId: scopedTenantId },
    });

    if (!salesPlan) {
      return this.getEmptyMonthlyTargets();
    }

    const { monthlyContribution, monthlyTargets } = salesPlan;

    return this.monthNames.map((name, index) => ({
      month: index + 1,
      monthName: name,
      contributionPercent: monthlyContribution[index] ?? 0,
      targetValue: monthlyTargets[index] ?? 0,
      weeksInMonth: WEEKS_PER_MONTH[index],
    }));
  }

  /**
   * Get all 52 weekly targets for the year
   */
  async getWeeklyTargets(
    tenantId: string | null | undefined,
  ): Promise<WeeklyTarget[]> {
    const scopedTenantId = assertTenantContext(tenantId);

    const salesPlan = await this.prisma.salesPlan.findUnique({
      where: { tenantId: scopedTenantId },
    });

    if (!salesPlan) {
      return this.getEmptyWeeklyTargets();
    }

    const { monthlyTargets } = salesPlan;
    const weeklyTargets: WeeklyTarget[] = [];
    let weekNumber = 1;
    let cumulativeTarget = 0;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthlyTarget = monthlyTargets[monthIndex] ?? 0;
      const weeksInMonth = WEEKS_PER_MONTH[monthIndex];
      const weeklyTargetValue = weeksInMonth > 0 ? monthlyTarget / weeksInMonth : 0;

      for (let weekInMonth = 1; weekInMonth <= weeksInMonth; weekInMonth++) {
        cumulativeTarget += weeklyTargetValue;
        weeklyTargets.push({
          weekNumber,
          month: monthIndex + 1,
          monthName: this.monthNames[monthIndex],
          weekInMonth,
          weeklyTarget: Number(weeklyTargetValue.toFixed(2)),
          cumulativeTarget: Number(cumulativeTarget.toFixed(2)),
        });
        weekNumber++;
      }
    }

    return weeklyTargets;
  }

  /**
   * Get target for a specific week number (1-52)
   */
  async getWeeklyTargetForWeek(
    tenantId: string | null | undefined,
    weekNumber: number,
  ): Promise<WeeklyTarget | null> {
    if (weekNumber < 1 || weekNumber > 52) {
      return null;
    }

    const weeklyTargets = await this.getWeeklyTargets(tenantId);
    return weeklyTargets[weekNumber - 1] ?? null;
  }

  /**
   * Get current period targets with achievement data
   */
  async getCurrentPeriodTargets(
    userId: string,
    tenantId: string | null | undefined,
  ): Promise<CurrentPeriodTargets> {
    const scopedTenantId = assertTenantContext(tenantId);
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentWeek = this.getWeekNumberInYear(now);
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    const daysRemainingInWeek = 7 - dayOfWeek;

    // Get sales plan for monthly/weekly targets
    const salesPlan = await this.prisma.salesPlan.findUnique({
      where: { tenantId: scopedTenantId },
    });

    // Get current month tracker for achieved values
    const monthKey = `${year}-${String(currentMonth).padStart(2, "0")}`;
    const tracker = await this.prisma.salesTracker.findFirst({
      where: { userId, tenantId: scopedTenantId, month: monthKey },
    });

    // Calculate targets
    const monthlyTarget = salesPlan?.monthlyTargets[currentMonth - 1] ?? 0;
    const weeksInCurrentMonth = WEEKS_PER_MONTH[currentMonth - 1];
    const weeklyTarget = weeksInCurrentMonth > 0 ? monthlyTarget / weeksInCurrentMonth : 0;
    
    // Calculate weeks remaining in month
    const weekInMonth = this.getWeekInMonth(now);
    const weeksRemainingInMonth = weeksInCurrentMonth - weekInMonth;

    // Get achieved values
    const achievedThisMonth = tracker?.achieved ?? 0;
    
    // Estimate weekly achieved (proportional to days elapsed in week)
    const daysElapsedInWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    const achievedThisWeek = this.estimateWeeklyAchieved(
      achievedThisMonth,
      now,
      weeksInCurrentMonth,
    );

    // Calculate achievement percentages
    const monthlyAchievementPercent = monthlyTarget > 0
      ? Number(((achievedThisMonth / monthlyTarget) * 100).toFixed(2))
      : 0;
    const weeklyAchievementPercent = weeklyTarget > 0
      ? Number(((achievedThisWeek / weeklyTarget) * 100).toFixed(2))
      : 0;

    return {
      year,
      currentMonth,
      currentWeek,
      monthlyTarget: Number(monthlyTarget.toFixed(2)),
      weeklyTarget: Number(weeklyTarget.toFixed(2)),
      achievedThisMonth: Number(achievedThisMonth.toFixed(2)),
      achievedThisWeek: Number(achievedThisWeek.toFixed(2)),
      monthlyAchievementPercent,
      weeklyAchievementPercent,
      daysRemainingInWeek,
      weeksRemainingInMonth: Math.max(0, weeksRemainingInMonth),
    };
  }

  /**
   * Get week number in year (1-52)
   * Uses ISO week numbering
   */
  private getWeekNumberInYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return Math.min(weekNo, 52);
  }

  /**
   * Get which week of the month (1-5) the date falls in
   */
  private getWeekInMonth(date: Date): number {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const firstDayOfWeek = firstOfMonth.getDay();
    return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
  }

  /**
   * Estimate weekly achieved based on monthly achieved
   * Simple proportional distribution
   */
  private estimateWeeklyAchieved(
    monthlyAchieved: number,
    date: Date,
    weeksInMonth: number,
  ): number {
    if (monthlyAchieved === 0 || weeksInMonth === 0) return 0;
    
    const weekInMonth = this.getWeekInMonth(date);
    const dayOfWeek = date.getDay() || 7; // 1-7
    
    // Assume even distribution across weeks
    const avgPerWeek = monthlyAchieved / weekInMonth;
    
    // Adjust for partial week
    const weekProgress = dayOfWeek / 7;
    return avgPerWeek * weekProgress;
  }

  /**
   * Generate empty monthly targets structure
   */
  private getEmptyMonthlyTargets(): MonthlyTarget[] {
    return this.monthNames.map((name, index) => ({
      month: index + 1,
      monthName: name,
      contributionPercent: 0,
      targetValue: 0,
      weeksInMonth: WEEKS_PER_MONTH[index],
    }));
  }

  /**
   * Generate empty weekly targets structure
   */
  private getEmptyWeeklyTargets(): WeeklyTarget[] {
    const weeklyTargets: WeeklyTarget[] = [];
    let weekNumber = 1;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const weeksInMonth = WEEKS_PER_MONTH[monthIndex];

      for (let weekInMonth = 1; weekInMonth <= weeksInMonth; weekInMonth++) {
        weeklyTargets.push({
          weekNumber,
          month: monthIndex + 1,
          monthName: this.monthNames[monthIndex],
          weekInMonth,
          weeklyTarget: 0,
          cumulativeTarget: 0,
        });
        weekNumber++;
      }
    }

    return weeklyTargets;
  }

  /**
   * Get weekly summary trend for a range of weeks
   * Default: last 6 weeks including current week
   */
  async getWeeklySummary(
    tenantId: string | null | undefined,
    year?: number,
    fromWeek?: number,
    toWeek?: number,
  ): Promise<WeeklySummaryResponse> {
    const scopedTenantId = assertTenantContext(tenantId);
    const now = new Date();
    
    // Determine year
    const targetYear = year ?? now.getFullYear();
    
    // Determine current week
    const currentWeek = getCurrentWeekNumber();
    
    // Determine week range (default: last 6 weeks including current)
    let startWeek = fromWeek ?? Math.max(1, currentWeek - 5);
    let endWeek = toWeek ?? currentWeek;
    
    // Validate range
    if (startWeek > endWeek) {
      throw new BadRequestException(
        "fromWeek cannot be greater than toWeek",
      );
    }
    if (startWeek < 1 || startWeek > 52 || endWeek < 1 || endWeek > 52) {
      throw new BadRequestException(
        "Week numbers must be between 1 and 52",
      );
    }

    // Load all required data in parallel (single queries, no N+1)
    const [salesPlan, achievementStages, trackerEntries] = await Promise.all([
      this.prisma.salesPlan.findUnique({
        where: { tenantId: scopedTenantId },
      }),
      this.prisma.achievementStage.findMany({
        where: { tenantId: scopedTenantId, isActive: true },
        orderBy: { order: "asc" },
      }),
      this.getTrackerEntriesForWeekRange(scopedTenantId, targetYear, startWeek, endWeek),
    ]);

    // Compute weekly targets array (52 weeks)
    const weeklyTargets = this.computeWeeklyTargetsArray(salesPlan?.monthlyTargets ?? []);
    
    // Group tracker entries by week
    const achievedByWeek = this.groupTrackersByWeek(trackerEntries, targetYear);
    
    // Build items for each week in range
    const items: WeeklySummaryItem[] = [];
    for (let week = startWeek; week <= endWeek; week++) {
      const target = weeklyTargets[week - 1] ?? 0;
      const achieved = achievedByWeek.get(week) ?? 0;
      const achievementPercent = target > 0 
        ? Number(((achieved / target) * 100).toFixed(2)) 
        : 0;
      
      const stage = this.findMatchingStage(achievementPercent, achievementStages);
      
      items.push({
        week,
        target: Number(target.toFixed(2)),
        achieved: Number(achieved.toFixed(2)),
        achievementPercent,
        stage,
      });
    }

    return {
      year: targetYear,
      fromWeek: startWeek,
      toWeek: endWeek,
      items,
    };
  }

  /**
   * Fetch tracker entries for months that overlap with the week range
   */
  private async getTrackerEntriesForWeekRange(
    tenantId: string,
    year: number,
    fromWeek: number,
    toWeek: number,
  ) {
    // Determine which months contain the weeks in the range
    const monthsInRange = this.getMonthsForWeekRange(fromWeek, toWeek);
    const monthKeys = monthsInRange.map(
      (m) => `${year}-${String(m).padStart(2, "0")}`,
    );

    return this.prisma.salesTracker.findMany({
      where: {
        tenantId,
        month: { in: monthKeys },
      },
      select: {
        month: true,
        achieved: true,
      },
    });
  }

  /**
   * Get which months (1-12) contain the specified week range
   */
  private getMonthsForWeekRange(fromWeek: number, toWeek: number): number[] {
    const months = new Set<number>();
    let weekCounter = 0;
    
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const weeksInMonth = WEEKS_PER_MONTH[monthIndex];
      const monthStart = weekCounter + 1;
      const monthEnd = weekCounter + weeksInMonth;
      
      // Check if this month overlaps with the requested week range
      if (monthEnd >= fromWeek && monthStart <= toWeek) {
        months.add(monthIndex + 1);
      }
      
      weekCounter += weeksInMonth;
    }
    
    return Array.from(months);
  }

  /**
   * Get month number for a given week number
   */
  private getMonthForWeek(weekNumber: number): number {
    let weekCounter = 0;
    
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      weekCounter += WEEKS_PER_MONTH[monthIndex];
      if (weekNumber <= weekCounter) {
        return monthIndex + 1;
      }
    }
    
    return 12;
  }

  /**
   * Compute flat weekly targets array from monthly targets
   */
  private computeWeeklyTargetsArray(monthlyTargets: number[]): number[] {
    const weeklyTargets: number[] = [];
    
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthlyTarget = monthlyTargets[monthIndex] ?? 0;
      const weeksInMonth = WEEKS_PER_MONTH[monthIndex];
      const weeklyTarget = weeksInMonth > 0 ? monthlyTarget / weeksInMonth : 0;
      
      for (let w = 0; w < weeksInMonth; w++) {
        weeklyTargets.push(weeklyTarget);
      }
    }
    
    return weeklyTargets;
  }

  /**
   * Group tracker entries by week number
   * Since trackers are monthly, we distribute achieved value evenly across weeks in the month
   */
  private groupTrackersByWeek(
    entries: Array<{ month: string; achieved: number | null }>,
    targetYear: number,
  ): Map<number, number> {
    const byWeek = new Map<number, number>();
    
    for (const entry of entries) {
      // Parse month key "2026-01" to get month number
      const [yearStr, monthStr] = entry.month.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      
      // Skip entries from different years
      if (year !== targetYear) continue;
      
      const monthIndex = month - 1;
      const weeksInMonth = WEEKS_PER_MONTH[monthIndex];
      const achieved = entry.achieved ?? 0;
      
      // Distribute achieved evenly across weeks in this month
      const weeklyAchieved = weeksInMonth > 0 ? achieved / weeksInMonth : 0;
      
      // Get the starting week number for this month
      let startWeek = 1;
      for (let i = 0; i < monthIndex; i++) {
        startWeek += WEEKS_PER_MONTH[i];
      }
      
      // Add the weekly achieved for each week in the month
      for (let w = 0; w < weeksInMonth; w++) {
        const weekNum = startWeek + w;
        const current = byWeek.get(weekNum) ?? 0;
        byWeek.set(weekNum, current + weeklyAchieved);
      }
    }
    
    return byWeek;
  }

  /**
   * Find the matching achievement stage for a given percentage
   */
  private findMatchingStage(
    percent: number,
    stages: Array<{
      name: string;
      percentOfGoal: number | null;
      color: string | null;
    }>,
  ): AchievementStageInfo | null {
    if (stages.length === 0) return null;

    // Sort stages by percentOfGoal ascending
    const sorted = [...stages].sort(
      (a, b) => (a.percentOfGoal ?? 0) - (b.percentOfGoal ?? 0),
    );

    // Find the stage where percent is within range
    for (let i = 0; i < sorted.length; i++) {
      const currentMin = i === 0 ? 0 : (sorted[i - 1].percentOfGoal ?? 0);
      const currentMax = sorted[i].percentOfGoal ?? 100;

      if (percent >= currentMin && percent <= currentMax) {
        return {
          name: sorted[i].name,
          minPercentage: currentMin,
          maxPercentage: currentMax,
          color: sorted[i].color ?? undefined,
        };
      }
    }

    // If percent exceeds all stages, return the highest stage
    const highest = sorted[sorted.length - 1];
    if (percent > (highest.percentOfGoal ?? 100)) {
      const prevMax = sorted.length > 1 
        ? (sorted[sorted.length - 2].percentOfGoal ?? 0) 
        : 0;
      return {
        name: highest.name,
        minPercentage: prevMax,
        maxPercentage: highest.percentOfGoal ?? 100,
        color: highest.color ?? undefined,
      };
    }

    return null;
  }
}
