# Activity Weekly Summary

## Overview

The Activity Weekly Summary endpoint provides a comparison between **planned weekly activity targets** (from onboarding configuration) and **actual activities logged** during a specific week.

This is part of the **Leading Indicators Foundation (Phase B1)** - enabling tenants to track their business development activities against configured goals.

## Endpoint

```
GET /api/v1/activities/weekly-summary
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `year` | number | No | Current year | Year for the summary (2020-2100) |
| `week` | number | No | Current week | Week number (1-52) |

### Response Shape

```json
{
  "year": 2026,
  "week": 1,
  "items": [
    {
      "category": "Sales",
      "target": 5,
      "actual": 3,
      "completionPercent": 60
    },
    {
      "category": "Marketing",
      "target": 5,
      "actual": 2,
      "completionPercent": 40
    },
    {
      "category": "Operations",
      "target": 5,
      "actual": 1,
      "completionPercent": 20
    }
  ],
  "overallCompletionPercent": 40
}
```

## Business Logic

### Week Calculation (Excel-Style Parity)

The week number calculation uses the **same logic as the Sales module**:

```typescript
weekNumber = clamp(ceil((dayOfYear + 1) / 7), 1, 52)
```

This ensures consistency across all weekly metrics in the platform.

### Week Date Boundaries

```typescript
// Start of week = Jan 1 + (weekNumber - 1) * 7 days
// End of week = Start + 6 days, 23:59:59.999
```

### Target Distribution

The `weeklyActivityGoal` from `ActivityConfiguration` is **evenly distributed** across all enabled categories:

```
perCategoryTarget = floor(weeklyActivityGoal / enabledCategoriesCount)
```

**Example:**
- Weekly Goal: 15 activities
- Enabled Categories: Sales, Marketing, Operations (3)
- Per-Category Target: 15 / 3 = 5

### Activity Categories

Categories are determined by the `ActivityConfiguration` settings from onboarding:

| Config Field | Category Name |
|--------------|---------------|
| `salesEnabled` | Sales |
| `marketingEnabled` | Marketing |
| `networkingEnabled` | Networking |
| `productDevEnabled` | Product Dev |
| `operationsEnabled` | Operations |

Only **enabled** categories appear in the response `items` array.

### Completion Calculation

**Per-Category:**
```
completionPercent = target > 0 ? (actual / target) * 100 : 0
```

**Overall:**
```
overallCompletionPercent = sumOfTarget > 0 ? (sumOfActual / sumOfTarget) * 100 : 0
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| No `ActivityConfiguration` exists | Returns empty `items[]`, `overallCompletionPercent: 0` |
| All categories disabled | Returns empty `items[]`, `overallCompletionPercent: 0` |
| `weeklyActivityGoal = 0` | All targets = 0, all completions = 0% |
| Week < 1 or > 52 | Returns 400 Bad Request |
| Activities with custom categories | Only matched against enabled categories; unmatched are ignored |

## Tenant Isolation

- Configuration is loaded by `tenantId`
- Activities are filtered by both `userId` AND `tenantId`
- No cross-tenant data leakage possible

## Authentication

Requires JWT Bearer token with tenant context. Minimum role: `TENANT_USER`.

## Integration with Sales Weekly Summary

Both endpoints share:
- Same week calculation logic (`getWeekNumber`, `getWeekDateRange`)
- Same year/week query parameter validation
- Consistent response structure philosophy

This enables unified weekly dashboards comparing:
- Sales target vs achieved
- Activity target vs actual

## E2E Test Coverage

21 tests covering:
1. No configuration scenarios
2. Configuration with no activities
3. Activities logged and grouped by category
4. Multiple categories with different completion rates
5. Week validation (1-52 range)
6. Tenant isolation verification
7. Year parameter handling
8. All categories disabled
9. Zero weekly goal handling
10. Unconfigured category handling

## Related Files

- **Controller**: `src/activities/activities.controller.ts`
- **Service**: `src/activities/activities.service.ts`
- **DTOs**: `src/activities/dto/activity.dto.ts`
- **Date Utils**: `src/common/utils/date.utils.ts`
- **E2E Tests**: `test/activities-weekly-summary.e2e-spec.ts`
