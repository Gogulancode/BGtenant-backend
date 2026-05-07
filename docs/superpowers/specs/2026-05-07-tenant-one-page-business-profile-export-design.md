# Tenant One-Page Business Profile Export Design

## Goal
Give tenant users a polished, one-page business profile after onboarding, sales planning, activity setup, achievement stages, and CRM setup. The profile should be useful for review, sharing, and printing to PDF from the browser.

## Current State
The Reports page currently focuses on weekly/monthly report generation and calls a backend endpoint that returns a mock download URL. The data needed for a business profile already exists across onboarding, sales planning, activity configuration, sales prospects, achievement stages, business setup, and business snapshot models, but it is not assembled into a single end-user output.

## Recommended Approach
Add a tenant-scoped backend endpoint that aggregates the profile data into one report-shaped JSON response, then render a polished printable report in the frontend Reports page. The browser print dialog will provide the first production export path through "Print / Save as PDF" without adding a heavy server-side PDF rendering dependency.

## Backend Design
Create `GET /api/v1/reports/business-profile`.

The endpoint will:
- Require tenant context.
- Allow all tenant member roles to view their tenant profile.
- Aggregate tenant, current user, business identity, business setup checklist, sales plan, activity configuration, sales prospects, achievement stages, and business snapshot data.
- Return calculated CRM summary values including total prospects, pipeline value, converted value, active follow-ups, and counts by status.
- Return report metadata with `generatedAt`.
- Record an audit action for profile report viewing.

## Frontend Design
Update the Reports page so the primary experience is the one-page business profile preview.

The page will:
- Fetch the business profile report through React Query.
- Show loading and error states.
- Render a structured one-page preview with sections for business identity, sales plan, activity engine, CRM pipeline, and achievement roadmap.
- Provide a refresh button and a print/export button using `window.print()`.
- Keep the old weekly/monthly report generator as a secondary section.

## Export Behavior
The production export path for this slice is browser-native print/save as PDF. This is reliable for users, works without server-side rendering infrastructure, and avoids shipping another mock download link.

## Testing
Backend unit tests will verify that the report aggregates tenant-scoped profile data, computes CRM totals correctly, and records an audit action. Build verification will cover the frontend TypeScript and production bundle.
