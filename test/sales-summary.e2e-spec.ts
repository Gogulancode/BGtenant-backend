import { CacheModule } from "@nestjs/cache-manager";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { SalesController } from "../src/sales/sales.controller";
import { SalesService } from "../src/sales/sales.service";
import { SalesTargetsService } from "../src/sales/sales-targets.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

class PrismaStub {
  salesPlanning = { findFirst: jest.fn() };
  salesTracker = { findFirst: jest.fn() };
  salesPlan = { findUnique: jest.fn() };
  $transaction = (operations: Promise<unknown>[]) => Promise.all(operations);
}

class AllowGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      userId: "user-e2e",
      tenantId: "tenant-e2e",
      role: Role.TENANT_ADMIN,
    };
    return true;
  }
}

describe("Sales summary endpoint (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaStub;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-03-04T12:00:00.000Z"));

    prisma = new PrismaStub();
    const planning = {
      id: "plan-2025",
      year: 2025,
      q1: 26000,
      q2: 0,
      q3: 0,
      q4: 0,
      growthPct: 0,
    };
    const currentTracker = {
      id: "tracker-mar",
      month: "2025-03",
      target: 9000,
      achieved: 25000,
      orders: 22,
      asp: 420,
      profit: 3400,
    };
    const previousTracker = {
      id: "tracker-feb",
      month: "2025-02",
      target: 8500,
      achieved: 20000,
      orders: 20,
      asp: 410,
      profit: 3000,
    };

    prisma.salesPlanning.findFirst.mockResolvedValue(planning);
    prisma.salesPlan.findUnique.mockResolvedValue(null);
    prisma.salesTracker.findFirst.mockImplementation(({ where }) => {
      if (where.month === "2025-03") {
        return Promise.resolve(currentTracker);
      }
      if (where.month === "2025-02") {
        return Promise.resolve(previousTracker);
      }
      return Promise.resolve(null);
    });

    const moduleBuilder = Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [SalesController],
      providers: [SalesService, SalesTargetsService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowGuard);

    const moduleRef: TestingModule = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.useRealTimers();
  });

  it("returns validation and rollover data for /sales/summary", async () => {
    await request(app.getHttpServer())
      .get("/sales/summary")
      .set("Authorization", "Bearer test")
      .expect(200)
      .expect(({ body }) => {
        expect(body.validation).toBeDefined();
        expect(body.validation.weeklyPlan.weeklyTarget).toBeCloseTo(2000);
        expect(body.validation.dailyTracker.status).toBe("CURRENT");
        expect(body.validation.planVsActual.status).toBe("ON_TRACK");
        expect(body.validation.weeklyRollover).toMatchObject({
          status: "ROLLED_OVER",
          requiresRollover: true,
          currentMonth: "2025-03",
          previousMonth: "2025-02",
        });
      });
  });
});
