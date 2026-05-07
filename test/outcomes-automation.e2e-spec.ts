import { Test, TestingModule } from "@nestjs/testing";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  startOfPreviousWeek,
  startOfWeek,
} from "../src/common/utils/date.utils";
import { OutcomeStatus } from "@prisma/client";
import { TelemetryService } from "../src/observability/telemetry.service";

type OutcomeRecord = {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  status: OutcomeStatus;
  weekStartDate: Date;
};

class InMemoryPrismaService {
  private records: OutcomeRecord[] = [];

  outcome = {
    findMany: (args: any) => this.findMany(args),
    findFirst: (args: any) => this.findFirst(args),
    updateMany: (args: any) => this.updateMany(args),
    create: (args: any) => this.create(args),
    createMany: (args: any) => this.createMany(args),
  };

  reset(data: OutcomeRecord[]) {
    this.records = data.map((item) => ({ ...item }));
  }

  snapshot() {
    return this.records.map((item) => ({ ...item }));
  }

  private matches(record: OutcomeRecord, where: any = {}) {
    if (!where) {
      return true;
    }
    return Object.entries(where).every(([key, value]) => {
      if (key === "weekStartDate" && value && typeof value === "object") {
        if ("lt" in (value as Record<string, unknown>)) {
          const ltValue = (value as { lt?: Date }).lt;
          if (ltValue && !(record.weekStartDate < ltValue)) {
            return false;
          }
        }

        if ("gte" in (value as Record<string, unknown>)) {
          const gteValue = (value as { gte?: Date }).gte;
          if (gteValue && !(record.weekStartDate >= gteValue)) {
            return false;
          }
        }

        if (value instanceof Date) {
          return record.weekStartDate.getTime() === value.getTime();
        }

        return true;
      }

      if (key === "weekStartDate" && value instanceof Date) {
        return record.weekStartDate.getTime() === value.getTime();
      }

      if (
        value instanceof Date &&
        record[key as keyof OutcomeRecord] instanceof Date
      ) {
        return (
          (record[key as keyof OutcomeRecord] as Date).getTime() ===
          value.getTime()
        );
      }

      return value === record[key as keyof OutcomeRecord];
    });
  }

  private findMany({ where, distinct }: any = {}) {
    let results = this.records.filter((record) => this.matches(record, where));

    if (distinct) {
      const distinctFields = Array.isArray(distinct) ? distinct : [distinct];
      const seen = new Set<string>();
      results = results.filter((record) => {
        const key = distinctFields
          .map((field) => record[field as keyof OutcomeRecord])
          .join("|");
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    return results;
  }

  private findFirst({ where }: any) {
    return this.records.find((record) => this.matches(record, where)) ?? null;
  }

  private updateMany({ where, data }: any) {
    let count = 0;
    this.records = this.records.map((record) => {
      if (this.matches(record, where)) {
        count += 1;
        return { ...record, ...data };
      }
      return record;
    });
    return { count };
  }

  private create({ data }: any) {
    const record = {
      id: data.id ?? `outcome-${this.records.length + 1}`,
      ...data,
    } as OutcomeRecord;
    this.records.push(record);
    return record;
  }

  private createMany({ data }: any) {
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      this.create({ data: item });
    }
    return { count: items.length };
  }
}

class TelemetryStub {
  recordJobSuccess = jest.fn();
  recordJobFailure = jest.fn();
}

describe("Outcomes automation (integration)", () => {
  const userId = "user-automation";
  const tenantId = "tenant-automation";
  const secondUserId = "user-automation-2";
  const secondTenantId = "tenant-automation-2";
  let service: OutcomesService;
  let prisma: InMemoryPrismaService;
  let telemetry: TelemetryStub;
  let currentWeek: Date;

  beforeEach(async () => {
    prisma = new InMemoryPrismaService();
    telemetry = new TelemetryStub();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useValue: telemetry },
      ],
    }).compile();

    service = moduleRef.get(OutcomesService);

    const previousWeek = startOfPreviousWeek();
    currentWeek = startOfWeek();

    prisma.reset([
      {
        id: "planned-prev",
        tenantId,
        userId,
        title: "Complete onboarding",
        status: OutcomeStatus.Planned,
        weekStartDate: previousWeek,
      },
      {
        id: "done-prev",
        tenantId,
        userId,
        title: "Ship release",
        status: OutcomeStatus.Done,
        weekStartDate: previousWeek,
      },
      {
        id: "planned-cur",
        tenantId,
        userId,
        title: "Design playbooks",
        status: OutcomeStatus.Planned,
        weekStartDate: currentWeek,
      },
    ]);
  });

  it("flags overdue outcomes and carries them forward", async () => {
    const expectedCurrentWeek = new Date(currentWeek);
    await service.flagOverdueOutcomes();
    const summary = await service.autoCarryForwardMissed();

    expect(summary?.created).toBe(1);
    expect(summary?.usersProcessed).toBeGreaterThanOrEqual(1);
    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith(
      "outcomes-carry-forward",
      expect.objectContaining({ created: 1 }),
    );

    const snapshot = prisma.snapshot();
    const overdue = snapshot.find((o) => o.id === "planned-prev");
    expect(overdue?.status).toBe(OutcomeStatus.Missed);

    const duplicates = snapshot.filter(
      (o) =>
        o.tenantId === tenantId &&
        o.userId === userId &&
        o.title === "Complete onboarding" &&
        o.weekStartDate.getTime() === expectedCurrentWeek.getTime(),
    );
    expect(duplicates).toHaveLength(1);

    const currentWeekItems = snapshot.filter(
      (o) => o.weekStartDate.getTime() === expectedCurrentWeek.getTime(),
    );
    expect(currentWeekItems).toHaveLength(2);
  });

  it("does not duplicate outcomes when carry-forward cron runs multiple times", async () => {
    const expectedCurrentWeek = new Date(currentWeek);

    await service.flagOverdueOutcomes();
    const firstSummary = await service.autoCarryForwardMissed();
    const afterFirstRun = prisma.snapshot();

    const secondSummary = await service.autoCarryForwardMissed();
    const afterSecondRun = prisma.snapshot();

    const countAfterFirst = afterFirstRun.filter(
      (o) =>
        o.tenantId === tenantId &&
        o.userId === userId &&
        o.title === "Complete onboarding" &&
        o.weekStartDate.getTime() === expectedCurrentWeek.getTime(),
    ).length;
    const countAfterSecond = afterSecondRun.filter(
      (o) =>
        o.tenantId === tenantId &&
        o.userId === userId &&
        o.title === "Complete onboarding" &&
        o.weekStartDate.getTime() === expectedCurrentWeek.getTime(),
    ).length;

    expect(countAfterFirst).toBe(1);
    expect(countAfterSecond).toBe(1);
    expect(firstSummary?.created).toBe(1);
    expect(secondSummary?.created).toBe(0);
  });

  it("respects tenant boundaries when carrying forward missed outcomes", async () => {
    const previousWeek = startOfPreviousWeek();
    const weekStart = startOfWeek();

    prisma.reset([
      {
        id: "tenant1-prev",
        tenantId,
        userId,
        title: "Tenant One Goal",
        status: OutcomeStatus.Planned,
        weekStartDate: previousWeek,
      },
      {
        id: "tenant2-prev",
        tenantId: secondTenantId,
        userId: secondUserId,
        title: "Tenant Two Goal",
        status: OutcomeStatus.Planned,
        weekStartDate: previousWeek,
      },
    ]);

    await service.flagOverdueOutcomes();
    const summary = await service.autoCarryForwardMissed();

    const snapshot = prisma.snapshot();
    const tenantOneCarryForward = snapshot.filter(
      (o) =>
        o.tenantId === tenantId &&
        o.userId === userId &&
        o.title === "Tenant One Goal" &&
        o.weekStartDate.getTime() === weekStart.getTime(),
    );
    const tenantTwoCarryForward = snapshot.filter(
      (o) =>
        o.tenantId === secondTenantId &&
        o.userId === secondUserId &&
        o.title === "Tenant Two Goal" &&
        o.weekStartDate.getTime() === weekStart.getTime(),
    );

    expect(tenantOneCarryForward).toHaveLength(1);
    expect(tenantTwoCarryForward).toHaveLength(1);
    expect(summary?.created).toBe(2);

    // ensure no cross-tenant leakage
    const crossTenant = snapshot.find(
      (o) =>
        (o.tenantId === tenantId && o.userId === secondUserId) ||
        (o.tenantId === secondTenantId && o.userId === userId),
    );
    expect(crossTenant).toBeUndefined();
  });

  it("keeps manual carry-forward idempotent per user", async () => {
    const previousWeek = startOfPreviousWeek();
    const currentWeek = startOfWeek();

    prisma.reset([
      {
        id: "prev-a",
        tenantId,
        userId,
        title: "Document SOP",
        status: OutcomeStatus.Planned,
        weekStartDate: previousWeek,
      },
      {
        id: "prev-b",
        tenantId,
        userId,
        title: "Audit CRM",
        status: OutcomeStatus.Planned,
        weekStartDate: previousWeek,
      },
      {
        id: "current-a",
        tenantId,
        userId,
        title: "Document SOP",
        status: OutcomeStatus.Planned,
        weekStartDate: currentWeek,
      },
    ]);

    await service.flagOverdueOutcomes();

    const firstRun = await service.carryForwardMissed(userId, tenantId);
    expect(firstRun.created).toBe(1);
    expect(firstRun.alreadyPlanned).toContain("Document SOP");

    const secondRun = await service.carryForwardMissed(userId, tenantId);
    expect(secondRun.created).toBe(0);
    expect(secondRun.alreadyPlanned).toEqual(
      expect.arrayContaining(["Document SOP", "Audit CRM"]),
    );

    const snapshot = prisma.snapshot();
    const carried = snapshot.filter(
      (o) =>
        o.tenantId === tenantId &&
        o.userId === userId &&
        o.title === "Audit CRM" &&
        o.weekStartDate.getTime() === currentWeek.getTime(),
    );
    expect(carried).toHaveLength(1);
  });
});
