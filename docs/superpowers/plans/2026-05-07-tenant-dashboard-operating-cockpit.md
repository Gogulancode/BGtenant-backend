# Tenant Dashboard Operating Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-oriented tenant home dashboard that tells users what to do today and how they are pacing against sales, activity, CRM, and achievement goals.

**Architecture:** Extend the existing dashboard summary backend response with a `cockpit` aggregate. Replace the frontend Dashboard page's static charts and generic KPIs with action-oriented cards powered by that aggregate.

**Tech Stack:** NestJS, Prisma, Jest, React, Vite, TanStack Query, shadcn/ui, lucide-react.

---

### Task 1: Backend Cockpit Aggregate

**Files:**
- Modify: `D:\BGAccountabiityapp\src\dashboard\dashboard.contract.spec.ts`
- Modify: `D:\BGAccountabiityapp\src\dashboard\dashboard.service.ts`
- Modify: `D:\BGAccountabiityapp\src\dashboard\dashboard.module.ts`

- [ ] **Step 1: Write failing cockpit contract test**

Add a test that constructs `DashboardService` with mocked module services and mocked Prisma queries. Assert that `getSummary()` returns `userName`, `cockpit.sales`, `cockpit.activities`, `cockpit.outcomes`, `cockpit.crm`, and `cockpit.achievement`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/dashboard/dashboard.contract.spec.ts`

Expected: FAIL because `DashboardService` does not yet build `cockpit`.

- [ ] **Step 3: Implement cockpit aggregation**

Inject `PrismaService`, import `PrismaModule`, and assemble cockpit data from existing summaries plus tenant-scoped Prisma reads for user, setup checklist, activity configuration, prospects, and achievement stages.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/dashboard/dashboard.contract.spec.ts`

Expected: PASS.

### Task 2: Frontend Cockpit UI

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Dashboard.tsx`

- [ ] **Step 1: Add dashboard summary types**

Add `DashboardSummaryResponse` and cockpit nested types around the existing `getDashboardSummary()` call.

- [ ] **Step 2: Replace static charts**

Remove hard-coded weekly and activity chart data from `Dashboard.tsx`. Render real cockpit cards, today focus lists, quick actions, and roadmap progress from `data.cockpit`.

- [ ] **Step 3: Preserve setup help**

Keep `FirstWeekChecklist` and `BusinessSetupCard` where useful, but make the primary dashboard content the operating cockpit.

### Task 3: Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run backend dashboard test**

Run: `npm test -- --runInBand src/dashboard/dashboard.contract.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `npm run build` in `D:\bridge-gaps-dashboard-main`

Expected: PASS, with only the existing Browserslist/chunk-size warnings if present.

- [ ] **Step 4: Restart local app**

Restart backend on port 3002 and frontend on port 8080, then verify `GET /api/v1/health` and `/dashboard`.
