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
import { ActivitiesController } from "../src/activities/activities.controller";
import { ActivitiesService } from "../src/activities/activities.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

class PrismaStub {
  activityConfiguration = { findUnique: jest.fn() };
  activity = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
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

// Guard that simulates a different tenant
class OtherTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      userId: "user-other",
      tenantId: "tenant-other",
      role: Role.TENANT_ADMIN,
    };
    return true;
  }
}

describe("GET /activities/weekly-summary (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaStub;

  const mockActivityConfig = {
    id: "config-1",
    tenantId: "tenant-e2e",
    salesEnabled: true,
    marketingEnabled: true,
    networkingEnabled: false,
    productDevEnabled: false,
    operationsEnabled: true,
    weeklyActivityGoal: 15,
    enableReminders: true,
    reminderDays: [1, 3, 5],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = new PrismaStub();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [ActivitiesController],
      providers: [
        ActivitiesService,
        { provide: PrismaService, useValue: prisma },
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
  // TEST 1: No ActivityConfiguration
  // ============================================
  describe("when no ActivityConfiguration exists", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(null);
    });

    it("should return empty items and 0% completion", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(res.body).toMatchObject({
        year: expect.any(Number),
        week: expect.any(Number),
        items: [],
        overallCompletionPercent: 0,
      });
    });

    it("should accept year and week query params", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary?year=2026&week=10")
        .expect(200);

      expect(res.body).toMatchObject({
        year: 2026,
        week: 10,
        items: [],
        overallCompletionPercent: 0,
      });
    });
  });

  // ============================================
  // TEST 2: With configuration, no activities logged
  // ============================================
  describe("when configuration exists but no activities logged", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(
        mockActivityConfig,
      );
      prisma.activity.findMany.mockResolvedValue([]);
    });

    it("should return items with actual=0 and completionPercent=0", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(res.body.items).toHaveLength(3); // Sales, Marketing, Operations enabled
      expect(res.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "Sales",
            actual: 0,
            completionPercent: 0,
          }),
          expect.objectContaining({
            category: "Marketing",
            actual: 0,
            completionPercent: 0,
          }),
          expect.objectContaining({
            category: "Operations",
            actual: 0,
            completionPercent: 0,
          }),
        ]),
      );
      expect(res.body.overallCompletionPercent).toBe(0);
    });

    it("should distribute weekly goal evenly across enabled categories", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      // 15 / 3 categories = 5 per category
      for (const item of res.body.items) {
        expect(item.target).toBe(5);
      }
    });
  });

  // ============================================
  // TEST 3: With activities logged
  // ============================================
  describe("when activities are logged", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(
        mockActivityConfig,
      );
      prisma.activity.findMany.mockResolvedValue([
        { category: "Sales" },
        { category: "Sales" },
        { category: "Sales" },
        { category: "Marketing" },
        { category: "Marketing" },
        { category: "Operations" },
      ]);
    });

    it("should group activities by category correctly", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      const salesItem = res.body.items.find(
        (i: any) => i.category === "Sales",
      );
      const marketingItem = res.body.items.find(
        (i: any) => i.category === "Marketing",
      );
      const operationsItem = res.body.items.find(
        (i: any) => i.category === "Operations",
      );

      expect(salesItem.actual).toBe(3);
      expect(marketingItem.actual).toBe(2);
      expect(operationsItem.actual).toBe(1);
    });

    it("should calculate completionPercent correctly", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      const salesItem = res.body.items.find(
        (i: any) => i.category === "Sales",
      );
      // 3 actual / 5 target = 60%
      expect(salesItem.completionPercent).toBe(60);
    });

    it("should calculate overallCompletionPercent correctly", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      // Total actual: 3 + 2 + 1 = 6
      // Total target: 5 + 5 + 5 = 15
      // 6 / 15 = 40%
      expect(res.body.overallCompletionPercent).toBe(40);
    });
  });

  // ============================================
  // TEST 4: Multiple categories independently computed
  // ============================================
  describe("when multiple categories have different completion rates", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue({
        ...mockActivityConfig,
        salesEnabled: true,
        marketingEnabled: true,
        networkingEnabled: true,
        productDevEnabled: true,
        operationsEnabled: true,
        weeklyActivityGoal: 10, // 10 / 5 categories = 2 per category
      });
      prisma.activity.findMany.mockResolvedValue([
        { category: "Sales" },
        { category: "Sales" },
        { category: "Sales" }, // 3/2 = 150%
        { category: "Marketing" },
        { category: "Marketing" }, // 2/2 = 100%
        { category: "Networking" }, // 1/2 = 50%
        // Product Dev: 0/2 = 0%
        // Operations: 0/2 = 0%
      ]);
    });

    it("should compute each category independently", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(res.body.items).toHaveLength(5);

      const salesItem = res.body.items.find(
        (i: any) => i.category === "Sales",
      );
      const marketingItem = res.body.items.find(
        (i: any) => i.category === "Marketing",
      );
      const networkingItem = res.body.items.find(
        (i: any) => i.category === "Networking",
      );
      const productDevItem = res.body.items.find(
        (i: any) => i.category === "Product Dev",
      );
      const operationsItem = res.body.items.find(
        (i: any) => i.category === "Operations",
      );

      expect(salesItem.completionPercent).toBe(150);
      expect(marketingItem.completionPercent).toBe(100);
      expect(networkingItem.completionPercent).toBe(50);
      expect(productDevItem.completionPercent).toBe(0);
      expect(operationsItem.completionPercent).toBe(0);
    });

    it("should calculate overallCompletionPercent from sum of actual/target", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      // Total actual: 3 + 2 + 1 + 0 + 0 = 6
      // Total target: 2 * 5 = 10
      // 6 / 10 = 60%
      expect(res.body.overallCompletionPercent).toBe(60);
    });
  });

  // ============================================
  // TEST 5: Week validation
  // ============================================
  describe("week parameter validation", () => {
    it("should reject week < 1", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary?week=0")
        .expect(400);

      expect(res.body.message).toContain("Week must be between 1 and 52");
    });

    it("should reject week > 52", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary?week=53")
        .expect(400);

      expect(res.body.message).toContain("Week must be between 1 and 52");
    });

    it("should accept valid week numbers", async () => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get("/activities/weekly-summary?week=1")
        .expect(200);

      await request(app.getHttpServer())
        .get("/activities/weekly-summary?week=52")
        .expect(200);
    });
  });

  // ============================================
  // TEST 6: Tenant isolation
  // ============================================
  describe("tenant isolation", () => {
    it("should only count activities for the current tenant", async () => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(
        mockActivityConfig,
      );
      // Mock returns activities - the service filters by tenantId
      prisma.activity.findMany.mockResolvedValue([
        { category: "Sales" },
        { category: "Sales" },
      ]);

      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      // Verify the findMany was called with correct tenant filter
      expect(prisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-e2e",
          }),
        }),
      );
    });

    it("should only load configuration for the current tenant", async () => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(
        mockActivityConfig,
      );
      prisma.activity.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(prisma.activityConfiguration.findUnique).toHaveBeenCalledWith({
        where: { tenantId: "tenant-e2e" },
      });
    });
  });

  // ============================================
  // TEST 7: Year parameter handling
  // ============================================
  describe("year parameter handling", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue(
        mockActivityConfig,
      );
      prisma.activity.findMany.mockResolvedValue([]);
    });

    it("should default to current year when not specified", async () => {
      const currentYear = new Date().getFullYear();

      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(res.body.year).toBe(currentYear);
    });

    it("should accept past years", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary?year=2024")
        .expect(200);

      expect(res.body.year).toBe(2024);
    });

    it("should accept future years", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary?year=2030")
        .expect(200);

      expect(res.body.year).toBe(2030);
    });
  });

  // ============================================
  // TEST 8: All categories disabled
  // ============================================
  describe("when all categories are disabled", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue({
        ...mockActivityConfig,
        salesEnabled: false,
        marketingEnabled: false,
        networkingEnabled: false,
        productDevEnabled: false,
        operationsEnabled: false,
      });
    });

    it("should return empty items", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.overallCompletionPercent).toBe(0);
    });
  });

  // ============================================
  // TEST 9: Zero weeklyActivityGoal
  // ============================================
  describe("when weeklyActivityGoal is 0 or null", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue({
        ...mockActivityConfig,
        weeklyActivityGoal: 0,
      });
      prisma.activity.findMany.mockResolvedValue([{ category: "Sales" }]);
    });

    it("should handle zero target gracefully", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      // 0 / 3 categories = 0 per category
      for (const item of res.body.items) {
        expect(item.target).toBe(0);
        expect(item.completionPercent).toBe(0);
      }
      expect(res.body.overallCompletionPercent).toBe(0);
    });
  });

  // ============================================
  // TEST 10: Activities with unconfigured categories
  // ============================================
  describe("when activities have unconfigured categories", () => {
    beforeEach(() => {
      prisma.activityConfiguration.findUnique.mockResolvedValue({
        ...mockActivityConfig,
        salesEnabled: true,
        marketingEnabled: false,
        networkingEnabled: false,
        productDevEnabled: false,
        operationsEnabled: false,
        weeklyActivityGoal: 5,
      });
      prisma.activity.findMany.mockResolvedValue([
        { category: "Sales" },
        { category: "Sales" },
        { category: "CustomCategory" }, // Not in config
        { category: "AnotherCustom" }, // Not in config
      ]);
    });

    it("should only include enabled categories in items", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].category).toBe("Sales");
      expect(res.body.items[0].actual).toBe(2);
    });

    it("should not count activities from unconfigured categories in overall", async () => {
      const res = await request(app.getHttpServer())
        .get("/activities/weekly-summary")
        .expect(200);

      // Only Sales category: 2 actual / 5 target = 40%
      expect(res.body.overallCompletionPercent).toBe(40);
    });
  });
});
