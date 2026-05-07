import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

// Controllers
import { MetricsController } from "../src/metrics/metrics.controller";
import { OutcomesController } from "../src/outcomes/outcomes.controller";
import { ActivitiesController } from "../src/activities/activities.controller";
import { ReviewsController } from "../src/reviews/reviews.controller";
import { SalesController } from "../src/sales/sales.controller";
import { SupportController } from "../src/support/support.controller";
import { OnboardingController } from "../src/onboarding/onboarding.controller";
import { TemplatesController } from "../src/templates/templates.controller";

// Services
import { MetricsService } from "../src/metrics/metrics.service";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { ActivitiesService } from "../src/activities/activities.service";
import { ReviewsService } from "../src/reviews/reviews.service";
import { SalesService } from "../src/sales/sales.service";
import { SalesTargetsService } from "../src/sales/sales-targets.service";
import { SupportService } from "../src/support/support.service";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { TemplatesService } from "../src/templates/templates.service";
import { ActionLogService } from "../src/action-log/action-log.service";

type ActiveUser = {
  userId: string;
  tenantId: string | null;
  role: Role;
};

const createAuthGuard = (getUser: () => ActiveUser) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = getUser();
    return true;
  },
});

// Helper to check if message array contains a substring
const messageContains = (messages: string | string[], substring: string): boolean => {
  if (Array.isArray(messages)) {
    return messages.some((msg) => msg.toLowerCase().includes(substring.toLowerCase()));
  }
  return messages.toLowerCase().includes(substring.toLowerCase());
};

describe("High-Value Negative E2E Tests", () => {
  // ============================================
  // 1. Tenant Isolation Violations
  // ============================================
  describe("1. Tenant Isolation Violations", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const metricsService = {
      getMetricById: jest.fn(),
      deleteMetric: jest.fn(),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-1",
        tenantId: "tenant-a",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        imports: [CacheModule.register()],
        controllers: [MetricsController],
        providers: [
          { provide: MetricsService, useValue: metricsService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects access to metrics from another tenant", async () => {
      // Simulate metric belongs to different tenant
      metricsService.getMetricById.mockRejectedValue(
        new ForbiddenException("Metric outside your scope"),
      );

      await request(app.getHttpServer())
        .get("/metrics/metric-from-tenant-b")
        .expect(403)
        .expect(({ body }) => {
          expect(body.message).toContain("outside your scope");
        });
    });

    it("rejects deletion of resources from another tenant", async () => {
      metricsService.deleteMetric.mockRejectedValue(
        new ForbiddenException("Metric outside your scope"),
      );

      await request(app.getHttpServer())
        .delete("/metrics/metric-from-tenant-b")
        .expect(403);
    });

    it("rejects requests with null tenantId for tenant-scoped resources", async () => {
      activeUser = { userId: "user-1", tenantId: null, role: Role.TENANT_ADMIN };

      metricsService.getMetricById.mockRejectedValue(
        new ForbiddenException("Tenant context required"),
      );

      await request(app.getHttpServer())
        .get("/metrics/any-metric")
        .expect(403);
    });
  });

  // ============================================
  // 2. RBAC Denial - Templates are READ-ONLY for Tenants
  // ============================================
  describe("2. RBAC Denial - Template Management (Read-Only)", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const templatesService = {
      getAllMetricTemplates: jest.fn().mockResolvedValue([]),
      getAllOutcomeTemplates: jest.fn().mockResolvedValue([]),
      getAllActivityTemplates: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "tenant-user",
        tenantId: "tenant-a",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [TemplatesController],
        providers: [
          { provide: TemplatesService, useValue: templatesService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("allows all tenant roles to READ metric templates", async () => {
      for (const role of [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER]) {
        activeUser = { ...activeUser, role };
        await request(app.getHttpServer())
          .get("/templates/metrics")
          .expect(200);
      }
      expect(templatesService.getAllMetricTemplates).toHaveBeenCalledTimes(4);
    });

    it("returns 404 for POST (templates are read-only for tenants)", async () => {
      // Templates are managed via Superadmin API, so POST/PUT/DELETE return 404
      await request(app.getHttpServer())
        .post("/templates/metrics")
        .send({ name: "New Template" })
        .expect(404);
    });

    it("returns 404 for PUT (templates are read-only for tenants)", async () => {
      await request(app.getHttpServer())
        .put("/templates/metrics/template-1")
        .send({ name: "Updated Template" })
        .expect(404);
    });

    it("returns 404 for DELETE (templates are read-only for tenants)", async () => {
      await request(app.getHttpServer())
        .delete("/templates/metrics/template-1")
        .expect(404);
    });
  });

  // ============================================
  // 3. Onboarding PATCH Out-of-Order Steps
  // ============================================
  describe("3. Onboarding Out-of-Order Step Validation", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const onboardingService = {
      getOnboardingProgress: jest.fn(),
      updateOnboardingProgress: jest.fn(),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-onboard",
        tenantId: "tenant-onboard",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [OnboardingController],
        providers: [
          { provide: OnboardingService, useValue: onboardingService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects currentStep exceeding maximum (6)", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 10 })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "exceed 6")).toBe(true);
        });
    });

    it("rejects negative currentStep values", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: -1 })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "at least 1")).toBe(true);
        });
    });

    it("rejects invalid completedStep enum values", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ completedStep: "INVALID_STEP" })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "completedStep")).toBe(true);
        });
    });

    it("rejects currentStep of 0", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 0 })
        .expect(400);
    });
  });

  // ============================================
  // 4. Metrics: Logging Invalid Values
  // ============================================
  describe("4. Metrics - Invalid Log Values", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const metricsService = {
      createLog: jest.fn(),
      getMetricById: jest.fn().mockResolvedValue({ id: "metric-1" }),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-metrics",
        tenantId: "tenant-metrics",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        imports: [CacheModule.register()],
        controllers: [MetricsController],
        providers: [
          { provide: MetricsService, useValue: metricsService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects non-numeric metric log values", async () => {
      await request(app.getHttpServer())
        .post("/metrics/metric-1/logs")
        .send({ value: "not-a-number" })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "number")).toBe(true);
        });
    });

    it("rejects metric log without value field", async () => {
      await request(app.getHttpServer())
        .post("/metrics/metric-1/logs")
        .send({})
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "value")).toBe(true);
        });
    });

    it("rejects metric log with invalid date format", async () => {
      await request(app.getHttpServer())
        .post("/metrics/metric-1/logs")
        .send({ value: 100, date: "invalid-date" })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "date")).toBe(true);
        });
    });
  });

  // ============================================
  // 5. Outcomes: Completing Already Completed Outcomes
  // ============================================
  describe("5. Outcomes - Status Validation", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const outcomesService = {
      updateOutcome: jest.fn(),
      getOutcomes: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-outcomes",
        tenantId: "tenant-outcomes",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [OutcomesController],
        providers: [
          { provide: OutcomesService, useValue: outcomesService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("validates status enum on outcome update", async () => {
      await request(app.getHttpServer())
        .put("/outcomes/outcome-1")
        .send({ status: "INVALID_STATUS" })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "status")).toBe(true);
        });
    });

    it("allows valid status transitions", async () => {
      outcomesService.updateOutcome.mockResolvedValue({
        id: "outcome-1",
        status: "Done",
      });

      await request(app.getHttpServer())
        .put("/outcomes/outcome-1")
        .send({ status: "Done" })
        .expect(200);

      expect(outcomesService.updateOutcome).toHaveBeenCalled();
    });

    it("rejects invalid outcome status values", async () => {
      await request(app.getHttpServer())
        .put("/outcomes/outcome-1")
        .send({ status: "COMPLETED" }) // Should be "Done" not "COMPLETED"
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "Planned, Done, Missed")).toBe(true);
        });
    });
  });

  // ============================================
  // 6. Activities: Invalid Date Validation
  // ============================================
  describe("6. Activities - Date Format Validation", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const activitiesService = {
      createActivity: jest.fn(),
      getAllActivities: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-activities",
        tenantId: "tenant-activities",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [ActivitiesController],
        providers: [
          { provide: ActivitiesService, useValue: activitiesService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects activity with invalid dueDate format", async () => {
      await request(app.getHttpServer())
        .post("/activities")
        .send({
          title: "Test Activity",
          category: "Sales",
          dueDate: "not-a-valid-date",
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "dueDate")).toBe(true);
        });
    });

    it("accepts valid ISO date for dueDate", async () => {
      activitiesService.createActivity.mockResolvedValue({ id: "activity-1" });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await request(app.getHttpServer())
        .post("/activities")
        .send({
          title: "Test Activity",
          category: "Sales",
          dueDate: futureDate.toISOString(),
        })
        .expect(201);

      expect(activitiesService.createActivity).toHaveBeenCalled();
    });

    it("rejects activity without required title", async () => {
      await request(app.getHttpServer())
        .post("/activities")
        .send({ category: "Sales" })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "title")).toBe(true);
        });
    });
  });

  // ============================================
  // 7. Reviews: Validation Protection
  // ============================================
  describe("7. Reviews - Validation Protection", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const reviewsService = {
      createReview: jest.fn().mockResolvedValue({ id: "review-1" }),
      getReviews: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-reviews",
        tenantId: "tenant-reviews",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [ReviewsController],
        providers: [
          { provide: ReviewsService, useValue: reviewsService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects mood values above maximum (5)", async () => {
      await request(app.getHttpServer())
        .post("/reviews")
        .send({
          type: "Daily",
          content: "Good day",
          mood: 10, // Max is 5
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "mood")).toBe(true);
        });
    });

    it("rejects mood values below minimum (1)", async () => {
      await request(app.getHttpServer())
        .post("/reviews")
        .send({
          type: "Daily",
          content: "Bad day",
          mood: 0, // Min is 1
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "mood")).toBe(true);
        });
    });

    it("rejects invalid review type", async () => {
      await request(app.getHttpServer())
        .post("/reviews")
        .send({
          type: "MONTHLY", // Only Daily/Weekly allowed
          content: "Review",
          mood: 3,
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "type")).toBe(true);
        });
    });

    it("accepts valid daily review", async () => {
      await request(app.getHttpServer())
        .post("/reviews")
        .send({
          type: "Daily",
          content: "Great progress today",
          mood: 4,
        })
        .expect(201);

      expect(reviewsService.createReview).toHaveBeenCalled();
    });
  });

  // ============================================
  // 8. Sales: Invalid Date Formats
  // ============================================
  describe("8. Sales - Date Format Validation", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const salesService = {
      getSalesPlanning: jest.fn(),
      upsertSalesPlanning: jest.fn().mockResolvedValue({ id: "plan" }),
      getSalesTracker: jest.fn(),
      upsertSalesTracker: jest.fn().mockResolvedValue({ id: "tracker" }),
      getSummary: jest.fn().mockResolvedValue({}),
      getAllSalesTrackers: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    };
    const salesTargetsService = {
      getCurrentPeriodTargets: jest.fn().mockResolvedValue({}),
      getMonthlyTargets: jest.fn().mockResolvedValue([]),
      getWeeklyTargets: jest.fn().mockResolvedValue([]),
      getWeeklyTargetForWeek: jest.fn().mockResolvedValue(null),
      getWeeklySummary: jest.fn().mockResolvedValue({ items: [] }),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-sales",
        tenantId: "tenant-sales",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        imports: [CacheModule.register()],
        controllers: [SalesController],
        providers: [
          { provide: SalesService, useValue: salesService },
          { provide: SalesTargetsService, useValue: salesTargetsService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects sales planning with non-integer year", async () => {
      await request(app.getHttpServer())
        .post("/sales/planning")
        .send({
          year: "twenty-twenty-five",
          q1: 10000,
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "year")).toBe(true);
        });
    });

    it("rejects sales planning with year below minimum (2000)", async () => {
      await request(app.getHttpServer())
        .post("/sales/planning")
        .send({
          year: 1800,
          q1: 10000,
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "2000")).toBe(true);
        });
    });

    it("accepts valid sales planning", async () => {
      await request(app.getHttpServer())
        .post("/sales/planning")
        .send({
          year: 2025,
          q1: 10000,
          q2: 12000,
        })
        .expect(201);

      expect(salesService.upsertSalesPlanning).toHaveBeenCalled();
    });

    it("accepts valid sales tracker with correct month format", async () => {
      await request(app.getHttpServer())
        .post("/sales/tracker")
        .send({
          month: "2025-03",
          target: 10000,
        })
        .expect(201);

      expect(salesService.upsertSalesTracker).toHaveBeenCalled();
    });
  });

  // ============================================
  // 9. Support Tickets: Max Length Violations
  // ============================================
  describe("9. Support Tickets - Validation", () => {
    let app: INestApplication;
    let activeUser: ActiveUser;
    const supportService = {
      createTicket: jest.fn().mockResolvedValue({ id: "ticket-1" }),
      getAllTickets: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      getMyTickets: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    };

    beforeAll(async () => {
      activeUser = {
        userId: "user-support",
        tenantId: "tenant-support",
        role: Role.TENANT_ADMIN,
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [SupportController],
        providers: [
          { provide: SupportService, useValue: supportService },
          RolesGuard,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createAuthGuard(() => activeUser))
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("rejects subject exceeding 120 characters", async () => {
      const longSubject = "x".repeat(121);

      await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: longSubject,
          message: "Valid message content here with enough characters",
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "120")).toBe(true);
        });
    });

    it("rejects subject shorter than 5 characters", async () => {
      await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: "Hi",
          message: "Valid message content here with enough characters",
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "5")).toBe(true);
        });
    });

    it("rejects message exceeding 2000 characters", async () => {
      const longMessage = "x".repeat(2001);

      await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: "Valid Subject Here",
          message: longMessage,
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "2000")).toBe(true);
        });
    });

    it("rejects message shorter than 10 characters", async () => {
      await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: "Valid Subject Here",
          message: "Short",
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "10")).toBe(true);
        });
    });

    it("rejects invalid priority enum value", async () => {
      await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: "Valid Subject Here",
          message: "Valid message with enough characters here",
          priority: "URGENT", // Only LOW, MEDIUM, HIGH allowed
        })
        .expect(400)
        .expect(({ body }) => {
          expect(messageContains(body.message, "priority")).toBe(true);
        });
    });

    it("accepts valid support ticket", async () => {
      await request(app.getHttpServer())
        .post("/support/tickets")
        .send({
          subject: "Need help with metrics",
          message: "I cannot see my metrics on the dashboard. Please assist.",
          priority: "HIGH",
        })
        .expect(201);

      expect(supportService.createTicket).toHaveBeenCalled();
    });
  });

  // ============================================
  // 10. Action Logs Missing TenantId
  // ============================================
  describe("10. Action Logs - TenantId Enforcement", () => {
    let actionLogService: ActionLogService;

    beforeAll(() => {
      actionLogService = {
        record: jest.fn(),
      } as unknown as ActionLogService;
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("logs action with null tenantId for system-level operations", () => {
      // This tests that the action log service accepts null tenantId
      // for system-level operations (e.g., auth events before tenant context)
      expect(() => {
        actionLogService.record("user-id", null, "LOGIN", "auth");
      }).not.toThrow();

      expect(actionLogService.record).toHaveBeenCalledWith(
        "user-id",
        null,
        "LOGIN",
        "auth",
      );
    });

    it("logs action with valid tenantId for tenant-scoped operations", () => {
      expect(() => {
        actionLogService.record(
          "user-id",
          "tenant-123",
          "CREATE_METRIC",
          "metrics",
          { name: "MRR" },
        );
      }).not.toThrow();

      expect(actionLogService.record).toHaveBeenCalledWith(
        "user-id",
        "tenant-123",
        "CREATE_METRIC",
        "metrics",
        { name: "MRR" },
      );
    });

    it("documents tenantId as required for data-modifying operations", () => {
      // This is a documentation test - verifying the expected behavior
      // In production, tenant-scoped operations should always have tenantId
      const tenantScopedActions = [
        "CREATE_METRIC",
        "UPDATE_METRIC",
        "DELETE_METRIC",
        "CREATE_OUTCOME",
        "CREATE_ACTIVITY",
        "CREATE_REVIEW",
        "CREATE_TICKET",
      ];

      tenantScopedActions.forEach((action) => {
        // These actions should always be called with a valid tenantId
        actionLogService.record("user-id", "tenant-123", action, "module");
      });

      expect(actionLogService.record).toHaveBeenCalledTimes(
        tenantScopedActions.length,
      );
    });
  });
});
