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
  achievementStage = { findMany: jest.fn() };
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

describe("GET /sales/weekly-summary (e2e)", () => {
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
    monthlyContribution: [
      8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.37,
    ],
    // Calculated monthly targets (100000 each month = 1.2M/year)
    monthlyTargets: [
      100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000,
      100000, 100000, 100000,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAchievementStages = [
    {
      id: "stage-1",
      tenantId: "tenant-e2e",
      name: "Bronze",
      order: 1,
      targetValue: 300000,
      percentOfGoal: 25,
      color: "#CD7F32",
      icon: "bronze",
      reward: "Bronze level achieved!",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "stage-2",
      tenantId: "tenant-e2e",
      name: "Silver",
      order: 2,
      targetValue: 600000,
      percentOfGoal: 50,
      color: "#C0C0C0",
      icon: "silver",
      reward: "Silver level achieved!",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "stage-3",
      tenantId: "tenant-e2e",
      name: "Gold",
      order: 3,
      targetValue: 900000,
      percentOfGoal: 75,
      color: "#FFD700",
      icon: "gold",
      reward: "Gold level achieved!",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "stage-4",
      tenantId: "tenant-e2e",
      name: "Platinum",
      order: 4,
      targetValue: 1200000,
      percentOfGoal: 100,
      color: "#E5E4E2",
      icon: "platinum",
      reward: "Platinum level achieved!",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    // Set to January 15, 2026 (Thursday - week 3)
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

    prisma = new PrismaStub();
    prisma.salesPlan.findUnique.mockResolvedValue(mockSalesPlan);
    prisma.salesPlanning.findFirst.mockResolvedValue(null);
    prisma.salesTracker.findFirst.mockResolvedValue(null);
    prisma.salesTracker.findMany.mockResolvedValue([]);
    prisma.salesTracker.count.mockResolvedValue(0);
    prisma.achievementStage.findMany.mockResolvedValue(mockAchievementStages);

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
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.useRealTimers();
  });

  // ============================================
  // Test 1: No SalesPlan - returns zeros
  // ============================================
  describe("No SalesPlan", () => {
    beforeEach(() => {
      prisma.salesPlan.findUnique.mockResolvedValue(null);
      prisma.achievementStage.findMany.mockResolvedValue([]);
    });

    it("should return correct number of weeks (default 6)", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      expect(res.body).toHaveProperty("year", 2026);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      // Default range: last 6 weeks (week 3 is current, so weeks 1-3)
      // Since we're in week 3, fromWeek = max(1, 3-5) = 1
      expect(res.body.fromWeek).toBe(1);
      expect(res.body.toWeek).toBeGreaterThanOrEqual(1);
    });

    it("should have all targets = 0", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      for (const item of res.body.items) {
        expect(item.target).toBe(0);
      }
    });

    it("should have all achieved = 0", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      for (const item of res.body.items) {
        expect(item.achieved).toBe(0);
      }
    });

    it("should have stage = null for all items", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      for (const item of res.body.items) {
        expect(item.stage).toBeNull();
      }
    });
  });

  // ============================================
  // Test 2: With SalesPlan - weeklyTargets used correctly
  // ============================================
  describe("With SalesPlan", () => {
    it("should use weekly targets from SalesPlan", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      // January has 5 weeks in Excel-style, so weekly target = 100000 / 5 = 20000
      const januaryWeeklyTarget = 20000;

      // All items should be in January (weeks 1-3 for current week = 3)
      for (const item of res.body.items) {
        expect(item.target).toBe(januaryWeeklyTarget);
      }
    });

    it("should return items sorted by week ascending", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      const weeks = res.body.items.map((i: { week: number }) => i.week);
      const sorted = [...weeks].sort((a, b) => a - b);
      expect(weeks).toEqual(sorted);
    });

    it("should have correct year in response", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?year=2025")
        .expect(200);

      expect(res.body.year).toBe(2025);
    });
  });

  // ============================================
  // Test 3: Tracker aggregation
  // ============================================
  describe("Tracker aggregation", () => {
    it("should distribute monthly tracker entries evenly across weeks", async () => {
      // Mock tracker entries for January (5 weeks, 100000 achieved = 20000 per week)
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 100000 }, // January
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=5")
        .expect(200);

      // Each week should have 100000 / 5 = 20000 achieved
      for (const item of res.body.items) {
        expect(item.achieved).toBe(20000);
      }
    });

    it("should calculate correct achievement percentages", async () => {
      // Target is 20000 per week, achieved 100000 in month = 20000/week = 100%
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 100000 },
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const week1 = res.body.items[0];
      // 20000 achieved / 20000 target = 100%
      expect(week1.achievementPercent).toBe(100);
    });

    it("should handle weeks with no tracker entries", async () => {
      // No tracker entries for January
      prisma.salesTracker.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=3")
        .expect(200);

      for (const item of res.body.items) {
        expect(item.achieved).toBe(0);
        expect(item.achievementPercent).toBe(0);
      }
    });

    it("should handle multiple months in week range", async () => {
      // Weeks 4-6 span January (5 weeks) and February (5 weeks)
      // Week 5 is last week of Jan, Week 6 is first week of Feb
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 50000 }, // 10000 per week in Jan
        { month: "2026-02", achieved: 75000 }, // 15000 per week in Feb
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=4&toWeek=7")
        .expect(200);

      const week4 = res.body.items.find((i: { week: number }) => i.week === 4);
      const week5 = res.body.items.find((i: { week: number }) => i.week === 5);
      const week6 = res.body.items.find((i: { week: number }) => i.week === 6);
      const week7 = res.body.items.find((i: { week: number }) => i.week === 7);

      // Weeks 4 and 5 are in January (50000 / 5 = 10000)
      expect(week4?.achieved).toBe(10000);
      expect(week5?.achieved).toBe(10000);
      
      // Weeks 6 and 7 are in February (75000 / 5 = 15000)
      expect(week6?.achieved).toBe(15000);
      expect(week7?.achieved).toBe(15000);
    });
  });

  // ============================================
  // Test 4: Achievement stage mapping
  // ============================================
  describe("Achievement stage mapping", () => {
    it("should assign correct stage based on percent (Bronze: 0-25%)", async () => {
      // Target = 20000, achieved = 4000 per week → 20%
      // 20000 monthly = 4000 per week (20000 / 5 weeks)
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 20000 }, // 4000 per week = 20%
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const week1 = res.body.items[0];
      expect(week1.achievementPercent).toBe(20);
      expect(week1.stage).not.toBeNull();
      expect(week1.stage.name).toBe("Bronze");
    });

    it("should assign correct stage based on percent (Silver: 25-50%)", async () => {
      // Target = 20000, 40000 monthly = 8000 per week = 40%
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 40000 }, // 8000 per week = 40%
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const week1 = res.body.items[0];
      expect(week1.achievementPercent).toBe(40);
      expect(week1.stage).not.toBeNull();
      expect(week1.stage.name).toBe("Silver");
    });

    it("should assign correct stage based on percent (Gold: 50-75%)", async () => {
      // Target = 20000, 70000 monthly = 14000 per week = 70%
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 70000 }, // 14000 per week = 70%
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const week1 = res.body.items[0];
      expect(week1.achievementPercent).toBe(70);
      expect(week1.stage).not.toBeNull();
      expect(week1.stage.name).toBe("Gold");
    });

    it("should assign highest stage for percent > 100%", async () => {
      // Target = 20000, 150000 monthly = 30000 per week = 150%
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 150000 }, // 30000 per week = 150%
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const week1 = res.body.items[0];
      expect(week1.achievementPercent).toBe(150);
      expect(week1.stage).not.toBeNull();
      expect(week1.stage.name).toBe("Platinum");
    });

    it("should return stage = null when no stages configured", async () => {
      prisma.achievementStage.findMany.mockResolvedValue([]);
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 50000 },
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      expect(res.body.items[0].stage).toBeNull();
    });
  });

  // ============================================
  // Test 5: Range handling
  // ============================================
  describe("Range handling", () => {
    it("should respect custom fromWeek/toWeek", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=5&toWeek=10")
        .expect(200);

      expect(res.body.fromWeek).toBe(5);
      expect(res.body.toWeek).toBe(10);
      expect(res.body.items).toHaveLength(6); // weeks 5,6,7,8,9,10
    });

    it("should return 400 when fromWeek > toWeek", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=10&toWeek=5")
        .expect(400);

      expect(res.body.message).toContain("fromWeek cannot be greater than toWeek");
    });

    it("should return 400 when week < 1", async () => {
      await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=0&toWeek=5")
        .expect(400);
    });

    it("should return 400 when week > 52", async () => {
      await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=53")
        .expect(400);
    });

    it("should default to last 6 weeks when no range specified", async () => {
      // Current week is 3, so default fromWeek = max(1, 3-5) = 1
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      expect(res.body.fromWeek).toBe(1);
      expect(res.body.toWeek).toBe(3); // current week
    });

    it("should handle single week range", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=5&toWeek=5")
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].week).toBe(5);
    });
  });

  // ============================================
  // Test 6: Year handling
  // ============================================
  describe("Year handling", () => {
    it("should default to current year", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      expect(res.body.year).toBe(2026);
    });

    it("should allow specifying a different year", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?year=2025")
        .expect(200);

      expect(res.body.year).toBe(2025);
    });
  });

  // ============================================
  // Test 7: Response structure
  // ============================================
  describe("Response structure", () => {
    it("should have correct top-level structure", async () => {
      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary")
        .expect(200);

      expect(res.body).toHaveProperty("year");
      expect(res.body).toHaveProperty("fromWeek");
      expect(res.body).toHaveProperty("toWeek");
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("should have correct item structure", async () => {
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 50000 },
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const item = res.body.items[0];
      expect(item).toHaveProperty("week");
      expect(item).toHaveProperty("target");
      expect(item).toHaveProperty("achieved");
      expect(item).toHaveProperty("achievementPercent");
      expect(item).toHaveProperty("stage");
    });

    it("should have correct stage structure when present", async () => {
      prisma.salesTracker.findMany.mockResolvedValue([
        { month: "2026-01", achieved: 50000 },
      ]);

      const res = await request(app.getHttpServer())
        .get("/sales/weekly-summary?fromWeek=1&toWeek=1")
        .expect(200);

      const stage = res.body.items[0].stage;
      expect(stage).toHaveProperty("name");
      expect(stage).toHaveProperty("minPercentage");
      expect(stage).toHaveProperty("maxPercentage");
      // color is optional
    });
  });
});
