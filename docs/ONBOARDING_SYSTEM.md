# Comprehensive Onboarding System

## Overview

The Business Accountability Platform now includes a comprehensive 8-step onboarding flow that guides new tenants through setting up their workspace. This system ensures all required configuration is captured before users can fully utilize the platform.

## Database Schema

### New Models Added

1. **BusinessIdentity** - Company/business details (Step 2)
2. **SalesPlan** - 3-year historical data + projections with monthly targets (Step 3)
3. **ActivityConfiguration** - Development activity tracking setup (Step 4)
4. **SalesCycleStage** - Custom sales pipeline stages (Step 5)
5. **AchievementStage** - Target milestone stages (Step 6)

### Extended Models

1. **User** - Added profile fields: `age`, `gender`, `maritalStatus`, `businessDescription`, `socialHandles`
2. **OnboardingProgress** - Added step completion flags and `selectedPlan`

### New Enums

- `Gender` - MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
- `MaritalStatus` - SINGLE, MARRIED, DIVORCED, WIDOWED, PREFER_NOT_TO_SAY
- `CompanyType` - SOLE_PROPRIETORSHIP, PARTNERSHIP, LLC, CORPORATION, NON_PROFIT, COOPERATIVE, OTHER
- `Industry` - TECHNOLOGY, HEALTHCARE, FINANCE, RETAIL, MANUFACTURING, EDUCATION, REAL_ESTATE, HOSPITALITY, CONSULTING, MARKETING, CONSTRUCTION, TRANSPORTATION, AGRICULTURE, ENTERTAINMENT, OTHER
- `TurnoverBand` - UNDER_1L through ABOVE_10CR
- `EmployeeRange` - SOLO, MICRO, SMALL, MEDIUM, LARGE, ENTERPRISE

## Onboarding Steps

### Step 1: Profile Setup
**Endpoint:** `PATCH /api/v1/onboarding/profile`

Captures user personal information and basic business details:
- Name (required)
- Age (optional, 18-120)
- Gender (optional)
- Marital Status (optional)
- Business Type (required: Solopreneur, Startup, MSME)
- Business Description (optional)
- Social Handles (optional: LinkedIn, Twitter, Instagram, Facebook, Website)

### Step 2: Business Identity
**Endpoint:** `PUT /api/v1/onboarding/business-identity`

Captures company/business information:
- Company Name
- Company Type (LLC, Corporation, etc.)
- Industry (required)
- Industry Other (for custom industries)
- Founded Year
- Turnover Band
- Employee Range
- Website
- Description

### Step 3: Sales Planning
**Endpoint:** `PUT /api/v1/onboarding/sales-plan`

Captures historical and projected revenue:
- Year Minus 3 Value (optional)
- Year Minus 2 Value (optional)
- Year Minus 1 Value (optional)
- Projected Year Value (required)
- Monthly Contribution (required, 12 values summing to ~100% ±1%)
- Monthly Targets (auto-calculated)

**Validation:**
- `monthlyContribution` must have exactly 12 values
- Values must sum to 100% (with ±1% tolerance)
- All values must be non-negative

**Calculation:**
```
monthlyTargets[i] = projectedYearValue * (monthlyContribution[i] / 100)
```

### Step 4: Activity Setup
**Endpoint:** `PUT /api/v1/onboarding/activity-setup`

Configures activity tracking preferences:
- Sales Enabled (default: true)
- Marketing Enabled (default: true)
- Networking Enabled (default: true)
- Product Dev Enabled (default: true)
- Operations Enabled (default: true)
- Weekly Activity Goal (default: 5, range: 1-50)
- Enable Reminders (default: true)
- Reminder Days (default: [1, 3, 5] = Mon, Wed, Fri)

### Step 5: Sales Cycle Setup
**Endpoint:** `PUT /api/v1/onboarding/sales-cycle`

Configures custom sales pipeline:
- Minimum 2 stages, maximum 10 stages
- Each stage has: name, order, color (hex), description, probability (0-100)
- Orders must be unique

**Default Stages Available:**
- POST `/api/v1/onboarding/sales-cycle/defaults` creates:
  - Lead (10% probability)
  - Qualified (25% probability)
  - Proposal (50% probability)
  - Negotiation (75% probability)
  - Closed Won (100% probability)

### Step 6: Achievement Stages
**Endpoint:** `PUT /api/v1/onboarding/achievement-stages`

Configures milestone/reward stages:
- Minimum 2 stages, maximum 10 stages
- Each stage has: name, order, targetValue, percentOfGoal, color (hex), icon, reward

**Example:**
```json
{
  "stages": [
    { "name": "Bronze", "order": 1, "targetValue": 375000, "percentOfGoal": 25 },
    { "name": "Silver", "order": 2, "targetValue": 750000, "percentOfGoal": 50 },
    { "name": "Gold", "order": 3, "targetValue": 1125000, "percentOfGoal": 75 },
    { "name": "Platinum", "order": 4, "targetValue": 1500000, "percentOfGoal": 100 }
  ]
}
```

### Step 7: Subscription Selection
**Endpoint:** `PUT /api/v1/onboarding/subscription`

Selects subscription plan:
- FREE: 1 user, 5 metrics, 20 activities
- STARTER: 3 users, 10 metrics, 50 activities (₹499/month)
- PROFESSIONAL: 10 users, 25 metrics, 100 activities (₹999/month)
- ENTERPRISE: 100 users, 100 metrics, 500 activities (Custom pricing)

### Step 8: Complete Onboarding
**Endpoint:** `POST /api/v1/onboarding/complete`

Validates all required steps are complete and:
1. Creates actual subscription based on selected plan
2. Marks tenant as onboarded (`isOnboarded = true`)
3. Returns final progress with completion timestamp

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /onboarding | Get onboarding progress |
| PATCH | /onboarding | Update progress (step, completedStep) |
| PATCH | /onboarding/profile | Update profile (Step 1) |
| GET | /onboarding/business-identity | Get business identity |
| PUT | /onboarding/business-identity | Update business identity (Step 2) |
| GET | /onboarding/sales-plan | Get sales plan |
| PUT | /onboarding/sales-plan | Update sales plan (Step 3) |
| GET | /onboarding/activity-setup | Get activity configuration |
| PUT | /onboarding/activity-setup | Update activity config (Step 4) |
| GET | /onboarding/sales-cycle | Get sales cycle stages |
| PUT | /onboarding/sales-cycle | Replace sales cycle (Step 5) |
| POST | /onboarding/sales-cycle/defaults | Create default sales cycle |
| GET | /onboarding/achievement-stages | Get achievement stages |
| PUT | /onboarding/achievement-stages | Replace achievement stages (Step 6) |
| GET | /onboarding/subscription | Get selected subscription |
| PUT | /onboarding/subscription | Select subscription (Step 7) |
| POST | /onboarding/complete | Complete onboarding (Step 8) |

## Validation Rules

### Step Skipping Prevention
- Users cannot skip ahead more than one step
- Users CAN go back to any previous step to update data
- Completing a step automatically advances `currentStep` by 1

### Required Steps for Completion
All of these must be true before calling `/complete`:
- `profileCompleted`
- `businessIdentityCompleted`
- `salesPlanCompleted`
- `activityConfigCompleted`
- `salesCycleCompleted`
- `achievementStagesCompleted`
- `subscriptionCompleted`

## Response Structure

### Progress Response
```typescript
{
  id: string;
  tenantId: string;
  currentStep: number;           // 1-8
  stepsCompleted: string[];      // ["PROFILE", "BUSINESS_IDENTITY", ...]
  isCompleted: boolean;
  completedAt: Date | null;
  stepFlags: {
    profileCompleted: boolean;
    businessIdentityCompleted: boolean;
    salesPlanCompleted: boolean;
    activityConfigCompleted: boolean;
    salesCycleCompleted: boolean;
    achievementStagesCompleted: boolean;
    subscriptionCompleted: boolean;
    visualSetupCompleted: boolean;
  };
  selectedPlan?: SubscriptionPlan;
  stepTitles: Record<string, string>;
  totalSteps: number;            // 8
  createdAt: Date;
  updatedAt: Date;
}
```

## E2E Test Coverage

51 tests covering:
- Progress tracking (GET/PATCH /onboarding)
- Profile updates (PATCH /onboarding/profile)
- Business identity (GET/PUT /onboarding/business-identity)
- Sales plan with monthly contribution validation (GET/PUT /onboarding/sales-plan)
- Activity configuration (GET/PUT /onboarding/activity-setup)
- Sales cycle stages (GET/PUT/POST /onboarding/sales-cycle)
- Achievement stages (GET/PUT /onboarding/achievement-stages)
- Subscription selection (GET/PUT /onboarding/subscription)
- Onboarding completion (POST /onboarding/complete)
- Tenant isolation
- Role-based access

## Migration

A Prisma migration was created:
```
prisma/migrations/20251130104731_add_comprehensive_onboarding_models/
```

Run with:
```bash
npx prisma migrate dev
```

## API Version

The onboarding endpoints are part of API v1.0.0 at `/api/v1/onboarding/*`.
