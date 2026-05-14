import { SalesProspectStatus } from "@prisma/client";
import { CoachService } from "./coach.service";
import { CoachState } from "./dto/coach.dto";

const userId = "user-coach";
const tenantId = "tenant-coach";
const wednesday = new Date("2026-05-13T10:00:00.000Z");

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  const tx = {
    weeklySalesEntry: { upsert: jest.fn().mockResolvedValue({}) },
    activity: { create: jest.fn().mockResolvedValue({}) },
    salesProspect: { create: jest.fn().mockResolvedValue({}) },
    actionLog: { create: jest.fn().mockResolvedValue({}) },
  };

  return {
    onboardingProgress: {
      findUnique: jest.fn().mockResolvedValue({
        isCompleted: true,
        completedAt: new Date("2026-05-13T09:00:00.000Z"),
      }),
    },
    businessIdentity: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ companyName: "Acme", usp: "Speed" }),
    },
    salesPlan: {
      findUnique: jest.fn().mockResolvedValue({
        projectedYearValue: 11700000,
        monthlyTargets: [900000, 900000, 900000, 900000, 900000, 900000],
      }),
    },
    weeklySalesEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    activityConfiguration: {
      findUnique: jest.fn().mockResolvedValue({ weeklyActivityGoal: 7 }),
    },
    activity: {
      count: jest.fn().mockResolvedValue(0),
    },
    salesProspect: {
      count: jest.fn().mockResolvedValue(0),
    },
    actionLog: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (callback: (transaction: any) => unknown) =>
      callback(tx),
    ),
    __tx: tx,
    ...overrides,
  } as any;
}

describe("CoachService", () => {
  it("returns catch-up guidance for a mid-week onboarding with no week data", async () => {
    const service = new CoachService(createPrismaMock());

    const result = await service.getToday(userId, tenantId, wednesday);

    expect(result.state).toBe(CoachState.CATCH_UP_REQUIRED);
    expect(result.stats.weeklyTarget).toBe(225000);
    expect(result.stats.expectedByToday).toBe(96429);
    expect(result.actions[0]).toEqual(
      expect.objectContaining({
        type: "COMPLETE_CATCH_UP",
        priority: "required",
      }),
    );
  });

  it("returns behind guidance when catch-up is complete but pace is low", async () => {
    const service = new CoachService(
      createPrismaMock({
        weeklySalesEntry: {
          findUnique: jest.fn().mockResolvedValue({ achieved: 50000 }),
        },
        activity: { count: jest.fn().mockResolvedValue(1) },
        actionLog: {
          findFirst: jest.fn().mockResolvedValue({ id: "log-1" }),
        },
      }),
    );

    const result = await service.getToday(userId, tenantId, wednesday);

    expect(result.state).toBe(CoachState.BEHIND);
    expect(result.stats.achievedSoFar).toBe(50000);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "COMPLETE_ACTIVITY_RHYTHM" }),
        expect.objectContaining({ type: "LOG_OR_CREATE_SALES_PROGRESS" }),
      ]),
    );
  });

  it("saves catch-up into weekly sales, activities, prospects, and marker log", async () => {
    const prisma = createPrismaMock({
      actionLog: {
        findFirst: jest.fn().mockResolvedValue({ id: "log-1" }),
      },
    });
    const service = new CoachService(prisma);

    await service.saveCatchUp(
      userId,
      tenantId,
      {
        salesRevenue: 50000,
        orderCount: 2,
        activitiesCompleted: [
          {
            title: "Called warm prospect",
            category: "Sales",
            occurredOn: "2026-05-12",
          },
        ],
        prospects: [
          {
            name: "Sarah Chen",
            status: SalesProspectStatus.WARM,
            nextAction: "Send proposal",
            nextFollowUpDate: "2026-05-15",
          },
        ],
        notes: "Catch-up from Monday to Wednesday",
      },
      wednesday,
    );

    expect(prisma.__tx.weeklySalesEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          achieved: 50000,
          orders: 2,
        }),
      }),
    );
    expect(prisma.__tx.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Called warm prospect",
          status: "Completed",
        }),
      }),
    );
    expect(prisma.__tx.salesProspect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prospectName: "Sarah Chen",
          status: SalesProspectStatus.WARM,
        }),
      }),
    );
    expect(prisma.__tx.actionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          module: "coach",
          action: "catch_up_completed",
        }),
      }),
    );
  });
});
