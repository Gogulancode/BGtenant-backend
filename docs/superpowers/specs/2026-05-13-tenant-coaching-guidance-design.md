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

Example:

> You're 48% toward this month's sales target. Two strong follow-ups today can keep the week on track.

Avoid:

> AI recommends that you create two follow-up activities.

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
    "title": "Today's Focus",
    "message": "Protect the week by closing two follow-ups today.",
    "tone": "encouraging",
    "healthScore": 72
  },
  "cards": [
    {
      "id": "sales-gap-followups",
      "type": "next_action",
      "priority": "high",
      "title": "Close the sales gap",
      "message": "You're 48% toward this month's target. Two strong calls today can improve the forecast.",
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

The service should be deterministic and testable. Each guidance card should come from a named rule, such as `missingOnboarding`, `salesTargetGap`, `overdueFollowups`, `activityRhythmDrop`, `emptyCrm`, or `profileReady`.

If an AI provider is added later, it should receive only a minimal summary of signals, not raw customer-sensitive data. If the provider fails, the endpoint returns the rule-generated wording.

## Web Design

Tenant web should show coaching as a dashboard layer:

- Dashboard top area: Today's Focus card with one primary action
- Today/Execution page: Momentum Coach cards next to due actions
- Sales page: coaching prompt near target progress and weekly sales entry
- CRM page: next best follow-up prompt and empty-state guidance
- Reports/Profile page: readiness prompt for the one-page business profile

The web experience can be slightly more analytical than mobile, but still encouraging.

## Mobile Design

Mobile should make coaching feel immediate and habit-forming:

- Today tab: Today's Focus, Due Today, Momentum Prompts
- Setup completion flow: guided encouragement after each completed section
- Sales entry: simple prompt explaining why the entry matters
- Activity entry: suggest the next useful action based on overdue or missing rhythm
- Profile tab: Business Health and next improvement area

The first version should use cards and prompts, not a chatbot screen. A chatbot-style interface can be considered only after the core guidance works.

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
- Rule fallback still works when AI is disabled or fails

Frontend and mobile tests should cover:

- Guidance cards render from API data
- Empty guidance state is friendly
- Primary action routes to the correct screen
- Loading and API error states do not block the rest of the page

## Rollout

Phase 1: Backend rule engine and endpoint.

Phase 2: Tenant web dashboard, sales, CRM, and reports guidance cards.

Phase 3: Mobile Today, setup, sales, activity, and profile guidance cards.

Phase 4: Optional AI wording provider behind feature flag.

This keeps the product useful immediately while allowing AI enhancement later without creating dependency risk.
