# Tenant Today Execution Workspace Design

## Goal
Make the Today page the place where users actually execute the product loop: complete weekly outcomes, log weekly sales, act on configured business-development activities, follow up with CRM prospects, log daily metrics, and reflect.

## Current State
The Today page currently supports momentum, weekly outcomes, metric quick logging, sales progress display, and reflection. It does not yet use the new cockpit/dashboard data, does not expose weekly sales logging, does not show configured activity templates due today, and does not surface CRM follow-ups as daily work.

## Recommended Approach
Keep the Today page as a single daily execution workspace and connect it to the existing dashboard cockpit summary. Add frontend API helpers for activity creation/update and use the existing weekly sales entry endpoint for weekly sales logging.

## Backend Design
No new models are required. Activity creation and update should allow tenant contributor roles so staff users can log and complete their own execution activities. Activity deletion remains leadership-only.

## Frontend Design
The Today page will contain:
- Header with greeting, date, and a refresh action.
- Momentum and weekly execution summary from `dashboard.cockpit`.
- Sales log card for current week achieved amount, order count, and notes.
- Activity execution card showing configured activities due today plus current week activity progress.
- CRM follow-up card showing warm/hot prospects from cockpit.
- Weekly outcomes card with checkboxes.
- Quick metric log card.
- Daily reflection card.

## Testing
Backend role changes will be covered by build verification. Frontend behavior will be verified by production build because the frontend project has no test runner configured.
