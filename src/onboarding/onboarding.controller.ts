import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { OnboardingService } from "./onboarding.service";
import {
  UpdateOnboardingDto,
  OnboardingProgressResponseDto,
  UpdateProfileOnboardingDto,
  ProfileOnboardingResponseDto,
  BusinessIdentityDto,
  BusinessIdentityResponseDto,
  SalesPlanDto,
  SalesPlanResponseDto,
  ActivityConfigurationDto,
  ActivityConfigurationResponseDto,
  SalesCycleSetupDto,
  SalesCycleSetupResponseDto,
  AchievementStagesSetupDto,
  AchievementStagesSetupResponseDto,
  SubscriptionSelectionDto,
  SubscriptionSelectionResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { TENANT_MEMBER_ROLES } from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Onboarding")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ============================================
  // PROGRESS TRACKING
  // ============================================

  @ApiOperation({
    summary: "Get onboarding progress",
    description:
      "Returns the current onboarding progress for the authenticated tenant. Creates a default record if none exists.",
  })
  @ApiOkResponse({
    description: "Onboarding progress retrieved successfully",
    type: OnboardingProgressResponseDto,
  })
  @ApiNotFoundResponse({ description: "Tenant not found" })
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  async getProgress(@CurrentUser() user: UserContext) {
    return this.onboardingService.getOnboardingProgress(
      user.tenantId,
      user.userId,
    );
  }

  @ApiOperation({
    summary: "Update onboarding progress",
    description:
      "Updates the onboarding progress for the authenticated tenant. Can advance steps, mark steps as completed, or mark the entire onboarding as complete.",
  })
  @ApiOkResponse({
    description: "Onboarding progress updated successfully",
    type: OnboardingProgressResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input data or step skipping attempt",
  })
  @ApiNotFoundResponse({ description: "Tenant not found" })
  @Patch()
  @HttpCode(HttpStatus.OK)
  @Roles(...TENANT_MEMBER_ROLES)
  async updateProgress(
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateOnboardingDto,
  ) {
    return this.onboardingService.updateOnboardingProgress(
      user.tenantId,
      dto,
      user.userId,
    );
  }

  // ============================================
  // STEP 1: PROFILE
  // ============================================

  @ApiOperation({
    summary: "Update profile for onboarding (Step 1)",
    description:
      "Updates the user profile with personal and business information during onboarding.",
  })
  @ApiOkResponse({
    description: "Profile updated successfully",
    type: ProfileOnboardingResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid input data" })
  @Patch("profile")
  @HttpCode(HttpStatus.OK)
  @Roles(...TENANT_MEMBER_ROLES)
  async updateProfile(
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateProfileOnboardingDto,
  ) {
    return this.onboardingService.updateProfileOnboarding(
      user.userId,
      user.tenantId,
      dto,
    );
  }

  // ============================================
  // STEP 2: BUSINESS IDENTITY
  // ============================================

  @ApiOperation({
    summary: "Get business identity",
    description:
      "Retrieves the business identity configuration for the tenant.",
  })
  @ApiOkResponse({
    description: "Business identity retrieved successfully",
    type: BusinessIdentityResponseDto,
  })
  @Get("business-identity")
  @Roles(...TENANT_MEMBER_ROLES)
  async getBusinessIdentity(@CurrentUser() user: UserContext) {
    return this.onboardingService.getBusinessIdentity(user.tenantId);
  }

  @ApiOperation({
    summary: "Update business identity (Step 2)",
    description:
      "Creates or updates the business identity information including company type, industry, and turnover.",
  })
  @ApiOkResponse({
    description: "Business identity saved successfully",
    type: BusinessIdentityResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid input data" })
  @Put("business-identity")
  @Roles(...TENANT_MEMBER_ROLES)
  async upsertBusinessIdentity(
    @CurrentUser() user: UserContext,
    @Body() dto: BusinessIdentityDto,
  ) {
    return this.onboardingService.upsertBusinessIdentity(user.tenantId, dto);
  }

  // ============================================
  // STEP 3: SALES PLAN
  // ============================================

  @ApiOperation({
    summary: "Get sales plan",
    description:
      "Retrieves the sales plan with historical data and projections.",
  })
  @ApiOkResponse({
    description: "Sales plan retrieved successfully",
    type: SalesPlanResponseDto,
  })
  @Get("sales-plan")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSalesPlan(@CurrentUser() user: UserContext) {
    return this.onboardingService.getSalesPlan(user.tenantId);
  }

  @ApiOperation({
    summary: "Update sales plan (Step 3)",
    description:
      "Creates or updates the sales plan with 3-year historical data, projected revenue, and monthly contribution percentages. Monthly targets are automatically calculated.",
  })
  @ApiOkResponse({
    description: "Sales plan saved successfully",
    type: SalesPlanResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid input data or monthly contribution percentages do not sum to 100%",
  })
  @Put("sales-plan")
  @Roles(...TENANT_MEMBER_ROLES)
  async upsertSalesPlan(
    @CurrentUser() user: UserContext,
    @Body() dto: SalesPlanDto,
  ) {
    return this.onboardingService.upsertSalesPlan(user.tenantId, dto);
  }

  // ============================================
  // STEP 4: ACTIVITY CONFIGURATION
  // ============================================

  @ApiOperation({
    summary: "Get activity configuration",
    description:
      "Retrieves the activity tracking configuration for the tenant.",
  })
  @ApiOkResponse({
    description: "Activity configuration retrieved successfully",
    type: ActivityConfigurationResponseDto,
  })
  @Get("activity-setup")
  @Roles(...TENANT_MEMBER_ROLES)
  async getActivityConfiguration(@CurrentUser() user: UserContext) {
    return this.onboardingService.getActivityConfiguration(user.tenantId);
  }

  @ApiOperation({
    summary: "Update activity configuration (Step 4)",
    description:
      "Creates or updates the activity tracking configuration including enabled categories, weekly goals, and reminder settings.",
  })
  @ApiOkResponse({
    description: "Activity configuration saved successfully",
    type: ActivityConfigurationResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid input data" })
  @Put("activity-setup")
  @Roles(...TENANT_MEMBER_ROLES)
  async upsertActivityConfiguration(
    @CurrentUser() user: UserContext,
    @Body() dto: ActivityConfigurationDto,
  ) {
    return this.onboardingService.upsertActivityConfiguration(
      user.tenantId,
      dto,
    );
  }

  // ============================================
  // STEP 5: SALES CYCLE
  // ============================================

  @ApiOperation({
    summary: "Get sales cycle stages",
    description: "Retrieves the configured sales cycle pipeline stages.",
  })
  @ApiOkResponse({
    description: "Sales cycle stages retrieved successfully",
    type: SalesCycleSetupResponseDto,
  })
  @Get("sales-cycle")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSalesCycleStages(@CurrentUser() user: UserContext) {
    return this.onboardingService.getSalesCycleStages(user.tenantId);
  }

  @ApiOperation({
    summary: "Update sales cycle stages (Step 5)",
    description:
      "Replaces all sales cycle stages with the provided configuration. Minimum 2 stages, maximum 10 stages required.",
  })
  @ApiOkResponse({
    description: "Sales cycle stages saved successfully",
    type: SalesCycleSetupResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input data or duplicate order numbers",
  })
  @Put("sales-cycle")
  @Roles(...TENANT_MEMBER_ROLES)
  async replaceSalesCycleStages(
    @CurrentUser() user: UserContext,
    @Body() dto: SalesCycleSetupDto,
  ) {
    return this.onboardingService.replaceSalesCycleStages(user.tenantId, dto);
  }

  @ApiOperation({
    summary: "Initialize default sales cycle",
    description:
      "Creates a default sales cycle pipeline with Lead, Qualified, Proposal, Negotiation, and Closed Won stages.",
  })
  @ApiCreatedResponse({
    description: "Default sales cycle created successfully",
    type: SalesCycleSetupResponseDto,
  })
  @Post("sales-cycle/defaults")
  @HttpCode(HttpStatus.CREATED)
  @Roles(...TENANT_MEMBER_ROLES)
  async initializeDefaultSalesCycle(@CurrentUser() user: UserContext) {
    return this.onboardingService.initializeDefaultSalesCycle(user.tenantId);
  }

  // ============================================
  // STEP 6: ACHIEVEMENT STAGES
  // ============================================

  @ApiOperation({
    summary: "Get achievement stages",
    description: "Retrieves the configured achievement milestone stages.",
  })
  @ApiOkResponse({
    description: "Achievement stages retrieved successfully",
    type: AchievementStagesSetupResponseDto,
  })
  @Get("achievement-stages")
  @Roles(...TENANT_MEMBER_ROLES)
  async getAchievementStages(@CurrentUser() user: UserContext) {
    return this.onboardingService.getAchievementStages(user.tenantId);
  }

  @ApiOperation({
    summary: "Update achievement stages (Step 6)",
    description:
      "Replaces all achievement stages with the provided configuration. Minimum 2 stages, maximum 10 stages required.",
  })
  @ApiOkResponse({
    description: "Achievement stages saved successfully",
    type: AchievementStagesSetupResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input data or duplicate order numbers",
  })
  @Put("achievement-stages")
  @Roles(...TENANT_MEMBER_ROLES)
  async replaceAchievementStages(
    @CurrentUser() user: UserContext,
    @Body() dto: AchievementStagesSetupDto,
  ) {
    return this.onboardingService.replaceAchievementStages(user.tenantId, dto);
  }

  // ============================================
  // STEP 7: SUBSCRIPTION
  // ============================================

  @ApiOperation({
    summary: "Get selected subscription",
    description: "Retrieves the subscription plan selected during onboarding.",
  })
  @ApiOkResponse({
    description: "Selected subscription retrieved successfully",
    type: SubscriptionSelectionResponseDto,
  })
  @Get("subscription")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSelectedSubscription(@CurrentUser() user: UserContext) {
    return this.onboardingService.getSelectedSubscription(user.tenantId);
  }

  @ApiOperation({
    summary: "Select subscription plan (Step 7)",
    description:
      "Selects a subscription plan for the tenant. The actual subscription is created when onboarding is completed.",
  })
  @ApiOkResponse({
    description: "Subscription plan selected successfully",
    type: SubscriptionSelectionResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid subscription plan" })
  @Put("subscription")
  @Roles(...TENANT_MEMBER_ROLES)
  async selectSubscription(
    @CurrentUser() user: UserContext,
    @Body() dto: SubscriptionSelectionDto,
  ) {
    return this.onboardingService.selectSubscription(user.tenantId, dto);
  }

  // ============================================
  // STEP 8: COMPLETE ONBOARDING
  // ============================================

  @ApiOperation({
    summary: "Complete onboarding (Step 8)",
    description:
      "Marks the onboarding as complete. Validates that all required steps are completed before allowing completion. Creates the actual subscription based on the selected plan.",
  })
  @ApiOkResponse({
    description: "Onboarding completed successfully",
    type: OnboardingProgressResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Not all required steps are completed",
  })
  @ApiNotFoundResponse({ description: "Onboarding progress not found" })
  @Post("complete")
  @HttpCode(HttpStatus.OK)
  @Roles(...TENANT_MEMBER_ROLES)
  async completeOnboarding(@CurrentUser() user: UserContext) {
    return this.onboardingService.completeOnboarding(user.tenantId);
  }
}
