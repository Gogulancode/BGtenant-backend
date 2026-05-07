# Tenant Dashboard Operating Cockpit Design

## Goal
Turn the tenant dashboard into the user's daily operating cockpit: what to do now, where sales stand this week, which CRM follow-ups matter, and how current execution connects to the achievement roadmap.

## Current State
The Dashboard page shows general accountability KPIs, a first-week checklist, business setup card, and static chart data. The backend dashboard summary already aggregates several module summaries, but it does not yet package product-specific cockpit data from the newer onboarding, sales planning, activity setup, CRM, and achievement roadmap flows.

## Recommended Approach
Extend the existing `GET /api/v1/dashboard/summary` response with a `cockpit` object. The frontend will use that single response as the main dashboard data source and render action-oriented sections rather than static demo charts.

## Backend Design
Add dashboard cockpit aggregation to `DashboardService.getSummary`.

The `cockpit` object will include:
- `userName` for the greeting.
- `setup`: business setup completion status and next action.
- `sales`: weekly and monthly targets, actuals, gap, and pacing.
- `activities`: weekly target, actual completion, reminder days, and due-today configured activity templates.
- `outcomes`: planned, completed, and completion percentage for the current week.
- `crm`: prospect totals, pipeline value, converted value, active follow-ups, and top follow-up prospects.
- `achievement`: current and next achievement stage based on current month progress.

The existing summary fields remain for compatibility with other pages.

## Frontend Design
Replace the static-dashboard layout with an operating cockpit:
- Header with greeting and primary quick actions.
- Top row: weekly sales gap, activity completion, outcomes completion, CRM follow-ups.
- "Today's Focus" section with activities due today and CRM follow-ups.
- "Execution Pulse" section using real weekly sales/activity/outcome values.
- "Roadmap" section showing current and next achievement stages.
- Keep setup assistance for incomplete users.

## Testing
Add a backend unit test that verifies the cockpit response is assembled from existing module summaries and Prisma-backed tenant setup data. Frontend verification will rely on production build because the existing frontend project has no test runner configured.
