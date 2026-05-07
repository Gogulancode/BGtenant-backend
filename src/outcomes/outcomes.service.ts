import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateOutcomeDto,
  UpdateOutcomeDto,
  WeeklySummaryQueryDto,
  WeeklySummaryResponseDto,
} from "./dto/outcome.dto";
import { OutcomeStatus } from "@prisma/client";
import { assertTenantContext } from "../common/utils/tenant.utils";
import {
  startOfWeek,
  startOfPreviousWeek,
  getCurrentWeekNumber,
  getWeekDateRange,
} from "../common/utils/date.utils";
import { TelemetryService } from "../observability/telemetry.service";
import {
  PaginationDto,
  createPaginatedResponse,
} from "../common/dto/pagination.dto";

interface CarryForwardResult {
  userId: string;
  tenantId: string;
  created: number;
  skipped: number;
  carriedTitles: string[];
  alreadyPlanned: string[];
  previousWeek: Date;
  currentWeek: Date;
}

interface CarryForwardJobSummary {
  created: number;
  skipped: number;
  usersProcessed: number;
  tenantsTouched: number;
  runs: CarryForwardResult[];
}

@Injectable()
export class OutcomesService {
  private readonly logger = new Logger(OutcomesService.name);

  constructor(
    private prisma: PrismaService,
    private telemetry: TelemetryService,
  ) {}

  async getOutcomes(
    userId: string,
    tenantId: string | null | undefined,
    weekStart?: string,
    pagination?: PaginationDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: any = { userId, tenantId: scopedTenantId };
    if (weekStart) {
      where.weekStartDate = new Date(weekStart);
    }

    // Apply search filter if provided
    if (pagination?.search) {
      where.title = { contains: pagination.search, mode: "insensitive" };
    }

    const [outcomes, total] = await this.prisma.$transaction([
      this.prisma.outcome.findMany({
        where,
        orderBy: pagination?.getOrderBy(
          ["title", "status", "weekstartdate"],
          "weekStartDate",
          "desc",
        ) ?? { weekStartDate: "desc" },
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 50,
      }),
      this.prisma.outcome.count({ where }),
    ]);

    if (pagination) {
      return createPaginatedResponse(outcomes, total, pagination);
    }

    return outcomes;
  }

  async createOutcome(
    userId: string,
    tenantId: string | null | undefined,
    createOutcomeDto: CreateOutcomeDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.outcome.create({
      data: {
        userId,
        tenantId: scopedTenantId,
        title: createOutcomeDto.title,
        status: createOutcomeDto.status,
        weekStartDate: new Date(createOutcomeDto.weekStartDate),
      },
    });
  }

  async updateOutcome(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
    updateOutcomeDto: UpdateOutcomeDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const existing = await this.prisma.outcome.findFirst({
      where: { id, userId, tenantId: scopedTenantId },
    });

    if (!existing) {
      throw new NotFoundException("Outcome not found");
    }

    return this.prisma.outcome.update({
      where: { id },
      data: updateOutcomeDto,
    });
  }

  async deleteOutcome(
    userId: string,
    tenantId: string | null | undefined,
    id: string,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const existing = await this.prisma.outcome.findFirst({
      where: { id, userId, tenantId: scopedTenantId },
    });

    if (!existing) {
      throw new NotFoundException("Outcome not found");
    }

    return this.prisma.outcome.delete({ where: { id } });
  }

  async carryForwardMissed(
    userId: string,
    tenantId: string | null | undefined,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const summary = await this.processCarryForwardForUser(
      userId,
      scopedTenantId,
    );

    return {
      message: summary.created
        ? `Carried forward ${summary.created} missed outcome${summary.created === 1 ? "" : "s"}`
        : "No missed outcomes to carry forward",
      ...summary,
    };
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const weekStart = startOfWeek();
    const previousWeekStart = startOfPreviousWeek();

    const [outcomes, overdue, previousWeekCompletion, overdueCount] =
      await this.prisma.$transaction([
        this.prisma.outcome.findMany({
          where: {
            userId,
            tenantId: scopedTenantId,
            weekStartDate: { gte: weekStart },
          },
          select: { id: true, title: true, status: true, weekStartDate: true },
        }),
        this.prisma.outcome.findMany({
          where: {
            userId,
            tenantId: scopedTenantId,
            status: OutcomeStatus.Missed,
            weekStartDate: { lt: weekStart },
          },
          orderBy: { weekStartDate: "asc" },
          take: 3,
          select: { id: true, title: true, weekStartDate: true },
        }),
        this.prisma.outcome.findMany({
          where: {
            userId,
            tenantId: scopedTenantId,
            weekStartDate: previousWeekStart,
          },
          select: { status: true },
        }),
        this.prisma.outcome.count({
          where: {
            userId,
            tenantId: scopedTenantId,
            status: OutcomeStatus.Missed,
            weekStartDate: { lt: weekStart },
          },
        }),
      ]);

    const total = outcomes.length;
    const completed = outcomes.filter(
      (o) => o.status === OutcomeStatus.Done,
    ).length;
    const planned = outcomes.filter(
      (o) => o.status === OutcomeStatus.Planned,
    ).length;
    const missed = outcomes.filter(
      (o) => o.status === OutcomeStatus.Missed,
    ).length;
    const completionRate = total
      ? Number(((completed / total) * 100).toFixed(2))
      : 0;

    const prevWeekCounts = previousWeekCompletion.reduce(
      (acc, curr) => {
        acc.total += 1;
        if (curr.status === OutcomeStatus.Done) {
          acc.done += 1;
        }
        return acc;
      },
      { total: 0, done: 0 },
    );

    const lastWeekCompletion = prevWeekCounts.total
      ? Number(((prevWeekCounts.done / prevWeekCounts.total) * 100).toFixed(2))
      : 0;

    const upcoming = outcomes
      .filter((o) => o.status === OutcomeStatus.Planned)
      .sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime())
      .slice(0, 3);

    return {
      totalThisWeek: total,
      completed,
      planned,
      missed,
      completionRate,
      lastWeekCompletion,
      overdueCount,
      overdue,
      upcoming,
    };
  }

  async getCompletionRateTrend(
    userId: string,
    tenantId: string | null | undefined,
    weeks = 6,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const currentWeek = startOfWeek();
    const oldestWeek = new Date(currentWeek);
    oldestWeek.setDate(oldestWeek.getDate() - (weeks - 1) * 7);

    const outcomes = await this.prisma.outcome.findMany({
      where: {
        userId,
        tenantId: scopedTenantId,
        weekStartDate: { gte: oldestWeek },
      },
      select: { status: true, weekStartDate: true },
    });

    const buckets = new Map<string, { total: number; done: number }>();
    for (const outcome of outcomes) {
      const key = startOfWeek(outcome.weekStartDate).toISOString();
      if (!buckets.has(key)) {
        buckets.set(key, { total: 0, done: 0 });
      }
      const bucket = buckets.get(key);
      bucket.total += 1;
      if (outcome.status === OutcomeStatus.Done) {
        bucket.done += 1;
      }
    }

    const series = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStartDate = new Date(currentWeek);
      weekStartDate.setDate(weekStartDate.getDate() - i * 7);
      if (weekStartDate < oldestWeek) {
        continue;
      }
      const key = weekStartDate.toISOString();
      const bucket = buckets.get(key) ?? { total: 0, done: 0 };
      const completionRate = bucket.total
        ? Number(((bucket.done / bucket.total) * 100).toFixed(2))
        : 0;
      series.push({
        weekStart: key,
        completionRate,
        completed: bucket.done,
        total: bucket.total,
      });
    }

    return { weeks: series };
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async flagOverdueOutcomes() {
    const currentWeekStart = startOfWeek();
    const result = await this.prisma.outcome.updateMany({
      where: {
        status: OutcomeStatus.Planned,
        weekStartDate: { lt: currentWeekStart },
      },
      data: { status: OutcomeStatus.Missed },
    });
    if (result.count) {
      this.logger.log(`Flagged ${result.count} overdue outcomes as Missed`);
    }
  }

  @Cron("0 1 * * 1")
  async autoCarryForwardMissed() {
    const jobName = "outcomes-carry-forward";
    let summary: CarryForwardJobSummary | undefined;

    try {
      summary = await this.processCarryForwardForAllUsers();

      if (summary.created) {
        this.logger.log(
          `Carried forward ${summary.created} outcomes across ${summary.usersProcessed} users`,
        );
      } else {
        this.logger.log("No missed outcomes to carry forward this cycle");
      }

      await this.telemetry.recordJobSuccess(jobName, {
        created: summary.created,
        skipped: summary.skipped,
        usersProcessed: summary.usersProcessed,
        tenantsTouched: summary.tenantsTouched,
      });

      return summary;
    } catch (error) {
      await this.telemetry.recordJobFailure(jobName, error as Error, {
        created: summary?.created ?? 0,
        usersProcessed: summary?.usersProcessed ?? 0,
      });
      throw error;
    }
  }

  private async processCarryForwardForUser(
    userId: string,
    tenantId: string,
  ): Promise<CarryForwardResult> {
    const previousWeek = startOfPreviousWeek();
    const currentWeek = startOfWeek();

    const missedOutcomes = await this.prisma.outcome.findMany({
      where: {
        userId,
        tenantId,
        status: OutcomeStatus.Missed,
        weekStartDate: previousWeek,
      },
      select: { title: true },
      orderBy: { title: "asc" },
    });

    if (!missedOutcomes.length) {
      return {
        userId,
        tenantId,
        created: 0,
        skipped: 0,
        carriedTitles: [],
        alreadyPlanned: [],
        previousWeek,
        currentWeek,
      };
    }

    const currentWeekOutcomes = await this.prisma.outcome.findMany({
      where: { userId, tenantId, weekStartDate: currentWeek },
      select: { title: true },
    });

    const existingTitles = new Set(currentWeekOutcomes.map((o) => o.title));
    const carriedTitles: string[] = [];
    const alreadyPlanned: string[] = [];

    for (const outcome of missedOutcomes) {
      if (existingTitles.has(outcome.title)) {
        alreadyPlanned.push(outcome.title);
      } else {
        carriedTitles.push(outcome.title);
        existingTitles.add(outcome.title);
      }
    }

    if (carriedTitles.length) {
      await this.prisma.outcome.createMany({
        data: carriedTitles.map((title) => ({
          userId,
          tenantId,
          title,
          status: OutcomeStatus.Planned,
          weekStartDate: currentWeek,
        })),
      });
    }

    return {
      userId,
      tenantId,
      created: carriedTitles.length,
      skipped: alreadyPlanned.length,
      carriedTitles,
      alreadyPlanned,
      previousWeek,
      currentWeek,
    };
  }

  private async processCarryForwardForAllUsers(): Promise<CarryForwardJobSummary> {
    const previousWeek = startOfPreviousWeek();

    const combos = await this.prisma.outcome.findMany({
      where: {
        status: OutcomeStatus.Missed,
        weekStartDate: previousWeek,
      },
      select: { userId: true, tenantId: true },
      distinct: ["userId", "tenantId"],
    });

    if (!combos.length) {
      return {
        created: 0,
        skipped: 0,
        usersProcessed: 0,
        tenantsTouched: 0,
        runs: [],
      };
    }

    const runs: CarryForwardResult[] = [];
    for (const combo of combos) {
      const summary = await this.processCarryForwardForUser(
        combo.userId,
        combo.tenantId,
      );
      runs.push(summary);
    }

    const created = runs.reduce((sum, run) => sum + run.created, 0);
    const skipped = runs.reduce((sum, run) => sum + run.skipped, 0);
    const tenantsTouched = new Set(runs.map((run) => run.tenantId)).size;

    return {
      created,
      skipped,
      usersProcessed: combos.length,
      tenantsTouched,
      runs,
    };
  }

  /**
   * Get weekly summary comparing planned outcomes vs completed.
   * Uses the same week calculation logic as Sales and Activities modules.
   */
  async getWeeklySummary(
    userId: string,
    tenantId: string | null | undefined,
    query: WeeklySummaryQueryDto,
  ): Promise<WeeklySummaryResponseDto> {
    const scopedTenantId = assertTenantContext(tenantId);

    // Determine year and week
    const year = query.year ?? new Date().getFullYear();
    const week = query.week ?? getCurrentWeekNumber();

    // Get week date boundaries (same logic as Sales/Activities)
    const { start: startOfWeekDate, end: endOfWeekDate } = getWeekDateRange(year, week);

    // Fetch outcomes for this tenant and user in the week range
    // Outcomes are tracked by weekStartDate, which is the start of the week they're planned for
    const outcomes = await this.prisma.outcome.findMany({
      where: {
        userId,
        tenantId: scopedTenantId,
        weekStartDate: {
          gte: startOfWeekDate,
          lte: endOfWeekDate,
        },
      },
      select: { status: true },
    });

    // Compute planned and completed
    const planned = outcomes.length;
    const completed = outcomes.filter(
      (o) => o.status === OutcomeStatus.Done,
    ).length;

    // Calculate completion percentage
    const completionPercent =
      planned > 0 ? Math.round((completed / planned) * 100 * 10) / 10 : 0;

    return {
      year,
      week,
      planned,
      completed,
      completionPercent,
    };
  }
}
