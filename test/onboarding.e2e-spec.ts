import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { Role, SubscriptionPlan } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { OnboardingController } from "../src/onboarding/onboarding.controller";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import {
  ONBOARDING_STEP_TITLES,
  MAX_ONBOARDING_STEPS,
} from "../src/onboarding/dto/onboarding-progress-response.dto";
import { PLAN_FEATURES } from "../src/onboarding/dto/subscription-selection.dto";
import { DEFAULT_SALES_CYCLE_STAGES } from "../src/onboarding/dto/sales-cycle.dto";

type ActiveUser = { userId: string; tenantId: string; role?: Role };

const authGuardFactory = (getUser: () => ActiveUser) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = getUser();
    return true;
  },
});

describe("OnboardingController (e2e)", () => {
  let app: INestApplication;
  let onboardingService: {
    getOnboardingProgress: jest.Mock;
    updateOnboardingProgress: jest.Mock;
    updateProfileOnboarding: jest.Mock;
    getBusinessIdentity: jest.Mock;
    upsertBusinessIdentity: jest.Mock;
    getSalesPlan: jest.Mock;
    upsertSalesPlan: jest.Mock;
    getActivityConfiguration: jest.Mock;
    upsertActivityConfiguration: jest.Mock;
    getSalesCycleStages: jest.Mock;
    replaceSalesCycleStages: jest.Mock;
    initializeDefaultSalesCycle: jest.Mock;
    getAchievementStages: jest.Mock;
    replaceAchievementStages: jest.Mock;
    getSelectedSubscription: jest.Mock;
    selectSubscription: jest.Mock;
    completeOnboarding: jest.Mock;
  };
  let activeUser: ActiveUser;

  const mockProgress = {
    id: "progress-1",
    tenantId: "tenant-abc",
    currentStep: 1,
    stepsCompleted: [],
    isCompleted: false,
    completedAt: null,
    stepFlags: {
      profileCompleted: false,
      businessIdentityCompleted: false,
      salesPlanCompleted: false,
      activityConfigCompleted: false,
      salesCycleCompleted: false,
      achievementStagesCompleted: false,
      subscriptionCompleted: false,
      visualSetupCompleted: false,
    },
    selectedPlan: undefined,
    stepTitles: ONBOARDING_STEP_TITLES,
    totalSteps: MAX_ONBOARDING_STEPS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile = {
    id: "user-onboarding",
    name: "Test User",
    email: "test@example.com",
    age: 35,
    gender: "MALE",
    maritalStatus: "MARRIED",
    businessType: "Startup",
    businessDescription: "A test company",
    socialHandles: { linkedin: "https://linkedin.com/in/test" },
    updatedAt: new Date(),
  };

  const mockBusinessIdentity = {
    id: "bi-1",
    tenantId: "tenant-abc",
    companyName: "Test Company",
    companyType: "LLC",
    industry: "TECHNOLOGY",
    foundedYear: 2020,
    turnoverBand: "L10_TO_25L",
    employeeRange: "SMALL",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSalesPlan = {
    id: "sp-1",
    tenantId: "tenant-abc",
    yearMinus1Value: 1000000,
    yearMinus2Value: 750000,
    yearMinus3Value: 500000,
    projectedYearValue: 1500000,
    monthlyContribution: [8, 7, 8, 9, 8, 7, 9, 10, 9, 8, 8, 9],
    monthlyTargets: [
      120000, 105000, 120000, 135000, 120000, 105000, 135000, 150000, 135000,
      120000, 120000, 135000,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockActivityConfig = {
    id: "ac-1",
    tenantId: "tenant-abc",
    salesEnabled: true,
    marketingEnabled: true,
    networkingEnabled: true,
    productDevEnabled: true,
    operationsEnabled: true,
    weeklyActivityGoal: 5,
    enableReminders: true,
    reminderDays: [1, 3, 5],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSalesCycleStages = {
    stages: [
      {
        id: "s1",
        tenantId: "tenant-abc",
        name: "Lead",
        order: 1,
        probability: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "s2",
        tenantId: "tenant-abc",
        name: "Qualified",
        order: 2,
        probability: 25,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "s3",
        tenantId: "tenant-abc",
        name: "Closed",
        order: 3,
        probability: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    totalStages: 3,
  };

  const mockAchievementStages = {
    stages: [
      {
        id: "a1",
        tenantId: "tenant-abc",
        name: "Bronze",
        order: 1,
        targetValue: 375000,
        percentOfGoal: 25,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "a2",
        tenantId: "tenant-abc",
        name: "Platinum",
        order: 2,
        targetValue: 1500000,
        percentOfGoal: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    totalStages: 2,
  };

  const mockSubscriptionSelection = {
    selectedPlan: SubscriptionPlan.STARTER,
    planFeatures: PLAN_FEATURES[SubscriptionPlan.STARTER],
  };

  beforeEach(async () => {
    activeUser = {
      userId: "user-onboarding",
      tenantId: "tenant-abc",
      role: Role.TENANT_ADMIN,
    };

    onboardingService = {
      getOnboardingProgress: jest.fn().mockResolvedValue(mockProgress),
      updateOnboardingProgress: jest.fn().mockResolvedValue(mockProgress),
      updateProfileOnboarding: jest.fn().mockResolvedValue(mockProfile),
      getBusinessIdentity: jest.fn().mockResolvedValue(mockBusinessIdentity),
      upsertBusinessIdentity: jest.fn().mockResolvedValue(mockBusinessIdentity),
      getSalesPlan: jest.fn().mockResolvedValue(mockSalesPlan),
      upsertSalesPlan: jest.fn().mockResolvedValue(mockSalesPlan),
      getActivityConfiguration: jest.fn().mockResolvedValue(mockActivityConfig),
      upsertActivityConfiguration: jest
        .fn()
        .mockResolvedValue(mockActivityConfig),
      getSalesCycleStages: jest.fn().mockResolvedValue(mockSalesCycleStages),
      replaceSalesCycleStages: jest
        .fn()
        .mockResolvedValue(mockSalesCycleStages),
      initializeDefaultSalesCycle: jest.fn().mockResolvedValue({
        stages: DEFAULT_SALES_CYCLE_STAGES.map((s, i) => ({
          id: `s${i}`,
          tenantId: "tenant-abc",
          ...s,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        totalStages: 5,
      }),
      getAchievementStages: jest.fn().mockResolvedValue(mockAchievementStages),
      replaceAchievementStages: jest
        .fn()
        .mockResolvedValue(mockAchievementStages),
      getSelectedSubscription: jest
        .fn()
        .mockResolvedValue(mockSubscriptionSelection),
      selectSubscription: jest
        .fn()
        .mockResolvedValue(mockSubscriptionSelection),
      completeOnboarding: jest.fn().mockResolvedValue({
        ...mockProgress,
        isCompleted: true,
        completedAt: new Date(),
        stepFlags: {
          ...mockProgress.stepFlags,
          visualSetupCompleted: true,
        },
      }),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        { provide: OnboardingService, useValue: onboardingService },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuardFactory(() => activeUser));

    const moduleRef: TestingModule = await moduleBuilder.compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ============================================
  // GET /onboarding - Progress Tracking
  // ============================================
  describe("GET /onboarding", () => {
    it("returns onboarding progress for the authenticated tenant", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding")
        .expect(200);

      expect(onboardingService.getOnboardingProgress).toHaveBeenCalledWith(
        activeUser.tenantId,
        activeUser.userId,
      );
      expect(response.body).toMatchObject({
        id: "progress-1",
        tenantId: "tenant-abc",
        currentStep: 1,
        stepsCompleted: [],
        isCompleted: false,
      });
    });

    it("includes stepTitles and totalSteps in response", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding")
        .expect(200);

      expect(response.body.stepTitles).toEqual(ONBOARDING_STEP_TITLES);
      expect(response.body.totalSteps).toBe(MAX_ONBOARDING_STEPS);
    });

    it("includes stepFlags in response", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding")
        .expect(200);

      expect(response.body.stepFlags).toBeDefined();
      expect(response.body.stepFlags.profileCompleted).toBe(false);
    });

    it("allows all tenant member roles to access progress", async () => {
      const roles = [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER];

      for (const role of roles) {
        activeUser = { ...activeUser, role };
        await request(app.getHttpServer()).get("/onboarding").expect(200);
      }
    });

    it("rejects requests without a valid role", async () => {
      activeUser = { ...activeUser, role: undefined };
      await request(app.getHttpServer()).get("/onboarding").expect(403);
    });
  });

  // ============================================
  // PATCH /onboarding - Update Progress
  // ============================================
  describe("PATCH /onboarding", () => {
    it("updates current step", async () => {
      const dto = { currentStep: 3 };

      await request(app.getHttpServer())
        .patch("/onboarding")
        .send(dto)
        .expect(200);

      expect(onboardingService.updateOnboardingProgress).toHaveBeenCalledWith(
        activeUser.tenantId,
        dto,
        activeUser.userId,
      );
    });

    it("marks a step as completed", async () => {
      const dto = { completedStep: "PROFILE" };

      onboardingService.updateOnboardingProgress.mockResolvedValueOnce({
        ...mockProgress,
        stepsCompleted: ["PROFILE"],
        stepFlags: { ...mockProgress.stepFlags, profileCompleted: true },
      });

      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send(dto)
        .expect(200);

      expect(response.body.stepsCompleted).toContain("PROFILE");
    });

    it("validates currentStep is within range (1-8)", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 9 })
        .expect(400);
    });

    it("validates completedStep is a valid enum value", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ completedStep: "INVALID_STEP" })
        .expect(400);
    });

    it("accepts valid completedStep enum values", async () => {
      const validSteps = [
        "PROFILE",
        "BUSINESS_IDENTITY",
        "SALES_PLAN",
        "ACTIVITY_CONFIG",
        "SALES_CYCLE",
        "ACHIEVEMENT_STAGES",
        "SUBSCRIPTION",
        "VISUAL_SETUP",
      ];

      for (const step of validSteps) {
        onboardingService.updateOnboardingProgress.mockResolvedValueOnce({
          ...mockProgress,
          stepsCompleted: [step],
        });

        await request(app.getHttpServer())
          .patch("/onboarding")
          .send({ completedStep: step })
          .expect(200);
      }
    });
  });

  // ============================================
  // PATCH /onboarding/profile - Step 1
  // ============================================
  describe("PATCH /onboarding/profile", () => {
    it("updates user profile", async () => {
      const dto = {
        name: "Updated User",
        age: 35,
        gender: "MALE",
        maritalStatus: "MARRIED",
        businessType: "Startup",
        businessDescription: "A test company",
        socialHandles: { linkedin: "https://linkedin.com/in/test" },
      };

      const response = await request(app.getHttpServer())
        .patch("/onboarding/profile")
        .send(dto)
        .expect(200);

      expect(onboardingService.updateProfileOnboarding).toHaveBeenCalledWith(
        activeUser.userId,
        activeUser.tenantId,
        dto,
      );
      expect(response.body.name).toBe("Test User");
    });

    it("validates age range (18-120)", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding/profile")
        .send({ name: "Test", businessType: "Solopreneur", age: 10 })
        .expect(400);

      await request(app.getHttpServer())
        .patch("/onboarding/profile")
        .send({ name: "Test", businessType: "Solopreneur", age: 150 })
        .expect(400);
    });

    it("validates gender enum", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding/profile")
        .send({ name: "Test", businessType: "Solopreneur", gender: "INVALID" })
        .expect(400);
    });

    it("validates businessType enum", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding/profile")
        .send({ name: "Test", businessType: "INVALID" })
        .expect(400);
    });

    it("validates socialHandles URLs", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding/profile")
        .send({
          name: "Test",
          businessType: "Solopreneur",
          socialHandles: { linkedin: "not-a-url" },
        })
        .expect(400);
    });
  });

  // ============================================
  // PUT /onboarding/business-identity - Step 2
  // ============================================
  describe("PUT /onboarding/business-identity", () => {
    it("creates/updates business identity", async () => {
      const dto = {
        companyName: "Test Company",
        companyType: "LLC",
        industry: "TECHNOLOGY",
        foundedYear: 2020,
      };

      const response = await request(app.getHttpServer())
        .put("/onboarding/business-identity")
        .send(dto)
        .expect(200);

      expect(onboardingService.upsertBusinessIdentity).toHaveBeenCalledWith(
        activeUser.tenantId,
        dto,
      );
      expect(response.body.companyName).toBe("Test Company");
    });

    it("validates industry enum", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/business-identity")
        .send({ industry: "INVALID" })
        .expect(400);
    });

    it("validates companyType enum", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/business-identity")
        .send({ industry: "TECHNOLOGY", companyType: "INVALID" })
        .expect(400);
    });

    it("validates foundedYear range", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/business-identity")
        .send({ industry: "TECHNOLOGY", foundedYear: 1800 })
        .expect(400);
    });
  });

  describe("GET /onboarding/business-identity", () => {
    it("retrieves business identity", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding/business-identity")
        .expect(200);

      expect(onboardingService.getBusinessIdentity).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
      expect(response.body.tenantId).toBe("tenant-abc");
    });
  });

  // ============================================
  // PUT /onboarding/sales-plan - Step 3
  // ============================================
  describe("PUT /onboarding/sales-plan", () => {
    it("creates/updates sales plan with valid monthly contribution", async () => {
      const dto = {
        projectedYearValue: 1500000,
        averageTicketSize: 25000,
        conversionRatio: 20,
        existingCustomerContribution: 40,
        newCustomerContribution: 60,
        monthlyContribution: [8, 7, 8, 9, 8, 7, 9, 10, 9, 8, 8, 9],
      };

      const response = await request(app.getHttpServer())
        .put("/onboarding/sales-plan")
        .send(dto)
        .expect(200);

      expect(onboardingService.upsertSalesPlan).toHaveBeenCalledWith(
        activeUser.tenantId,
        dto,
      );
      expect(response.body.monthlyTargets).toHaveLength(12);
    });

    it("rejects monthly contribution not summing to 100%", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-plan")
        .send({
          projectedYearValue: 1500000,
          monthlyContribution: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], // 120%
        })
        .expect(400);
    });

    it("rejects less than 12 monthly values", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-plan")
        .send({
          projectedYearValue: 1500000,
          monthlyContribution: [25, 25, 25, 25],
        })
        .expect(400);
    });

    it("rejects more than 12 monthly values", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-plan")
        .send({
          projectedYearValue: 1500000,
          monthlyContribution: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
        })
        .expect(400);
    });

    it("rejects negative projectedYearValue", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-plan")
        .send({
          projectedYearValue: -1000,
          monthlyContribution: [8, 8, 8, 8, 8, 9, 9, 9, 9, 8, 8, 8],
        })
        .expect(400);
    });
  });

  describe("GET /onboarding/sales-plan", () => {
    it("retrieves sales plan", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding/sales-plan")
        .expect(200);

      expect(onboardingService.getSalesPlan).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
      expect(response.body.monthlyContribution).toHaveLength(12);
    });
  });

  // ============================================
  // PUT /onboarding/activity-setup - Step 4
  // ============================================
  describe("PUT /onboarding/activity-setup", () => {
    it("creates/updates activity configuration", async () => {
      const dto = {
        salesEnabled: true,
        marketingEnabled: false,
        weeklyActivityGoal: 10,
        reminderDays: [1, 5],
      };

      const response = await request(app.getHttpServer())
        .put("/onboarding/activity-setup")
        .send(dto)
        .expect(200);

      expect(
        onboardingService.upsertActivityConfiguration,
      ).toHaveBeenCalledWith(activeUser.tenantId, dto);
    });

    it("validates weeklyActivityGoal range (1-50)", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/activity-setup")
        .send({ weeklyActivityGoal: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .put("/onboarding/activity-setup")
        .send({ weeklyActivityGoal: 100 })
        .expect(400);
    });

    it("validates reminderDays values (1-7)", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/activity-setup")
        .send({ reminderDays: [0, 8] })
        .expect(400);
    });
  });

  describe("GET /onboarding/activity-setup", () => {
    it("retrieves activity configuration", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding/activity-setup")
        .expect(200);

      expect(onboardingService.getActivityConfiguration).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
    });
  });

  // ============================================
  // PUT /onboarding/sales-cycle - Step 5
  // ============================================
  describe("PUT /onboarding/sales-cycle", () => {
    it("replaces sales cycle stages", async () => {
      const dto = {
        stages: [
          { name: "Lead", order: 1, probability: 10 },
          { name: "Qualified", order: 2, probability: 25 },
          { name: "Closed", order: 3, probability: 100 },
        ],
      };

      const response = await request(app.getHttpServer())
        .put("/onboarding/sales-cycle")
        .send(dto)
        .expect(200);

      expect(onboardingService.replaceSalesCycleStages).toHaveBeenCalledWith(
        activeUser.tenantId,
        dto,
      );
      expect(response.body.totalStages).toBe(3);
    });

    it("rejects less than 2 stages", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-cycle")
        .send({ stages: [{ name: "Lead", order: 1 }] })
        .expect(400);
    });

    it("rejects more than 10 stages", async () => {
      const stages = Array.from({ length: 11 }, (_, i) => ({
        name: `Stage ${i + 1}`,
        order: i + 1,
      }));

      await request(app.getHttpServer())
        .put("/onboarding/sales-cycle")
        .send({ stages })
        .expect(400);
    });

    it("validates color is hex format", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-cycle")
        .send({
          stages: [
            { name: "Lead", order: 1, color: "red" },
            { name: "Closed", order: 2 },
          ],
        })
        .expect(400);
    });

    it("validates probability range (0-100)", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/sales-cycle")
        .send({
          stages: [
            { name: "Lead", order: 1, probability: -10 },
            { name: "Closed", order: 2 },
          ],
        })
        .expect(400);

      await request(app.getHttpServer())
        .put("/onboarding/sales-cycle")
        .send({
          stages: [
            { name: "Lead", order: 1, probability: 150 },
            { name: "Closed", order: 2 },
          ],
        })
        .expect(400);
    });
  });

  describe("POST /onboarding/sales-cycle/defaults", () => {
    it("creates default sales cycle stages", async () => {
      const response = await request(app.getHttpServer())
        .post("/onboarding/sales-cycle/defaults")
        .expect(201);

      expect(
        onboardingService.initializeDefaultSalesCycle,
      ).toHaveBeenCalledWith(activeUser.tenantId);
      expect(response.body.totalStages).toBe(5);
    });
  });

  describe("GET /onboarding/sales-cycle", () => {
    it("retrieves sales cycle stages", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding/sales-cycle")
        .expect(200);

      expect(onboardingService.getSalesCycleStages).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
      expect(response.body.stages).toBeDefined();
    });
  });

  // ============================================
  // PUT /onboarding/achievement-stages - Step 6
  // ============================================
  describe("PUT /onboarding/achievement-stages", () => {
    it("replaces achievement stages", async () => {
      const dto = {
        stages: [
          { name: "Bronze", order: 1, targetValue: 375000, percentOfGoal: 25 },
          {
            name: "Platinum",
            order: 2,
            targetValue: 1500000,
            percentOfGoal: 100,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .put("/onboarding/achievement-stages")
        .send(dto)
        .expect(200);

      expect(onboardingService.replaceAchievementStages).toHaveBeenCalledWith(
        activeUser.tenantId,
        dto,
      );
      expect(response.body.totalStages).toBe(2);
    });

    it("rejects less than 2 stages", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/achievement-stages")
        .send({ stages: [{ name: "Bronze", order: 1, targetValue: 100000 }] })
        .expect(400);
    });

    it("validates color is hex format", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/achievement-stages")
        .send({
          stages: [
            { name: "Bronze", order: 1, targetValue: 100000, color: "gold" },
            { name: "Silver", order: 2, targetValue: 200000 },
          ],
        })
        .expect(400);
    });

    it("validates targetValue is positive", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/achievement-stages")
        .send({
          stages: [
            { name: "Bronze", order: 1, targetValue: -1000 },
            { name: "Silver", order: 2, targetValue: 200000 },
          ],
        })
        .expect(400);
    });
  });

  describe("GET /onboarding/achievement-stages", () => {
    it("retrieves achievement stages", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding/achievement-stages")
        .expect(200);

      expect(onboardingService.getAchievementStages).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
      expect(response.body.stages).toBeDefined();
    });
  });

  // ============================================
  // PUT /onboarding/subscription - Step 7
  // ============================================
  describe("PUT /onboarding/subscription", () => {
    it("selects subscription plan", async () => {
      const dto = { plan: "STARTER" };

      const response = await request(app.getHttpServer())
        .put("/onboarding/subscription")
        .send(dto)
        .expect(200);

      expect(onboardingService.selectSubscription).toHaveBeenCalledWith(
        activeUser.tenantId,
        dto,
      );
      expect(response.body.selectedPlan).toBe("STARTER");
      expect(response.body.planFeatures).toBeDefined();
    });

    it("validates subscription plan enum", async () => {
      await request(app.getHttpServer())
        .put("/onboarding/subscription")
        .send({ plan: "INVALID_PLAN" })
        .expect(400);
    });

    it("accepts all valid subscription plans", async () => {
      const plans = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"];

      for (const plan of plans) {
        await request(app.getHttpServer())
          .put("/onboarding/subscription")
          .send({ plan })
          .expect(200);
      }
    });
  });

  describe("GET /onboarding/subscription", () => {
    it("retrieves selected subscription", async () => {
      const response = await request(app.getHttpServer())
        .get("/onboarding/subscription")
        .expect(200);

      expect(onboardingService.getSelectedSubscription).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
      expect(response.body.selectedPlan).toBeDefined();
    });
  });

  // ============================================
  // POST /onboarding/complete - Step 8
  // ============================================
  describe("POST /onboarding/complete", () => {
    it("completes onboarding when all steps are done", async () => {
      const response = await request(app.getHttpServer())
        .post("/onboarding/complete")
        .expect(200);

      expect(onboardingService.completeOnboarding).toHaveBeenCalledWith(
        activeUser.tenantId,
      );
      expect(response.body.isCompleted).toBe(true);
      expect(response.body.completedAt).toBeDefined();
    });
  });

  // ============================================
  // Tenant Isolation Tests
  // ============================================
  describe("Tenant isolation", () => {
    it("scopes all requests to the authenticated tenant", async () => {
      const endpoints = [
        { method: "get", path: "/onboarding" },
        { method: "get", path: "/onboarding/business-identity" },
        { method: "get", path: "/onboarding/sales-plan" },
        { method: "get", path: "/onboarding/activity-setup" },
        { method: "get", path: "/onboarding/sales-cycle" },
        { method: "get", path: "/onboarding/achievement-stages" },
        { method: "get", path: "/onboarding/subscription" },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .expect(200);
      }

      // All service calls should have received the tenant ID from the JWT
      expect(onboardingService.getOnboardingProgress).toHaveBeenCalledWith(
        "tenant-abc",
        activeUser.userId,
      );
      expect(onboardingService.getBusinessIdentity).toHaveBeenCalledWith(
        "tenant-abc",
      );
      expect(onboardingService.getSalesPlan).toHaveBeenCalledWith("tenant-abc");
    });

    it("prevents cross-tenant access by using JWT tenant context", async () => {
      activeUser = {
        userId: "user-1",
        tenantId: "tenant-secure",
        role: Role.STAFF,
      };

      await request(app.getHttpServer()).get("/onboarding").expect(200);

      expect(onboardingService.getOnboardingProgress).toHaveBeenCalledWith(
        "tenant-secure",
        "user-1",
      );
    });
  });

  // ============================================
  // Role-based Access Tests
  // ============================================
  describe("Role-based access", () => {
    it("allows all tenant member roles for read operations", async () => {
      const roles = [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER];

      for (const role of roles) {
        activeUser = { ...activeUser, role };
        await request(app.getHttpServer()).get("/onboarding").expect(200);
      }
    });

    it("allows all tenant member roles for write operations", async () => {
      const roles = [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER];

      for (const role of roles) {
        activeUser = { ...activeUser, role };
        await request(app.getHttpServer())
          .patch("/onboarding")
          .send({ currentStep: 2 })
          .expect(200);
      }
    });
  });
});
