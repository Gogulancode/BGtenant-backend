# Hybrid Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid business coach experience that tells tenant users exactly what to do next, why it matters, and where to act in both API and mobile UI.

**Architecture:** Extend the existing `GET /api/v1/dashboard/guidance` contract with optional guidance fields while preserving existing clients. Backend rules stay deterministic; mobile renders richer coach cards from the same endpoint.

**Tech Stack:** NestJS, Prisma, Jest, Expo React Native, TypeScript.

---

### Task 1: Backend Guidance Contract

**Files:**
- Modify: `src/dashboard/dto/dashboard-guidance.dto.ts`
- Modify: `src/dashboard/dashboard-guidance.service.ts`
- Modify: `src/dashboard/dashboard-guidance.service.spec.ts`

- [ ] Add optional fields to guidance response: `summary.journeyStage`, `card.why`, `card.impactMetric`, `card.afterActionMessage`.
- [ ] Derive journey stage from setup, sales, CRM, and activity data.
- [ ] Add missing weekly sales entry guidance ahead of sales gap guidance.
- [ ] Add concrete why text and after-action text to each rule card.
- [ ] Verify with `npm test -- --runInBand dashboard-guidance.service.spec.ts`.

### Task 2: Tenant Web Compatibility

**Files:**
- Modify: `src/components/GuidanceCoachPanel.tsx` in tenant web repo.
- Modify: `src/lib/api.ts` in tenant web repo.

- [ ] Add optional fields to TypeScript API types.
- [ ] Show journey stage, why copy, and after-action copy in the existing coach panel.
- [ ] Verify tenant web build still passes.

### Task 3: Mobile Coach UI

**Files:**
- Modify: `D:\BG-mobile-app\src\types\api.ts`
- Modify: `D:\BG-mobile-app\src\components\GuidanceCoachCard.tsx`
- Modify: `D:\BG-mobile-app\app\(tabs)\today.tsx`
- Modify: `D:\BG-mobile-app\app\(tabs)\profile.tsx`

- [ ] Add optional guidance fields to mobile types.
- [ ] Upgrade `GuidanceCoachCard` to show journey stage, next action, why text, signals, and direct action label.
- [ ] Keep the UI colorful and premium without using chatbot language.
- [ ] Verify Expo/TypeScript checks.

### Task 4: Local Demo

**Files:**
- No source files unless QA finds a bug.

- [ ] Build backend.
- [ ] Restart local backend on port 3002.
- [ ] Confirm `/api/v1/dashboard/guidance` returns journey stage and why text.
- [ ] Open/reload the Android app and show the updated coach card.
