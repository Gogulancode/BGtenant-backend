import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";
import { ActionLogService } from "../action-log/action-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  let service: ReportsService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    user: { findFirst: jest.Mock };
    businessIdentity: { findUnique: jest.Mock };
    businessSetupChecklist: { findUnique: jest.Mock };
    salesPlan: { findUnique: jest.Mock };
    activityConfiguration: { findUnique: jest.Mock };
    salesProspect: {
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    achievementStage: { findMany: jest.Mock };
    businessSnapshot: { findFirst: jest.Mock };
  };
  let actionLog: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      user: { findFirst: jest.fn() },
      businessIdentity: { findUnique: jest.fn() },
      businessSetupChecklist: { findUnique: jest.fn() },
      salesPlan: { findUnique: jest.fn() },
      activityConfiguration: { findUnique: jest.fn() },
      salesProspect: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      achievementStage: { findMany: jest.fn() },
      businessSnapshot: { findFirst: jest.fn() },
    };
    actionLog = { record: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionLogService, useValue: actionLog },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it("builds a tenant business profile report with sales, activities, CRM, and roadmap", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Bridge Gaps Studio",
      slug: "bridge-gaps",
      email: "hello@example.com",
    });
    prisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      name: "Asha Owner",
      email: "asha@example.com",
      businessType: "Solopreneur",
      businessDescription: "Accountability coaching for business owners",
      socialHandles: { linkedin: "https://linkedin.com/in/asha" },
      painPoints: { gettingCustomers: true, executingPlans: true },
    });
    prisma.businessIdentity.findUnique.mockResolvedValue({
      companyName: "Bridge Gaps Studio",
      customerType: "B2B",
      registrationStatus: "REGISTERED",
      offeringType: "SERVICE",
      industry: "CONSULTING",
      industryOther: null,
      turnoverBand: "L50_TO_1CR",
      employeeRange: "MICRO",
      website: "https://example.com",
      description: "Sales accountability systems",
      usp: "Weekly execution clarity for founders",
      keywords: ["sales", "accountability"],
      offerings: ["Sales review", "Execution dashboard"],
    });
    prisma.businessSetupChecklist.findUnique.mockResolvedValue({
      uspDefined: true,
      uspValue: "Weekly execution clarity for founders",
      menuCardDefined: true,
      menuCardValue: "Sales review, Execution dashboard",
      packagesDefined: false,
      packagesValue: null,
      customerSegmentDefined: true,
      customerSegmentValue: "Founder-led service businesses",
    });
    prisma.salesPlan.findUnique.mockResolvedValue({
      projectedYearValue: 1200000,
      monthlyTargets: [100000, 100000],
      averageTicketSize: 25000,
      conversionRatio: 20,
      existingCustomerContribution: 40,
      newCustomerContribution: 60,
      monthlyOrderTargets: [4, 4],
      monthlyLeadTargets: [20, 20],
      existingCustomerTarget: 480000,
      newCustomerTarget: 720000,
    });
    prisma.activityConfiguration.findUnique.mockResolvedValue({
      weeklyActivityGoal: 7,
      enableReminders: true,
      reminderDays: [1, 3, 5],
      activities: [
        {
          category: "Sales follow-ups",
          priority: "HIGH",
          weeklyGoal: 5,
          reminderDays: [1, 3, 5],
          measurability: "Follow-ups completed",
          impact: "Move warm leads to closure",
          relevance: "BOTH",
          enabled: true,
        },
        {
          category: "Monthly offer",
          priority: "MEDIUM",
          weeklyGoal: 1,
          reminderDays: [2],
          measurability: "Offer shipped",
          impact: "Reactivate buyers",
          relevance: "SERVICE",
          enabled: false,
        },
      ],
    });
    prisma.salesProspect.groupBy.mockResolvedValue([
      {
        status: "WARM",
        _count: { _all: 2 },
        _sum: { proposalValue: 150000 },
      },
      {
        status: "CONVERTED",
        _count: { _all: 1 },
        _sum: { proposalValue: 50000 },
      },
    ]);
    prisma.salesProspect.findMany.mockResolvedValue([
      {
        prospectName: "Acme Traders",
        status: "WARM",
        proposalValue: 100000,
        lastFollowUpAt: new Date("2026-05-06T00:00:00.000Z"),
      },
    ]);
    prisma.achievementStage.findMany.mockResolvedValue([
      {
        name: "Foundation",
        order: 1,
        targetValue: 300000,
        percentOfGoal: 25,
        color: "#2563eb",
        icon: "target",
        reward: "Core systems active",
        isActive: true,
      },
    ]);
    prisma.businessSnapshot.findFirst.mockResolvedValue({
      annualSales: 900000,
      avgMonthlySales: 75000,
      ordersPerMonth: 3,
      avgSellingPrice: 25000,
      monthlyExpenses: 30000,
      profitMargin: 40,
      suggestedNSM: "Qualified conversations booked",
    });

    const result = await service.getBusinessProfileReport({
      userId: "user-1",
      tenantId: "tenant-1",
      role: Role.STAFF,
    });

    expect(result.tenant.name).toBe("Bridge Gaps Studio");
    expect(result.businessIdentity.companyName).toBe("Bridge Gaps Studio");
    expect(result.salesPlan.expectedMonthlyOrders).toBe(8);
    expect(result.salesPlan.expectedMonthlyLeads).toBe(40);
    expect(result.activities.enabledActivities).toHaveLength(1);
    expect(result.crm.totalProspects).toBe(3);
    expect(result.crm.pipelineValue).toBe(200000);
    expect(result.crm.convertedValue).toBe(50000);
    expect(result.crm.activeFollowUps).toBe(2);
    expect(result.achievementStages).toHaveLength(1);
    expect(actionLog.record).toHaveBeenCalledWith(
      "user-1",
      "tenant-1",
      "VIEW_BUSINESS_PROFILE_REPORT",
      "reports",
      { report: "business-profile" },
    );
  });
});
