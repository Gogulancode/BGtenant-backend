import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { MAX_ONBOARDING_STEPS } from "./onboarding-progress-response.dto";

/**
 * Valid onboarding step identifiers.
 * These correspond to key milestones in the tenant onboarding flow.
 */
export enum OnboardingStep {
  PROFILE = "PROFILE",
  BUSINESS_IDENTITY = "BUSINESS_IDENTITY",
  SALES_PLAN = "SALES_PLAN",
  ACTIVITY_CONFIG = "ACTIVITY_CONFIG",
  SALES_CYCLE = "SALES_CYCLE",
  ACHIEVEMENT_STAGES = "ACHIEVEMENT_STAGES",
  SUBSCRIPTION = "SUBSCRIPTION",
  VISUAL_SETUP = "VISUAL_SETUP",
}

/**
 * Mapping of step enum to step number
 */
export const STEP_TO_NUMBER: Record<OnboardingStep, number> = {
  [OnboardingStep.PROFILE]: 1,
  [OnboardingStep.BUSINESS_IDENTITY]: 2,
  [OnboardingStep.SALES_PLAN]: 3,
  [OnboardingStep.ACTIVITY_CONFIG]: 4,
  [OnboardingStep.SALES_CYCLE]: 5,
  [OnboardingStep.ACHIEVEMENT_STAGES]: 6,
  [OnboardingStep.SUBSCRIPTION]: 7,
  [OnboardingStep.VISUAL_SETUP]: 8,
};

export class UpdateOnboardingDto {
  @ApiPropertyOptional({
    description: "Current step number in the onboarding flow (1-based)",
    example: 2,
    minimum: 1,
    maximum: MAX_ONBOARDING_STEPS,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: "currentStep must be at least 1" })
  @Max(MAX_ONBOARDING_STEPS, {
    message: `currentStep must not exceed ${MAX_ONBOARDING_STEPS}`,
  })
  currentStep?: number;

  @ApiPropertyOptional({
    description:
      "Step identifier to mark as completed",
    example: "PROFILE",
    enum: OnboardingStep,
  })
  @IsOptional()
  @IsEnum(OnboardingStep, {
    message:
      "completedStep must be one of: PROFILE, BUSINESS_IDENTITY, SALES_PLAN, ACTIVITY_CONFIG, SALES_CYCLE, ACHIEVEMENT_STAGES, SUBSCRIPTION, VISUAL_SETUP",
  })
  completedStep?: OnboardingStep;

  @ApiPropertyOptional({
    description: "Whether the entire onboarding flow is completed",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
