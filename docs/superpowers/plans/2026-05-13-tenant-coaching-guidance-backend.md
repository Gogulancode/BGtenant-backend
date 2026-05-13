# Tenant Coaching Guidance Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tenant-authenticated `GET /api/v1/dashboard/guidance` endpoint with deterministic, encouraging coaching cards.

**Architecture:** Add a focused guidance service under the existing dashboard module. The service reads tenant-scoped onboarding, setup, sales, CRM prospect, and activity data through Prisma and returns a stable response contract for tenant web and mobile. AI is deliberately not required in this phase; the rule engine produces production-safe coaching copy without external provider risk.

**Tech Stack:** NestJS, Prisma, Jest, existing `JwtAuthGuard`, `RolesGuard`, and tenant role constants.

---

## File Structure

- Create `src/dashboard/dto/dashboard-guidance.dto.ts`: TypeScript interfaces and string-literal unions for the guidance response contract.
- Create `src/dashboard/dashboard-guidance.service.ts`: Rule engine, data loading, health score calculation, and guidance response builder.
- Create `src/dashboard/dashboard-guidance.service.spec.ts`: Unit tests for the rule engine using mocked Prisma calls.
- Modify `src/dashboard/dashboard.controller.ts`: Add `GET /dashboard/guidance`.
- Modify `src/dashboard/dashboard.module.ts`: Register `DashboardGuidanceService`.
- Modify `src/dashboard/dashboard.contract.spec.ts`: Add a lightweight controller/service contract check or keep existing summary contract unchanged if a dedicated service spec covers the response.

## Response Contract

```ts
export type GuidanceCardType = "next_action" | "insight" | "celebration";
export type GuidancePriority = "high" | "medium" | "low";
export type GuidanceSource = "setup" | "sales" | "crm" | "activity" | "profile";
export type GuidanceSignalStatus = "good" | "watch" | "risk";

export interface GuidanceSummaryDto {
  title: string;
  message: string;
  tone: "encouraging";
  healthScore: number;
}

export interface GuidanceCardDto {
  id: string;
  type: GuidanceCardType;
  priority: GuidancePriority;
  title: string;
  message: string;
  actionLabel: string;
  actionRoute: string;
  source: GuidanceSource;
}

export interface GuidanceSignalDto {
  key: string;
  label: string;
  value: number;
  unit: "count" | "percent" | "currency";
  status: GuidanceSignalStatus;
}

export interface DashboardGuidanceDto {
  summary: GuidanceSummaryDto;
  cards: GuidanceCardDto[];
  signals: GuidanceSignalDto[];
  generatedAt: Date;
}
```

### Task 1: Add Guidance Service Tests

**Files:**
- Create: `src/dashboard/dashboard-guidance.service.spec.ts`
- Create: `src/dashboard/dto/dashboard-guidance.dto.ts`

- [ ] **Step 1: Create the DTO file with the response contract**

Add `src/dashboard/dto/dashboard-guidance.dto.ts` with the contract shown in the "Response Contract" section.

- [ ] **Step 2: Write failing unit tests for setup, empty CRM, sales gap, CRM follow-up, activity rhythm, and tenant scoping**

Add `src/dashboard/dashboard-guidance.service.spec.ts`:

```ts
import { DashboardGuidanceService } from "./dashboard-guidance.service";
import { PrismaService } from "../prisma/prisma.service";
import { SalesProspectStatus } from "@prisma/client";

const userId = "user-guidance";
const tenantId = "tenant-guidance";

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  const prisma = {
    onboardingProgress: {
      findUnique: jest.fn().mockResolvedValue({
        tenantId,
        isCompleted: false,
        profileCompleted: true,
        businessIdentityCompleted: false,
        salesPlanCompleted: true,
        activityConfigCompleted: false,
        salesCycleCompleted: true,
        achievementStagesCompleted: true,
        subscriptionCompleted: true,
        visualSetupCompleted: false,
      }),
    },
    businessSetupChecklist: {
      findUnique: jest.fn().mockResolvedValue({
        uspDefined: true,
        menuCardDefined: true,
        packagesDefined: false,
        customerSegmentDefined: true,
      }),
    },
    salesPlan: {
      findUnique: jest.fn().mockResolvedValue({
        projectedYearValue: 1200000,
        monthlyTargets: [100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000],
        averageTicketSize: 25000,
        conversionRatio: 25,
        existingCustomerContribution: 40,
        newCustomerContribution: 60,
      }),
    },
    salesTracker: {
      findUnique: jest.fn().mockResolvedValue({
        target: 100000,
        achieved: 42000,
      }),
    },
    salesProspect: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    activity: {
      count: jest.fn().mockResolvedValue(1),
    },
    activityConfiguration: {
      findUnique: jest.fn().mockResolvedValue({
        weeklyActivityGoal: 5,
        enableReminders: true,
      }),
    },
    ...overrides,
  } as unknown as PrismaService;

  return prisma;
}

describe("DashboardGuidanceService", () => {
  it("returns setup guidance when onboarding or business setup is incomplete", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.summary.title).toBe("Today's Focus");
    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "complete-business-setup",
          source: "setup",
          priority: "high",
          actionRoute: "/setup",
        }),
      ]),
    );
  });

  it("returns starter CRM guidance when there are no prospects", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "add-first-prospects",
          source: "crm",
          actionLabel: "Add prospects",
          actionRoute: "/sales/prospects",
        }),
      ]),
    );
  });

  it("returns sales gap guidance when monthly achievement is behind target", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sales-gap-followups",
          source: "sales",
          priority: "high",
          actionRoute: "/sales",
        }),
      ]),
    );
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "monthly_target_progress",
          value: 42,
          status: "watch",
        }),
      ]),
    );
  });

  it("returns CRM follow-up guidance for warm or hot prospects", async () => {
    const prisma = createPrismaMock({
      salesProspect: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "prospect-1",
            prospectName: "Acme Traders",
            status: SalesProspectStatus.HOT,
            proposalValue: 75000,
            lastFollowUpAt: new Date("2026-05-07T00:00:00.000Z"),
          },
        ]),
      },
    });
    const service = new DashboardGuidanceService(prisma);

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crm-followup-acme-traders",
          source: "crm",
          actionLabel: "Follow up",
        }),
      ]),
    );
  });

  it("returns activity rhythm guidance when weekly activity is below configured goal", async () => {
    const service = new DashboardGuidanceService(createPrismaMock());

    const result = await service.getGuidance(userId, tenantId);

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "activity-rhythm",
          source: "activity",
          actionRoute: "/activities",
        }),
      ]),
    );
  });

  it("uses tenant and user filters for tenant scoped data", async () => {
    const prisma = createPrismaMock() as unknown as {
      onboardingProgress: { findUnique: jest.Mock };
      businessSetupChecklist: { findUnique: jest.Mock };
      salesPlan: { findUnique: jest.Mock };
      salesTracker: { findUnique: jest.Mock };
      salesProspect: { count: jest.Mock; findMany: jest.Mock };
      activity: { count: jest.Mock };
      activityConfiguration: { findUnique: jest.Mock };
    };
    const service = new DashboardGuidanceService(prisma as unknown as PrismaService);

    await service.getGuidance(userId, tenantId);

    expect(prisma.onboardingProgress.findUnique).toHaveBeenCalledWith({ where: { tenantId } });
    expect(prisma.salesTracker.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId_month: expect.objectContaining({ tenantId, userId }) },
    });
    expect(prisma.salesProspect.count).toHaveBeenCalledWith({ where: { tenantId, userId } });
    expect(prisma.activity.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId, userId }),
    });
  });
});
```

- [ ] **Step 3: Run the service test and verify it fails because the service does not exist**

Run:

```powershell
npm test -- dashboard-guidance.service.spec.ts --runInBand
```

Expected: FAIL with a TypeScript module resolution error for `./dashboard-guidance.service`.

### Task 2: Implement Rule-Based Guidance Service

**Files:**
- Create: `src/dashboard/dashboard-guidance.service.ts`
- Modify: `src/dashboard/dashboard-guidance.service.spec.ts` only if Prisma unique names differ during compile

- [ ] **Step 1: Implement `DashboardGuidanceService`**

Add `src/dashboard/dashboard-guidance.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { SalesProspectStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DashboardGuidanceDto,
  GuidanceCardDto,
  GuidanceSignalDto,
} from "./dto/dashboard-guidance.dto";

function percent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfWeek(date = new Date()): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? 6 : day - 1;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

@Injectable()
export class DashboardGuidanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getGuidance(
    userId: string,
    tenantId: string | null | undefined,
  ): Promise<DashboardGuidanceDto> {
    if (!tenantId) {
      return {
        summary: {
          title: "Today's Focus",
          message: "Sign in with a tenant workspace to see your coaching focus.",
          tone: "encouraging",
          healthScore: 0,
        },
        cards: [],
        signals: [],
        generatedAt: new Date(),
      };
    }

    const month = currentMonthKey();
    const weekStart = startOfWeek();

    const [
      onboarding,
      setup,
      salesPlan,
      salesTracker,
      prospectCount,
      followUps,
      weeklyActivityCount,
      activityConfiguration,
    ] = await Promise.all([
      this.prisma.onboardingProgress.findUnique({ where: { tenantId } }),
      this.prisma.businessSetupChecklist.findUnique({ where: { tenantId } }),
      this.prisma.salesPlan.findUnique({ where: { tenantId } }),
      this.prisma.salesTracker.findUnique({
        where: { tenantId_userId_month: { tenantId, userId, month } },
      }),
      this.prisma.salesProspect.count({ where: { tenantId, userId } }),
      this.prisma.salesProspect.findMany({
        where: {
          tenantId,
          userId,
          status: { in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT] },
        },
        orderBy: [{ lastFollowUpAt: "asc" }, { updatedAt: "desc" }],
        take: 3,
        select: {
          prospectName: true,
          status: true,
          proposalValue: true,
          lastFollowUpAt: true,
        },
      }),
      this.prisma.activity.count({
        where: {
          tenantId,
          userId,
          createdAt: { gte: weekStart },
        },
      }),
      this.prisma.activityConfiguration.findUnique({ where: { tenantId } }),
    ]);

    const cards: GuidanceCardDto[] = [];
    const signals: GuidanceSignalDto[] = [];

    const setupComplete =
      Boolean(onboarding?.isCompleted) &&
      Boolean(setup?.uspDefined) &&
      Boolean(setup?.menuCardDefined) &&
      Boolean(setup?.packagesDefined) &&
      Boolean(setup?.customerSegmentDefined);

    if (!setupComplete) {
      cards.push({
        id: "complete-business-setup",
        type: "next_action",
        priority: "high",
        title: "Strengthen your business foundation",
        message:
          "A few setup details are still open. Complete them so your sales plan and profile feel sharper.",
        actionLabel: "Finish setup",
        actionRoute: "/setup",
        source: "setup",
      });
    }

    const monthlyTarget =
      Number(salesTracker?.target) ||
      Number(salesPlan?.monthlyTargets?.[new Date().getMonth()]) ||
      0;
    const monthlyAchieved = Number(salesTracker?.achieved) || 0;
    const monthlyProgress = percent(monthlyAchieved, monthlyTarget);

    if (monthlyTarget > 0) {
      signals.push({
        key: "monthly_target_progress",
        label: "Monthly target progress",
        value: monthlyProgress,
        unit: "percent",
        status: monthlyProgress >= 70 ? "good" : monthlyProgress >= 35 ? "watch" : "risk",
      });
    }

    if (monthlyTarget > 0 && monthlyProgress < 70) {
      cards.push({
        id: "sales-gap-followups",
        type: "next_action",
        priority: "high",
        title: "Close the sales gap",
        message: `You're ${monthlyProgress}% toward this month's target. A focused follow-up today can protect the month.`,
        actionLabel: "Log sales",
        actionRoute: "/sales",
        source: "sales",
      });
    }

    signals.push({
      key: "crm_prospect_count",
      label: "CRM prospects",
      value: prospectCount,
      unit: "count",
      status: prospectCount >= 3 ? "good" : "watch",
    });

    if (prospectCount === 0) {
      cards.push({
        id: "add-first-prospects",
        type: "next_action",
        priority: "medium",
        title: "Build your first follow-up list",
        message:
          "Start with three prospects you can contact this week. Small lists create real rhythm.",
        actionLabel: "Add prospects",
        actionRoute: "/sales/prospects",
        source: "crm",
      });
    } else if (followUps.length > 0) {
      const prospect = followUps[0];
      cards.push({
        id: `crm-followup-${slug(prospect.prospectName)}`,
        type: "next_action",
        priority: prospect.status === SalesProspectStatus.HOT ? "high" : "medium",
        title: `Follow up with ${prospect.prospectName}`,
        message:
          "This prospect is already warm. A timely follow-up can move the conversation forward.",
        actionLabel: "Follow up",
        actionRoute: "/sales/prospects",
        source: "crm",
      });
    }

    const weeklyGoal = Number(activityConfiguration?.weeklyActivityGoal) || 0;
    const activityProgress = percent(weeklyActivityCount, weeklyGoal);

    if (weeklyGoal > 0) {
      signals.push({
        key: "weekly_activity_progress",
        label: "Weekly activity rhythm",
        value: activityProgress,
        unit: "percent",
        status: activityProgress >= 70 ? "good" : activityProgress >= 35 ? "watch" : "risk",
      });
    }

    if (weeklyGoal > 0 && activityProgress < 70) {
      cards.push({
        id: "activity-rhythm",
        type: "next_action",
        priority: "medium",
        title: "Rebuild today's activity rhythm",
        message: `You've logged ${weeklyActivityCount} of ${weeklyGoal} planned activities this week. Add one useful action today.`,
        actionLabel: "Add activity",
        actionRoute: "/activities",
        source: "activity",
      });
    }

    if (cards.length === 0) {
      cards.push({
        id: "momentum-on-track",
        type: "celebration",
        priority: "low",
        title: "Your rhythm is on track",
        message:
          "You have the core pieces moving. Review your dashboard and keep one meaningful follow-up active today.",
        actionLabel: "Review dashboard",
        actionRoute: "/dashboard",
        source: "profile",
      });
    }

    const healthScore = Math.round(
      [
        setupComplete ? 100 : 50,
        monthlyTarget > 0 ? monthlyProgress : 50,
        prospectCount >= 3 ? 100 : prospectCount * 25,
        weeklyGoal > 0 ? activityProgress : 50,
      ].reduce((total, item) => total + item, 0) / 4,
    );

    const primaryCard = cards[0];

    return {
      summary: {
        title: "Today's Focus",
        message: primaryCard.message,
        tone: "encouraging",
        healthScore,
      },
      cards: cards.slice(0, 5),
      signals,
      generatedAt: new Date(),
    };
  }
}
```

- [ ] **Step 2: Run the service test and fix compile mismatches only**

Run:

```powershell
npm test -- dashboard-guidance.service.spec.ts --runInBand
```

Expected: PASS. If Prisma generated unique input names differ, update only the test expectation and service query to match the generated Prisma client.

- [ ] **Step 3: Commit the service**

Run:

```powershell
git add src/dashboard/dto/dashboard-guidance.dto.ts src/dashboard/dashboard-guidance.service.ts src/dashboard/dashboard-guidance.service.spec.ts
git commit -m "feat: add dashboard coaching guidance service"
```

### Task 3: Expose Guidance Endpoint

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`
- Modify: `src/dashboard/dashboard.module.ts`
- Modify: `src/dashboard/dashboard.contract.spec.ts`

- [ ] **Step 1: Write failing controller/module contract expectation**

In `src/dashboard/dashboard.contract.spec.ts`, import `DashboardGuidanceService`, add a mock `guidanceService`, and add this test:

```ts
it("delegates guidance requests to the guidance service with tenant context", async () => {
  const guidanceService = {
    getGuidance: jest.fn().mockResolvedValue({
      summary: {
        title: "Today's Focus",
        message: "Keep one meaningful follow-up active today.",
        tone: "encouraging",
        healthScore: 75,
      },
      cards: [],
      signals: [],
      generatedAt: new Date("2026-05-13T00:00:00.000Z"),
    }),
  } as unknown as DashboardGuidanceService;

  const controller = new DashboardController({} as DashboardService, guidanceService);

  await expect(
    controller.getGuidance({
      userId: "user-contract",
      email: "owner@example.com",
      role: "TENANT_ADMIN" as never,
      tenantId: "tenant-contract",
    }),
  ).resolves.toMatchObject({
    summary: {
      title: "Today's Focus",
      tone: "encouraging",
    },
  });

  expect(guidanceService.getGuidance).toHaveBeenCalledWith(
    "user-contract",
    "tenant-contract",
  );
});
```

- [ ] **Step 2: Run the dashboard contract test and verify it fails**

Run:

```powershell
npm test -- dashboard.contract.spec.ts --runInBand
```

Expected: FAIL because `DashboardController` does not accept `DashboardGuidanceService` and does not expose `getGuidance`.

- [ ] **Step 3: Wire controller and module**

Update `src/dashboard/dashboard.controller.ts`:

```ts
import { DashboardGuidanceService } from "./dashboard-guidance.service";
```

Change the constructor:

```ts
constructor(
  private readonly dashboardService: DashboardService,
  private readonly dashboardGuidanceService: DashboardGuidanceService,
) {}
```

Add the endpoint:

```ts
@ApiOperation({ summary: "Get coaching guidance for the current tenant" })
@ApiOkResponse({ description: "Tenant coaching guidance payload" })
@Get("guidance")
@Roles(...TENANT_MEMBER_ROLES)
async getGuidance(@CurrentUser() user: UserContext) {
  return this.dashboardGuidanceService.getGuidance(user.userId, user.tenantId);
}
```

Update `src/dashboard/dashboard.module.ts`:

```ts
import { DashboardGuidanceService } from "./dashboard-guidance.service";
```

Change providers:

```ts
providers: [DashboardService, DashboardGuidanceService],
```

- [ ] **Step 4: Run dashboard tests**

Run:

```powershell
npm test -- dashboard.contract.spec.ts dashboard-guidance.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit endpoint wiring**

Run:

```powershell
git add src/dashboard/dashboard.controller.ts src/dashboard/dashboard.module.ts src/dashboard/dashboard.contract.spec.ts
git commit -m "feat: expose dashboard coaching guidance endpoint"
```

### Task 4: Verification And OpenAPI

**Files:**
- Potentially modify: `docs/tenant-openapi.json` if `npm run generate:openapi` changes it

- [ ] **Step 1: Run backend unit tests**

Run:

```powershell
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Regenerate OpenAPI**

Run:

```powershell
npm run generate:openapi
```

Expected: PASS. If `docs/tenant-openapi.json` changes, include it in the final commit.

- [ ] **Step 4: Commit generated docs if needed**

If OpenAPI changed:

```powershell
git add docs/tenant-openapi.json
git commit -m "docs: update tenant api contract for guidance"
```

If OpenAPI did not change:

```powershell
git status --short
```

Expected: clean.

## Self-Review

Spec coverage:

- Backend `GET /api/v1/dashboard/guidance`: Task 3.
- Deterministic rule-based coaching: Task 2.
- Tenant auth and role guard reuse: Task 3 uses existing dashboard controller guards.
- Tenant scoping: Task 1 test and Task 2 Prisma filters.
- Setup, sales, CRM, activity inputs: Task 1 and Task 2.
- Friendly missing-data behavior: Task 2 creates starter CRM and momentum cards.
- AI disabled by default: No AI provider is added in this phase.

No implementation step depends on web/mobile changes. Web and mobile guidance cards should be planned after this endpoint is verified.
