# Tenant Coaching Guidance Design

## Purpose

Add a proactive guidance layer that makes the tenant web and mobile app feel like an encouraging business coach. The product should not present this as an AI chatbot. Users should feel the system understands their business setup, goals, sales rhythm, CRM pipeline, and daily activity habits, then gives clear next steps.

## Product Positioning

The feature is branded in-product as coaching guidance, not AI. Recommended labels:

- Today's Focus
- Momentum Coach
- Next Best Action
- Growth Signals
- Business Health

The tone should be encouraging, practical, and direct. It should sound like a founder coach helping the user keep momentum, not like a technical assistant.

The approved tone is hybrid: supportive like a fitness coach, but specific like a business consultant. The coach should never stop at encouragement. Every prompt should include a clear business action the user can take now.

Example:

> You're 48% toward this month's sales target. Two strong follow-ups today can keep the week on track.

Avoid:

> AI recommends that you create two follow-up activities.

## Interaction Model

The coach should follow one consistent pattern across web and mobile:

1. Next action: one short instruction, such as "Add 3 warm prospects this week."
2. Why it matters: one data-backed reason, such as "You are 48% toward this month's sales target."
3. Do it now: a primary action that routes directly to the correct screen.
4. After-save feedback: a short confirmation that explains what changed and what to do next.
5. Weekly journey: a visible growth stage that makes business progress feel continuous.

This makes the product interactive without becoming a chatbot. A new business owner should always know what the app expects them to do next.

## Business Fitness Journey

The coach should frame progress as a simple operating journey:

- Foundation: complete profile, business identity, sales plan, and activity rhythm.
- Rhythm: log weekly sales and daily/weekly activities.
- Pipeline: add prospects, follow-ups, and proposal values.
- Growth: close the sales gap, improve conversion, and increase repeatable activity.
- Scale: review reports, refine targets, add users, and strengthen operating cadence.

The journey is not a separate module at first. It is a shared label and progress signal used by dashboard, Today, setup, profile, sales, and reports. The current stage should be derived from existing data, not manually selected by the user.

## Coach Rules

The first production version should prioritize rules in this order:

1. If onboarding is incomplete, guide the next missing setup section.
2. If setup is complete but no weekly sales entry exists, ask the user to log weekly sales.
3. If sales progress is below plan, ask for specific CRM or follow-up action.
4. If CRM has no prospects, ask the user to add the first 3 prospects.
5. If CRM has warm or hot prospects, surface the next follow-up.
6. If activity rhythm is behind, ask the user to log one useful activity today.
7. If the one-page profile is ready, prompt the user to review/share it.
8. If the week is healthy, celebrate and suggest a growth action.

Each rule must produce a card with an action route. Passive advice should be avoided unless it is attached to a concrete next step.

## Recommended Approach

Use rule-based coaching as the source of truth first, with an optional AI wording layer later.

The rule engine is the primary implementation because it is reliable, free, testable, and safe for production. It calculates coaching signals from existing product data. An optional AI provider can later rewrite messages in a warmer style, but it must never be required for the feature to work.

Alternative approaches considered:

- Pure AI assistant: more flexible, but risky for cost, consistency, privacy, and production reliability.
- Static empty-state tips only: simple, but does not feel personal enough for this product.
- Rule engine plus optional AI wording: best balance of usefulness, reliability, cost control, and client-demo polish.

## Coaching Inputs

The first version should use only data already available in the tenant product:

- Onboarding completion and missing setup sections
- Monthly sales target, weekly sales logs, ASP/ATS, expected leads, conversion ratio
- Existing versus new customer contribution
- CRM prospects by status, overdue follow-ups, next follow-up date
- Activity rhythm, overdue actions, today's actions, weekly completion trend
- One-page business profile readiness
- Support or system status only if it affects the user's workflow

## Backend Design

Add a tenant-authenticated guidance endpoint:

```http
GET /api/v1/dashboard/guidance
```

Response shape:

```json
{
  "summary": {
    "title": "Close the sales gap",
    "message": "You are 48% toward this month's target. Add two follow-ups today to protect the week.",
    "tone": "encouraging",
    "healthScore": 72,
    "journeyStage": "Pipeline"
  },
  "cards": [
    {
      "id": "sales-gap-followups",
      "type": "next_action",
      "priority": "high",
      "title": "Close the sales gap",
      "message": "You are 48% toward this month's target. Two strong calls today can improve the forecast.",
      "why": "Follow-ups are the fastest action connected to this week's sales gap.",
      "actionLabel": "Add follow-up",
      "actionRoute": "/activities/new",
      "source": "sales"
    }
  ],
  "signals": [
    {
      "key": "monthly_target_progress",
      "label": "Monthly target progress",
      "value": 48,
      "unit": "percent",
      "status": "watch"
    }
  ]
}
```

The service should be deterministic and testable. Each guidance card should come from a named rule, such as `missingOnboarding`, `missingWeeklySalesEntry`, `salesTargetGap`, `overdueFollowups`, `activityRhythmDrop`, `emptyCrm`, `profileReady`, or `healthyWeek`.

The API can add new optional fields without breaking current clients:

- `journeyStage`: current operating stage.
- `why`: short data-backed reason for a card.
- `impactMetric`: optional metric affected by the action, such as `sales_gap`, `activity_rhythm`, or `crm_pipeline`.
- `afterActionMessage`: optional success copy shown by the UI after a save completes.

If an AI provider is added later, it should receive only a minimal summary of signals, not raw customer-sensitive data. If the provider fails, the endpoint returns the rule-generated wording.

## Web Design

Tenant web should show coaching as a dashboard layer:

- Dashboard top area: next best action card with one primary action, one reason, and current journey stage
- Today/Execution page: Momentum Coach cards next to due actions
- Sales page: coaching prompt near target progress and weekly sales entry
- CRM page: next best follow-up prompt and empty-state guidance
- Reports/Profile page: readiness prompt for the one-page business profile

The web experience can be slightly more analytical than mobile, but still encouraging.

After a user saves onboarding, logs sales, adds a prospect, or adds an activity, the relevant page should show a success prompt such as:

> Good. Your sales progress moved from 42% to 52%. Next, schedule one follow-up.

## Mobile Design

Mobile should make coaching feel immediate and habit-forming:

- Today tab: next best action, due today, momentum prompts, and journey stage
- Setup completion flow: guided encouragement after each completed section
- Sales entry: simple prompt explaining why the entry matters
- Activity entry: suggest the next useful action based on overdue or missing rhythm
- Profile tab: Business Health and next improvement area

The first version should use cards, progress states, and direct actions, not a chatbot screen. A chatbot-style interface can be considered only after the core guidance works.

Mobile visual style should be warm, colorful, and animated, but the copy must remain business-specific. Good mobile prompts:

- "Your next move: add 3 warm prospects."
- "You logged sales. Now close the loop with one follow-up."
- "Setup is complete. This week is about rhythm."

## Error Handling

If source data is missing, return useful starter guidance instead of an error. For example, if no CRM prospects exist, the guidance should suggest adding the first three prospects.

If partial data fails to load, return available cards and include a low-priority system card only when the user can act on it. API failures should be logged server-side without exposing technical details in the UI.

## Security And Privacy

The endpoint must be tenant-scoped and require normal tenant authentication. It must not expose cross-tenant data. If optional AI wording is added, the backend must redact or summarize sensitive customer names, emails, phone numbers, and support details before sending data to any external provider.

Configuration should use environment variables:

- `AI_COACH_PROVIDER`
- `AI_COACH_API_KEY`
- `AI_COACH_ENABLED`

Default behavior is rule-based with AI disabled.

## Testing

Backend tests should cover:

- Authenticated tenant can fetch guidance
- Unauthenticated request is rejected
- Guidance is scoped to the current tenant
- Missing onboarding creates setup guidance
- Sales gap creates sales guidance
- Overdue CRM follow-up creates CRM guidance
- Empty CRM creates starter guidance
- Activity rhythm drop creates activity guidance
- Missing weekly sales entry creates log-sales guidance
- Healthy week creates celebration and growth guidance
- Journey stage is derived correctly from setup, sales, CRM, and activity data
- Rule fallback still works when AI is disabled or fails

Frontend and mobile tests should cover:

- Guidance cards render from API data
- Empty guidance state is friendly
- Primary action routes to the correct screen
- After-save feedback appears after onboarding, sales, prospect, and activity saves
- Journey stage is displayed without blocking normal workflows
- Loading and API error states do not block the rest of the page

## Rollout

Phase 1: Backend rule engine and endpoint with journey stage, why text, and after-action messages.

Phase 2: Tenant web dashboard, Today, sales, CRM, and reports guidance cards.

Phase 3: Mobile Today, setup, sales, activity, and profile guidance cards with animated premium styling.

Phase 4: Optional AI wording provider behind feature flag.

This keeps the product useful immediately while allowing AI enhancement later without creating dependency risk.
