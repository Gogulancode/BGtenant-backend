import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  Role,
  OnboardingProgress,
  SubscriptionPlan,
  SubscriptionStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";
import { startOfWeek, startOfNextWeek } from "../common/utils/date.utils";
import {
  UpdateOnboardingDto,
  OnboardingStep,
  STEP_TO_NUMBER,
} from "./dto/update-onboarding.dto";
import {
  ONBOARDING_STEP_TITLES,
  MAX_ONBOARDING_STEPS,
  OnboardingProgressResponseDto,
} from "./dto/onboarding-progress-response.dto";
import {
  UpdateProfileOnboardingDto,
  ProfileOnboardingResponseDto,
} from "./dto/profile-onboarding.dto";
import {
  BusinessIdentityDto,
  BusinessIdentityResponseDto,
} from "./dto/business-identity.dto";
import { SalesPlanDto, SalesPlanResponseDto } from "./dto/sales-plan.dto";
import {
  ActivityConfigurationDto,
  ActivityConfigurationResponseDto,
  DEFAULT_ACTIVITY_TEMPLATES,
} from "./dto/activity-configuration.dto";
import {
  SalesCycleSetupDto,
  SalesCycleSetupResponseDto,
  DEFAULT_SALES_CYCLE_STAGES,
} from "./dto/sales-cycle.dto";
import {
  AchievementStagesSetupDto,
  AchievementStagesSetupResponseDto,
  generateDefaultAchievementStages,
} from "./dto/achievement-stages.dto";
import {
  SubscriptionSelectionDto,
  SubscriptionSelectionResponseDto,
  PLAN_FEATURES,
} from "./dto/subscription-selection.dto";

const WELCOME_OUTCOME = "Complete onboarding checklist";

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ============================================
  // ONBOARDING PROGRESS TRACKING
  // ============================================

  /**
   * Get onboarding progress for a tenant.
   * Uses upsert to create a default record if none exists (single query).
   */
  async getOnboardingProgress(
    tenantId: string,
    userId?: string,
  ): Promise<OnboardingProgressResponseDto> {
    try {
      const progress = await this.prisma.onboardingProgress.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          currentStep: 1,
          stepsCompleted: [],
          isCompleted: false,
        },
      });

      return this.mapToProgressResponse(
        progress,
        userId ? await this.getOnboardingUser(userId, tenantId) : undefined,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Foreign key constraint")
      ) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }
      throw error;
    }
  }

  /**
   * Update onboarding progress for a tenant.
   * Validates that steps cannot be skipped (can only advance by 1 step at a time).
   */
  async updateOnboardingProgress(
    tenantId: string,
    dto: UpdateOnboardingDto,
    userId?: string,
  ): Promise<OnboardingProgressResponseDto> {
    const existing = await this.getOnboardingProgress(tenantId);

    const updateData: Record<string, unknown> = {};

    // Validate and update current step if provided
    if (dto.currentStep !== undefined) {
      const maxAllowedStep = existing.currentStep + 1;
      if (dto.currentStep > maxAllowedStep) {
        throw new BadRequestException(
          `Cannot skip to step ${dto.currentStep}. You are on step ${existing.currentStep}. Complete the current step first.`,
        );
      }
      updateData.currentStep = dto.currentStep;
    }

    // Append completed step if not already in the list
    if (dto.completedStep) {
      const alreadyCompleted = existing.stepsCompleted.includes(
        dto.completedStep,
      );
      if (!alreadyCompleted) {
        updateData.stepsCompleted = [
          ...existing.stepsCompleted,
          dto.completedStep,
        ];
      }
    }

    // Mark as completed if requested
    if (dto.isCompleted === true && !existing.isCompleted) {
      updateData.isCompleted = true;
      updateData.completedAt = new Date();

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { isOnboarded: true },
      });

      this.logger.log(`Tenant ${tenantId} marked as fully onboarded`);
    }

    if (Object.keys(updateData).length === 0) {
      return userId
        ? {
            ...existing,
            user: this.mapOnboardingUser(
              await this.getOnboardingUser(userId, tenantId),
            ),
          }
        : existing;
    }

    const updated = await this.prisma.onboardingProgress.update({
      where: { tenantId },
      data: updateData,
    });

    this.logger.log(
      `Updated onboarding progress for tenant ${tenantId}: step=${updated.currentStep}`,
    );

    return this.mapToProgressResponse(
      updated,
      userId ? await this.getOnboardingUser(userId, tenantId) : undefined,
    );
  }

  private mapToProgressResponse(
    progress: OnboardingProgress,
    user?: {
      id: string;
      name: string;
      email: string;
      age: number | null;
      gender: string | null;
      maritalStatus: string | null;
      businessDescription: string | null;
      socialHandles: unknown;
      painPoints: unknown;
    } | null,
  ): OnboardingProgressResponseDto {
    return {
      id: progress.id,
      tenantId: progress.tenantId,
      currentStep: progress.currentStep,
      stepsCompleted: progress.stepsCompleted,
      isCompleted: progress.isCompleted,
      completedAt: progress.completedAt,
      stepFlags: {
        profileCompleted: progress.profileCompleted,
        businessIdentityCompleted: progress.businessIdentityCompleted,
        salesPlanCompleted: progress.salesPlanCompleted,
        activityConfigCompleted: progress.activityConfigCompleted,
        salesCycleCompleted: progress.salesCycleCompleted,
        achievementStagesCompleted: progress.achievementStagesCompleted,
        subscriptionCompleted: progress.subscriptionCompleted,
        visualSetupCompleted: progress.visualSetupCompleted,
      },
      selectedPlan: progress.selectedPlan || undefined,
      user: this.mapOnboardingUser(user),
      stepTitles: ONBOARDING_STEP_TITLES,
      totalSteps: MAX_ONBOARDING_STEPS,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    };
  }

  private mapOnboardingUser(
    user?: {
      id: string;
      name: string;
      email: string;
      age: number | null;
      gender: string | null;
      maritalStatus: string | null;
      businessDescription: string | null;
      socialHandles: unknown;
      painPoints: unknown;
    } | null,
  ): OnboardingProgressResponseDto["user"] {
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          age: user.age || undefined,
          gender: user.gender as NonNullable<
            OnboardingProgressResponseDto["user"]
          >["gender"],
          maritalStatus: user.maritalStatus as NonNullable<
            OnboardingProgressResponseDto["user"]
          >["maritalStatus"],
          businessDescription: user.businessDescription || undefined,
          socialHandles: user.socialHandles as Record<string, unknown>,
          painPoints: user.painPoints as Record<string, unknown>,
        }
      : undefined;
  }

  private async getOnboardingUser(userId: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        gender: true,
        maritalStatus: true,
        businessDescription: true,
        socialHandles: true,
        painPoints: true,
      },
    });
  }

  // ============================================
  // STEP 1: PROFILE UPDATE
  // ============================================

  async updateProfileOnboarding(
    userId: string,
    tenantId: string,
    dto: UpdateProfileOnboardingDto,
  ): Promise<ProfileOnboardingResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        age: dto.age,
        gender: dto.gender,
        maritalStatus: dto.maritalStatus,
        businessType: dto.businessType,
        businessDescription: dto.businessDescription,
        socialHandles: dto.socialHandles
          ? JSON.parse(JSON.stringify(dto.socialHandles))
          : undefined,
        painPoints: dto.painPoints
          ? JSON.parse(JSON.stringify(dto.painPoints))
          : undefined,
      },
    });

    // Mark step as completed
    await this.markStepCompleted(
      tenantId,
      OnboardingStep.PROFILE,
      "profileCompleted",
    );

    this.logger.log(`Profile onboarding updated for user ${userId}`);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      age: updated.age || undefined,
      gender: updated.gender as ProfileOnboardingResponseDto["gender"],
      maritalStatus:
        updated.maritalStatus as ProfileOnboardingResponseDto["maritalStatus"],
      businessType: updated.businessType,
      businessDescription: updated.businessDescription || undefined,
      socialHandles:
        updated.socialHandles as ProfileOnboardingResponseDto["socialHandles"],
      painPoints:
        updated.painPoints as ProfileOnboardingResponseDto["painPoints"],
      updatedAt: updated.updatedAt,
    };
  }

  // ============================================
  // STEP 2: BUSINESS IDENTITY
  // ============================================

  async upsertBusinessIdentity(
    tenantId: string,
    dto: BusinessIdentityDto,
  ): Promise<BusinessIdentityResponseDto> {
    const businessIdentity = await this.prisma.businessIdentity.upsert({
      where: { tenantId },
      update: {
        companyName: dto.companyName,
        companyType: dto.companyType,
        customerType: dto.customerType,
        registrationStatus: dto.registrationStatus,
        offeringType: dto.offeringType,
        industry: dto.industry,
        industryOther: dto.industryOther,
        foundedYear: dto.foundedYear,
        businessAge: dto.businessAge,
        turnoverBand: dto.turnoverBand,
        employeeRange: dto.employeeRange,
        website: dto.website,
        description: dto.description,
        usp: dto.usp,
        keywords: dto.keywords,
        offerings: dto.offerings ?? undefined,
      },
      create: {
        tenantId,
        companyName: dto.companyName,
        companyType: dto.companyType,
        customerType: dto.customerType,
        registrationStatus: dto.registrationStatus,
        offeringType: dto.offeringType,
        industry: dto.industry,
        industryOther: dto.industryOther,
        foundedYear: dto.foundedYear,
        businessAge: dto.businessAge,
        turnoverBand: dto.turnoverBand,
        employeeRange: dto.employeeRange,
        website: dto.website,
        description: dto.description,
        usp: dto.usp,
        keywords: dto.keywords ?? [],
        offerings: dto.offerings ?? undefined,
      },
    });

    await this.markStepCompleted(
      tenantId,
      OnboardingStep.BUSINESS_IDENTITY,
      "businessIdentityCompleted",
    );

    this.logger.log(`Business identity updated for tenant ${tenantId}`);

    return businessIdentity as BusinessIdentityResponseDto;
  }

  async getBusinessIdentity(
    tenantId: string,
  ): Promise<BusinessIdentityResponseDto | null> {
    const identity = await this.prisma.businessIdentity.findUnique({
      where: { tenantId },
    });
    return identity as BusinessIdentityResponseDto | null;
  }

  // ============================================
  // STEP 3: SALES PLAN
  // ============================================

  async upsertSalesPlan(
    tenantId: string,
    dto: SalesPlanDto,
  ): Promise<SalesPlanResponseDto> {
    const monthlyTargets = dto.monthlyContribution.map(
      (pct) => (dto.projectedYearValue * pct) / 100,
    );
    const monthlyOrderTargets = monthlyTargets.map((target) =>
      Math.ceil(target / dto.averageTicketSize),
    );
    const monthlyLeadTargets = monthlyOrderTargets.map((orders) =>
      Math.ceil(orders / (dto.conversionRatio / 100)),
    );
    const existingCustomerTarget =
      (dto.projectedYearValue * dto.existingCustomerContribution) / 100;
    const newCustomerTarget =
      (dto.projectedYearValue * dto.newCustomerContribution) / 100;

    const salesPlan = await this.prisma.salesPlan.upsert({
      where: { tenantId },
      update: {
        yearMinus3Value: dto.yearMinus3Value,
        yearMinus2Value: dto.yearMinus2Value,
        yearMinus1Value: dto.yearMinus1Value,
        projectedYearValue: dto.projectedYearValue,
        monthlyContribution: dto.monthlyContribution,
        monthlyTargets,
        averageTicketSize: dto.averageTicketSize,
        conversionRatio: dto.conversionRatio,
        existingCustomerContribution: dto.existingCustomerContribution,
        newCustomerContribution: dto.newCustomerContribution,
        monthlyOrderTargets,
        monthlyLeadTargets,
        existingCustomerTarget,
        newCustomerTarget,
      },
      create: {
        tenantId,
        yearMinus3Value: dto.yearMinus3Value,
        yearMinus2Value: dto.yearMinus2Value,
        yearMinus1Value: dto.yearMinus1Value,
        projectedYearValue: dto.projectedYearValue,
        monthlyContribution: dto.monthlyContribution,
        monthlyTargets,
        averageTicketSize: dto.averageTicketSize,
        conversionRatio: dto.conversionRatio,
        existingCustomerContribution: dto.existingCustomerContribution,
        newCustomerContribution: dto.newCustomerContribution,
        monthlyOrderTargets,
        monthlyLeadTargets,
        existingCustomerTarget,
        newCustomerTarget,
      },
    });

    await this.markStepCompleted(
      tenantId,
      OnboardingStep.SALES_PLAN,
      "salesPlanCompleted",
    );

    this.logger.log(
      `Sales plan updated for tenant ${tenantId}: projected=${dto.projectedYearValue}`,
    );

    return salesPlan as SalesPlanResponseDto;
  }

  async getSalesPlan(tenantId: string): Promise<SalesPlanResponseDto | null> {
    const plan = await this.prisma.salesPlan.findUnique({
      where: { tenantId },
    });
    return plan as SalesPlanResponseDto | null;
  }

  // ============================================
  // STEP 4: ACTIVITY CONFIGURATION
  // ============================================

  async upsertActivityConfiguration(
    tenantId: string,
    dto: ActivityConfigurationDto,
  ): Promise<ActivityConfigurationResponseDto> {
    const activities = JSON.parse(
      JSON.stringify(dto.activities ?? DEFAULT_ACTIVITY_TEMPLATES),
    ) as Prisma.InputJsonValue;

    const config = await this.prisma.activityConfiguration.upsert({
      where: { tenantId },
      update: {
        salesEnabled: dto.salesEnabled ?? true,
        marketingEnabled: dto.marketingEnabled ?? true,
        networkingEnabled: dto.networkingEnabled ?? true,
        productDevEnabled: dto.productDevEnabled ?? true,
        operationsEnabled: dto.operationsEnabled ?? true,
        weeklyActivityGoal: dto.weeklyActivityGoal ?? 5,
        enableReminders: dto.enableReminders ?? true,
        reminderDays: dto.reminderDays ?? [1, 3, 5],
        activities,
      },
      create: {
        tenantId,
        salesEnabled: dto.salesEnabled ?? true,
        marketingEnabled: dto.marketingEnabled ?? true,
        networkingEnabled: dto.networkingEnabled ?? true,
        productDevEnabled: dto.productDevEnabled ?? true,
        operationsEnabled: dto.operationsEnabled ?? true,
        weeklyActivityGoal: dto.weeklyActivityGoal ?? 5,
        enableReminders: dto.enableReminders ?? true,
        reminderDays: dto.reminderDays ?? [1, 3, 5],
        activities,
      },
    });

    await this.markStepCompleted(
      tenantId,
      OnboardingStep.ACTIVITY_CONFIG,
      "activityConfigCompleted",
    );

    this.logger.log(`Activity configuration updated for tenant ${tenantId}`);

    return config as unknown as ActivityConfigurationResponseDto;
  }

  async getActivityConfiguration(
    tenantId: string,
  ): Promise<ActivityConfigurationResponseDto | null> {
    const config = await this.prisma.activityConfiguration.findUnique({
      where: { tenantId },
    });
    return config as unknown as ActivityConfigurationResponseDto | null;
  }

  // ============================================
  // STEP 5: SALES CYCLE STAGES
  // ============================================

  async replaceSalesCycleStages(
    tenantId: string,
    dto: SalesCycleSetupDto,
  ): Promise<SalesCycleSetupResponseDto> {
    // Validate unique orders
    const orders = dto.stages.map((s) => s.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException(
        "Each stage must have a unique order number",
      );
    }

    // Delete existing stages and create new ones in a transaction
    const stages = await this.prisma.$transaction(async (tx) => {
      await tx.salesCycleStage.deleteMany({ where: { tenantId } });

      return Promise.all(
        dto.stages.map((stage) =>
          tx.salesCycleStage.create({
            data: {
              tenantId,
              name: stage.name,
              order: stage.order,
              color: stage.color,
              description: stage.description,
              probability: stage.probability ?? 0,
              isActive: stage.isActive ?? true,
            },
          }),
        ),
      );
    });

    await this.markStepCompleted(
      tenantId,
      OnboardingStep.SALES_CYCLE,
      "salesCycleCompleted",
    );

    this.logger.log(
      `Sales cycle stages replaced for tenant ${tenantId}: ${stages.length} stages`,
    );

    return {
      stages: stages.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        name: s.name,
        order: s.order,
        color: s.color || undefined,
        description: s.description || undefined,
        probability: s.probability || undefined,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      totalStages: stages.length,
    };
  }

  async getSalesCycleStages(
    tenantId: string,
  ): Promise<SalesCycleSetupResponseDto> {
    const stages = await this.prisma.salesCycleStage.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
    });

    return {
      stages: stages.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        name: s.name,
        order: s.order,
        color: s.color || undefined,
        description: s.description || undefined,
        probability: s.probability || undefined,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      totalStages: stages.length,
    };
  }

  async initializeDefaultSalesCycle(
    tenantId: string,
  ): Promise<SalesCycleSetupResponseDto> {
    return this.replaceSalesCycleStages(tenantId, {
      stages: DEFAULT_SALES_CYCLE_STAGES,
    });
  }

  // ============================================
  // STEP 6: ACHIEVEMENT STAGES
  // ============================================

  async replaceAchievementStages(
    tenantId: string,
    dto: AchievementStagesSetupDto,
  ): Promise<AchievementStagesSetupResponseDto> {
    // Validate unique orders
    const orders = dto.stages.map((s) => s.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException(
        "Each stage must have a unique order number",
      );
    }

    // Delete existing stages and create new ones in a transaction
    const stages = await this.prisma.$transaction(async (tx) => {
      await tx.achievementStage.deleteMany({ where: { tenantId } });

      return Promise.all(
        dto.stages.map((stage) =>
          tx.achievementStage.create({
            data: {
              tenantId,
              name: stage.name,
              order: stage.order,
              targetValue: stage.targetValue,
              percentOfGoal: stage.percentOfGoal,
              color: stage.color,
              icon: stage.icon,
              reward: stage.reward,
              isActive: stage.isActive ?? true,
            },
          }),
        ),
      );
    });

    await this.markStepCompleted(
      tenantId,
      OnboardingStep.ACHIEVEMENT_STAGES,
      "achievementStagesCompleted",
    );

    this.logger.log(
      `Achievement stages replaced for tenant ${tenantId}: ${stages.length} stages`,
    );

    return {
      stages: stages.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        name: s.name,
        order: s.order,
        targetValue: s.targetValue,
        percentOfGoal: s.percentOfGoal || undefined,
        color: s.color || undefined,
        icon: s.icon || undefined,
        reward: s.reward || undefined,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      totalStages: stages.length,
    };
  }

  async getAchievementStages(
    tenantId: string,
  ): Promise<AchievementStagesSetupResponseDto> {
    const stages = await this.prisma.achievementStage.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
    });

    return {
      stages: stages.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        name: s.name,
        order: s.order,
        targetValue: s.targetValue,
        percentOfGoal: s.percentOfGoal || undefined,
        color: s.color || undefined,
        icon: s.icon || undefined,
        reward: s.reward || undefined,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      totalStages: stages.length,
    };
  }

  // ============================================
  // STEP 7: SUBSCRIPTION SELECTION
  // ============================================

  async selectSubscription(
    tenantId: string,
    dto: SubscriptionSelectionDto,
  ): Promise<SubscriptionSelectionResponseDto> {
    const progress = await this.ensureProgress(tenantId);
    const stepsCompleted = new Set(progress.stepsCompleted);
    stepsCompleted.add(OnboardingStep.SUBSCRIPTION);

    await this.prisma.onboardingProgress.update({
      where: { tenantId },
      data: {
        selectedPlan: dto.plan,
        subscriptionCompleted: true,
        stepsCompleted: Array.from(stepsCompleted),
      },
    });

    this.logger.log(
      `Subscription selected for tenant ${tenantId}: ${dto.plan}`,
    );

    return {
      selectedPlan: dto.plan,
      planFeatures: PLAN_FEATURES[dto.plan],
    };
  }

  async getSelectedSubscription(
    tenantId: string,
  ): Promise<SubscriptionSelectionResponseDto | null> {
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { tenantId },
    });

    if (!progress?.selectedPlan) {
      return null;
    }

    return {
      selectedPlan: progress.selectedPlan,
      planFeatures: PLAN_FEATURES[progress.selectedPlan],
    };
  }

  // ============================================
  // STEP 8: COMPLETE ONBOARDING
  // ============================================

  async completeOnboarding(
    tenantId: string,
  ): Promise<OnboardingProgressResponseDto> {
    await this.ensureDefaultCompletionArtifacts(tenantId);
    const progress = await this.reconcileProgressWithSavedSetup(tenantId);

    // Validate all required steps are completed
    const requiredFlags = [
      "profileCompleted",
      "businessIdentityCompleted",
      "salesPlanCompleted",
      "activityConfigCompleted",
      "salesCycleCompleted",
      "achievementStagesCompleted",
      "subscriptionCompleted",
    ] as const;

    const incompleteSteps = requiredFlags.filter((flag) => !progress[flag]);

    if (incompleteSteps.length > 0) {
      throw new BadRequestException(
        `Cannot complete onboarding. Incomplete steps: ${incompleteSteps.join(", ")}`,
      );
    }

    // Update onboarding progress and tenant
    const completedSteps = new Set(progress.stepsCompleted);
    completedSteps.add(OnboardingStep.VISUAL_SETUP);

    const [updated] = await this.prisma.$transaction([
      this.prisma.onboardingProgress.update({
        where: { tenantId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
          visualSetupCompleted: true,
          stepsCompleted: Array.from(completedSteps),
          currentStep: MAX_ONBOARDING_STEPS,
        },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { isOnboarded: true },
      }),
    ]);

    // Create actual subscription based on selected plan
    const selectedPlan = progress.selectedPlan ?? SubscriptionPlan.FREE;
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        },
      },
    });

    if (!existingSubscription) {
      const features = PLAN_FEATURES[selectedPlan];
      await this.prisma.subscription.create({
        data: {
          tenantId,
          plan: selectedPlan,
          status:
            selectedPlan === SubscriptionPlan.FREE
              ? SubscriptionStatus.ACTIVE
              : SubscriptionStatus.TRIAL,
          trialEndsAt:
            selectedPlan !== SubscriptionPlan.FREE
              ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
              : null,
          maxUsers: features.maxUsers,
          maxMetrics: features.maxMetrics,
          maxActivities: features.maxActivities,
        },
      });
    }

    this.logger.log(`Onboarding completed for tenant ${tenantId}`);

    return this.mapToProgressResponse(updated);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async markStepCompleted(
    tenantId: string,
    step: OnboardingStep,
    flagName: string,
  ): Promise<void> {
    const progress = await this.ensureProgress(tenantId);

    const updateData: Record<string, unknown> = {
      [flagName]: true,
    };

    if (!progress.stepsCompleted.includes(step)) {
      updateData.stepsCompleted = [...progress.stepsCompleted, step];
    }

    // Auto-advance currentStep if this is the current step
    const stepNumber = STEP_TO_NUMBER[step];
    if (
      progress.currentStep === stepNumber &&
      stepNumber < MAX_ONBOARDING_STEPS
    ) {
      updateData.currentStep = stepNumber + 1;
    }

    await this.prisma.onboardingProgress.update({
      where: { tenantId },
      data: updateData,
    });
  }

  private async ensureProgress(tenantId: string): Promise<OnboardingProgress> {
    return this.prisma.onboardingProgress.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        currentStep: 1,
        stepsCompleted: [],
        isCompleted: false,
      },
    });
  }

  private async ensureDefaultCompletionArtifacts(
    tenantId: string,
  ): Promise<void> {
    const [salesCycleCount, achievementStageCount, salesPlan] =
      await Promise.all([
        this.prisma.salesCycleStage.count({ where: { tenantId } }),
        this.prisma.achievementStage.count({ where: { tenantId } }),
        this.prisma.salesPlan.findUnique({ where: { tenantId } }),
      ]);

    if (salesCycleCount === 0) {
      await this.prisma.$transaction(
        DEFAULT_SALES_CYCLE_STAGES.map((stage) =>
          this.prisma.salesCycleStage.create({
            data: {
              tenantId,
              name: stage.name,
              order: stage.order,
              color: stage.color,
              description: stage.description,
              probability: stage.probability ?? 0,
              isActive: stage.isActive ?? true,
            },
          }),
        ),
      );
    }

    if (achievementStageCount === 0) {
      const annualGoal = salesPlan?.projectedYearValue ?? 0;
      const stages = generateDefaultAchievementStages(annualGoal);
      await this.prisma.$transaction(
        stages.map((stage) =>
          this.prisma.achievementStage.create({
            data: {
              tenantId,
              name: stage.name,
              order: stage.order,
              targetValue: stage.targetValue,
              percentOfGoal: stage.percentOfGoal,
              color: stage.color,
              icon: stage.icon,
              reward: stage.reward,
              isActive: stage.isActive ?? true,
            },
          }),
        ),
      );
    }
  }

  private async reconcileProgressWithSavedSetup(
    tenantId: string,
  ): Promise<OnboardingProgress> {
    const progress = await this.ensureProgress(tenantId);
    const [
      user,
      businessIdentity,
      salesPlan,
      activityConfiguration,
      salesCycleCount,
      achievementStageCount,
    ] = await Promise.all([
      this.prisma.user.findFirst({
        where: { tenantId },
        select: { name: true },
      }),
      this.prisma.businessIdentity.findUnique({ where: { tenantId } }),
      this.prisma.salesPlan.findUnique({ where: { tenantId } }),
      this.prisma.activityConfiguration.findUnique({ where: { tenantId } }),
      this.prisma.salesCycleStage.count({ where: { tenantId } }),
      this.prisma.achievementStage.count({ where: { tenantId } }),
    ]);

    const stepsCompleted = new Set(progress.stepsCompleted);
    const updateData: Prisma.OnboardingProgressUpdateInput = {};
    const mark = (
      completed: boolean,
      flagName: keyof Pick<
        OnboardingProgress,
        | "profileCompleted"
        | "businessIdentityCompleted"
        | "salesPlanCompleted"
        | "activityConfigCompleted"
        | "salesCycleCompleted"
        | "achievementStagesCompleted"
        | "subscriptionCompleted"
      >,
      step: OnboardingStep,
    ) => {
      if (!completed) return;
      if (!progress[flagName]) {
        updateData[flagName] = true;
      }
      stepsCompleted.add(step);
    };

    mark(Boolean(user?.name), "profileCompleted", OnboardingStep.PROFILE);
    mark(
      Boolean(businessIdentity?.companyName && businessIdentity?.usp),
      "businessIdentityCompleted",
      OnboardingStep.BUSINESS_IDENTITY,
    );
    mark(Boolean(salesPlan), "salesPlanCompleted", OnboardingStep.SALES_PLAN);
    mark(
      Boolean(activityConfiguration),
      "activityConfigCompleted",
      OnboardingStep.ACTIVITY_CONFIG,
    );
    mark(
      salesCycleCount > 0,
      "salesCycleCompleted",
      OnboardingStep.SALES_CYCLE,
    );
    mark(
      achievementStageCount > 0,
      "achievementStagesCompleted",
      OnboardingStep.ACHIEVEMENT_STAGES,
    );
    mark(true, "subscriptionCompleted", OnboardingStep.SUBSCRIPTION);

    if (!progress.selectedPlan) {
      updateData.selectedPlan = SubscriptionPlan.FREE;
    }
    updateData.stepsCompleted = Array.from(stepsCompleted);

    return this.prisma.onboardingProgress.update({
      where: { tenantId },
      data: updateData,
    });
  }

  /**
   * Validate that a step cannot be skipped
   */
  async validateStepOrder(
    tenantId: string,
    targetStep: OnboardingStep,
  ): Promise<void> {
    const progress = await this.getOnboardingProgress(tenantId);
    const targetStepNumber = STEP_TO_NUMBER[targetStep];

    if (targetStepNumber > progress.currentStep + 1) {
      throw new BadRequestException(
        `Cannot skip to step ${targetStep}. Complete previous steps first.`,
      );
    }
  }

  // ============================================
  // LEGACY ONBOARDING SEEDING (existing functionality)
  // ============================================

  async seedNewTenantWorkspace(payload: {
    tenantId: string;
    tenantName: string;
    adminUserId: string;
    adminEmail: string;
    adminName: string;
  }) {
    await Promise.all([
      this.ensureWelcomeOutcome(payload.adminUserId, payload.tenantId),
      this.ensureKickoffActivities(payload.adminUserId, payload.tenantId),
    ]);

    await this.emailService.sendOnboardingChecklistEmail({
      tenantName: payload.tenantName,
      recipientEmail: payload.adminEmail,
      recipientName: payload.adminName,
      checklist: this.getChecklistItems(Role.TENANT_ADMIN),
    });

    this.logger.log(
      `Provisioned onboarding assets for tenant ${payload.tenantId} admin ${payload.adminUserId}`,
    );
  }

  async handleInviteAcceptance(payload: {
    tenantId: string;
    tenantName: string;
    userId: string;
    userEmail: string;
    userName: string;
    role: Role;
  }) {
    await this.ensureKickoffActivities(payload.userId, payload.tenantId);

    await this.emailService.sendOnboardingChecklistEmail({
      tenantName: payload.tenantName,
      recipientEmail: payload.userEmail,
      recipientName: payload.userName,
      checklist: this.getChecklistItems(payload.role),
    });

    this.logger.log(
      `Onboarding sequence triggered for invited user ${payload.userId} (${payload.role})`,
    );
  }

  private async ensureWelcomeOutcome(userId: string, tenantId: string) {
    const weekStart = startOfWeek();
    const existing = await this.prisma.outcome.findFirst({
      where: {
        userId,
        tenantId,
        title: WELCOME_OUTCOME,
        weekStartDate: weekStart,
      },
    });

    if (existing) {
      return;
    }

    await this.prisma.outcome.create({
      data: {
        userId,
        tenantId,
        title: WELCOME_OUTCOME,
        status: "Planned",
        weekStartDate: weekStart,
      },
    });
  }

  private async ensureKickoffActivities(userId: string, tenantId: string) {
    const dueDate = startOfNextWeek();
    const activities = [
      {
        title: "Invite your accountability partner",
        category: "Operations",
        description: "Add at least one collaborator to your workspace.",
      },
      {
        title: "Log your first metric",
        category: "Metrics",
        description: "Record baseline KPI values to generate a momentum score.",
      },
    ];

    for (const [index, activity] of activities.entries()) {
      const exists = await this.prisma.activity.findFirst({
        where: {
          userId,
          tenantId,
          title: activity.title,
        },
      });

      if (exists) {
        continue;
      }

      await this.prisma.activity.create({
        data: {
          userId,
          tenantId,
          title: activity.title,
          description: activity.description,
          category: activity.category,
          priority: index === 0 ? "High" : "Medium",
          dueDate,
        },
      });
    }
  }

  private getChecklistItems(role: Role): string[] {
    if (role === Role.TENANT_ADMIN) {
      return [
        "Invite at least one teammate",
        "Configure your metrics library",
        "Schedule the first weekly outcome review",
      ];
    }

    return [
      "Review the current week's outcomes",
      "Update your daily metrics",
      "Complete a quick reflection by Friday",
    ];
  }
}
