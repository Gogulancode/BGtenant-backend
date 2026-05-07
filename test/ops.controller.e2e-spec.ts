import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { OpsController } from "../src/ops/ops.controller";
import { OpsService } from "../src/ops/ops.service";
import { ConfigService } from "@nestjs/config";
import { OpsAuthGuard } from "../src/ops/guards/ops-auth.guard";

const OPS_TOKEN = "ops-secret";

describe("OpsController (e2e)", () => {
  let app: INestApplication;
  const opsService = {
    getSystemHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
    getEnvironmentInfo: jest
      .fn()
      .mockResolvedValue({ nodeEnv: "test", services: { database: true } }),
    getTelemetryOverview: jest.fn().mockResolvedValue({
      totals: { successCount: 1, failureCount: 0 },
      jobs: [],
    }),
    getInsightsTelemetryDashboard: jest.fn().mockResolvedValue({
      summary: { totalInsights: 0, avgMomentum: 0, lastRefreshAt: undefined },
      flagDistribution: [],
      topTenants: [],
      telemetry: null,
    }),
    getRateLimitOverview: jest.fn().mockResolvedValue({
      config: { limit: 20, ttlMs: 60000 },
      window: { minutes: 60, since: new Date().toISOString() },
      topTenants: [],
      moduleHotspots: [],
    }),
    getRecentAuditLogs: jest.fn().mockResolvedValue({
      limit: 50,
      total: 0,
      logs: [],
    }),
  } satisfies Record<string, jest.Mock>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OpsController],
      providers: [
        OpsAuthGuard,
        { provide: OpsService, useValue: opsService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === "OPS_SERVICE_TOKEN" ? OPS_TOKEN : null,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes /ops/health without auth", async () => {
    await request(app.getHttpServer())
      .get("/ops/health")
      .expect(200)
      .expect({ status: "healthy" });
    expect(opsService.getSystemHealth).toHaveBeenCalledTimes(1);
  });

  it("rejects protected endpoints without ops token", async () => {
    await request(app.getHttpServer()).get("/ops/telemetry").expect(401);
    expect(opsService.getTelemetryOverview).not.toHaveBeenCalled();
  });

  it("allows access with valid ops token", async () => {
    await request(app.getHttpServer())
      .get("/ops/telemetry")
      .set("Authorization", `Bearer ${OPS_TOKEN}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals.successCount).toBe(1);
        expect(Array.isArray(body.jobs)).toBe(true);
      });
    expect(opsService.getTelemetryOverview).toHaveBeenCalledTimes(1);
  });

  it("clamps rate limit window values", async () => {
    await request(app.getHttpServer())
      .get("/ops/rate-limits")
      .query({ windowMinutes: 999 })
      .set("Authorization", `Bearer ${OPS_TOKEN}`)
      .expect(200);

    expect(opsService.getRateLimitOverview).toHaveBeenCalledWith(240);
  });

  it("clamps audit log limits and forwards tenant filter", async () => {
    await request(app.getHttpServer())
      .get("/ops/audit-logs")
      .query({ page: 1, pageSize: 50, tenantId: "tenant-test" })
      .set("Authorization", `Bearer ${OPS_TOKEN}`)
      .expect(200);

    expect(opsService.getRecentAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 50,
        tenantId: "tenant-test",
      }),
    );
  });
});
