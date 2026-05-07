import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SubscriptionPlan } from "@prisma/client";

export const ONBOARDING_STEP_TITLES: Record<string, string> = {
  "1": "Profile Setup",
  "2": "Business Identity",
  "3": "Sales Planning",
  "4": "Activity Setup",
  "5": "Sales Cycle",
  "6": "Achievement Stages",
  "7": "Subscription",
  "8": "Finish",
};

export const MAX_ONBOARDING_STEPS = 8;

export class OnboardingStepFlags {
  @ApiProperty({ description: 'Profile step completed', example: true })
  profileCompleted: boolean;

  @ApiProperty({ description: 'Business identity step completed', example: false })
  businessIdentityCompleted: boolean;

  @ApiProperty({ description: 'Sales plan step completed', example: false })
  salesPlanCompleted: boolean;

  @ApiProperty({ description: 'Activity configuration step completed', example: false })
  activityConfigCompleted: boolean;

  @ApiProperty({ description: 'Sales cycle step completed', example: false })
  salesCycleCompleted: boolean;

  @ApiProperty({ description: 'Achievement stages step completed', example: false })
  achievementStagesCompleted: boolean;

  @ApiProperty({ description: 'Subscription step completed', example: false })
  subscriptionCompleted: boolean;

  @ApiProperty({ description: 'Visual/finish step completed', example: false })
  visualSetupCompleted: boolean;
}

export class OnboardingProgressResponseDto {
  @ApiProperty({ description: "Unique identifier" })
  id: string;

  @ApiProperty({ description: "Tenant ID" })
  tenantId: string;

  @ApiProperty({ description: "Current step number (1-based)", example: 1 })
  currentStep: number;

  @ApiProperty({
    description: "Array of completed step identifiers",
    example: ["PROFILE", "BUSINESS_IDENTITY"],
    type: [String],
  })
  stepsCompleted: string[];

  @ApiProperty({
    description: "Whether onboarding is fully completed",
    example: false,
  })
  isCompleted: boolean;

  @ApiProperty({
    description: "Timestamp when onboarding was completed",
    required: false,
    nullable: true,
  })
  completedAt: Date | null;

  @ApiProperty({
    description: "Step completion flags",
    type: OnboardingStepFlags,
  })
  stepFlags: OnboardingStepFlags;

  @ApiPropertyOptional({
    description: "Selected subscription plan (before activation)",
    enum: SubscriptionPlan,
  })
  selectedPlan?: SubscriptionPlan;

  @ApiProperty({
    description: "Step number to title mapping for UI display",
    example: ONBOARDING_STEP_TITLES,
  })
  stepTitles: Record<string, string>;

  @ApiProperty({
    description: "Total number of onboarding steps",
    example: MAX_ONBOARDING_STEPS,
  })
  totalSteps: number;

  @ApiProperty({ description: "Record creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Record last update timestamp" })
  updatedAt: Date;
}
