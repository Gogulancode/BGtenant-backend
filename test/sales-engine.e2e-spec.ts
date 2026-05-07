import { Test, TestingModule } from "@nestjs/testing";
import { SalesService } from "../src/sales/sales.service";
import { SalesTargetsService } from "../src/sales/sales-targets.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  formatMonthKey,
  startOfPreviousWeek,
} from "../src/common/utils/date.utils";

type SalesPlanningRecord = {
  id: string;
  tenantId: string;
  userId: string;
  year: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  growthPct: number;
};

type SalesTrackerRecord = {
  id: string;
  tenantId: string;
  userId: string;
  month: string;
  target: number;
  achieved: number;
  orders: number;
  asp: number;
  profit: number;
};

class InMemorySalesPrismaService {
  private planningRecords: SalesPlanningRecord[] = [];
  private trackerRecords: SalesTrackerRecord[] = [];

  salesPlanning = {
    findFirst: (args: any) => this.findFirstPlanning(args),
    create: (args: any) => this.createPlanning(args),
    update: (args: any) => this.updatePlanning(args),
  };

  salesTracker = {
    findFirst: (args: any) => this.findFirstTracker(args),
    create: (args: any) => this.createTracker(args),
    update: (args: any) => this.updateTracker(args),
  };

  salesPlan = {
    findUnique: () => Promise.resolve(null),
  };

  $transaction = (operations: any[]) => Promise.all(operations);

  resetPlanning(data: SalesPlanningRecord[]) {
    this.planningRecords = data.map((item) => ({ ...item }));
  }

  resetTracker(data: SalesTrackerRecord[]) {
    this.trackerRecords = data.map((item) => ({ ...item }));
  }

  getPlanningSnapshot() {
    return this.planningRecords.map((item) => ({ ...item }));
  }

  getTrackerSnapshot() {
    return this.trackerRecords.map((item) => ({ ...item }));
  }

  private matchesPlanning(record: SalesPlanningRecord, where: any = {}) {
    return Object.entries(where).every(([key, value]) => {
      return value === record[key as keyof SalesPlanningRecord];
    });
  }

  private matchesTracker(record: SalesTrackerRecord, where: any = {}) {
    return Object.entries(where).every(([key, value]) => {
      return value === record[key as keyof SalesTrackerRecord];
    });
  }

  private findFirstPlanning({ where, select }: any) {
    const record = this.planningRecords.find((r) =>
      this.matchesPlanning(r, where),
    );
    if (!record) return null;
    if (select) {
      const result: any = {};
      Object.keys(select).forEach((key) => {
        if (select[key]) result[key] = record[key as keyof SalesPlanningRecord];
      });
      return result;
    }
    return record;
  }

  private findFirstTracker({ where, select }: any) {
    const record = this.trackerRecords.find((r) =>
      this.matchesTracker(r, where),
    );
    if (!record) return null;
    if (select) {
      const result: any = {};
      Object.keys(select).forEach((key) => {
        if (select[key]) result[key] = record[key as keyof SalesTrackerRecord];
      });
      return result;
    }
    return record;
  }

  private createPlanning({ data }: any) {
    const record = {
      id: data.id ?? `planning-${this.planningRecords.length + 1}`,
      ...data,
    } as SalesPlanningRecord;
    this.planningRecords.push(record);
    return record;
  }

  private createTracker({ data }: any) {
    const record = {
      id: data.id ?? `tracker-${this.trackerRecords.length + 1}`,
      ...data,
    } as SalesTrackerRecord;
    this.trackerRecords.push(record);
    return record;
  }

  private updatePlanning({ where, data }: any) {
    const index = this.planningRecords.findIndex((r) => r.id === where.id);
    if (index === -1) throw new Error("Planning record not found");
    this.planningRecords[index] = { ...this.planningRecords[index], ...data };
    return this.planningRecords[index];
  }

  private updateTracker({ where, data }: any) {
    const index = this.trackerRecords.findIndex((r) => r.id === where.id);
    if (index === -1) throw new Error("Tracker record not found");
    this.trackerRecords[index] = { ...this.trackerRecords[index], ...data };
    return this.trackerRecords[index];
  }
}

describe("Sales engine validation (integration)", () => {
  const userId = "user-sales-engine";
  const tenantId = "tenant-sales-engine";
  const secondUserId = "user-sales-engine-2";
  const secondTenantId = "tenant-sales-engine-2";
  let service: SalesService;
  let prisma: InMemorySalesPrismaService;

  beforeEach(async () => {
    // Mock February 15, 2025 for consistent testing
    jest.useFakeTimers().setSystemTime(new Date("2025-02-15T12:00:00.000Z"));

    prisma = new InMemorySalesPrismaService();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [SalesService, SalesTargetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(SalesService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Plan vs Actual Rollups", () => {
    it("calculates growth percentage correctly based on Q1 and Q4 values", async () => {
      const planningDto = {
        year: 2025,
        q1: 100000,
        q2: 110000,
        q3: 120000,
        q4: 150000,
      };

      const result = await service.upsertSalesPlanning(
        userId,
        tenantId,
        planningDto,
      );

      // Expected growth: (150000 - 100000) / 100000 * 100 = 50%
      expect(result.growthPct).toBe(50);
    });

    it("handles zero Q1 gracefully to avoid division by zero", async () => {
      const planningDto = {
        year: 2025,
        q1: 0,
        q2: 10000,
        q3: 20000,
        q4: 30000,
      };

      const result = await service.upsertSalesPlanning(
        userId,
        tenantId,
        planningDto,
      );

      // Should handle zero Q1 by using Math.max(q1, 1)
      expect(result.growthPct).toBe(3000000); // (30000 - 0) / 1 * 100
    });

    it("updates existing planning record instead of creating duplicate", async () => {
      const initialDto = {
        year: 2025,
        q1: 50000,
        q2: 60000,
        q3: 70000,
        q4: 80000,
      };

      const updatedDto = {
        year: 2025,
        q1: 60000,
        q2: 70000,
        q3: 80000,
        q4: 90000,
      };

      await service.upsertSalesPlanning(userId, tenantId, initialDto);
      await service.upsertSalesPlanning(userId, tenantId, updatedDto);

      const snapshot = prisma.getPlanningSnapshot();
      const userRecords = snapshot.filter(
        (r) =>
          r.userId === userId && r.tenantId === tenantId && r.year === 2025,
      );

      expect(userRecords).toHaveLength(1);
      expect(userRecords[0].q1).toBe(60000);
      expect(userRecords[0].growthPct).toBe(50); // (90000 - 60000) / 60000 * 100
    });
  });

  describe("Weekly Rollover Logic", () => {
    it("provides accurate current and previous month data for summary", async () => {
      // Setup planning data
      await service.upsertSalesPlanning(userId, tenantId, {
        year: 2025,
        q1: 120000,
        q2: 130000,
        q3: 140000,
        q4: 150000,
      });

      // Setup current month (February) tracker
      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-02",
        target: 30000,
        achieved: 15000,
        orders: 25,
        asp: 600,
        profit: 4500,
      });

      // Setup previous week's month (still February in this case) tracker
      const previousWeekMonth = formatMonthKey(
        startOfPreviousWeek(new Date("2025-02-15T12:00:00.000Z")),
      );
      if (previousWeekMonth !== "2025-02") {
        await service.upsertSalesTracker(userId, tenantId, {
          month: previousWeekMonth,
          target: 25000,
          achieved: 20000,
          orders: 20,
          asp: 1000,
          profit: 6000,
        });
      }

      const summary = await service.getSummary(userId, tenantId);

      expect(summary).toBeDefined();
      expect(summary.tracker?.month).toBe("2025-02");
      expect(summary.tracker?.achieved).toBe(15000);
      expect(summary.tracker?.target).toBe(30000);

      // Verify quarterly target calculation
      expect(summary.planning?.q1).toBe(120000);
      expect(summary.validation.weeklyPlan.status).toBe("CONFIGURED");
      expect(summary.validation.planVsActual.status).toBe("OFF_TRACK");
      expect(summary.validation.dailyTracker.status).toBe("CURRENT");
      expect(summary.validation.weeklyRollover.status).toBe("NOT_REQUIRED");
    });

    it("handles month boundary rollover correctly", async () => {
      // Test at month boundary - March 1st
      jest.setSystemTime(new Date("2025-03-01T12:00:00.000Z"));

      await service.upsertSalesPlanning(userId, tenantId, {
        year: 2025,
        q1: 120000,
        q2: 130000,
        q3: 140000,
        q4: 150000,
      });

      // February data
      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-02",
        target: 30000,
        achieved: 28000,
        orders: 35,
        asp: 800,
        profit: 8400,
      });

      // March data (new month)
      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-03",
        target: 32000,
        achieved: 5000,
        orders: 8,
        asp: 625,
        profit: 1500,
      });

      const summary = await service.getSummary(userId, tenantId);

      expect(summary.tracker?.month).toBe("2025-03");
      expect(summary.tracker?.achieved).toBe(5000);
      expect(summary.validation.weeklyRollover.carryForward?.month).toBe(
        "2025-02",
      );
      expect(summary.validation.weeklyRollover.status).toBe("ROLLED_OVER");
      expect(summary.validation.weeklyRollover.carryForward).toMatchObject({
        month: "2025-02",
        achieved: 28000,
      });
    });

    it("identifies missing quarterly plan configuration", async () => {
      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-02",
        target: 15000,
        achieved: 12000,
        orders: 18,
        asp: 666,
        profit: 4200,
      });

      const summary = await service.getSummary(userId, tenantId);

      expect(summary.validation.weeklyPlan.status).toBe("MISSING_PLAN");
      expect(summary.validation.planVsActual.status).toBe("NO_PLAN");
    });
  });

  describe("Tenant Isolation", () => {
    it("prevents cross-tenant data leakage in planning", async () => {
      // Create planning for two different tenants
      await service.upsertSalesPlanning(userId, tenantId, {
        year: 2025,
        q1: 100000,
        q2: 110000,
        q3: 120000,
        q4: 130000,
      });

      await service.upsertSalesPlanning(secondUserId, secondTenantId, {
        year: 2025,
        q1: 200000,
        q2: 210000,
        q3: 220000,
        q4: 230000,
      });

      // Verify tenant 1 can only see their data
      const tenant1Planning = await service.getSalesPlanning(
        userId,
        tenantId,
        2025,
      );
      expect(tenant1Planning?.q1).toBe(100000);

      // Verify tenant 2 can only see their data
      const tenant2Planning = await service.getSalesPlanning(
        secondUserId,
        secondTenantId,
        2025,
      );
      expect(tenant2Planning?.q1).toBe(200000);

      // Verify cross-tenant access returns null
      const crossTenantAccess = await service.getSalesPlanning(
        userId,
        secondTenantId,
        2025,
      );
      expect(crossTenantAccess).toBeNull();
    });

    it("prevents cross-tenant data leakage in tracking", async () => {
      // Create tracking for two different tenants
      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-02",
        target: 30000,
        achieved: 15000,
        orders: 25,
        asp: 600,
        profit: 4500,
      });

      await service.upsertSalesTracker(secondUserId, secondTenantId, {
        month: "2025-02",
        target: 50000,
        achieved: 35000,
        orders: 40,
        asp: 875,
        profit: 10500,
      });

      // Verify tenant 1 can only see their data
      const tenant1Tracker = await service.getSalesTracker(
        userId,
        tenantId,
        "2025-02",
      );
      expect(tenant1Tracker?.achieved).toBe(15000);

      // Verify tenant 2 can only see their data
      const tenant2Tracker = await service.getSalesTracker(
        secondUserId,
        secondTenantId,
        "2025-02",
      );
      expect(tenant2Tracker?.achieved).toBe(35000);

      // Verify cross-tenant access returns null
      const crossTenantAccess = await service.getSalesTracker(
        userId,
        secondTenantId,
        "2025-02",
      );
      expect(crossTenantAccess).toBeNull();
    });

    it("ensures summary endpoint respects tenant boundaries", async () => {
      // Setup data for both tenants
      await service.upsertSalesPlanning(userId, tenantId, {
        year: 2025,
        q1: 120000,
        q2: 130000,
        q3: 140000,
        q4: 150000,
      });

      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-02",
        target: 30000,
        achieved: 15000,
        orders: 25,
        asp: 600,
        profit: 4500,
      });

      await service.upsertSalesPlanning(secondUserId, secondTenantId, {
        year: 2025,
        q1: 240000,
        q2: 250000,
        q3: 260000,
        q4: 270000,
      });

      await service.upsertSalesTracker(secondUserId, secondTenantId, {
        month: "2025-02",
        target: 60000,
        achieved: 45000,
        orders: 50,
        asp: 900,
        profit: 13500,
      });

      // Get summaries for both tenants
      const tenant1Summary = await service.getSummary(userId, tenantId);
      const tenant2Summary = await service.getSummary(
        secondUserId,
        secondTenantId,
      );

      // Verify tenant isolation in summaries
      expect(tenant1Summary.planning?.q1).toBe(120000);
      expect(tenant1Summary.tracker?.achieved).toBe(15000);

      expect(tenant2Summary.planning?.q1).toBe(240000);
      expect(tenant2Summary.tracker?.achieved).toBe(45000);

      // Ensure no data mixing
      expect(tenant1Summary.planning?.q1).not.toBe(tenant2Summary.planning?.q1);
      expect(tenant1Summary.tracker?.achieved).not.toBe(
        tenant2Summary.tracker?.achieved,
      );
    });
  });

  describe("Error Handling", () => {
    it("handles missing planning gracefully in summary", async () => {
      // Only create tracker without planning
      await service.upsertSalesTracker(userId, tenantId, {
        month: "2025-02",
        target: 30000,
        achieved: 15000,
        orders: 25,
        asp: 600,
        profit: 4500,
      });

      const summary = await service.getSummary(userId, tenantId);

      expect(summary).toBeDefined();
      expect(summary.planning).toBeNull();
      expect(summary.tracker?.achieved).toBe(15000); // Tracker data should still be available
    });

    it("handles missing tracker gracefully in summary", async () => {
      // Only create planning without tracker
      await service.upsertSalesPlanning(userId, tenantId, {
        year: 2025,
        q1: 120000,
        q2: 130000,
        q3: 140000,
        q4: 150000,
      });

      const summary = await service.getSummary(userId, tenantId);

      expect(summary).toBeDefined();
      expect(summary.planning?.q1).toBe(120000);
      expect(summary.tracker).toBeNull(); // No tracker data available
    });
  });
});
