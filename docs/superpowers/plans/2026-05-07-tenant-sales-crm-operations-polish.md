# Tenant Sales CRM Operations Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the tenant Sales page as an operational CRM workspace with quick funnel movement, follow-up hygiene, and fresh downstream reporting data.

**Architecture:** Keep the existing NestJS sales prospect endpoints and React Query hooks. Tighten the backend summary contract, then enhance the existing `SalesProspectsPanel` and make the Sales page default to CRM.

**Tech Stack:** NestJS, Prisma, Jest, React, TypeScript, TanStack Query, shadcn/ui, lucide-react.

---

### Task 1: Align Active Follow-Up Summary

**Files:**
- Modify: `D:\BGAccountabiityapp\src\sales\sales-prospects.service.spec.ts`
- Modify: `D:\BGAccountabiityapp\src\sales\sales-prospects.service.ts`

- [ ] **Step 1: Update the failing service expectation**

Change the summary test to expect `activeFollowUps` to count only warm and hot prospects in the tenant/month scope:

```ts
expect(prisma.salesProspect.count).toHaveBeenCalledWith({
  where: {
    userId: "user-1",
    tenantId: "tenant-1",
    month: "2026-05",
    status: {
      in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT],
    },
  },
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm test -- --runInBand src/sales/sales-prospects.service.spec.ts
```

Expected: FAIL because the service still includes `lastFollowUpAt` and `COLD`.

- [ ] **Step 3: Update the service query**

Change `SalesProspectsService.summary()` active follow-up count:

```ts
this.prisma.salesProspect.count({
  where: {
    ...where,
    status: {
      in: [SalesProspectStatus.WARM, SalesProspectStatus.HOT],
    },
  },
}),
```

- [ ] **Step 4: Run the targeted test again**

Run:

```powershell
npm test -- --runInBand src/sales/sales-prospects.service.spec.ts
```

Expected: PASS.

### Task 2: Refresh Dependent Client Data

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\hooks\useSales.ts`

- [ ] **Step 1: Add a shared invalidation helper**

Add a local helper that invalidates CRM, dashboard, and report caches after prospect mutations:

```ts
function invalidateSalesProspectDependencies(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["sales", "prospects"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  queryClient.invalidateQueries({ queryKey: ["reports", "business-profile"] });
}
```

- [ ] **Step 2: Use the helper in create, update, and delete mutations**

Replace each prospect mutation `onSuccess` body with:

```ts
invalidateSalesProspectDependencies(queryClient);
```

### Task 3: Polish CRM Operations UI

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\components\sales\SalesProspectsPanel.tsx`

- [ ] **Step 1: Add operational helpers**

Add helpers for current date, stale follow-up detection, filter reset, status board values, and quick update payloads.

- [ ] **Step 2: Add summary and status board UI**

Render status cards for the five funnel statuses and a compact health strip for conversion rate and follow-up hygiene.

- [ ] **Step 3: Add next-action and quick-action table columns**

Keep existing edit/delete actions. Add quick buttons for follow-up today, mark warm, mark hot, and mark converted when each action is relevant.

- [ ] **Step 4: Keep filters ergonomic**

Add a reset filters button that appears only when month/status/reason/search differs from the default view.

### Task 4: Make Sales CRM-First

**Files:**
- Modify: `D:\bridge-gaps-dashboard-main\src\pages\Sales.tsx`

- [ ] **Step 1: Update page heading**

Set the title to `Sales CRM & Revenue Operations` and description to `Operate the monthly pipeline, follow-ups, sales targets, and weekly revenue rhythm from one place.`

- [ ] **Step 2: Make CRM the default tab**

Set `Tabs defaultValue="prospects"` and order triggers as `CRM Pipeline` then `Planning & Trends`.

### Task 5: Verify and Restart

- [ ] **Step 1: Run backend targeted test**

```powershell
npm test -- --runInBand src/sales/sales-prospects.service.spec.ts
```

- [ ] **Step 2: Run backend build**

```powershell
npm run build
```

- [ ] **Step 3: Run frontend build**

```powershell
npm run build
```

- [ ] **Step 4: Restart local servers**

Stop listeners on ports 3002 and 8080, then start backend `npm run start:dev` from `D:\BGAccountabiityapp` and frontend `npm run dev -- --host 127.0.0.1 --port 8080` from `D:\bridge-gaps-dashboard-main`.

- [ ] **Step 5: Check local routes**

Verify backend health and frontend `/sales` return HTTP 200.
