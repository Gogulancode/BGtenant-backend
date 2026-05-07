# Tenant Sales Cycle CRM Design

**Goal:** Complete the Excel wireframe's Sales Cycle requirement as a production tenant feature.

**Decision:** Use `D:\BGAccountabiityapp` as the single backend for this phase. The tenant frontend in `D:\bridge-gaps-dashboard-main` will call new `/api/v1/sales/prospects` endpoints from the existing API.

## Scope

This phase implements the Sales Cycle Closure / Conversion Ratio sheet as a real prospect/deal tracker. It does not modify the separate `D:\superadmin-backend` project. It does not implement billing, Google Calendar, media uploads, or community rankings; those are separate production tracks.

## User Experience

The tenant Sales page gets a new `Prospects` tab. Users can create, edit, filter, and delete prospect records. Each record includes month, first call date, prospect name, mobile number, product/service type, proposal value, referral source, last follow-up date, funnel status, reason, and remarks.

Statuses are `COLD`, `WARM`, `HOT`, `CONVERTED`, and `REJECTED`. Reasons are `BUDGET`, `AUTHORITY`, `NEED`, `TIMELINE`, `AVAILABILITY`, `CLOSURE`, and `OTHER`.

## Backend Design

Add a `SalesProspect` Prisma model scoped by `tenantId` and `userId`. The API follows existing tenant auth and RBAC patterns in the sales module.

Endpoints:

- `GET /api/v1/sales/prospects`
- `POST /api/v1/sales/prospects`
- `GET /api/v1/sales/prospects/:id`
- `PATCH /api/v1/sales/prospects/:id`
- `DELETE /api/v1/sales/prospects/:id`
- `GET /api/v1/sales/prospects/summary`

The list endpoint supports filtering by month, status, reason, search, and pagination. All queries enforce tenant isolation.

## Frontend Design

Add typed API functions and React Query hooks for prospects. Add a focused `SalesProspectsPanel` component under `src/components/sales`. Integrate it into the Sales page as a tab so the large existing sales page does not absorb all CRM logic.

The UI uses a dense operational table, filters, a create/edit dialog, status badges, and summary cards for pipeline value, converted value, active follow-ups, and rejection counts.

## Testing

Backend tests cover tenant isolation, CRUD, filter behavior, enum validation, summary calculations, and delete authorization. Frontend verification requires Vite production build and browser/manual smoke of the Sales prospects tab after the dev server is running.

## Production Acceptance Criteria

- Backend and frontend compile.
- Existing stale unit test failures are either fixed or documented before release.
- Prospects are persisted in PostgreSQL through Prisma.
- Tenant users cannot access another tenant's prospects.
- Excel wireframe fields are represented in the UI.
- Blank/empty states are graceful and not mock data.
- The feature has no dependency on `D:\superadmin-backend`.
