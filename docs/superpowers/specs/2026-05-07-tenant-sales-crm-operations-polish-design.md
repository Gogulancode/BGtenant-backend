# Tenant Sales CRM Operations Polish Design

## Goal
Make the tenant Sales page feel like the primary place to operate the monthly CRM pipeline: review status health, identify stale follow-ups, move prospects through the funnel, and keep downstream Dashboard and Report data fresh.

## Current Context
The tenant app already has a `SalesProspectsPanel` backed by `/api/v1/sales/prospects` and `/api/v1/sales/prospects/summary`. It captures the wireframe fields for month, first call, prospect, mobile number, offering type, proposal value, referral source, last follow-up, funnel status, reason, and remarks.

The main gaps are operational:
- The Sales page opens on planning/tracking, so CRM work is one tab away.
- Users must open the edit dialog for simple daily actions such as marking a prospect warm, hot, converted, or followed up.
- The summary shows totals, but not a clear status board or follow-up hygiene view.
- Prospect mutations refresh the CRM list only, leaving Dashboard and Business Profile report caches stale until a manual refresh.
- The backend `activeFollowUps` definition counts any cold/warm/hot prospect that has a follow-up date, while the product cockpit treats warm/hot prospects as active follow-ups.

## Design
Sales should open on the CRM pipeline by default and label the second tab as planning and weekly trends. This keeps Sales focused on revenue operations while preserving the existing weekly planning tools.

The CRM panel will add an operations strip above the table:
- Status board cards for Cold, Warm, Hot, Converted, and Rejected.
- Conversion rate from converted prospects over total prospects.
- Pipeline coverage using current pipeline value over converted value as a lightweight health signal when a monthly target is unavailable in this panel.
- Reset filters control when any filter is active.

The prospect table will keep all wireframe fields, but add an operational "Next action" column:
- Show "Needs follow-up" for active cold/warm/hot prospects without a follow-up date.
- Show "Follow-up overdue" when the last follow-up is older than seven days.
- Show the last follow-up date for healthy active prospects.
- Show "Closed" for converted or rejected prospects.

The row action area will include safe quick actions:
- `Followed up today` sets `lastFollowUpAt` to the current date.
- `Mark warm`, `Mark hot`, and `Mark converted` advance the funnel without opening the edit dialog.
- Existing edit and delete flows remain available for detailed changes.

Backend summary will align `activeFollowUps` to the product cockpit definition: warm or hot prospects in the selected month. Cold prospects remain visible in the status board but are not counted as active follow-ups.

## Data Flow
The existing prospect create/update/delete endpoints remain the write surface. Frontend mutation hooks will invalidate:
- `["sales", "prospects"]`
- `["dashboard-summary"]`
- `["reports", "business-profile"]`

This keeps Sales, Dashboard, and the One-Page Business Profile in sync after CRM changes.

## Error Handling
Quick actions use the existing update mutation. Success toasts identify the action taken. Failures show a destructive toast with the API error message when available.

## Testing
Backend service test coverage will be updated first for the active follow-up summary contract. Verification will run the targeted sales prospect service test, backend build, frontend build, and local route health checks for `/sales`.
