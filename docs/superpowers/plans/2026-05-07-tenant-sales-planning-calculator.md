# Tenant Sales Planning Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the onboarding sales planning calculator with ASP/ATS, conversion ratio, expected leads, and existing/new customer contribution.

**Architecture:** Store user assumptions and backend-calculated outputs on `SalesPlan`, then update Step 3 to submit the new assumptions and preview the derived numbers live.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, react-hook-form, zod.

---

### Task 1: Backend SalesPlan Calculator Contract

**Files:**
- Modify: `D:\BGAccountabiityapp\prisma\schema.prisma`
- Create: `D:\BGAccountabiityapp\prisma\migrations\20260507023000_extend_sales_plan_calculator\migration.sql`
- Modify: `D:\BGAccountabiityapp\src\onboarding\dto\sales-plan.dto.ts`
- Modify: `D:\BGAccountabiityapp\src\onboarding\onboarding.service.ts`
- Modify: `D:\BGAccountabiityapp\src\onboarding\onboarding.service.spec.ts`

- [ ] Add persisted assumption and calculated fields to `SalesPlan`.
- [ ] Validate average ticket size, conversion ratio, and customer contribution.
- [ ] Calculate monthly order and lead targets in the service.
- [ ] Calculate existing/new customer annual target values in the service.
- [ ] Add focused service test coverage.

### Task 2: Frontend Sales Planning Step

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\onboarding\steps\Step3SalesPlan.tsx`

- [ ] Add API types for new calculator fields.
- [ ] Add form fields for average ticket size, conversion ratio, and customer contribution.
- [ ] Show live annual and monthly order/lead calculations.
- [ ] Preserve current revenue history and monthly distribution behavior.

### Task 3: Verification

- [ ] Run `npx prisma generate`.
- [ ] Run `npm test -- --runInBand src/onboarding/onboarding.service.spec.ts`.
- [ ] Run `npx prisma validate`.
- [ ] Run backend build.
- [ ] Run frontend build.
- [ ] Apply local migration and restart dev servers.
