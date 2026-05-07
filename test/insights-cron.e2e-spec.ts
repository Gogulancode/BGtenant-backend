import { Test, TestingModule } from "@nestjs/testing";
import { InsightsService } from "../src/insights/insights.service";
import { SalesService } from "../src/sales/sales.service";
import { ActivitiesService } from "../src/activities/activities.service";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TelemetryService } from "../src/observability/telemetry.service";
import { OutcomeStatus } from "@prisma/client";

interface MetricLogRecord {
  userId: string;
  tenantId: string;
  date: Date;
}

interface OutcomeRecord {
  userId: string;
  tenantId: string;
  status: OutcomeStatus;
  weekStartDate: Date;
}

interface UserRecord {
  id: string;
  tenantId: string | null;
}

interface ActivityRecord {
  userId: string;
  tenantId: string;
  status: string;
  category: string;
}

interface InsightRecord {
  userId: string;
  tenantId: string;
  momentumScore?: number;
  flags?: string | null;
  streakCount?: number;
  updatedAt?: Date;
}

class InMemoryPrismaInsightsService {
  users: UserRecord[] = [];
  metricLogs: MetricLogRecord[] = [];
  outcomes: OutcomeRecord[] = [];
  activities: ActivityRecord[] = [];
  insights = new Map<string, InsightRecord>();

  async $transaction<T>(operations: Array<Promise<T>>) {
    return Promise.all(operations);
  }

  user = {
    findMany: async () => this.users,
  };

  metricLog = {
    findMany: async ({ where }: any) => {
      const userId = where?.metric?.userId;
      const tenantId = where?.metric?.tenantId;
      const since: Date | undefined = where?.date?.gte;
      return this.metricLogs.filter((log) => {
        if (userId && log.userId !== userId) return false;
        if (tenantId && log.tenantId !== tenantId) return false;
        if (since && log.date < since) return false;
        return true;
      });
    },
  };

  outcome = {
    findMany: async ({ where }: any) => {
      const { userId, tenantId, weekStartDate } = where ?? {};
      const since: Date | undefined = weekStartDate?.gte;
      return this.outcomes.filter((outcome) => {
        if (userId && outcome.userId !== userId) return false;
        if (tenantId && outcome.tenantId !== tenantId) return false;
        if (since && outcome.weekStartDate < since) return false;
        return true;
      });
    },
  };

  activity = {
    findMany: async ({ where }: any) => {
      const { userId, tenantId } = where ?? {};
      return this.activities.filter((activity) => {
        if (userId && activity.userId !== userId) return false;
        if (tenantId && activity.tenantId !== tenantId) return false;
        return true;
      });
    },
  };

  insight = {
    upsert: async ({ where, update, create }: any) => {
      const existing = this.insights.get(where.userId);
      if (existing) {
        const updated = {
          ...existing,
          ...update,
          updatedAt: new Date(),
        };
        this.insights.set(where.userId, updated);
        return updated;
      }
      const created = {
        userId: create.userId,
        tenantId: create.tenantId,
        momentumScore: create.momentumScore,
        flags: create.flags,
        streakCount: create.streakCount,
        updatedAt: new Date(),
      } satisfies InsightRecord;
      this.insights.set(where.userId, created);
      return created;
    },
  };

  insightStore() {
    return Array.from(this.insights.values());
  }
}

describe("Insights cron automation", () => {
  let service: InsightsService;
  let prisma: InMemoryPrismaInsightsService;
  let telemetry: { recordJobSuccess: jest.Mock; recordJobFailure: jest.Mock };

  beforeEach(async () => {
    telemetry = {
      recordJobSuccess: jest.fn(),
      recordJobFailure: jest.fn(),
    };

    prisma = new InMemoryPrismaInsightsService();
    prisma.users = [
      { id: "user-cron-1", tenantId: "tenant-cron" },
      { id: "user-cron-2", tenantId: "tenant-cron" },
    ];

    const now = new Date();
    prisma.metricLogs = [
      { userId: "user-cron-1", tenantId: "tenant-cron", date: now },
      {
        userId: "user-cron-1",
        tenantId: "tenant-cron",
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: "user-cron-2",
        tenantId: "tenant-cron",
        date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    const currentWeek = new Date();
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
    prisma.outcomes = [
      {
        userId: "user-cron-1",
        tenantId: "tenant-cron",
        status: OutcomeStatus.Done,
        weekStartDate: currentWeek,
      },
      {
        userId: "user-cron-1",
        tenantId: "tenant-cron",
        status: OutcomeStatus.Planned,
        weekStartDate: currentWeek,
      },
      {
        userId: "user-cron-2",
        tenantId: "tenant-cron",
        status: OutcomeStatus.Missed,
        weekStartDate: currentWeek,
      },
    ];

    prisma.activities = [
      {
        userId: "user-cron-1",
        tenantId: "tenant-cron",
        status: "Completed",
        category: "Sales",
      },
      {
        userId: "user-cron-1",
        tenantId: "tenant-cron",
        status: "Active",
        category: "Product",
      },
      {
        userId: "user-cron-2",
        tenantId: "tenant-cron",
        status: "Active",
        category: "Operations",
      },
    ];

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useValue: telemetry },
        {
          provide: SalesService,
          useValue: {
            getSummary: jest.fn().mockResolvedValue({
              targets: { weeklyAchievementPercent: 80 },
            }),
          },
        },
        {
          provide: ActivitiesService,
          useValue: {
            getWeeklySummary: jest.fn().mockResolvedValue({
              year: 2026,
              week: 1,
              items: [],
              overallCompletionPercent: 80,
            }),
          },
        },
        {
          provide: OutcomesService,
          useValue: {
            getWeeklySummary: jest.fn().mockResolvedValue({
              year: 2026,
              week: 1,
              planned: 5,
              completed: 4,
              completionPercent: 80,
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(InsightsService);
  });

  it("calculates momentum scores for a single user", async () => {
    const result = await service.calculateInsights(
      "user-cron-1",
      "tenant-cron",
    );
    expect(result.momentumScore).toBeGreaterThan(0);
    expect(["Green", "Yellow", "Red"]).toContain(result.flags);
    expect(prisma.insightStore()).toHaveLength(1);
    expect(result.automationSnapshot).toMatchObject({
      executionSummary: expect.any(Object),
      outcomeSummary: expect.any(Object),
      trend: expect.any(Object),
    });
  });

  it("refreshes all tenant insights and reports telemetry", async () => {
    await service.refreshTenantInsights();

    expect(prisma.insightStore()).toHaveLength(2);
    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith(
      "insights-refresh",
      expect.objectContaining({ usersProcessed: 2 }),
    );
  });
});
