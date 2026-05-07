# Tenant One-Page Business Profile Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-scoped one-page business profile report that can be reviewed and exported through browser print/save as PDF.

**Architecture:** The backend reports service will expose an aggregate read endpoint for the current tenant. The frontend Reports page will fetch that aggregate, render it as a printable report, and keep the existing weekly/monthly generator as a secondary tool.

**Tech Stack:** NestJS, Prisma, Jest, React, Vite, TanStack Query, shadcn/ui, lucide-react.

---

### Task 1: Backend Report Aggregation

**Files:**
- Create: `D:\BGAccountabiityapp\src\reports\reports.service.spec.ts`
- Modify: `D:\BGAccountabiityapp\src\reports\reports.service.ts`
- Modify: `D:\BGAccountabiityapp\src\reports\reports.controller.ts`

- [ ] **Step 1: Write the failing test**

Add a Jest test for `ReportsService.getBusinessProfileReport()` that mocks tenant, user, business identity, sales plan, activity configuration, sales prospects, achievement stages, setup checklist, and snapshot records. Assert that the service returns business profile sections, CRM totals, and calls `actionLog.record()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/reports/reports.service.spec.ts`

Expected: FAIL because `getBusinessProfileReport` does not exist.

- [ ] **Step 3: Implement the endpoint**

Add `ReportsService.getBusinessProfileReport(requester)` and `ReportsController.getBusinessProfileReport()`. Move role metadata so `POST /generate` remains leadership-only while `GET /business-profile` allows tenant member roles.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/reports/reports.service.spec.ts`

Expected: PASS.

### Task 2: Frontend Report Preview

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\hooks\useReports.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Reports.tsx`

- [ ] **Step 1: Add API types and query hook**

Define the `BusinessProfileReport` response type, add `getBusinessProfileReport()`, and expose `useBusinessProfileReport()`.

- [ ] **Step 2: Build the printable UI**

Render report metadata, business profile, sales plan, activity engine, CRM summary, and achievement roadmap. Add refresh and print buttons. Use compact report sections that print cleanly.

- [ ] **Step 3: Keep legacy generator secondary**

Keep weekly/monthly generation below the new profile report so existing behavior is not removed.

### Task 3: Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run backend targeted test**

Run: `npm test -- --runInBand src/reports/reports.service.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `npm run build` in `D:\bridge-gaps-dashboard-main`

Expected: PASS, with only the pre-existing Browserslist/chunk-size warnings if present.

- [ ] **Step 4: Restart local app**

Stop listening processes on ports 3002 and 8080, then start backend and frontend dev servers. Verify backend health and frontend Reports route respond.
