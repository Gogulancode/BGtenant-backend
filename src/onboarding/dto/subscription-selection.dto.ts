import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';

export class SubscriptionSelectionDto {
  @ApiProperty({
    description: 'Selected subscription plan',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.STARTER,
  })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}

export class SubscriptionSelectionResponseDto {
  @ApiProperty({
    description: 'Selected plan stored in onboarding progress',
    enum: SubscriptionPlan,
  })
  selectedPlan: SubscriptionPlan;

  @ApiProperty({
    description: 'Plan features description',
    type: Object,
  })
  planFeatures: {
    maxUsers: number;
    maxMetrics: number;
    maxActivities: number;
    features: string[];
    price: string;
  };
}

/**
 * Subscription plan features mapping
 */
export const PLAN_FEATURES: Record<
  SubscriptionPlan,
  {
    maxUsers: number;
    maxMetrics: number;
    maxActivities: number;
    features: string[];
    price: string;
  }
> = {
  [SubscriptionPlan.FREE]: {
    maxUsers: 1,
    maxMetrics: 5,
    maxActivities: 20,
    features: [
      'Basic dashboard',
      'Weekly outcomes tracking',
      'Basic insights',
    ],
    price: '₹0/month',
  },
  [SubscriptionPlan.STARTER]: {
    maxUsers: 3,
    maxMetrics: 10,
    maxActivities: 50,
    features: [
      'Everything in Free',
      'Team collaboration (up to 3)',
      'Advanced metrics',
      'Sales tracking',
      'Email reminders',
    ],
    price: '₹499/month',
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    maxUsers: 10,
    maxMetrics: 25,
    maxActivities: 100,
    features: [
      'Everything in Starter',
      'Team collaboration (up to 10)',
      'Custom sales pipeline',
      'Achievement milestones',
      'Priority support',
      'API access',
    ],
    price: '₹999/month',
  },
  [SubscriptionPlan.ENTERPRISE]: {
    maxUsers: 100,
    maxMetrics: 100,
    maxActivities: 500,
    features: [
      'Everything in Professional',
      'Unlimited team members',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom reporting',
      'White-label options',
    ],
    price: 'Custom pricing',
  },
};
