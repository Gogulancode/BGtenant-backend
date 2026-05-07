import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  INestApplication,
  Injectable,
  Post,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import * as request from "supertest";
import * as bcrypt from "bcrypt";
import { BusinessType, OutcomeStatus, Role } from "@prisma/client";
import { InsightsController } from "../src/insights/insights.controller";
import { InsightsService } from "../src/insights/insights.service";
import { SalesService } from "../src/sales/sales.service";
import { ActivitiesService } from "../src/activities/activities.service";
import { OutcomesService } from "../src/outcomes/outcomes.service";
import { JwtStrategy } from "../src/common/strategies/jwt.strategy";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { PrismaService } from "../src/prisma/prisma.service";
import { TelemetryService } from "../src/observability/telemetry.service";
import { startOfWeek } from "../src/common/utils/date.utils";
import { LoginDto } from "../src/auth/dto/login.dto";

const TEST_EMAIL = "tenant@example.com";
const TEST_PASSWORD = "Password123!";
const TEST_TENANT_ID = "tenant-test";
const TEST_USER_ID = "user-test";
const TEST_JWT_SECRET = "hardening-secret";
const TEST_REFRESH_SECRET = "hardening-refresh-secret";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  businessType: BusinessType;
  role: Role;
  mfaEnabled: boolean;
  mfaSecret: string | null;
};

type InsightRecord = {
  id: string;
  userId: string;
  tenantId: string;
  momentumScore?: number | null;
  flags?: string | null;
  streakCount?: number | null;
  updatedAt: Date;
};

type MetricLogRecord = {
  id: string;
  date: Date;
  metric: { userId: string; tenantId: string };
};

type OutcomeRecord = {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  status: OutcomeStatus;
  weekStartDate: Date;
};

type ActivityRecord = {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  category: string;
  dueDate: Date;
  status: string;
};

type RefreshTokenRecord = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  revoked: boolean;
  replacedByToken?: string | null;
  createdAt: Date;
};

class ConfigStub {
  get(key: string) {
    if (key === "JWT_SECRET") {
      return TEST_JWT_SECRET;
    }
    if (key === "JWT_REFRESH_SECRET") {
      return TEST_REFRESH_SECRET;
    }
    return undefined;
  }
}

class TelemetryStub {
  async recordJobSuccess() {
    return;
  }

  async recordJobFailure() {
    return;
  }
}

@Injectable()
class TestAuthHandler {
  constructor(private readonly jwtService: JwtService) {}

  async login(dto: LoginDto) {
    if (dto.email !== TEST_EMAIL || dto.password !== TEST_PASSWORD) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = {
      sub: TEST_USER_ID,
      email: TEST_EMAIL,
      role: Role.TENANT_ADMIN,
      tenantId: TEST_TENANT_ID,
    };

    return {
      user: {
        id: TEST_USER_ID,
        name: "Tenant Admin",
        email: TEST_EMAIL,
        businessType: BusinessType.Startup,
        role: Role.TENANT_ADMIN,
        tenantId: TEST_TENANT_ID,
        mfaEnabled: false,
      },
      accessToken: this.jwtService.sign(payload),
      refreshToken: "test-refresh-token",
    };
  }
}

@Controller("auth")
class TestAuthController {
  constructor(private readonly auth: TestAuthHandler) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}

class PrismaTestService {
  users: UserRecord[] = [];
  insights: InsightRecord[] = [];
  metricLogs: MetricLogRecord[] = [];
  outcomes: OutcomeRecord[] = [];
  activities: ActivityRecord[] = [];
  refreshTokens: RefreshTokenRecord[] = [];
  private insightCounter = 0;
  private refreshTokenCounter = 0;

  static async createWithSeed() {
    const instance = new PrismaTestService();
    await instance.seedDefaults();
    return instance;
  }

  private async seedDefaults() {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    this.users.push({
      id: TEST_USER_ID,
      name: "Tenant Admin",
      email: TEST_EMAIL,
      passwordHash,
      tenantId: TEST_TENANT_ID,
      businessType: BusinessType.Startup,
      role: Role.TENANT_ADMIN,
      mfaEnabled: false,
      mfaSecret: null,
    });

    const thisWeek = startOfWeek();
    this.outcomes.push(
      {
        id: "out-1",
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        title: "Ship sprint demo",
        status: OutcomeStatus.Done,
        weekStartDate: thisWeek,
      },
      {
        id: "out-2",
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        title: "Close pilot customer",
        status: OutcomeStatus.Planned,
        weekStartDate: thisWeek,
      },
    );

    const today = new Date();
    this.metricLogs.push(
      {
        id: "metric-1",
        date: new Date(today),
        metric: { userId: TEST_USER_ID, tenantId: TEST_TENANT_ID },
      },
      {
        id: "metric-2",
        date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        metric: { userId: TEST_USER_ID, tenantId: TEST_TENANT_ID },
      },
      {
        id: "metric-3",
        date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000),
        metric: { userId: TEST_USER_ID, tenantId: TEST_TENANT_ID },
      },
    );

    this.activities.push(
      {
        id: "act-1",
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        title: "Prep Q4 plan",
        category: "Strategy",
        dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        status: "Active",
      },
      {
        id: "act-2",
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        title: "Call top prospect",
        category: "Sales",
        dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: "Active",
      },
    );
  }

  async $transaction<T>(operations: Promise<T>[]) {
    return Promise.all(operations);
  }

  user = {
    findUnique: async ({ where, select }: any) => {
      const record = this.findUser(where);
      return record ? this.applySelect(record, select) : null;
    },
    findFirst: async ({ where, select }: any) => {
      const record = this.users.find((user) => {
        if (where?.id && user.id !== where.id) {
          return false;
        }
        if (where?.tenantId && user.tenantId !== where.tenantId) {
          return false;
        }
        return true;
      });
      return record ? this.applySelect(record, select) : null;
    },
    findMany: async () => [...this.users],
  };

  insight = {
    findFirst: async ({ where }: any) => {
      return (
        this.insights.find((insight) => {
          if (where?.userId && insight.userId !== where.userId) {
            return false;
          }
          if (where?.tenantId && insight.tenantId !== where.tenantId) {
            return false;
          }
          return true;
        }) ?? null
      );
    },
    create: async ({ data }: any) => {
      const record: InsightRecord = {
        id: `insight-${++this.insightCounter}`,
        userId: data.userId,
        tenantId: data.tenantId,
        momentumScore: data.momentumScore ?? 0,
        flags: data.flags,
        streakCount: data.streakCount ?? 0,
        updatedAt: new Date(),
      };
      this.insights.push(record);
      return { ...record };
    },
    upsert: async ({ where, update, create }: any) => {
      const record = this.insights.find(
        (insight) => insight.userId === where.userId,
      );
      if (record) {
        Object.assign(record, update, { updatedAt: new Date() });
        return { ...record };
      }
      return this.insight.create({ data: create });
    },
  };

  metricLog = {
    findMany: async ({ where, orderBy, select }: any) => {
      let rows = [...this.metricLogs];
      if (where?.metric?.userId) {
        rows = rows.filter((log) => log.metric.userId === where.metric.userId);
      }
      if (where?.metric?.tenantId) {
        rows = rows.filter(
          (log) => log.metric.tenantId === where.metric.tenantId,
        );
      }
      if (where?.date?.gte) {
        rows = rows.filter((log) => log.date >= where.date.gte);
      }
      if (orderBy?.date === "desc") {
        rows.sort((a, b) => b.date.getTime() - a.date.getTime());
      } else if (orderBy?.date === "asc") {
        rows.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
      return rows.map((row) =>
        select ? this.applySelect(row, select) : { ...row },
      );
    },
  };

  outcome = {
    findMany: async ({ where, select, orderBy, take }: any) => {
      let rows = [...this.outcomes];
      if (where?.userId) {
        rows = rows.filter((row) => row.userId === where.userId);
      }
      if (where?.tenantId) {
        rows = rows.filter((row) => row.tenantId === where.tenantId);
      }
      if (where?.status) {
        rows = rows.filter((row) => row.status === where.status);
      }
      if (where?.weekStartDate?.gte) {
        rows = rows.filter(
          (row) => row.weekStartDate >= where.weekStartDate.gte,
        );
      }
      if (orderBy?.weekStartDate === "desc") {
        rows.sort(
          (a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime(),
        );
      } else if (orderBy?.weekStartDate === "asc") {
        rows.sort(
          (a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime(),
        );
      }
      if (typeof take === "number") {
        rows = rows.slice(0, take);
      }
      return rows.map((row) =>
        select ? this.applySelect(row, select) : { ...row },
      );
    },
  };

  activity = {
    findMany: async ({ where, select, orderBy, take }: any) => {
      let rows = [...this.activities];
      if (where?.userId) {
        rows = rows.filter((row) => row.userId === where.userId);
      }
      if (where?.tenantId) {
        rows = rows.filter((row) => row.tenantId === where.tenantId);
      }
      if (where?.status) {
        rows = rows.filter((row) => row.status === where.status);
      }
      if (orderBy?.dueDate === "asc") {
        rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      } else if (orderBy?.dueDate === "desc") {
        rows.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
      }
      if (typeof take === "number") {
        rows = rows.slice(0, take);
      }
      return rows.map((row) =>
        select ? this.applySelect(row, select) : { ...row },
      );
    },
  };

  refreshToken = {
    create: async ({ data }: any) => {
      const record: RefreshTokenRecord = {
        id: `rt-${++this.refreshTokenCounter}`,
        revoked: false,
        createdAt: new Date(),
        ...data,
      };
      this.refreshTokens.push(record);
      return { ...record };
    },
    findUnique: async ({ where, include }: any) => {
      const record =
        this.refreshTokens.find((token) => token.token === where.token) ?? null;
      if (!record) {
        return null;
      }
      const result: any = { ...record };
      if (include?.user) {
        result.user =
          this.users.find((user) => user.id === record.userId) ?? null;
      }
      return result;
    },
    update: async ({ where, data }: any) => {
      const record = this.refreshTokens.find((token) => token.id === where.id);
      if (!record) {
        throw new Error("Refresh token not found");
      }
      Object.assign(record, data);
      return { ...record };
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const token of this.refreshTokens) {
        if (where.userId && token.userId !== where.userId) {
          continue;
        }
        if (
          typeof where.revoked === "boolean" &&
          token.revoked !== where.revoked
        ) {
          continue;
        }
        Object.assign(token, data);
        count += 1;
      }
      return { count };
    },
    deleteMany: async ({ where }: any) => {
      const before = this.refreshTokens.length;
      this.refreshTokens = this.refreshTokens.filter(
        (token) => !this.matchesRefreshWhere(token, where),
      );
      return { count: before - this.refreshTokens.length };
    },
  };

  private matchesRefreshWhere(token: RefreshTokenRecord, where: any) {
    if (!where) {
      return true;
    }
    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) => this.matchesRefreshWhere(token, clause));
    }
    if (where.userId && token.userId !== where.userId) {
      return false;
    }
    if (where.token && token.token !== where.token) {
      return false;
    }
    if (typeof where.revoked === "boolean" && token.revoked !== where.revoked) {
      return false;
    }
    if (where.expiresAt?.lt && !(token.expiresAt < where.expiresAt.lt)) {
      return false;
    }
    if (where.createdAt?.lt && !(token.createdAt < where.createdAt.lt)) {
      return false;
    }
    return true;
  }

  private findUser(where: any) {
    if (!where) {
      return undefined;
    }
    if (where.email) {
      return this.users.find((user) => user.email === where.email);
    }
    if (where.id) {
      return this.users.find((user) => user.id === where.id);
    }
    return undefined;
  }

  private applySelect<T extends Record<string, any>>(
    record: T,
    select?: Record<string, boolean>,
  ) {
    if (!record) {
      return null;
    }
    if (!select) {
      return { ...record };
    }
    const shaped: Record<string, any> = {};
    for (const key of Object.keys(select)) {
      if (select[key]) {
        shaped[key] = (record as any)[key];
      }
    }
    return shaped;
  }
}

describe("Insights momentum & streak endpoints", () => {
  let app: INestApplication;
  let httpServer: any;
  let accessToken: string;

  beforeAll(async () => {
    const prisma = await PrismaTestService.createWithSeed();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        CacheModule.register(),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: "15m" },
        }),
      ],
      controllers: [TestAuthController, InsightsController],
      providers: [
        TestAuthHandler,
        InsightsService,
        JwtStrategy,
        RolesGuard,
        JwtAuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useClass: TelemetryStub },
        { provide: ConfigService, useClass: ConfigStub },
        {
          provide: SalesService,
          useValue: {
            getSummary: jest.fn().mockResolvedValue({
              targets: { weeklyAchievementPercent: 80 },
            }),
          },
        },
        {
          provide: ActivitiesService,
          useValue: {
            getWeeklySummary: jest.fn().mockResolvedValue({
              year: 2026,
              week: 1,
              items: [],
              overallCompletionPercent: 80,
            }),
          },
        },
        {
          provide: OutcomesService,
          useValue: {
            getWeeklySummary: jest.fn().mockResolvedValue({
              year: 2026,
              week: 1,
              planned: 5,
              completed: 4,
              completionPercent: 80,
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    httpServer = app.getHttpServer();

    const loginResponse = await request(httpServer)
      .post("/api/v1/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns enriched insight snapshot", async () => {
    const response = await request(httpServer)
      .get("/api/v1/insights")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      userId: TEST_USER_ID,
      tenantId: TEST_TENANT_ID,
      momentumScore: expect.any(Number),
      automationSnapshot: expect.objectContaining({
        executionSummary: expect.any(Object),
        activitySummary: expect.any(Object),
        outcomeSummary: expect.any(Object),
        trend: expect.any(Object),
      }),
    });
  });

  it("returns tenant-scoped momentum summary", async () => {
    const response = await request(httpServer)
      .get("/api/v1/insights/momentum")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      flag: expect.any(String),
      momentumScore: expect.any(Number),
      completionRate: expect.any(Number),
      completedOutcomes: expect.any(Number),
      totalOutcomes: expect.any(Number),
      activeDays: expect.any(Number),
      executionSummary: expect.any(Object),
    });
    expect(response.body.executionSummary).toMatchObject({
      weeklyCompletionRate: expect.any(Number),
      executionConsistency: expect.any(Number),
      activityCompletionRatio: expect.any(Number),
    });
    expect(response.body.trend).toMatchObject({
      direction: expect.any(String),
      delta: expect.any(Number),
    });
    expect(response.body.completionRate).toBeGreaterThanOrEqual(0);
    expect(response.body.updatedAt).toBeDefined();
  });

  it("returns tenant-scoped streak summary", async () => {
    const response = await request(httpServer)
      .get("/api/v1/insights/streak")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      streakCount: expect.any(Number),
      progressToTarget: expect.any(Number),
      recommendations: expect.any(Array),
      executionSummary: expect.any(Object),
      trend: expect.any(Object),
    });
    expect(Array.isArray(response.body.recommendations)).toBe(true);
    expect(response.body.progressToTarget).toBeGreaterThanOrEqual(0);
    expect(response.body.progressToTarget).toBeLessThanOrEqual(100);
    expect(response.body.lastActiveDate).toBeTruthy();
  });
});
