import { CacheModule } from "@nestjs/cache-manager";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { InsightsController } from "../src/insights/insights.controller";
import { InsightsService } from "../src/insights/insights.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TelemetryService } from "../src/observability/telemetry.service";
import { SalesService } from "../src/sales/sales.service";
import { ActivitiesService } from "../src/activities/activities.service";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

class PrismaStub {
  user = {
    findFirst: jest.fn().mockResolvedValue({ id: "user-e2e" }),
    findMany: jest.fn().mockResolvedValue([]),
  };
  outcome = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  activity = {
    findMany: jest.fn().mockResolvedValue([]),
  };
  activityConfiguration = {
    findUnique: jest.fn().mockResolvedValue(null),
  };
  salesPlanning = {
    findFirst: jest.fn().mockResolvedValue(null),
  };
  salesTracker = {
    findFirst: jest.fn().mockResolvedValue(null),
  };
  salesPlan = {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  };
  $transaction = (operations: Promise<unknown>[]) => Promise.all(operations);
}

class TelemetryStub {
  recordInsightsCalculation = jest.fn();
  recordOutcomesSnapshot = jest.fn();
}

class SalesServiceStub {
  getSummary = jest.fn().mockResolvedValue({
    targets: {
      weeklyAchievementPercent: 0,
    },
  });
}

class ActivitiesServiceStub {
  getWeeklySummary = jest.fn().mockResolvedValue({
    year: 2026,
    week: 1,
    items: [],
    overallCompletionPercent: 0,
  });
}

class OutcomesServiceStub {
  getWeeklySummary = jest.fn().mockResolvedValue({
    year: 2026,
    week: 1,
    planned: 0,
    completed: 0,
    completionPercent: 0,
  });
}

class AllowGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      userId: "user-e2e",
      tenantId: "tenant-e2e",
      role: Role.TENANT_ADMIN,
    };
    return true;
  }
}

describe("GET /insights/weekly-diagnostics (e2e)", () => {
  let app: INestApplication;
  let salesServiceStub: SalesServiceStub;
  let activitiesServiceStub: ActivitiesServiceStub;
  let outcomesServiceStub: OutcomesServiceStub;

  beforeEach(async () => {
    salesServiceStub = new SalesServiceStub();
    activitiesServiceStub = new ActivitiesServiceStub();
    outcomesServiceStub = new OutcomesServiceStub();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [InsightsController],
      providers: [
        InsightsService,
        { provide: PrismaService, useClass: PrismaStub },
        { provide: TelemetryService, useClass: TelemetryStub },
        { provide: SalesService, useValue: salesServiceStub },
        { provide: ActivitiesService, useValue: activitiesServiceStub },
        { provide: OutcomesService, useValue: outcomesServiceStub },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ============================================
  // TEST 1: All low → effort + execution issues
  // ============================================
  describe("when all metrics are low", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 50 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        items: [],
        overallCompletionPercent: 40,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        planned: 5,
        completed: 1,
        completionPercent: 20,
      });
    });

    it("should return effort + execution issues (CRITICAL + WARNING)", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "SALES",
            level: "CRITICAL",
            message: expect.stringContaining("insufficient activity"),
          }),
          expect.objectContaining({
            type: "OUTCOME",
            level: "WARNING",
            message: expect.stringContaining("not being completed"),
          }),
        ]),
      );
    });

    it("should compute negative momentum effect", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // sales < 80 → -5, activities < 80 → -3, outcomes < 80 → -2 = -10
      expect(res.body.summary.momentumEffect).toBe(-10);
    });
  });

  // ============================================
  // TEST 2: Activities OK, sales low → pipeline issue
  // ============================================
  describe("when activities are healthy but sales low", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 60 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        items: [],
        overallCompletionPercent: 90,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        planned: 5,
        completed: 5,
        completionPercent: 100,
      });
    });

    it("should return pipeline issue (WARNING)", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "SALES",
            level: "WARNING",
            message: expect.stringContaining("conversions are low"),
          }),
        ]),
      );

      // Should NOT have effort issue since activities >= 80
      expect(res.body.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: "CRITICAL",
          }),
        ]),
      );
    });

    it("should compute momentum effect correctly", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // sales < 80 → -5 (activities OK, outcomes OK)
      expect(res.body.summary.momentumEffect).toBe(-5);
    });
  });

  // ============================================
  // TEST 3: Sales high → success
  // ============================================
  describe("when sales exceed target", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 120 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        items: [],
        overallCompletionPercent: 95,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        planned: 5,
        completed: 5,
        completionPercent: 100,
      });
    });

    it("should return success messages", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "ACTIVITY",
            level: "SUCCESS",
            message: expect.stringContaining("Momentum is building"),
          }),
          expect.objectContaining({
            type: "SALES",
            level: "SUCCESS",
            message: expect.stringContaining("exceeded target"),
          }),
        ]),
      );
    });

    it("should compute positive momentum effect", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // sales >= 100 → +5
      expect(res.body.summary.momentumEffect).toBe(5);
    });
  });

  // ============================================
  // TEST 4: Mixed cases → stacked diagnostics
  // ============================================
  describe("when metrics are mixed", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 85 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        items: [],
        overallCompletionPercent: 90,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        planned: 5,
        completed: 2,
        completionPercent: 40,
      });
    });

    it("should return stacked diagnostics (momentum + execution issue)", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "ACTIVITY",
            level: "SUCCESS",
            message: expect.stringContaining("Momentum is building"),
          }),
          expect.objectContaining({
            type: "OUTCOME",
            level: "WARNING",
            message: expect.stringContaining("not being completed"),
          }),
        ]),
      );
    });

    it("should compute mixed momentum effect", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // outcomes < 80 → -2
      expect(res.body.summary.momentumEffect).toBe(-2);
    });
  });

  // ============================================
  // TEST 5: No data → returns empty diagnostics safely
  // ============================================
  describe("when no data exists", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: null,
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        items: [],
        overallCompletionPercent: 0,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        year: 2026,
        week: 1,
        planned: 0,
        completed: 0,
        completionPercent: 0,
      });
    });

    it("should return safely with 0 metrics", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.summary.salesAchievementPercent).toBe(0);
      expect(res.body.summary.activityCompletionPercent).toBe(0);
      expect(res.body.summary.outcomeCompletionPercent).toBe(0);
    });

    it("should return diagnostics based on all-zero metrics", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // All metrics < 80 → effort issue + execution issue
      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "SALES",
            level: "CRITICAL",
          }),
          expect.objectContaining({
            type: "OUTCOME",
            level: "WARNING",
          }),
        ]),
      );
    });
  });

  // ============================================
  // TEST 6: Service throws → returns 0 safely
  // ============================================
  describe("when a service throws an error", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockRejectedValue(new Error("DB error"));
      activitiesServiceStub.getWeeklySummary.mockRejectedValue(
        new Error("DB error"),
      );
      outcomesServiceStub.getWeeklySummary.mockRejectedValue(
        new Error("DB error"),
      );
    });

    it("should return safely with 0 metrics (never throw)", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.summary.salesAchievementPercent).toBe(0);
      expect(res.body.summary.activityCompletionPercent).toBe(0);
      expect(res.body.summary.outcomeCompletionPercent).toBe(0);
    });
  });

  // ============================================
  // TEST 7: Week validation
  // ============================================
  describe("week parameter validation", () => {
    it("should reject week < 1", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics?week=0")
        .expect(400);

      expect(res.body.message).toContain("Week must be between 1 and 52");
    });

    it("should reject week > 52", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics?week=53")
        .expect(400);

      expect(res.body.message).toContain("Week must be between 1 and 52");
    });

    it("should accept valid week numbers", async () => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 50 },
      });

      await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics?week=1")
        .expect(200);

      await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics?week=52")
        .expect(200);
    });
  });

  // ============================================
  // TEST 8: Year and week in response
  // ============================================
  describe("response structure", () => {
    beforeEach(() => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 85 },
      });
    });

    it("should return specified year and week", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics?year=2025&week=10")
        .expect(200);

      expect(res.body.year).toBe(2025);
      expect(res.body.week).toBe(10);
    });

    it("should default to current year and week", async () => {
      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      expect(res.body.year).toBe(new Date().getFullYear());
      expect(res.body.week).toBeGreaterThanOrEqual(1);
      expect(res.body.week).toBeLessThanOrEqual(52);
    });
  });

  // ============================================
  // TEST 9: Momentum effect clamping
  // ============================================
  describe("momentum effect clamping", () => {
    it("should clamp to -10 when all metrics are bad", async () => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 10 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        overallCompletionPercent: 10,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        completionPercent: 10,
      });

      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // -5 -3 -2 = -10, clamped to -10
      expect(res.body.summary.momentumEffect).toBe(-10);
    });

    it("should clamp to +10 even with very high scores", async () => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 200 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        overallCompletionPercent: 100,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        completionPercent: 100,
      });

      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // +5, nothing negative (all >= 80), capped at 10 but only 5 added
      expect(res.body.summary.momentumEffect).toBe(5);
    });
  });

  // ============================================
  // TEST 10: Boundary cases at 80%
  // ============================================
  describe("boundary cases at 80% threshold", () => {
    it("should treat exactly 80% as healthy (no negative rules)", async () => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 80 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        overallCompletionPercent: 80,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        completionPercent: 80,
      });

      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // At 80%, should get "momentum building" SUCCESS
      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "ACTIVITY",
            level: "SUCCESS",
          }),
        ]),
      );

      // No negative rules should fire
      expect(res.body.diagnostics).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ level: "CRITICAL" }),
          expect.objectContaining({ level: "WARNING" }),
        ]),
      );

      // Momentum effect should be 0 (nothing < 80, nothing >= 100)
      expect(res.body.summary.momentumEffect).toBe(0);
    });

    it("should treat 79% as below threshold", async () => {
      salesServiceStub.getSummary.mockResolvedValue({
        targets: { weeklyAchievementPercent: 79 },
      });
      activitiesServiceStub.getWeeklySummary.mockResolvedValue({
        overallCompletionPercent: 79,
      });
      outcomesServiceStub.getWeeklySummary.mockResolvedValue({
        completionPercent: 79,
      });

      const res = await request(app.getHttpServer())
        .get("/insights/weekly-diagnostics")
        .expect(200);

      // Should get effort issue (CRITICAL) + execution issue (WARNING)
      expect(res.body.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ level: "CRITICAL" }),
          expect.objectContaining({ level: "WARNING" }),
        ]),
      );
    });
  });
});
