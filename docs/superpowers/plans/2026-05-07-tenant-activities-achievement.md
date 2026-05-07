# Tenant Activities & Achievement Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the tenant activity and achievement onboarding flow with wireframe-aligned activity templates and target achievement milestones.

**Architecture:** Store activity template selections as JSON on `ActivityConfiguration`, keep current boolean config fields for compatibility, and update frontend Step 4/Step 6 to use richer product guidance.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, react-hook-form, zod.

---

### Task 1: Backend Activity Metadata

**Files:**
- Modify: `D:\BGAccountabiityapp\prisma\schema.prisma`
- Create: `D:\BGAccountabiityapp\prisma\migrations\20260507033000_add_activity_template_metadata\migration.sql`
- Modify: `D:\BGAccountabiityapp\src\onboarding\dto\activity-configuration.dto.ts`
- Modify: `D:\BGAccountabiityapp\src\onboarding\onboarding.service.ts`
- Modify: `D:\BGAccountabiityapp\src\onboarding\onboarding.service.spec.ts`

- [ ] Add `activities` JSON storage to `ActivityConfiguration`.
- [ ] Add DTO validation for template activity rows.
- [ ] Persist and return selected activities.
- [ ] Add focused service tests.

### Task 2: Frontend Step 4

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\onboarding\steps\Step4ActivitySetup.tsx`

- [ ] Add measurability, impact, relevance, and enabled fields to activity API types.
- [ ] Replace generic category UI with recommended templates.
- [ ] Preserve editing of weekly goals and reminder days.

### Task 3: Frontend Step 6 Defaults

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\onboarding\steps\Step6AchievementStages.tsx`

- [ ] Replace revenue-only defaults with action-oriented target achievement stages.
- [ ] Keep target percentages and rewards compatible with backend.

### Task 4: Verification

- [ ] Run Prisma generate and validate.
- [ ] Run onboarding service tests.
- [ ] Run backend build.
- [ ] Run frontend build.
- [ ] Apply local migration and restart dev servers.
