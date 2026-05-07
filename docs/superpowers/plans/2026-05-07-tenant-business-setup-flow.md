# Tenant Business Setup Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the tenant onboarding profile and business identity slice so it matches the client wireframe and saves reliably.

**Architecture:** Add explicit Prisma fields and DTO validation for workbook concepts, then update onboarding service and React forms to use one shared contract. Keep media upload out of this slice.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, react-hook-form, zod, TanStack Query.

---

### Task 1: Backend Data Contract

**Files:**
- Modify: `D:\BGAccountabiityapp\prisma\schema.prisma`
- Create: `D:\BGAccountabiityapp\prisma\migrations\20260507013000_extend_business_identity\migration.sql`
- Modify: `D:\BGAccountabiityapp\src\onboarding\dto\profile-onboarding.dto.ts`
- Modify: `D:\BGAccountabiityapp\src\onboarding\dto\business-identity.dto.ts`
- Modify: `D:\BGAccountabiityapp\src\onboarding\onboarding.service.ts`
- Test: `D:\BGAccountabiityapp\src\onboarding\onboarding.service.spec.ts`

- [ ] Add `CustomerType`, `BusinessRegistrationStatus`, and `OfferingType` enums.
- [ ] Add `customerType`, `registrationStatus`, `offeringType`, and `offerings` to `BusinessIdentity`.
- [ ] Allow Step 1 profile onboarding to accept and save `painPoints`.
- [ ] Update business identity DTO/service mapping so every accepted field is persisted.
- [ ] Add focused onboarding service tests for pain points and business identity mapping.
- [ ] Run `npm test -- --runInBand src/onboarding/onboarding.service.spec.ts`.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run build`.

### Task 2: Frontend Step 2 Business Identity

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\lib\api.ts`
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\onboarding\steps\Step2BusinessIdentity.tsx`

- [ ] Replace legacy frontend field names with backend field names.
- [ ] Add B2B/B2C, registered status, product/service model, turnover band, website, USP, keywords, and offerings fields.
- [ ] Preserve prefill behavior from `getBusinessIdentity`.
- [ ] Run `npm run build`.

### Task 3: Final Verification

- [ ] Run backend onboarding tests.
- [ ] Run backend build.
- [ ] Run frontend build.
- [ ] Confirm Prisma migration status is up to date after applying the migration locally.
