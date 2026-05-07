# Sales Targets API

This document describes the Sales Targets feature that provides weekly and monthly target breakdowns based on the SalesPlan onboarding configuration.

## Overview

The Sales Targets service calculates weekly and monthly revenue targets from the `SalesPlan` model configured during onboarding. It uses an Excel-style week distribution where:

- **Months 1-4 (Jan-Apr)**: 5 weeks each = 20 weeks
- **Months 5-12 (May-Dec)**: 4 weeks each = 32 weeks
- **Total**: 52 weeks per year

This distribution matches common business fiscal calendars and ensures consistent week-to-month mapping.

## Week Distribution Map

```typescript
const WEEKS_PER_MONTH = [5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4];
```

| Month    | Weeks | Cumulative |
|----------|-------|------------|
| January  | 5     | 5          |
| February | 5     | 10         |
| March    | 5     | 15         |
| April    | 5     | 20         |
| May      | 4     | 24         |
| June     | 4     | 28         |
| July     | 4     | 32         |
| August   | 4     | 36         |
| September| 4     | 40         |
| October  | 4     | 44         |
| November | 4     | 48         |
| December | 4     | 52         |

## API Endpoints

### GET /api/v1/sales/targets

Returns current period targets with achievement data.

**Response:**
```json
{
  "year": 2026,
  "currentMonth": 1,
  "currentWeek": 1,
  "monthlyTarget": 100000,
  "weeklyTarget": 20000,
  "achievedThisMonth": 15000,
  "achievedThisWeek": 5000,
  "monthlyAchievementPercent": 15,
  "weeklyAchievementPercent": 25,
  "daysRemainingInWeek": 3,
  "weeksRemainingInMonth": 4
}
```

### GET /api/v1/sales/targets/monthly

Returns all 12 monthly targets for the year.

**Response:**
```json
[
  {
    "month": 1,
    "monthName": "January",
    "contributionPercent": 8.33,
    "targetValue": 100000,
    "weeksInMonth": 5
  },
  // ... 11 more months
]
```

### GET /api/v1/sales/targets/weekly

Returns all 52 weekly targets for the year.

**Response:**
```json
[
  {
    "weekNumber": 1,
    "month": 1,
    "monthName": "January",
    "weekInMonth": 1,
    "weeklyTarget": 20000,
    "cumulativeTarget": 20000
  },
  // ... 51 more weeks
]
```

### GET /api/v1/sales/targets/week?week={number}

Returns target for a specific week (1-52).

**Query Parameters:**
- `week` (required): Week number between 1 and 52

**Response:**
```json
{
  "weekNumber": 1,
  "month": 1,
  "monthName": "January",
  "weekInMonth": 1,
  "weeklyTarget": 20000,
  "cumulativeTarget": 20000
}
```

### GET /api/v1/sales/summary (Enhanced)

The summary endpoint now includes a `targets` object with current period target data.

**Response:**
```json
{
  "planning": { ... },
  "tracker": { ... },
  "progress": 15,
  "year": 2026,
  "month": "2026-01",
  "validation": { ... },
  "targets": {
    "monthlyTarget": 100000,
    "weeklyTarget": 20000,
    "achievedThisMonth": 15000,
    "achievedThisWeek": 5000,
    "monthlyAchievementPercent": 15,
    "weeklyAchievementPercent": 25,
    "daysRemainingInWeek": 3,
    "weeksRemainingInMonth": 4
  }
}
```

## How Weekly Targets Are Calculated

1. **Get Monthly Target**: From `SalesPlan.monthlyTargets[monthIndex]`
2. **Get Weeks in Month**: From the `WEEKS_PER_MONTH` constant
3. **Calculate Weekly Target**: `monthlyTarget / weeksInMonth`

### Example

For January with `monthlyTarget = 100,000` and `weeksInMonth = 5`:
- Weekly target = 100,000 / 5 = **20,000**

For May with `monthlyTarget = 100,000` and `weeksInMonth = 4`:
- Weekly target = 100,000 / 4 = **25,000**

## Prerequisites

The Sales Targets feature requires a `SalesPlan` record for the tenant, which is created during Step 3 of onboarding. The SalesPlan contains:

- `projectedYearValue`: Total projected revenue for the year
- `monthlyContribution`: Array of 12 percentages (must sum to ~100%)
- `monthlyTargets`: Array of 12 calculated monthly targets

## Integration with Frontend

### Dashboard Widget

```typescript
// Fetch current targets
const { data } = await api.get('/sales/targets');

// Display
<Card>
  <h3>Weekly Target: ${data.weeklyTarget.toLocaleString()}</h3>
  <Progress value={data.weeklyAchievementPercent} />
  <p>{data.daysRemainingInWeek} days remaining this week</p>
</Card>
```

### Sales Planning Page

```typescript
// Fetch all weekly targets for chart
const { data: weeklyTargets } = await api.get('/sales/targets/weekly');

// Plot cumulative target line
const chartData = weeklyTargets.map(w => ({
  week: w.weekNumber,
  target: w.cumulativeTarget
}));
```

## Error Handling

If no `SalesPlan` exists for the tenant, all target values will be `0` and the response structure remains consistent. The API does not throw errors for missing plans.

## Performance

- Monthly and weekly target endpoints are cached for 5 minutes (300 seconds)
- Current targets endpoint is cached for 1 minute (60 seconds)
- Cache is invalidated automatically when SalesPlan is updated

## Testing

Run the E2E tests:

```bash
npm run test:e2e -- --testPathPattern=sales-targets
npm run test:e2e -- --testPathPattern=sales-weekly-summary
```

## Related Files

- Service: `src/sales/sales-targets.service.ts`
- Controller: `src/sales/sales.controller.ts`
- DTOs: `src/sales/dto/sales.dto.ts`
- E2E Tests: `test/sales-targets.e2e-spec.ts`, `test/sales-weekly-summary.e2e-spec.ts`
- Schema: `prisma/schema.prisma` (SalesPlan model)

---

## Weekly Summary Trend API

The Weekly Summary endpoint provides a historical trend view of weekly sales performance over a range of weeks, including achievement stages.

### GET /api/v1/sales/weekly-summary

Returns weekly sales trend data for a range of weeks.

**Query Parameters:**
- `year` (optional): Year for the data (default: current year)
- `fromWeek` (optional): Starting week number 1-52 (default: currentWeek - 5 or 1)
- `toWeek` (optional): Ending week number 1-52 (default: currentWeek)

**Response:**
```json
{
  "year": 2026,
  "fromWeek": 1,
  "toWeek": 6,
  "items": [
    {
      "week": 1,
      "target": 20000,
      "achieved": 18000,
      "achievementPercent": 90,
      "stage": {
        "name": "Gold",
        "minPercentage": 75,
        "maxPercentage": 100,
        "color": "#FFD700"
      }
    },
    {
      "week": 2,
      "target": 20000,
      "achieved": 22000,
      "achievementPercent": 110,
      "stage": {
        "name": "Platinum",
        "minPercentage": 100,
        "maxPercentage": 100,
        "color": "#E5E4E2"
      }
    }
    // ... more weeks
  ]
}
```

### Week Number Calculation

The week number is calculated using a simple formula that matches the Excel-style distribution:

```typescript
export const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor(
    (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const week = Math.ceil((diffDays + 1) / 7);
  return Math.max(1, Math.min(week, 52));
};
```

This ensures consistency across all sales-related week calculations.

### Achievement Stage Mapping

The endpoint maps achievement percentages to configured `AchievementStage` records:

1. Stages are sorted by `percentOfGoal` ascending
2. For each achievement percent, find the stage where:
   - `percent >= previousStage.percentOfGoal` AND `percent <= currentStage.percentOfGoal`
3. Returns `null` if no stages are configured for the tenant

**Default Stages (from onboarding):**

| Stage    | Percent Range | Color     |
|----------|---------------|-----------|
| Bronze   | 0-25%         | #CD7F32   |
| Silver   | 25-50%        | #C0C0C0   |
| Gold     | 50-75%        | #FFD700   |
| Platinum | 75-100%+      | #E5E4E2   |

### Performance Characteristics

- **Single DB Query**: Tracker entries are fetched with a single query using date range
- **No N+1**: All required data (SalesPlan, AchievementStages, Trackers) loaded in parallel
- **Cached**: Response cached for 60 seconds
- **Tenant Isolated**: Data filtered by JWT tenantId

### Error Cases

| Condition | Behavior |
|-----------|----------|
| No SalesPlan | All targets = 0, achievementPercent = 0 |
| No trackers | All achieved = 0 |
| No AchievementStages | All stage = null |
| fromWeek > toWeek | 400 Bad Request |
| week < 1 or > 52 | 400 Bad Request |

### Frontend Integration Example

```typescript
// React Query hook
const { data, isLoading } = useQuery({
  queryKey: ['sales', 'weekly-summary', year, fromWeek, toWeek],
  queryFn: () => api.get('/sales/weekly-summary', { 
    params: { year, fromWeek, toWeek } 
  }),
  staleTime: 60 * 1000, // 1 minute
});

// Trend chart component
<ResponsiveContainer>
  <ComposedChart data={data.items}>
    <Bar dataKey="achieved" fill="#3B82F6" />
    <Line dataKey="target" stroke="#10B981" strokeDasharray="5 5" />
    <XAxis dataKey="week" />
    <YAxis />
    <Tooltip />
  </ComposedChart>
</ResponsiveContainer>
```
