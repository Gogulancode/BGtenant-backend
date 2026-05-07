# Tenant Production Readiness Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tenant auth routing, onboarding gating, and route-level error states production-ready.

**Architecture:** Centralize public and private route decisions in auth guard components, then simplify app routes so the protected dashboard shell renders only after auth and onboarding checks pass. Keep page-level product work intact.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, shadcn/ui.

---

### Task 1: Strengthen Route Guards

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\components\auth\ProtectedRoute.tsx`

- [ ] Create shared loading and error UI for auth route checks.
- [ ] Call onboarding state query with `enabled: Boolean(accessToken)` so hook order stays stable.
- [ ] Redirect missing-token users to `/login` with the current path in location state.
- [ ] Redirect incomplete setup users to `/onboarding` when `requireOnboarding` is true.
- [ ] Show a retry/logout error state when onboarding status fails.
- [ ] Export a `PublicOnlyRoute` component that routes logged-in users to `/onboarding` or `/today`.

### Task 2: Simplify App Routes

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\App.tsx`

- [ ] Wrap `/login` and `/register` with `PublicOnlyRoute`.
- [ ] Wrap `/onboarding` with `ProtectedRoute requireOnboarding={false}`.
- [ ] Wrap the dashboard layout once with `ProtectedRoute`.
- [ ] Remove repeated child-level `ProtectedRoute` wrappers.

### Task 3: Align Auth Pages

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Login.tsx`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Register.tsx`

- [ ] Convert Login to use `useLogin` so failed responses do not write invalid tokens.
- [ ] Remove local token redirects from Login and Register because `PublicOnlyRoute` owns that behavior.
- [ ] Keep Register success redirecting to `/onboarding`.

### Task 4: Add Onboarding Error State

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Onboarding.tsx`

- [ ] Read `isError`, `error`, and `refetch` from `useOnboardingState`.
- [ ] Show a retryable error panel when setup state cannot load.
- [ ] Keep the current step flow unchanged for successful states.

### Task 5: Verify

- [ ] Run frontend build:

```powershell
npm run build
```

- [ ] Restart the frontend dev server if needed.
- [ ] Smoke-check route HTTP responses for auth, onboarding, and core tenant pages.
