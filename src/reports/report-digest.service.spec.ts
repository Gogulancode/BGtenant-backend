import { Logger } from "@nestjs/common";
import { ReportDigestService } from "./report-digest.service";

const tenantCounts = {
  users: 4,
  metrics: 6,
  outcomes: 8,
  activities: 5,
};

describe("ReportDigestService", () => {
  const prisma = {
    tenant: {
      findMany: jest.fn(),
    },
    outcome: {
      findMany: jest.fn(),
    },
    insight: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    activity: {
      count: jest.fn(),
    },
    review: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const emailService = {
    sendReportDigest: jest.fn(),
    sendWeeklyExecutiveDigest: jest.fn(),
  } as any;

  const telemetry = {
    recordJobSuccess: jest.fn(),
    recordJobFailure: jest.fn(),
  } as any;

  let service: ReportDigestService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportDigestService(prisma, emailService, telemetry);
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    prisma.$transaction.mockImplementation(async (operations: any[]) =>
      Promise.all(operations),
    );
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("sends digests to eligible tenant recipients", async () => {
    prisma.tenant.findMany.mockResolvedValue([
      {
        id: "tenant-1",
        name: "Acme",
        users: [
          { email: "admin@acme.com", name: "Admin", role: "TENANT_ADMIN" },
          { email: "coach@acme.com", name: "Coach", role: "MANAGER" },
        ],
        _count: tenantCounts,
      },
    ]);

    await service.sendDailyDigests();

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: expect.objectContaining({
        id: true,
        name: true,
        users: expect.any(Object),
        _count: expect.any(Object),
      }),
    });

    expect(emailService.sendReportDigest).toHaveBeenCalledTimes(2);
    expect(emailService.sendReportDigest).toHaveBeenCalledWith({
      tenantName: "Acme",
      recipientEmail: "admin@acme.com",
      recipientName: "Admin",
      summary: tenantCounts,
    });
    expect(logSpy).toHaveBeenCalledWith(
      "Report digests processed for 1 active tenants",
    );
    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith("report-digest", {
      tenantsProcessed: 1,
      emailsSent: 2,
    });
  });

  it("skips tenants that have no recipients", async () => {
    prisma.tenant.findMany.mockResolvedValue([
      { id: "tenant-2", name: "Empty", users: [], _count: tenantCounts },
    ]);

    await service.sendDailyDigests();

    expect(emailService.sendReportDigest).not.toHaveBeenCalled();
    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith("report-digest", {
      tenantsProcessed: 1,
      emailsSent: 0,
    });
  });

  it("reports telemetry failures when tenant query throws", async () => {
    const error = new Error("db error");
    prisma.tenant.findMany.mockRejectedValue(error);

    await expect(service.sendDailyDigests()).rejects.toThrow("db error");

    expect(telemetry.recordJobFailure).toHaveBeenCalledWith(
      "report-digest",
      error,
    );
  });

  it("sends weekly executive digests with KPI payload", async () => {
    prisma.tenant.findMany.mockResolvedValue([
      {
        id: "tenant-3",
        name: "Momentum Inc",
        users: [{ email: "exec@momentum.com", name: "Exec" }],
      },
    ]);

    prisma.outcome.findMany.mockResolvedValue([
      { status: "Done" },
      { status: "Planned" },
    ]);
    prisma.insight.aggregate.mockResolvedValue({
      _avg: { momentumScore: 65.234 },
      _count: { _all: 4 },
    });
    prisma.user.count.mockResolvedValue(5);
    prisma.activity.count.mockResolvedValue(7);
    prisma.review.count.mockResolvedValue(3);
    prisma.insight.findMany.mockResolvedValue([
      { flags: "Green" },
      { flags: "Green" },
      { flags: "Green" },
    ]);

    await service.sendWeeklyExecutiveDigests();

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(emailService.sendWeeklyExecutiveDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantName: "Momentum Inc",
        recipientEmail: "exec@momentum.com",
        kpis: expect.objectContaining({
          outcomesCompleted: 1,
          outcomesPlanned: 2,
          avgMomentum: 65.23,
          activeUsers: 5,
          openActivities: 7,
          reviewsSubmitted: 3,
          flagDistribution: { Green: 3 },
        }),
      }),
    );

    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith(
      "weekly-executive-digest",
      {
        tenantsProcessed: 1,
        emailsSent: 1,
      },
    );
  });
});
