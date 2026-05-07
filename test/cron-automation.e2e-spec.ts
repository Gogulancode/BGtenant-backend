import { Test, TestingModule } from "@nestjs/testing";
import { ReportDigestService } from "../src/reports/report-digest.service";
import { TokenMaintenanceService } from "../src/auth/token-maintenance.service";
import { TelemetryService } from "../src/observability/telemetry.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmailService } from "../src/notifications/email.service";
import { TokensService } from "../src/auth/tokens.service";

const prisma = {
  tenant: {
    findMany: jest.fn(),
  },
};

const emailService = {
  sendReportDigest: jest.fn(),
  sendSystemAlert: jest.fn(),
};

const tokensService = {
  cleanupExpiredTokens: jest.fn(),
};

describe("Cron automation telemetry integration", () => {
  let telemetry: TelemetryService;
  let reportDigest: ReportDigestService;
  let tokenMaintenance: TokenMaintenanceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        ReportDigestService,
        TokenMaintenanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: TokensService, useValue: tokensService },
      ],
    }).compile();

    telemetry = moduleRef.get(TelemetryService);
    reportDigest = moduleRef.get(ReportDigestService);
    tokenMaintenance = moduleRef.get(TokenMaintenanceService);
  });

  it("records telemetry for report digest job", async () => {
    prisma.tenant.findMany.mockResolvedValue([
      {
        id: "tenant-1",
        name: "Acme",
        users: [
          { email: "admin@acme.com", name: "Admin", role: "TENANT_ADMIN" },
          { email: "manager@acme.com", name: "Manager", role: "MANAGER" },
        ],
        _count: { users: 5, metrics: 3, outcomes: 7, activities: 2 },
      },
    ]);

    await reportDigest.sendDailyDigests();

    expect(emailService.sendReportDigest).toHaveBeenCalledTimes(2);
    const snapshot = telemetry.getJobTelemetry("report-digest");
    expect(snapshot).toMatchObject({
      job: "report-digest",
      successCount: 1,
      failureCount: 0,
      lastMetadata: { tenantsProcessed: 1, emailsSent: 2 },
    });
  });

  it("records telemetry for token maintenance job and alerts on failure", async () => {
    tokensService.cleanupExpiredTokens.mockResolvedValue(6);

    await tokenMaintenance.cleanupStaleTokens();

    let snapshot = telemetry.getJobTelemetry("token-maintenance");
    expect(snapshot).toMatchObject({
      job: "token-maintenance",
      successCount: 1,
      lastMetadata: { removed: 6 },
    });

    const failure = new Error("db down");
    tokensService.cleanupExpiredTokens.mockRejectedValue(failure);

    await expect(tokenMaintenance.cleanupStaleTokens()).rejects.toThrow(
      "db down",
    );

    snapshot = telemetry.getJobTelemetry("token-maintenance");
    expect(snapshot?.failureCount).toBe(1);
    expect(snapshot?.lastError).toBe("db down");
    expect(emailService.sendSystemAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Job token-maintenance failed",
        severity: "critical",
      }),
    );
  });
});
