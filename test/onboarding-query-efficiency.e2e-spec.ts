import { Test, TestingModule } from "@nestjs/testing";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmailService } from "../src/notifications/email.service";
import { NotFoundException } from "@nestjs/common";
import { OnboardingStep } from "../src/onboarding/dto/update-onboarding.dto";

describe("Onboarding Query Efficiency (e2e)", () => {
  let onboardingService: OnboardingService;
  let prismaService: Partial<PrismaService>;
  let upsertCallCount: number;
  let findUniqueCallCount: number;
  let createCallCount: number;

  const mockEmailService = {
    sendOnboardingChecklistEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockProgress = {
    id: "progress-1",
    tenantId: "tenant-123",
    currentStep: 1,
    stepsCompleted: [],
    isCompleted: false,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    upsertCallCount = 0;
    findUniqueCallCount = 0;
    createCallCount = 0;

    prismaService = {
      onboardingProgress: {
        upsert: jest.fn().mockImplementation(() => {
          upsertCallCount++;
          return Promise.resolve(mockProgress);
        }),
        findUnique: jest.fn().mockImplementation(() => {
          findUniqueCallCount++;
          return Promise.resolve(mockProgress);
        }),
        create: jest.fn().mockImplementation(() => {
          createCallCount++;
          return Promise.resolve(mockProgress);
        }),
        update: jest.fn().mockResolvedValue(mockProgress),
      } as any,
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-123" }),
        update: jest.fn().mockResolvedValue({ id: "tenant-123" }),
      } as any,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    onboardingService = moduleRef.get<OnboardingService>(OnboardingService);
  });

  describe("getOnboardingProgress - N+1 prevention", () => {
    it("uses single upsert instead of separate find + create queries", async () => {
      const progress = await onboardingService.getOnboardingProgress("tenant-123");

      // Verify upsert was called exactly once
      expect(upsertCallCount).toBe(1);

      // Verify we did NOT use the old N+1 pattern (separate findUnique + create)
      expect(findUniqueCallCount).toBe(0);
      expect(createCallCount).toBe(0);

      // Verify result
      expect(progress).toMatchObject({
        tenantId: "tenant-123",
        currentStep: 1,
        stepsCompleted: [],
        isCompleted: false,
      });
    });

    it("passes correct default values to upsert create clause", async () => {
      await onboardingService.getOnboardingProgress("tenant-123");

      expect(prismaService.onboardingProgress!.upsert).toHaveBeenCalledWith({
        where: { tenantId: "tenant-123" },
        update: {}, // No-op update
        create: {
          tenantId: "tenant-123",
          currentStep: 1,
          stepsCompleted: [],
          isCompleted: false,
        },
      });
    });

    it("does not query tenant table separately (FK handles validation)", async () => {
      await onboardingService.getOnboardingProgress("tenant-123");

      // Tenant findUnique should NOT be called - we rely on FK constraint
      expect(prismaService.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when FK constraint fails", async () => {
      // Simulate FK constraint violation
      (prismaService.onboardingProgress!.upsert as jest.Mock).mockRejectedValueOnce(
        new Error("Foreign key constraint failed on the field"),
      );

      await expect(
        onboardingService.getOnboardingProgress("non-existent-tenant"),
      ).rejects.toThrow(NotFoundException);
    });

    it("includes stepTitles in response", async () => {
      const progress = await onboardingService.getOnboardingProgress("tenant-123");

      expect(progress.stepTitles).toBeDefined();
      expect(progress.stepTitles["1"]).toBe("Profile Setup");
    });

    it("preserves existing data when record already exists", async () => {
      const existingProgress = {
        ...mockProgress,
        currentStep: 5,
        stepsCompleted: ["PROFILE", "METRICS", "OUTCOMES"],
      };

      (prismaService.onboardingProgress!.upsert as jest.Mock).mockResolvedValueOnce(
        existingProgress,
      );

      const progress = await onboardingService.getOnboardingProgress("tenant-123");

      // Existing data should be returned (upsert update is no-op)
      expect(progress.currentStep).toBe(5);
      expect(progress.stepsCompleted).toEqual(["PROFILE", "METRICS", "OUTCOMES"]);
    });
  });

  describe("updateOnboardingProgress - efficiency", () => {
    it("calls getOnboardingProgress (upsert) then update", async () => {
      // Mock that user is already on step 1, advancing to step 2 (valid progression)
      const existingProgress = {
        ...mockProgress,
        currentStep: 1,
        stepsCompleted: [],
      };
      const updatedProgress = {
        ...mockProgress,
        currentStep: 2,
        stepsCompleted: ["PROFILE"],
      };

      (prismaService.onboardingProgress!.upsert as jest.Mock).mockResolvedValueOnce(
        existingProgress,
      );
      (prismaService.onboardingProgress!.update as jest.Mock).mockResolvedValueOnce(
        updatedProgress,
      );

      const result = await onboardingService.updateOnboardingProgress("tenant-123", {
        currentStep: 2, // Valid: step 1 -> step 2
        completedStep: OnboardingStep.PROFILE,
      });

      // Should use upsert for getOrCreate, then update
      expect(prismaService.onboardingProgress!.upsert).toHaveBeenCalledTimes(1);
      expect(prismaService.onboardingProgress!.update).toHaveBeenCalled();
      expect(result.currentStep).toBe(2);
    });
  });

  describe("Query count comparison", () => {
    it("OLD pattern would make 3 queries, NEW pattern makes 1", async () => {
      // This test documents the improvement:
      // OLD: findUnique(tenant) + findUnique(progress) + create(progress) = 3 queries
      // NEW: upsert(progress) = 1 query (FK handles tenant validation)

      await onboardingService.getOnboardingProgress("tenant-123");

      const totalOldPatternQueries = 3; // What it would have been
      const totalNewPatternQueries = upsertCallCount; // What it is now

      expect(totalNewPatternQueries).toBe(1);
      expect(totalNewPatternQueries).toBeLessThan(totalOldPatternQueries);
    });
  });
});
