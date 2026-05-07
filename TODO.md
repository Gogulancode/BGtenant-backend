# Project Status

## Phase 3 Hardening TODO (Nov 14, 2025)

> **Note:** All superadmin / platform helper functionality (tenant provisioning, global RBAC, platform ops) now lives in the separate `superadmin-app` repo. The backend in this workspace no longer exposes those routes, so the remaining hardening items here focus strictly on tenant-scoped APIs.


1. [x] Validation / RBAC stragglers – close remaining auth gaps before touching any other tracks.
	- [x] Superadmin platform helper routes handled in `superadmin-app` (this Nest backend no longer exposes `src/platform/tenants/*`).
	- [x] Require tenant member roles on legacy settings endpoints so preferences cannot be called anonymously or by super admins (`src/settings/settings.controller.ts`).
	- [x] Decorate tenant-user self-service endpoints ahead of upcoming CRUD expansion to ensure `RolesGuard` is always engaged (`src/user/user.controller.ts`).
2. [x] Automation enhancements – wire remaining observability + ops surfaces.
	- [x] Weekly executive digest cron sends KPI emails + telemetry (`src/reports/report-digest.service.ts`, `src/notifications/email.service.ts`).
	- [x] Insight refresh job emits telemetry + ops dashboard endpoint exposes flag/momentum stats (`src/insights/insights.service.ts`, `src/ops/ops.controller.ts`).
	- [x] Rate-limit & audit-log exposure surfaced through new ops routes with tenant-aware action logging (`src/common/middleware/action-logging.middleware.ts`, `src/ops/ops.service.ts`).
3. [x] Testing depth – integration coverage + baseline contract suites.
	- [x] Insights cron automation covered with in-memory Prisma + telemetry assertions (`test/insights-cron.e2e-spec.ts`).
	- [x] Outcome template CRUD flow verified end-to-end with action-log expectations (`test/templates.integration.spec.ts`).
	- [x] Dashboard summary contract locked via dedicated suite to guard client payload shape (`test/contracts/dashboard-contract.spec.ts`).
4. [x] Observability & docs – Swagger surface area for telemetry routes, structured audit-log surfacing, and dashboard/alert wiring for telemetry signals.
	- [x] Added typed DTOs plus Swagger response/query metadata for Ops telemetry, rate-limit, and audit-log routes (`src/ops/dto/ops.dto.ts`, `src/ops/ops.controller.ts`).
	- [x] Serialized audit logs for downstream ingestion and documented all observability flows (`src/ops/ops.service.ts`, `OBSERVABILITY_GUIDE.md`).
5. [x] Tenant-ready ops – tenant-specific rate limiting, invitation email delivery, onboarding automation, and password/MFA baseline policies.
	- [x] Tenant-aware throttler guard w/ subscription-based limits + ops visibility (`src/common/rate-limit/tenant-rate-limit.service.ts`, `src/common/guards/tenant-throttler.guard.ts`, `src/app.module.ts`).
	- [x] Automated onboarding seeds + invite acceptance workflows with checklist mailers (`src/onboarding/onboarding.service.ts`, `src/auth/auth.service.ts`).
	- [x] Strong password enforcement + MFA enrollment/verification endpoints (`src/auth/password-policy.service.ts`, `src/auth/mfa.service.ts`, `src/auth/auth.controller.ts`).

## Completed

- Initial project structure setup with NestJS.
- Prisma setup with PostgreSQL.
- JWT-based authentication.

## Module Status

### Auth
- [ ] Registration
- [ ] Login
- [ ] JWT Token Generation
- [ ] Refresh Token

### User
- [ ] User Profile Management

### Business
- [ ] Onboarding Snapshot
- [ ] NSM Suggestions

### Metrics
- [ ] Create Metric
- [ ] Log Metric

### Outcomes
- [ ] Create Weekly Outcome
- [ ] Track Outcome

### Reviews
- [ ] Daily Review
- [ ] Weekly Review

### Sales
- [ ] Quarterly Sales Planning
- [ ] Monthly Sales Tracking

### Activities
- [ ] Task Management

### Insights
- [ ] Momentum Scoring
- [ ] Flags
- [ ] Streaks

### Settings
- [ ] User Preferences

## Pending

- [ ] Implement refresh token rotation.
- [x] Implement automated insights calculation.
	- Added tenant-scoped automation snapshot (momentum, streaks, trends, execution summaries) plus hourly cron and Jest suites.
- [x] Implement carry-forward of missed outcomes.
	- Hardened cron + manual flow with telemetry, tenant-safe batching, and detailed summaries/tests to prevent duplicates.
- [ ] Add Swagger documentation for all endpoints.
- [ ] Write unit and integration tests.
- [ ] Setup CI/CD pipeline.

Next action: Add Swagger documentation for all endpoints before expanding tests and CI/CD.

## Hardening Follow-ups (Tenant Backend)

1. [x] Outcomes engine reliability
	- [x] Inspected `src/outcomes/outcomes.service.ts` cron behavior and logging safeguards.
	- [x] Ensured carry-forward logic stays deterministic across weeks.
	- [x] Added idempotency-focused automation spec in `test/outcomes-automation.e2e-spec.ts`.
2. [x] Sales engine validation
	- [x] Verified plan vs actual rollups plus weekly rollover logic via `test/sales-engine.e2e-spec.ts`.
	- [x] Exercised `/sales/summary` paths and supporting services in `src/sales/sales.service.ts`.
3. [x] Auth/session hardening
	- [x] Added scheduled refresh-token cleanup job (`src/auth/refresh-token-cleanup.service.ts`).
	- [x] Extended rotation/revocation/concurrency coverage in `src/auth/tokens.service.spec.ts`.
4. [x] Tenant isolation & RBAC tests
	- [x] Focused e2e coverage for metrics, sales, activities, and settings controllers in `test/tenant-isolation.e2e-spec.ts`.
	- [x] Verified guards reject cross-tenant or disallowed role access.
5. [x] Summary endpoint guardrails
	- [x] Guardrail tests for dashboard/modules live in `test/summary-guardrails.e2e-spec.ts`.
6. [x] Cron idempotency coverage
	- [x] Expanded automation suites for outcomes and sales jobs (`test/outcomes-automation.e2e-spec.ts`, `test/sales-engine.e2e-spec.ts`).
7. [x] Final suite sweep
	- [x] Ran `npm run test -- src/auth/tokens.service.spec.ts src/sales/sales.service.spec.ts`.
	- [x] Ran `npx jest --config ./test/jest-e2e.json test/sales-engine.e2e-spec.ts test/outcomes-automation.e2e-spec.ts`.
