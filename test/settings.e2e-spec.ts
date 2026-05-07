import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  NotFoundException,
} from "@nestjs/common";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { SettingsController } from "../src/settings/settings.controller";
import { SettingsService } from "../src/settings/settings.service";

type ActiveUser = {
  userId: string;
  tenantId: string | null;
  role: Role;
};

const createAuthGuard = (getUser: () => ActiveUser) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = getUser();
    return true;
  },
});

describe("Settings E2E Tests", () => {
  let app: INestApplication;
  let activeUser: ActiveUser;

  const mockSettings = {
    user: {
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
      role: Role.TENANT_ADMIN,
    },
    tenant: {
      id: "tenant-123",
      name: "Test Tenant",
      type: "Startup",
      slug: "test-tenant",
      isActive: true,
      createdAt: new Date("2025-01-01"),
    },
    preferences: {
      timezone: "America/New_York",
      notifications: {
        email: true,
        push: false,
      },
    },
  };

  const settingsService = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  };

  beforeAll(async () => {
    activeUser = {
      userId: "user-123",
      tenantId: "tenant-123",
      role: Role.TENANT_ADMIN,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createAuthGuard(() => activeUser))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.getSettings.mockResolvedValue(mockSettings);
    settingsService.updateSettings.mockResolvedValue(mockSettings);
  });

  describe("GET /settings", () => {
    it("returns user settings successfully", async () => {
      const response = await request(app.getHttpServer())
        .get("/settings")
        .expect(200);

      expect(response.body).toMatchObject({
        user: expect.objectContaining({
          id: "user-123",
          email: "test@example.com",
        }),
        tenant: expect.objectContaining({
          id: "tenant-123",
          name: "Test Tenant",
        }),
        preferences: expect.objectContaining({
          timezone: "America/New_York",
          notifications: expect.objectContaining({
            email: true,
            push: false,
          }),
        }),
      });

      expect(settingsService.getSettings).toHaveBeenCalledWith(
        activeUser.userId,
        activeUser.tenantId,
      );
    });

    it("returns 404 when user not found in tenant", async () => {
      settingsService.getSettings.mockRejectedValue(
        new NotFoundException("Tenant settings not found"),
      );

      await request(app.getHttpServer())
        .get("/settings")
        .expect(404);
    });
  });

  describe("PATCH /settings", () => {
    it("updates timezone successfully", async () => {
      const updatedSettings = {
        ...mockSettings,
        preferences: {
          ...mockSettings.preferences,
          timezone: "Europe/London",
        },
      };
      settingsService.updateSettings.mockResolvedValue(updatedSettings);

      const response = await request(app.getHttpServer())
        .patch("/settings")
        .send({ timezone: "Europe/London" })
        .expect(200);

      expect(response.body.preferences.timezone).toBe("Europe/London");
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        activeUser.userId,
        activeUser.tenantId,
        expect.objectContaining({ timezone: "Europe/London" }),
      );
    });

    it("updates notification preferences successfully", async () => {
      const updatedSettings = {
        ...mockSettings,
        preferences: {
          ...mockSettings.preferences,
          notifications: { email: false, push: true },
        },
      };
      settingsService.updateSettings.mockResolvedValue(updatedSettings);

      const response = await request(app.getHttpServer())
        .patch("/settings")
        .send({ notificationsEmail: false, notificationsPush: true })
        .expect(200);

      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        activeUser.userId,
        activeUser.tenantId,
        expect.objectContaining({
          notificationsEmail: false,
          notificationsPush: true,
        }),
      );
    });

    it("allows partial updates", async () => {
      await request(app.getHttpServer())
        .patch("/settings")
        .send({ notificationsEmail: false })
        .expect(200);

      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        activeUser.userId,
        activeUser.tenantId,
        expect.objectContaining({ notificationsEmail: false }),
      );
    });

    it("rejects timezone shorter than 3 characters", async () => {
      await request(app.getHttpServer())
        .patch("/settings")
        .send({ timezone: "AB" })
        .expect(400);
    });

    it("rejects timezone longer than 64 characters", async () => {
      const longTimezone = "A".repeat(65);
      await request(app.getHttpServer())
        .patch("/settings")
        .send({ timezone: longTimezone })
        .expect(400);
    });

    it("transforms string boolean values", async () => {
      // Note: class-transformer @Type(() => Boolean) converts truthy values to true
      // This is expected behavior - validation passes after transformation
      await request(app.getHttpServer())
        .patch("/settings")
        .send({ notificationsEmail: "yes" })
        .expect(200);
    });

    it("accepts empty update body", async () => {
      await request(app.getHttpServer())
        .patch("/settings")
        .send({})
        .expect(200);
    });
  });

  describe("Role-based Access", () => {
    it("allows VIEWER role to read settings", async () => {
      activeUser = {
        userId: "viewer-user",
        tenantId: "tenant-123",
        role: Role.VIEWER,
      };

      await request(app.getHttpServer())
        .get("/settings")
        .expect(200);
    });

    it("allows STAFF role to update settings", async () => {
      activeUser = {
        userId: "staff-user",
        tenantId: "tenant-123",
        role: Role.STAFF,
      };

      await request(app.getHttpServer())
        .patch("/settings")
        .send({ timezone: "UTC" })
        .expect(200);
    });

    it("allows MANAGER role to update settings", async () => {
      activeUser = {
        userId: "manager-user",
        tenantId: "tenant-123",
        role: Role.MANAGER,
      };

      await request(app.getHttpServer())
        .patch("/settings")
        .send({ notificationsPush: true })
        .expect(200);
    });
  });

  describe("Tenant Isolation", () => {
    it("rejects request with null tenantId", async () => {
      activeUser = {
        userId: "user-123",
        tenantId: null,
        role: Role.TENANT_ADMIN,
      };

      settingsService.getSettings.mockRejectedValue(
        new NotFoundException("Tenant settings not found"),
      );

      await request(app.getHttpServer())
        .get("/settings")
        .expect(404);
    });
  });

  describe("Valid Timezone Values", () => {
    const validTimezones = [
      "UTC",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];

    validTimezones.forEach((timezone) => {
      it(`accepts valid timezone: ${timezone}`, async () => {
        await request(app.getHttpServer())
          .patch("/settings")
          .send({ timezone })
          .expect(200);
      });
    });
  });
});
