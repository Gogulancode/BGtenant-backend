# Tenant Today Execution Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Today page into the daily execution workspace for sales, activities, outcomes, CRM follow-ups, metrics, and reflection.

**Architecture:** Use the existing dashboard cockpit summary as the Today page's primary context, add frontend API helpers for activities, and use existing weekly sales endpoints to save weekly sales progress.

**Tech Stack:** NestJS, React, Vite, TanStack Query, shadcn/ui, lucide-react.

---

### Task 1: Activity Logging Permissions And API Helpers

**Files:**
- Modify: `D:\BGAccountabiityapp\src\activities\activities.controller.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\hooks\useActivities.ts`

- [ ] **Step 1: Allow contributors to create/update activity execution records**

Change activity create and update routes from leadership roles to contributor roles. Deletion remains leadership-only.

- [ ] **Step 2: Add frontend helpers**

Add `createActivity`, `updateActivity`, `ActivityRecord`, and payload types to `api.ts`.

- [ ] **Step 3: Add activity mutation hooks**

Add `useCreateActivity` and `useUpdateActivity` to invalidate dashboard, activities, and weekly summary queries.

### Task 2: Today Execution Workspace UI

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Today.tsx`

- [ ] **Step 1: Use dashboard cockpit**

Use `dashboardData.cockpit` as the primary Today page context for momentum, activities, CRM, sales, and roadmap data.

- [ ] **Step 2: Add weekly sales logging**

Use `logWeeklySales()` with current year/week and fields for achieved, orders, and notes.

- [ ] **Step 3: Add activity execution**

Render due-today activity templates and allow creating completed activity records from them.

- [ ] **Step 4: Add CRM follow-up panel**

Show warm/hot prospects from cockpit with links to Sales.

- [ ] **Step 5: Preserve outcomes, metric quick log, and reflection**

Keep existing working flows, but place them inside the new operating layout.

### Task 3: Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run backend build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `npm run build` in `D:\bridge-gaps-dashboard-main`

Expected: PASS, with only existing Browserslist/chunk warnings.

- [ ] **Step 3: Restart local app**

Restart backend on port 3002 and frontend on port 8080. Verify `/api/v1/health` and `/today`.
