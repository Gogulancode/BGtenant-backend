import { Test, TestingModule } from "@nestjs/testing";
import { BusinessType } from "@prisma/client";
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
    };
    salesPlan: {
      upsert: jest.Mock;
    };
    activityConfiguration: {
      upsert: jest.Mock;
    };
    onboardingProgress: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      businessIdentity: {
        upsert: jest.fn(),
      },
      salesPlan: {
        upsert: jest.fn(),
      },
      activityConfiguration: {
        upsert: jest.fn(),
      },
      onboardingProgress: {
        findUnique: jest.fn().mockResolvedValue({
          currentStep: 1,
          stepsCompleted: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
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
});
