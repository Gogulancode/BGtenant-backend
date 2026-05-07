import { CacheModule } from "@nestjs/cache-manager";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { Role, OutcomeStatus } from "@prisma/client";
import { OutcomesController } from "../src/outcomes/outcomes.controller";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TelemetryService } from "../src/observability/telemetry.service";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

class PrismaStub {
  outcome = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  $transaction = (operations: Promise<unknown>[]) => Promise.all(operations);
}

class TelemetryStub {
  recordOutcomesSnapshot = jest.fn();
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

describe("GET /outcomes/weekly-summary (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaStub;

  beforeEach(async () => {
    prisma = new PrismaStub();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [OutcomesController],
      providers: [
        OutcomesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useClass: TelemetryStub },
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
  // TEST 1: No outcomes
  // ============================================
  describe("when no outcomes exist", () => {
    beforeEach(() => {
      prisma.outcome.findMany.mockResolvedValue([]);
    });

    it("should return planned=0, completed=0, completionPercent=0", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      expect(res.body).toMatchObject({
        year: expect.any(Number),
        week: expect.any(Number),
        planned: 0,
        completed: 0,
        completionPercent: 0,
      });
    });

    it("should accept year and week query params", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?year=2026&week=10")
        .expect(200);

      expect(res.body).toMatchObject({
        year: 2026,
        week: 10,
        planned: 0,
        completed: 0,
        completionPercent: 0,
      });
    });
  });

  // ============================================
  // TEST 2: Outcomes planned but none completed
  // ============================================
  describe("when outcomes are planned but none completed", () => {
    beforeEach(() => {
      prisma.outcome.findMany.mockResolvedValue([
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Missed },
      ]);
    });

    it("should return planned > 0 and completed = 0", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      expect(res.body.planned).toBe(4);
      expect(res.body.completed).toBe(0);
      expect(res.body.completionPercent).toBe(0);
    });
  });

  // ============================================
  // TEST 3: Outcomes planned and completed
  // ============================================
  describe("when outcomes are planned and some completed", () => {
    beforeEach(() => {
      prisma.outcome.findMany.mockResolvedValue([
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Missed },
      ]);
    });

    it("should calculate correct completionPercent", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      expect(res.body.planned).toBe(5);
      expect(res.body.completed).toBe(3);
      // 3/5 = 60%
      expect(res.body.completionPercent).toBe(60);
    });
  });

  // ============================================
  // TEST 4: 100% completion
  // ============================================
  describe("when all outcomes are completed", () => {
    beforeEach(() => {
      prisma.outcome.findMany.mockResolvedValue([
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Done },
      ]);
    });

    it("should return 100% completionPercent", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      expect(res.body.planned).toBe(3);
      expect(res.body.completed).toBe(3);
      expect(res.body.completionPercent).toBe(100);
    });
  });

  // ============================================
  // TEST 5: Week validation
  // ============================================
  describe("week parameter validation", () => {
    it("should reject week < 1", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?week=0")
        .expect(400);

      expect(res.body.message).toContain("Week must be between 1 and 52");
    });

    it("should reject week > 52", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?week=53")
        .expect(400);

      expect(res.body.message).toContain("Week must be between 1 and 52");
    });

    it("should accept valid week numbers", async () => {
      prisma.outcome.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?week=1")
        .expect(200);

      await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?week=52")
        .expect(200);
    });
  });

  // ============================================
  // TEST 6: Tenant isolation
  // ============================================
  describe("tenant isolation", () => {
    it("should only count outcomes for the current tenant", async () => {
      prisma.outcome.findMany.mockResolvedValue([
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Planned },
      ]);

      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      // Verify the findMany was called with correct tenant filter
      expect(prisma.outcome.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-e2e",
            userId: "user-e2e",
          }),
        }),
      );
    });
  });

  // ============================================
  // TEST 7: Year parameter handling
  // ============================================
  describe("year parameter handling", () => {
    beforeEach(() => {
      prisma.outcome.findMany.mockResolvedValue([]);
    });

    it("should default to current year when not specified", async () => {
      const currentYear = new Date().getFullYear();

      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      expect(res.body.year).toBe(currentYear);
    });

    it("should accept past years", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?year=2024")
        .expect(200);

      expect(res.body.year).toBe(2024);
    });

    it("should accept future years", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?year=2030")
        .expect(200);

      expect(res.body.year).toBe(2030);
    });
  });

  // ============================================
  // TEST 8: Partial completion percentages
  // ============================================
  describe("partial completion percentages", () => {
    it("should handle decimal percentages correctly", async () => {
      prisma.outcome.findMany.mockResolvedValue([
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Planned },
      ]);

      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      // 1/3 = 33.333...% should be rounded
      expect(res.body.completionPercent).toBeCloseTo(33.3, 1);
    });
  });

  // ============================================
  // TEST 9: Week date range filtering
  // ============================================
  describe("week date range filtering", () => {
    it("should filter outcomes by weekStartDate within week range", async () => {
      prisma.outcome.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get("/outcomes/weekly-summary?year=2026&week=1")
        .expect(200);

      // Verify the findMany was called with date range filter
      expect(prisma.outcome.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            weekStartDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ============================================
  // TEST 10: Mixed statuses
  // ============================================
  describe("when outcomes have mixed statuses", () => {
    beforeEach(() => {
      prisma.outcome.findMany.mockResolvedValue([
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Done },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Planned },
        { status: OutcomeStatus.Missed },
        { status: OutcomeStatus.Missed },
      ]);
    });

    it("should only count Done status as completed", async () => {
      const res = await request(app.getHttpServer())
        .get("/outcomes/weekly-summary")
        .expect(200);

      expect(res.body.planned).toBe(7);
      expect(res.body.completed).toBe(2);
      // 2/7 = 28.57%
      expect(res.body.completionPercent).toBeCloseTo(28.6, 1);
    });
  });
});
