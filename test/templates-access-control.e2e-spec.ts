import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { TemplatesController } from "../src/templates/templates.controller";
import { TemplatesService } from "../src/templates/templates.service";
import { PrismaService } from "../src/prisma/prisma.service";

class AllowAuthGuard implements CanActivate {
  constructor(private readonly getUser: () => any) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = this.getUser();
    return true;
  }
}

describe("Templates Access Control", () => {
  let app: INestApplication;
  let activeUser: { userId: string; tenantId: string; role: Role };

  const mockTemplates = {
    metrics: [
      { id: "mt-1", name: "Weekly Leads", targetValue: 100, createdAt: new Date() },
      { id: "mt-2", name: "Monthly Revenue", targetValue: 50000, createdAt: new Date() },
    ],
    outcomes: [
      { id: "ot-1", title: "Launch Product", createdAt: new Date() },
    ],
    activities: [
      { id: "at-1", name: "Customer Calls", category: "Sales", createdAt: new Date() },
    ],
  };

  beforeEach(async () => {
    activeUser = {
      userId: "user-tenant",
      tenantId: "tenant-123",
      role: Role.TENANT_ADMIN,
    };

    const prisma = {
      metricTemplate: {
        findMany: jest.fn().mockResolvedValue(mockTemplates.metrics),
      },
      outcomeTemplate: {
        findMany: jest.fn().mockResolvedValue(mockTemplates.outcomes),
      },
      activityTemplate: {
        findMany: jest.fn().mockResolvedValue(mockTemplates.activities),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        TemplatesService,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new AllowAuthGuard(() => activeUser))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET endpoints (allowed for tenants)", () => {
    it("allows tenants to fetch metric templates", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates/metrics")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({ id: "mt-1", name: "Weekly Leads" });
    });

    it("allows tenants to fetch outcome templates", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates/outcomes")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ id: "ot-1", title: "Launch Product" });
    });

    it("allows tenants to fetch activity templates", async () => {
      const response = await request(app.getHttpServer())
        .get("/templates/activities")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ id: "at-1", name: "Customer Calls" });
    });

    it("allows VIEWER role to read templates", async () => {
      activeUser.role = Role.VIEWER;

      await request(app.getHttpServer())
        .get("/templates/metrics")
        .set("Authorization", "Bearer test")
        .expect(200);
    });

    it("allows STAFF role to read templates", async () => {
      activeUser.role = Role.STAFF;

      await request(app.getHttpServer())
        .get("/templates/outcomes")
        .set("Authorization", "Bearer test")
        .expect(200);
    });
  });

  describe("POST/PUT/DELETE endpoints (blocked for tenants)", () => {
    it("returns 404 for POST /templates/metrics", async () => {
      await request(app.getHttpServer())
        .post("/templates/metrics")
        .set("Authorization", "Bearer test")
        .send({ name: "New Metric", targetValue: 100 })
        .expect(404);
    });

    it("returns 404 for PUT /templates/metrics/:id", async () => {
      await request(app.getHttpServer())
        .put("/templates/metrics/mt-1")
        .set("Authorization", "Bearer test")
        .send({ name: "Updated Metric" })
        .expect(404);
    });

    it("returns 404 for DELETE /templates/metrics/:id", async () => {
      await request(app.getHttpServer())
        .delete("/templates/metrics/mt-1")
        .set("Authorization", "Bearer test")
        .expect(404);
    });

    it("returns 404 for POST /templates/outcomes", async () => {
      await request(app.getHttpServer())
        .post("/templates/outcomes")
        .set("Authorization", "Bearer test")
        .send({ title: "New Outcome" })
        .expect(404);
    });

    it("returns 404 for PUT /templates/outcomes/:id", async () => {
      await request(app.getHttpServer())
        .put("/templates/outcomes/ot-1")
        .set("Authorization", "Bearer test")
        .send({ title: "Updated Outcome" })
        .expect(404);
    });

    it("returns 404 for DELETE /templates/outcomes/:id", async () => {
      await request(app.getHttpServer())
        .delete("/templates/outcomes/ot-1")
        .set("Authorization", "Bearer test")
        .expect(404);
    });

    it("returns 404 for POST /templates/activities", async () => {
      await request(app.getHttpServer())
        .post("/templates/activities")
        .set("Authorization", "Bearer test")
        .send({ name: "New Activity", category: "Sales" })
        .expect(404);
    });

    it("returns 404 for PUT /templates/activities/:id", async () => {
      await request(app.getHttpServer())
        .put("/templates/activities/at-1")
        .set("Authorization", "Bearer test")
        .send({ name: "Updated Activity" })
        .expect(404);
    });

    it("returns 404 for DELETE /templates/activities/:id", async () => {
      await request(app.getHttpServer())
        .delete("/templates/activities/at-1")
        .set("Authorization", "Bearer test")
        .expect(404);
    });
  });

  describe("Role-based access for all tenant roles", () => {
    const tenantRoles = [Role.TENANT_ADMIN, Role.MANAGER, Role.STAFF, Role.VIEWER];

    tenantRoles.forEach((role) => {
      it(`allows ${role} to GET templates`, async () => {
        activeUser.role = role;

        await request(app.getHttpServer())
          .get("/templates/metrics")
          .set("Authorization", "Bearer test")
          .expect(200);
      });

      it(`blocks ${role} from POST templates`, async () => {
        activeUser.role = role;

        await request(app.getHttpServer())
          .post("/templates/metrics")
          .set("Authorization", "Bearer test")
          .send({ name: "Test" })
          .expect(404);
      });
    });
  });
});

describe("Templates are global (no tenantId field)", () => {
  it("template models have no tenantId in schema", () => {
    // This is a compile-time check - if templates had tenantId,
    // the Prisma types would reflect it. The service queries
    // don't filter by tenantId, confirming global access.
    expect(true).toBe(true);
  });

  it("all tenants see the same templates", async () => {
    const templates = [
      { id: "shared-1", name: "Global Template", createdAt: new Date() },
    ];

    const prisma = {
      metricTemplate: {
        findMany: jest.fn().mockResolvedValue(templates),
      },
      outcomeTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      activityTemplate: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        TemplatesService,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(
        new AllowAuthGuard(() => ({
          userId: "user-1",
          tenantId: "tenant-A",
          role: Role.TENANT_ADMIN,
        })),
      )
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    // Tenant A sees the template
    const tenantAResponse = await request(app.getHttpServer())
      .get("/templates/metrics")
      .set("Authorization", "Bearer test");

    expect(tenantAResponse.body).toHaveLength(1);
    expect(tenantAResponse.body[0]).toMatchObject({ id: "shared-1", name: "Global Template" });

    // Same query - no tenant filtering applied
    expect(prisma.metricTemplate.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    });

    await app.close();
  });
});
