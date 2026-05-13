import { Test, TestingModule } from "@nestjs/testing";
import { BusinessType, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { EmailService } from "../notifications/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { OnboardingService } from "./onboarding.service";

describe("OnboardingService", () => {
  let service: OnboardingService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    businessIdentity: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
    salesPlan: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
    activityConfiguration: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
    salesCycleStage: {
      count: jest.Mock;
      create: jest.Mock;
    };
    achievementStage: {
      count: jest.Mock;
      create: jest.Mock;
    };
    subscription: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    tenant: {
      update: jest.Mock;
    };
    onboardingProgress: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      businessIdentity: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      salesPlan: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      activityConfiguration: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      salesCycleStage: {
        count: jest.fn(),
        create: jest.fn(),
      },
      achievementStage: {
        count: jest.fn(),
        create: jest.fn(),
      },
      subscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        update: jest.fn(),
      },
      onboardingProgress: {
        findUnique: jest.fn().mockResolvedValue({
          currentStep: 1,
          stepsCompleted: [],
        }),
        upsert: jest.fn().mockResolvedValue({
          tenantId: "tenant-1",
          currentStep: 1,
          stepsCompleted: [],
          isCompleted: false,
          profileCompleted: false,
          businessIdentityCompleted: false,
          salesPlanCompleted: false,
          activityConfigCompleted: false,
          salesCycleCompleted: false,
          achievementStagesCompleted: false,
          subscriptionCompleted: false,
          visualSetupCompleted: false,
          selectedPlan: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();

    service = module.get(OnboardingService);
  });

  it("persists profile onboarding pain points", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Asha Owner",
      email: "asha@example.com",
      age: 34,
      gender: "FEMALE",
      maritalStatus: "MARRIED",
      businessType: BusinessType.Solopreneur,
      businessDescription: "Boutique consulting studio",
      socialHandles: { linkedin: "https://linkedin.com/in/asha" },
      painPoints: { gettingCustomers: true, executingPlans: true },
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
    });

    const result = await service.updateProfileOnboarding("user-1", "tenant-1", {
      businessDescription: "Boutique consulting studio",
      painPoints: { gettingCustomers: true, executingPlans: true },
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          painPoints: { gettingCustomers: true, executingPlans: true },
        }),
      }),
    );
    expect(result.painPoints).toEqual({
      gettingCustomers: true,
      executingPlans: true,
    });
  });

  it("upserts workbook-aligned business identity fields", async () => {
    const saved = {
      id: "identity-1",
      tenantId: "tenant-1",
      companyName: "Bridge Gaps Studio",
      companyType: "SOLE_PROPRIETORSHIP",
      customerType: "B2B",
      registrationStatus: "REGISTERED",
      offeringType: "SERVICE",
      industry: "CONSULTING",
      businessAge: 4,
      turnoverBand: "L50_TO_1CR",
      employeeRange: "MICRO",
      website: "https://example.com",
      description: "Sales and business coaching",
      usp: "Practical accountability for owners",
      keywords: ["sales", "accountability"],
      offerings: ["Business owner review", "Sales excellence workshop"],
      createdAt: new Date("2026-05-07T00:00:00.000Z"),
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
    };
    prisma.businessIdentity.upsert.mockResolvedValue(saved);

    const result = await service.upsertBusinessIdentity("tenant-1", {
      companyName: "Bridge Gaps Studio",
      companyType: "SOLE_PROPRIETORSHIP" as any,
      customerType: "B2B" as any,
      registrationStatus: "REGISTERED" as any,
      offeringType: "SERVICE" as any,
      industry: "CONSULTING" as any,
      businessAge: 4,
      turnoverBand: "L50_TO_1CR" as any,
      employeeRange: "MICRO" as any,
      website: "https://example.com",
      description: "Sales and business coaching",
      usp: "Practical accountability for owners",
      keywords: ["sales", "accountability"],
      offerings: ["Business owner review", "Sales excellence workshop"],
    });

    expect(prisma.businessIdentity.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      update: expect.objectContaining({
        customerType: "B2B",
        registrationStatus: "REGISTERED",
        offeringType: "SERVICE",
        businessAge: 4,
        usp: "Practical accountability for owners",
        keywords: ["sales", "accountability"],
        offerings: ["Business owner review", "Sales excellence workshop"],
      }),
      create: expect.objectContaining({
        tenantId: "tenant-1",
        customerType: "B2B",
        registrationStatus: "REGISTERED",
        offeringType: "SERVICE",
        keywords: ["sales", "accountability"],
      }),
    });
    expect(result).toEqual(saved);
  });

  it("creates onboarding progress when a step is saved before progress exists", async () => {
    const saved = {
      id: "identity-1",
      tenantId: "tenant-1",
      companyName: "Bridge Gaps Studio",
      companyType: "SOLE_PROPRIETORSHIP",
      customerType: "B2B",
      registrationStatus: "REGISTERED",
      offeringType: "SERVICE",
      industry: "CONSULTING",
      businessAge: 4,
      turnoverBand: "L50_TO_1CR",
      employeeRange: "MICRO",
      website: "https://example.com",
      description: "Sales and business coaching",
      usp: "Practical accountability for owners",
      keywords: ["sales", "accountability"],
      offerings: ["Business owner review"],
      createdAt: new Date("2026-05-07T00:00:00.000Z"),
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
    };
    prisma.businessIdentity.upsert.mockResolvedValue(saved);

    await service.upsertBusinessIdentity("tenant-1", {
      companyName: "Bridge Gaps Studio",
      companyType: "SOLE_PROPRIETORSHIP" as any,
      customerType: "B2B" as any,
      registrationStatus: "REGISTERED" as any,
      offeringType: "SERVICE" as any,
      industry: "CONSULTING" as any,
      businessAge: 4,
      turnoverBand: "L50_TO_1CR" as any,
      employeeRange: "MICRO" as any,
      website: "https://example.com",
      description: "Sales and business coaching",
      usp: "Practical accountability for owners",
      keywords: ["sales", "accountability"],
      offerings: ["Business owner review"],
    });

    expect(prisma.onboardingProgress.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      update: {},
      create: {
        tenantId: "tenant-1",
        currentStep: 1,
        stepsCompleted: [],
        isCompleted: false,
      },
    });
    expect(prisma.onboardingProgress.update).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      data: {
        businessIdentityCompleted: true,
        stepsCompleted: ["BUSINESS_IDENTITY"],
      },
    });
  });

  it("calculates sales planning order lead and customer contribution targets", async () => {
    const payload = {
      yearMinus3Value: 500000,
      yearMinus2Value: 750000,
      yearMinus1Value: 1000000,
      projectedYearValue: 1200000,
      monthlyContribution: [10, 10, 10, 10, 10, 10, 5, 5, 5, 5, 10, 10],
      averageTicketSize: 25000,
      conversionRatio: 20,
      existingCustomerContribution: 40,
      newCustomerContribution: 60,
    };
    const saved = {
      id: "sales-plan-1",
      tenantId: "tenant-1",
      ...payload,
      monthlyTargets: [
        120000, 120000, 120000, 120000, 120000, 120000, 60000, 60000,
        60000, 60000, 120000, 120000,
      ],
      monthlyOrderTargets: [5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 5, 5],
      monthlyLeadTargets: [25, 25, 25, 25, 25, 25, 15, 15, 15, 15, 25, 25],
      existingCustomerTarget: 480000,
      newCustomerTarget: 720000,
      createdAt: new Date("2026-05-07T00:00:00.000Z"),
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
    };
    prisma.salesPlan.upsert.mockResolvedValue(saved);

    const result = await service.upsertSalesPlan("tenant-1", payload);

    expect(prisma.salesPlan.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      update: expect.objectContaining({
        monthlyTargets: saved.monthlyTargets,
        averageTicketSize: 25000,
        conversionRatio: 20,
        monthlyOrderTargets: saved.monthlyOrderTargets,
        monthlyLeadTargets: saved.monthlyLeadTargets,
        existingCustomerTarget: 480000,
        newCustomerTarget: 720000,
      }),
      create: expect.objectContaining({
        tenantId: "tenant-1",
        monthlyTargets: saved.monthlyTargets,
        monthlyOrderTargets: saved.monthlyOrderTargets,
        monthlyLeadTargets: saved.monthlyLeadTargets,
      }),
    });
    expect(result).toEqual(saved);
  });

  it("persists activity templates with measurability and impact metadata", async () => {
    const activities = [
      {
        category: "Creating weekly social media content",
        priority: "HIGH" as any,
        weeklyGoal: 3,
        reminderDays: [1, 3, 5],
        measurability: "Increase or decrease in followers, views, likes, comments, and shares",
        impact: "Generating Leads",
        relevance: "BOTH" as any,
        enabled: true,
      },
      {
        category: "Creating a monthly ad campaign on social media",
        priority: "HIGH" as any,
        weeklyGoal: 1,
        reminderDays: [2],
        measurability: "Leads generated vs leads converted",
        impact: "Sales",
        relevance: "BOTH" as any,
        enabled: true,
      },
    ];
    const saved = {
      id: "activity-config-1",
      tenantId: "tenant-1",
      salesEnabled: true,
      marketingEnabled: true,
      networkingEnabled: true,
      productDevEnabled: true,
      operationsEnabled: true,
      weeklyActivityGoal: 4,
      enableReminders: true,
      reminderDays: [1, 3, 5],
      activities,
      createdAt: new Date("2026-05-07T00:00:00.000Z"),
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
    };
    prisma.activityConfiguration.upsert.mockResolvedValue(saved);

    const result = await service.upsertActivityConfiguration("tenant-1", {
      weeklyActivityGoal: 4,
      activities,
    });

    expect(prisma.activityConfiguration.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      update: expect.objectContaining({
        weeklyActivityGoal: 4,
        activities,
      }),
      create: expect.objectContaining({
        tenantId: "tenant-1",
        weeklyActivityGoal: 4,
        activities,
      }),
    });
    expect(result).toEqual(saved);
  });

  it("completes onboarding from saved core mobile setup and creates default optional artifacts", async () => {
    prisma.salesCycleStage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    prisma.achievementStage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(4);
    prisma.salesPlan.upsert.mockResolvedValue({});
    prisma.salesPlan.findUnique.mockResolvedValue({
      projectedYearValue: 1200000,
    });
    prisma.user.findFirst.mockResolvedValue({ name: "Asha Owner" });
    prisma.businessIdentity.findUnique.mockResolvedValue({
      companyName: "Bridge Gaps Studio",
      usp: "Practical accountability for owners",
    });
    prisma.activityConfiguration.findUnique.mockResolvedValue({
      weeklyActivityGoal: 5,
    });
    prisma.onboardingProgress.update
      .mockResolvedValueOnce({
        id: "progress-1",
        tenantId: "tenant-1",
        currentStep: 1,
        stepsCompleted: [
          "PROFILE",
          "BUSINESS_IDENTITY",
          "SALES_PLAN",
          "ACTIVITY_CONFIG",
          "SALES_CYCLE",
          "ACHIEVEMENT_STAGES",
          "SUBSCRIPTION",
        ],
        isCompleted: false,
        completedAt: null,
        profileCompleted: true,
        businessIdentityCompleted: true,
        salesPlanCompleted: true,
        activityConfigCompleted: true,
        salesCycleCompleted: true,
        achievementStagesCompleted: true,
        subscriptionCompleted: true,
        visualSetupCompleted: false,
        selectedPlan: SubscriptionPlan.FREE,
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
        updatedAt: new Date("2026-05-07T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "progress-1",
        tenantId: "tenant-1",
        currentStep: 8,
        stepsCompleted: [
          "PROFILE",
          "BUSINESS_IDENTITY",
          "SALES_PLAN",
          "ACTIVITY_CONFIG",
          "SALES_CYCLE",
          "ACHIEVEMENT_STAGES",
          "SUBSCRIPTION",
          "VISUAL_SETUP",
        ],
        isCompleted: true,
        completedAt: new Date("2026-05-07T00:00:00.000Z"),
        profileCompleted: true,
        businessIdentityCompleted: true,
        salesPlanCompleted: true,
        activityConfigCompleted: true,
        salesCycleCompleted: true,
        achievementStagesCompleted: true,
        subscriptionCompleted: true,
        visualSetupCompleted: true,
        selectedPlan: SubscriptionPlan.FREE,
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
        updatedAt: new Date("2026-05-07T00:00:00.000Z"),
      });
    prisma.tenant.update.mockResolvedValue({});
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.subscription.create.mockResolvedValue({});

    const result = await service.completeOnboarding("tenant-1");

    expect(prisma.salesCycleStage.create).toHaveBeenCalledTimes(5);
    expect(prisma.achievementStage.create).toHaveBeenCalledTimes(4);
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
      }),
    });
    expect(result.isCompleted).toBe(true);
  });
});
