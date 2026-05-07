import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { OnboardingController } from "../src/onboarding/onboarding.controller";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmailService } from "../src/notifications/email.service";
import { BadRequestException } from "@nestjs/common";

type ActiveUser = { userId: string; tenantId: string; role?: Role };

const authGuardFactory = (getUser: () => ActiveUser) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = getUser();
    return true;
  },
});

describe("Onboarding Step Skip Prevention (e2e)", () => {
  let app: INestApplication;
  let prisma: {
    onboardingProgress: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
    tenant: {
      update: jest.Mock;
    };
  };
  let activeUser: ActiveUser;

  const createMockProgress = (overrides = {}) => ({
    id: "progress-1",
    tenantId: "tenant-abc",
    currentStep: 1,
    stepsCompleted: [],
    isCompleted: false,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    activeUser = {
      userId: "user-onboarding",
      tenantId: "tenant-abc",
      role: Role.TENANT_ADMIN,
    };

    prisma = {
      onboardingProgress: {
        upsert: jest.fn().mockResolvedValue(createMockProgress()),
        update: jest.fn().mockResolvedValue(createMockProgress()),
      },
      tenant: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const emailService = {
      sendOnboardingChecklistEmail: jest.fn().mockResolvedValue(undefined),
    };

    const moduleBuilder = Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuardFactory(() => activeUser));

    const moduleRef: TestingModule = await moduleBuilder.compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("Step skip prevention", () => {
    it("allows advancing to next step (step 1 → step 2)", async () => {
      // User is on step 1, can advance to step 2
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 1 }),
      );
      prisma.onboardingProgress.update.mockResolvedValue(
        createMockProgress({ currentStep: 2 }),
      );

      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 2 })
        .expect(200);
    });

    it("allows going back to previous step (step 3 → step 1)", async () => {
      // User is on step 3, can go back to step 1
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 3 }),
      );
      prisma.onboardingProgress.update.mockResolvedValue(
        createMockProgress({ currentStep: 1 }),
      );

      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 1 })
        .expect(200);
    });

    it("rejects skipping from step 1 to step 3", async () => {
      // User is on step 1, cannot jump to step 3
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 1 }),
      );

      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 3 })
        .expect(400);

      expect(response.body.message).toContain("Cannot skip to step 3");
      expect(response.body.message).toContain("You are on step 1");
    });

    it("rejects skipping from step 1 to step 6", async () => {
      // User is on step 1, cannot jump to final step
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 1 }),
      );

      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 6 })
        .expect(400);

      expect(response.body.message).toContain("Cannot skip to step 6");
    });

    it("rejects skipping from step 2 to step 5", async () => {
      // User is on step 2, cannot jump to step 5
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 2 }),
      );

      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 5 })
        .expect(400);

      expect(response.body.message).toContain("Cannot skip to step 5");
      expect(response.body.message).toContain("You are on step 2");
    });

    it("allows staying on the same step", async () => {
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 3 }),
      );
      prisma.onboardingProgress.update.mockResolvedValue(
        createMockProgress({ currentStep: 3 }),
      );

      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 3 })
        .expect(200);
    });

    it("allows completing a step without changing step number", async () => {
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({ currentStep: 2 }),
      );
      prisma.onboardingProgress.update.mockResolvedValue(
        createMockProgress({
          currentStep: 2,
          stepsCompleted: ["PROFILE"],
        }),
      );

      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ completedStep: "PROFILE" })
        .expect(200);

      expect(response.body.stepsCompleted).toContain("PROFILE");
    });

    it("allows marking onboarding complete from last step", async () => {
      prisma.onboardingProgress.upsert.mockResolvedValue(
        createMockProgress({
          currentStep: 6,
          stepsCompleted: ["PROFILE", "METRICS", "OUTCOMES", "SALES", "REVIEWS"],
        }),
      );
      prisma.onboardingProgress.update.mockResolvedValue(
        createMockProgress({
          currentStep: 6,
          isCompleted: true,
          completedAt: new Date(),
        }),
      );

      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ isCompleted: true })
        .expect(200);

      expect(response.body.isCompleted).toBe(true);
    });
  });

  describe("Validation edge cases", () => {
    it("rejects step 0", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 0 })
        .expect(400);
    });

    it("rejects negative step", async () => {
      await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: -1 })
        .expect(400);
    });

    it("rejects step 7 (exceeds max)", async () => {
      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ currentStep: 7 })
        .expect(400);

      expect(response.body.message).toContain("currentStep must not exceed 6");
    });

    it("rejects invalid completedStep enum", async () => {
      const response = await request(app.getHttpServer())
        .patch("/onboarding")
        .send({ completedStep: "INVALID" })
        .expect(400);

      const messages = Array.isArray(response.body.message)
        ? response.body.message.join(" ")
        : response.body.message;
      expect(messages).toContain("completedStep must be one of");
    });
  });
});
