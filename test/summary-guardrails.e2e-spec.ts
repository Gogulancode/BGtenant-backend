import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { Role, OutcomeStatus, ReviewType } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { BusinessController } from "../src/business/business.controller";
import { BusinessService } from "../src/business/business.service";
import { MetricsController } from "../src/metrics/metrics.controller";
import { MetricsService } from "../src/metrics/metrics.service";
import { DashboardController } from "../src/dashboard/dashboard.controller";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { OutcomesController } from "../src/outcomes/outcomes.controller";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { ReviewsController } from "../src/reviews/reviews.controller";
import { ReviewsService } from "../src/reviews/reviews.service";
import { ActivitiesController } from "../src/activities/activities.controller";
import { ActivitiesService } from "../src/activities/activities.service";
import { BusinessType } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ActionLogService } from "../src/action-log/action-log.service";
import { SalesService } from "../src/sales/sales.service";
import { InsightsService } from "../src/insights/insights.service";
import { TelemetryService } from "../src/observability/telemetry.service";
import {
  startOfWeek,
  startOfPreviousWeek,
} from "../src/common/utils/date.utils";

class AllowAuthGuard implements CanActivate {
  constructor(private readonly getUser: () => any) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = this.getUser();
    return true;
  }
}

describe("Summary endpoint guardrails", () => {
  let activeUser: { userId: string; tenantId: string; role: Role };

  beforeEach(() => {
    activeUser = {
      userId: "user-summary",
      tenantId: "tenant-summary",
      role: Role.TENANT_ADMIN,
    };
  });

  const createApp = async (
    moduleBuilder: ReturnType<typeof Test.createTestingModule>,
  ) => {
    const moduleRef = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue(new AllowAuthGuard(() => activeUser))
      .compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return app;
  };

  describe("/business/summary", () => {
    let app: INestApplication;
    const snapshot = {
      id: "snapshot-1",
      annualSales: 120000,
      avgMonthlySales: 10000,
      ordersPerMonth: 85,
      avgSellingPrice: 400,
      monthlyExpenses: null,
      profitMargin: null,
      suggestedNSM: "Active Customers",
    };

    beforeEach(async () => {
      const prisma = {
        businessSnapshot: {
          findFirst: jest.fn().mockResolvedValue(snapshot),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({
            businessType: BusinessType.Startup,
            tenantId: activeUser.tenantId,
          }),
        },
      } as unknown as PrismaService;

      app = await createApp(
        Test.createTestingModule({
          controllers: [BusinessController],
          providers: [
            BusinessService,
            RolesGuard,
            { provide: PrismaService, useValue: prisma },
          ],
        }),
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it("returns snapshot readiness metadata with consistent keys", async () => {
      await request(app.getHttpServer())
        .get("/business/summary")
        .set("Authorization", "Bearer test")
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            hasSnapshot: true,
            completionPercent: expect.any(Number),
            suggestedNSM: "Active Customers",
            snapshot: expect.objectContaining({ id: snapshot.id }),
          });
          expect(body.missingFields).toEqual(
            expect.arrayContaining(["monthlyExpenses", "profitMargin"]),
          );
        });
    });
  });

  describe("/metrics/summary", () => {
    let app: INestApplication;
    const cacheStub: Cache = {
      del: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      store: undefined,
      wrap: undefined,
      reset: undefined,
      mget: undefined,
      mset: undefined,
      mdel: undefined,
      keys: undefined,
      ttl: undefined,
    } as unknown as Cache;
    const actionLogStub = { record: jest.fn() } as unknown as ActionLogService;

    beforeEach(async () => {
      const metricRows = [
        {
          id: "metric-1",
          name: "Leads",
          target: 100,
          logs: [{ value: 45 }],
        },
        {
          id: "metric-2",
          name: "Revenue",
          target: 200,
          logs: [],
        },
      ];
      const recentLogs = [
        {
          id: "log-1",
          metricId: "metric-1",
          metric: { name: "Leads" },
          value: 45,
          date: new Date(),
        },
      ];

      const prisma = {
        metric: {
          findMany: jest.fn().mockResolvedValue(metricRows),
        },
        metricLog: {
          findMany: jest.fn().mockResolvedValue(recentLogs),
        },
        $transaction: async (operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
      } as unknown as PrismaService;

      app = await createApp(
        Test.createTestingModule({
          controllers: [MetricsController],
          providers: [
            MetricsService,
            RolesGuard,
            { provide: PrismaService, useValue: prisma },
            { provide: CACHE_MANAGER, useValue: cacheStub },
            { provide: ActionLogService, useValue: actionLogStub },
          ],
        }),
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it("emits metric totals, progress, and recent log entries", async () => {
      await request(app.getHttpServer())
        .get("/metrics/summary")
        .set("Authorization", "Bearer test")
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            totalMetrics: 2,
            activeMetrics: 1,
            averageProgress: expect.any(Number),
          });
          expect(body.recentLogs).toHaveLength(1);
          expect(body.recentLogs[0]).toMatchObject({
            metricName: "Leads",
            value: 45,
          });
        });
    });
  });

  describe("/outcomes/summary", () => {
    let app: INestApplication;

    beforeEach(async () => {
      jest.useFakeTimers().setSystemTime(new Date("2025-03-05T12:00:00.000Z"));

      const reference = new Date("2025-03-05T12:00:00.000Z");
      const currentWeekStart = startOfWeek(reference);
      const previousWeekStart = startOfPreviousWeek(reference);

      const prisma = {
        outcome: {
          findMany: jest.fn(async ({ where }) => {
            if (where?.weekStartDate?.gte) {
              return [
                {
                  id: "cw-1",
                  title: "Ship release",
                  status: OutcomeStatus.Planned,
                  weekStartDate: currentWeekStart,
                },
                {
                  id: "cw-2",
                  title: "Hire coach",
                  status: OutcomeStatus.Done,
                  weekStartDate: currentWeekStart,
                },
              ];
            }
            if (
              where?.status === OutcomeStatus.Missed &&
              where?.weekStartDate?.lt
            ) {
              return [
                {
                  id: "overdue-1",
                  title: "Delayed goal",
                  weekStartDate: previousWeekStart,
                },
              ];
            }
            if (
              where?.weekStartDate instanceof Date &&
              where.weekStartDate.getTime() === previousWeekStart.getTime()
            ) {
              return [
                { status: OutcomeStatus.Done },
                { status: OutcomeStatus.Planned },
              ];
            }
            return [];
          }),
          count: jest.fn().mockResolvedValue(1),
        },
        $transaction: async (operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
      } as unknown as PrismaService;

      const telemetryStub = {
        recordJobSuccess: jest.fn(),
        recordJobFailure: jest.fn(),
      } as unknown as TelemetryService;

      app = await createApp(
        Test.createTestingModule({
          controllers: [OutcomesController],
          providers: [
            OutcomesService,
            RolesGuard,
            { provide: PrismaService, useValue: prisma },
            { provide: TelemetryService, useValue: telemetryStub },
          ],
        }),
      );
    });

    afterEach(async () => {
      jest.useRealTimers();
      await app.close();
    });

    it("summarizes completion totals, overdue counts, and upcoming plans", async () => {
      await request(app.getHttpServer())
        .get("/outcomes/summary")
        .set("Authorization", "Bearer test")
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            totalThisWeek: 2,
            completed: 1,
            planned: 1,
            overdueCount: 1,
            overdue: expect.any(Array),
            upcoming: expect.any(Array),
          });
          expect(body.overdue).toHaveLength(1);
          expect(body.upcoming.length).toBeGreaterThanOrEqual(0);
        });
    });
  });

  describe("/reviews/summary", () => {
    let app: INestApplication;

    beforeEach(async () => {
      const prisma = {
        review: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "review-1",
              type: ReviewType.Daily,
              mood: 4,
              date: new Date(),
              content: "Solid day",
            },
            {
              id: "review-2",
              type: ReviewType.Weekly,
              mood: 2,
              date: new Date(),
              content: "Need focus",
            },
          ]),
        },
      } as unknown as PrismaService;

      app = await createApp(
        Test.createTestingModule({
          controllers: [ReviewsController],
          providers: [
            ReviewsService,
            RolesGuard,
            { provide: PrismaService, useValue: prisma },
          ],
        }),
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it("reports weekly and daily review mix with last entry", async () => {
      await request(app.getHttpServer())
        .get("/reviews/summary")
        .set("Authorization", "Bearer test")
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            lastSevenDays: 2,
            daily: 1,
            weekly: 1,
            averageMood: 3,
          });
          expect(body.lastReview).toMatchObject({ id: "review-1" });
        });
    });
  });

  describe("/activities/summary", () => {
    let app: INestApplication;

    beforeEach(async () => {
      const prisma = {
        activity: {
          groupBy: jest.fn(async ({ by }) => {
            if (by.includes("status")) {
              return [
                { status: "Active", _count: { status: 2 } },
                { status: "Completed", _count: { status: 1 } },
              ];
            }
            return [
              { category: "Growth", _count: { category: 2 } },
              { category: null, _count: { category: 1 } },
            ];
          }),
          count: jest.fn().mockResolvedValue(3),
          findMany: jest.fn().mockResolvedValue([
            {
              id: "activity-1",
              title: "Demo prep",
              category: "Growth",
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            },
          ]),
        },
      } as unknown as PrismaService;

      app = await createApp(
        Test.createTestingModule({
          controllers: [ActivitiesController],
          providers: [
            ActivitiesService,
            RolesGuard,
            { provide: PrismaService, useValue: prisma },
          ],
        }),
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it("structures activity status, category, and upcoming payloads", async () => {
      await request(app.getHttpServer())
        .get("/activities/summary")
        .set("Authorization", "Bearer test")
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toMatchObject({ Active: 2, Completed: 1 });
          expect(body.categories).toMatchObject({
            Growth: 2,
            Uncategorized: 1,
          });
          expect(body.overdue).toBe(3);
          expect(body.upcoming).toHaveLength(1);
        });
    });
  });

  describe("/dashboard/summary", () => {
    let app: INestApplication;

    beforeEach(async () => {
      const summary = (label: string) => ({ label, generated: label });

      const businessService = {
        getSummary: jest.fn().mockResolvedValue(summary("business")),
      };
      const metricsService = {
        getSummary: jest.fn().mockResolvedValue(summary("metrics")),
      };
      const outcomesService = {
        getSummary: jest.fn().mockResolvedValue(summary("outcomes")),
      };
      const reviewsService = {
        getSummary: jest.fn().mockResolvedValue(summary("reviews")),
      };
      const salesService = {
        getSummary: jest.fn().mockResolvedValue(summary("sales")),
      };
      const activitiesService = {
        getSummary: jest.fn().mockResolvedValue(summary("activities")),
      };
      const insightsService = {
        getSummary: jest.fn().mockResolvedValue(summary("insights")),
      };

      app = await createApp(
        Test.createTestingModule({
          controllers: [DashboardController],
          providers: [
            DashboardService,
            RolesGuard,
            { provide: BusinessService, useValue: businessService },
            { provide: MetricsService, useValue: metricsService },
            { provide: OutcomesService, useValue: outcomesService },
            { provide: ReviewsService, useValue: reviewsService },
            { provide: SalesService, useValue: salesService },
            { provide: ActivitiesService, useValue: activitiesService },
            { provide: InsightsService, useValue: insightsService },
          ],
        }),
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it("aggregates module payloads and stamps generation time", async () => {
      await request(app.getHttpServer())
        .get("/dashboard/summary")
        .set("Authorization", "Bearer test")
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            business: { label: "business" },
            metrics: { label: "metrics" },
            outcomes: { label: "outcomes" },
            reviews: { label: "reviews" },
            sales: { label: "sales" },
            activities: { label: "activities" },
            insights: { label: "insights" },
          });
          expect(new Date(body.generatedAt).toString()).not.toBe(
            "Invalid Date",
          );
        });
    });
  });
});
