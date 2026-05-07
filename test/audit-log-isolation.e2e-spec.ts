import { Test, TestingModule } from "@nestjs/testing";
import { ActionLogService } from "../src/action-log/action-log.service";
import { PrismaService } from "../src/prisma/prisma.service";

interface ActionLogRecord {
  id: string;
  userId: string;
  tenantId: string | null;
  action: string;
  module: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

class InMemoryActionLogPrismaService {
  private logs: ActionLogRecord[] = [];
  private idCounter = 0;

  actionLog = {
    create: async ({ data }: any) => {
      const record: ActionLogRecord = {
        id: `log-${++this.idCounter}`,
        userId: data.userId,
        tenantId: data.tenantId,
        action: data.action,
        module: data.module ?? null,
        details: data.details ?? null,
        createdAt: new Date(),
      };
      this.logs.push(record);
      return record;
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      let result = [...this.logs];

      if (where?.tenantId) {
        result = result.filter((log) => log.tenantId === where.tenantId);
      }
      if (where?.userId) {
        result = result.filter((log) => log.userId === where.userId);
      }

      if (orderBy?.createdAt === "desc") {
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }

      if (take) {
        result = result.slice(0, take);
      }

      return result;
    },
  };

  clear() {
    this.logs = [];
    this.idCounter = 0;
  }

  getLogs() {
    return [...this.logs];
  }
}

describe("Audit Log Tenant Isolation", () => {
  let service: ActionLogService;
  let prisma: InMemoryActionLogPrismaService;

  const tenantA = "tenant-a-id";
  const tenantB = "tenant-b-id";
  const userA1 = "user-a1";
  const userA2 = "user-a2";
  const userB1 = "user-b1";

  beforeEach(async () => {
    prisma = new InMemoryActionLogPrismaService();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ActionLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ActionLogService);
    prisma.clear();
  });

  it("records logs with correct tenant context", async () => {
    await service.record(userA1, tenantA, "CREATE_METRIC", "metrics", {
      name: "Revenue",
    });

    const logs = prisma.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: userA1,
      tenantId: tenantA,
      action: "CREATE_METRIC",
      module: "metrics",
    });
  });

  it("records system-level actions with null tenant", async () => {
    await service.record("system", null, "SYSTEM_BACKUP", "ops");

    const logs = prisma.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].tenantId).toBeNull();
  });

  it("isolates logs by tenant when querying", async () => {
    // Create logs for both tenants
    await service.record(userA1, tenantA, "CREATE_METRIC", "metrics");
    await service.record(userA2, tenantA, "UPDATE_METRIC", "metrics");
    await service.record(userB1, tenantB, "CREATE_OUTCOME", "outcomes");
    await service.record(userB1, tenantB, "DELETE_OUTCOME", "outcomes");

    // Query tenant A logs
    const tenantALogs = await service.getByTenant(tenantA);
    expect(tenantALogs).toHaveLength(2);
    expect(tenantALogs.every((log) => log.tenantId === tenantA)).toBe(true);

    // Query tenant B logs
    const tenantBLogs = await service.getByTenant(tenantB);
    expect(tenantBLogs).toHaveLength(2);
    expect(tenantBLogs.every((log) => log.tenantId === tenantB)).toBe(true);
  });

  it("prevents cross-tenant log access in getByTenant", async () => {
    await service.record(userA1, tenantA, "SENSITIVE_ACTION", "admin", {
      secret: "tenant-a-data",
    });
    await service.record(userB1, tenantB, "SENSITIVE_ACTION", "admin", {
      secret: "tenant-b-data",
    });

    // Tenant B querying should not see Tenant A's logs
    const tenantBLogs = await service.getByTenant(tenantB);
    expect(tenantBLogs).toHaveLength(1);
    expect(tenantBLogs[0].tenantId).toBe(tenantB);

    // Verify tenant A's sensitive data is not exposed
    const anyTenantAData = tenantBLogs.some((log) => log.tenantId === tenantA);
    expect(anyTenantAData).toBe(false);
  });

  it("correctly associates user actions with their tenant", async () => {
    // Multiple users in the same tenant
    await service.record(userA1, tenantA, "LOGIN", "auth");
    await service.record(userA2, tenantA, "LOGIN", "auth");

    // User in different tenant
    await service.record(userB1, tenantB, "LOGIN", "auth");

    const allLogs = prisma.getLogs();
    expect(allLogs).toHaveLength(3);

    // Verify each user's log has correct tenant
    const userA1Log = allLogs.find((l) => l.userId === userA1);
    const userA2Log = allLogs.find((l) => l.userId === userA2);
    const userB1Log = allLogs.find((l) => l.userId === userB1);

    expect(userA1Log?.tenantId).toBe(tenantA);
    expect(userA2Log?.tenantId).toBe(tenantA);
    expect(userB1Log?.tenantId).toBe(tenantB);
  });

  it("getByUser returns logs for specific user across all tenants", async () => {
    await service.record(userA1, tenantA, "ACTION_1", "module1");
    await service.record(userA1, tenantA, "ACTION_2", "module2");
    await service.record(userB1, tenantB, "ACTION_3", "module3");

    const userA1Logs = await service.getByUser(userA1);
    expect(userA1Logs).toHaveLength(2);
    expect(userA1Logs.every((log) => log.userId === userA1)).toBe(true);
  });

  it("respects limit parameter in queries", async () => {
    // Create 10 logs
    for (let i = 0; i < 10; i++) {
      await service.record(userA1, tenantA, `ACTION_${i}`, "test");
    }

    const limited = await service.getByTenant(tenantA, 5);
    expect(limited).toHaveLength(5);
  });

  it("preserves metadata in audit records", async () => {
    const metadata = {
      metricId: "metric-123",
      oldValue: 10,
      newValue: 20,
      changedBy: userA1,
    };

    await service.record(
      userA1,
      tenantA,
      "UPDATE_METRIC",
      "metrics",
      metadata,
    );

    const logs = prisma.getLogs();
    expect(logs[0].details).toMatchObject(metadata);
  });
});
