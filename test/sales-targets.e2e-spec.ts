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
import { SalesController } from "../src/sales/sales.controller";
import { SalesService } from "../src/sales/sales.service";
import { SalesTargetsService } from "../src/sales/sales-targets.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

class PrismaStub {
  salesPlan = { findUnique: jest.fn() };
  salesPlanning = { findFirst: jest.fn() };
  salesTracker = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  $transaction = (operations: Promise<unknown>[]) => Promise.all(operations);
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

describe("Sales Targets endpoints (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaStub;

  const mockSalesPlan = {
    id: "plan-2026",
    tenantId: "tenant-e2e",
    yearMinus3Value: 800000,
    yearMinus2Value: 900000,
    yearMinus1Value: 1000000,
    projectedYearValue: 1200000,
    // Monthly contribution percentages (8.33% each for simplicity)
    monthlyContribution: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.37],
    // Calculated monthly targets
    monthlyTargets: [100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Set to January 2, 2026 (Thursday - day 4 of week 1)
    jest.useFakeTimers().setSystemTime(new Date("2026-01-02T12:00:00.000Z"));

    prisma = new PrismaStub();
    prisma.salesPlan.findUnique.mockResolvedValue(mockSalesPlan);
    prisma.salesPlanning.findFirst.mockResolvedValue(null);
    prisma.salesTracker.findFirst.mockResolvedValue({
      id: "tracker-jan",
      month: "2026-01",
      target: 100000,
      achieved: 15000,
      orders: 10,
      asp: 1500,
      profit: 5000,
    });
    prisma.salesTracker.findMany.mockResolvedValue([]);
    prisma.salesTracker.count.mockResolvedValue(0);

    const moduleBuilder = Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [SalesController],
      providers: [
        SalesService,
        SalesTargetsService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowGuard);

    const moduleRef: TestingModule = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.useRealTimers();
  });

  describe("GET /sales/targets", () => {
    it("should return current period targets", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets")
        .expect(200);

      expect(res.body).toHaveProperty("year", 2026);
      expect(res.body).toHaveProperty("currentMonth", 1);
      expect(res.body).toHaveProperty("currentWeek");
      expect(res.body).toHaveProperty("monthlyTarget", 100000);
      expect(res.body).toHaveProperty("weeklyTarget", 20000); // 100000 / 5 weeks in Jan
      expect(res.body).toHaveProperty("achievedThisMonth");
      expect(res.body).toHaveProperty("achievedThisWeek");
      expect(res.body).toHaveProperty("monthlyAchievementPercent");
      expect(res.body).toHaveProperty("weeklyAchievementPercent");
      expect(res.body).toHaveProperty("daysRemainingInWeek");
      expect(res.body).toHaveProperty("weeksRemainingInMonth");
    });

    it("should return zeros when no SalesPlan exists", async () => {
      prisma.salesPlan.findUnique.mockResolvedValue(null);
      prisma.salesTracker.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get("/sales/targets")
        .expect(200);

      expect(res.body.monthlyTarget).toBe(0);
      expect(res.body.weeklyTarget).toBe(0);
      expect(res.body.achievedThisMonth).toBe(0);
      expect(res.body.monthlyAchievementPercent).toBe(0);
    });
  });

  describe("GET /sales/targets/monthly", () => {
    it("should return all 12 monthly targets", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets/monthly")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(12);
      
      // Check January (5 weeks)
      expect(res.body[0]).toMatchObject({
        month: 1,
        monthName: "January",
        weeksInMonth: 5,
        targetValue: 100000,
      });

      // Check May (4 weeks)
      expect(res.body[4]).toMatchObject({
        month: 5,
        monthName: "May",
        weeksInMonth: 4,
        targetValue: 100000,
      });
    });

    it("should return empty targets when no SalesPlan exists", async () => {
      prisma.salesPlan.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get("/sales/targets/monthly")
        .expect(200);

      expect(res.body).toHaveLength(12);
      expect(res.body[0].targetValue).toBe(0);
    });
  });

  describe("GET /sales/targets/weekly", () => {
    it("should return all 52 weekly targets", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets/weekly")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(52);
      
      // Check week 1 (in January)
      expect(res.body[0]).toMatchObject({
        weekNumber: 1,
        month: 1,
        monthName: "January",
        weekInMonth: 1,
        weeklyTarget: 20000, // 100000 / 5 weeks
      });

      // Check cumulative target increases
      expect(res.body[0].cumulativeTarget).toBe(20000);
      expect(res.body[4].cumulativeTarget).toBe(100000); // End of January (week 5)
    });

    it("should have proper week distribution per month", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets/weekly")
        .expect(200);

      // Verify Excel-style week distribution [5,5,5,5,4,4,4,4,4,4,4,4]
      const weeksPerMonth = new Map<number, number>();
      res.body.forEach((week: any) => {
        const count = weeksPerMonth.get(week.month) || 0;
        weeksPerMonth.set(week.month, count + 1);
      });

      // Jan-Apr should have 5 weeks
      expect(weeksPerMonth.get(1)).toBe(5);
      expect(weeksPerMonth.get(2)).toBe(5);
      expect(weeksPerMonth.get(3)).toBe(5);
      expect(weeksPerMonth.get(4)).toBe(5);

      // May-Dec should have 4 weeks
      expect(weeksPerMonth.get(5)).toBe(4);
      expect(weeksPerMonth.get(12)).toBe(4);
    });
  });

  describe("GET /sales/targets/week", () => {
    it("should return target for specific week", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets/week")
        .query({ week: 1 })
        .expect(200);

      expect(res.body).toMatchObject({
        weekNumber: 1,
        month: 1,
        monthName: "January",
        weekInMonth: 1,
        weeklyTarget: 20000,
      });
    });

    it("should return 400 for week > 52", async () => {
      await request(app.getHttpServer())
        .get("/sales/targets/week")
        .query({ week: 53 })
        .expect(400);
    });

    it("should return week 26 correctly (mid-year)", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets/week")
        .query({ week: 26 })
        .expect(200);

      // Week 26 should be in July (month 7)
      // Jan(5) + Feb(5) + Mar(5) + Apr(5) + May(4) + Jun(4) = 28 weeks
      // Week 26 is in June (weeks 25-28)
      expect(res.body.weekNumber).toBe(26);
      expect(res.body.month).toBe(6); // June
    });

    it("should reject invalid week parameter", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/targets/week")
        .query({ week: 0 })
        .expect(400);
    });
  });

  describe("GET /sales/summary with targets", () => {
    it("should include targets in summary response", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/summary")
        .expect(200);

      expect(res.body).toHaveProperty("targets");
      expect(res.body.targets).toMatchObject({
        monthlyTarget: 100000,
        weeklyTarget: 20000,
      });
      expect(res.body.targets).toHaveProperty("achievedThisMonth");
      expect(res.body.targets).toHaveProperty("achievedThisWeek");
      expect(res.body.targets).toHaveProperty("monthlyAchievementPercent");
      expect(res.body.targets).toHaveProperty("weeklyAchievementPercent");
    });
  });
});
