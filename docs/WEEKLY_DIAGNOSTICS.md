# Weekly Diagnostics Engine

## Overview

The Weekly Diagnostics Engine provides actionable insights explaining WHY business performance changed. It analyzes sales, activities, and outcomes data to generate rule-based diagnostic messages.

**Important:** This is a rule-based diagnostic system, NOT AI. All messages are deterministic based on defined thresholds.

## Endpoint

### GET /api/v1/insights/weekly-diagnostics

Returns weekly diagnostics with actionable insights.

**Authentication:** Required (JWT Bearer Token)

**Query Parameters:**

| Parameter | Type   | Required | Default      | Description                |
|-----------|--------|----------|--------------|----------------------------|
| year      | number | No       | Current year | Year (2020-2100)           |
| week      | number | No       | Current week | ISO week number (1-52)     |

**Response:**

```json
{
  "year": 2026,
  "week": 1,
  "diagnostics": [
    {
      "type": "SALES",
      "level": "WARNING",
      "message": "Activity levels are healthy, but conversions are low. Review lead quality."
    },
    {
      "type": "OUTCOME",
      "level": "WARNING",
      "message": "Weekly commitments are not being completed. Improve execution discipline."
    }
  ],
  "summary": {
    "salesAchievementPercent": 65.5,
    "activityCompletionPercent": 90.0,
    "outcomeCompletionPercent": 40.0,
    "momentumEffect": -7
  }
}
```

## Diagnostic Types

| Type       | Description                                    |
|------------|------------------------------------------------|
| `SALES`    | Issues or successes related to sales targets   |
| `ACTIVITY` | Issues or successes related to activity volume |
| `OUTCOME`  | Issues related to weekly commitment completion |

## Diagnostic Levels

| Level      | Description                         | UI Indicator |
|------------|-------------------------------------|--------------|
| `SUCCESS`  | Positive performance indicator      | 🟢 Green     |
| `WARNING`  | Needs attention                     | 🟡 Yellow    |
| `CRITICAL` | Urgent issue requiring action       | 🔴 Red       |

## Rule Engine

Rules are applied **in order** and may **stack** (multiple rules can fire):

### Rule 1 — Effort Issue
**Condition:** Sales < 80% AND Activities < 80%  
**Level:** CRITICAL  
**Message:** "Low sales driven by insufficient activity. Increase outreach volume."

**Interpretation:** Both sales and activities are underperforming. The root cause is likely insufficient effort/volume.

### Rule 2 — Pipeline Issue
**Condition:** Sales < 80% AND Activities >= 80%  
**Level:** WARNING  
**Message:** "Activity levels are healthy, but conversions are low. Review lead quality."

**Interpretation:** Activities are on track but not converting. Focus on lead quality, pitch, or pricing.

### Rule 3 — Execution Issue
**Condition:** Outcomes < 80%  
**Level:** WARNING  
**Message:** "Weekly commitments are not being completed. Improve execution discipline."

**Interpretation:** Weekly goals are not being achieved. Focus on prioritization and follow-through.

### Rule 4 — Momentum Building
**Condition:** Sales >= 80% AND Activities >= 80%  
**Level:** SUCCESS  
**Message:** "Strong activity and sales alignment. Momentum is building."

**Interpretation:** Both leading and lagging indicators are healthy.

### Rule 5 — Exceptional Performance
**Condition:** Sales >= 100%  
**Level:** SUCCESS  
**Message:** "Sales exceeded target. Consider raising goals or scaling efforts."

**Interpretation:** Target achieved or exceeded. Time to stretch.

## Momentum Effect

The `momentumEffect` score is a lightweight indicator ranging from **-10 to +10**.

### Calculation Rules

| Condition          | Effect |
|--------------------|--------|
| Sales >= 100%      | +5     |
| Sales < 80%        | -5     |
| Activities < 80%   | -3     |
| Outcomes < 80%     | -2     |

**Final value:** Sum of applicable effects, clamped to [-10, +10]

### Interpretation

| Range      | Meaning                              |
|------------|--------------------------------------|
| +5 to +10  | Strong positive momentum             |
| +1 to +4   | Slightly positive                    |
| 0          | Neutral                              |
| -1 to -4   | Slightly negative                    |
| -5 to -10  | Strong negative momentum (action needed) |

## Data Sources

The diagnostics engine aggregates data from three weekly summary endpoints:

| Metric                  | Source Endpoint                | Field Used                  |
|-------------------------|--------------------------------|-----------------------------|
| Sales Achievement %     | `GET /sales/summary`           | `targets.weeklyAchievementPercent` |
| Activity Completion %   | `GET /activities/weekly-summary` | `overallCompletionPercent` |
| Outcome Completion %    | `GET /outcomes/weekly-summary` | `completionPercent`        |

## Safety & Edge Cases

1. **Missing Data:** If any metric is unavailable, it defaults to 0
2. **Service Errors:** If any underlying service throws, the metric defaults to 0 (never throws)
3. **Tenant Isolation:** All queries are scoped to the authenticated user's tenant
4. **Week Validation:** Week must be 1-52 (validation error if outside range)

## Example Scenarios

### Scenario 1: All Metrics Low
- Sales: 40%, Activities: 30%, Outcomes: 20%
- **Diagnostics:**
  - CRITICAL: Effort issue
  - WARNING: Execution issue
- **Momentum Effect:** -10 (clamped from -5 -3 -2 = -10)

### Scenario 2: Good Activity, Low Sales
- Sales: 60%, Activities: 95%, Outcomes: 85%
- **Diagnostics:**
  - WARNING: Pipeline issue
- **Momentum Effect:** -5

### Scenario 3: Exceeding Target
- Sales: 120%, Activities: 90%, Outcomes: 100%
- **Diagnostics:**
  - SUCCESS: Momentum building
  - SUCCESS: Exceptional performance
- **Momentum Effect:** +5

### Scenario 4: Perfect Week
- Sales: 80%, Activities: 80%, Outcomes: 80%
- **Diagnostics:**
  - SUCCESS: Momentum building
- **Momentum Effect:** 0

## Testing

Run E2E tests:

```bash
npm run test:e2e -- --testPathPattern="insights-weekly-diagnostics"
```

### Test Coverage

| Test Case                   | Description                                  |
|-----------------------------|----------------------------------------------|
| All low                     | Effort + execution issues                    |
| Activities OK, sales low    | Pipeline issue                               |
| Sales high                  | Success messages                             |
| Mixed cases                 | Stacked diagnostics                          |
| No data                     | Returns empty diagnostics safely             |
| Service throws              | Returns 0 metrics (never throws)             |
| Week validation             | Rejects weeks outside 1-52                   |
| Boundary at 80%             | Treats 80% as healthy, 79% as below          |

## Related Endpoints

| Endpoint                       | Description                           |
|--------------------------------|---------------------------------------|
| GET /sales/summary             | Weekly sales achievement              |
| GET /sales/weekly-summary      | Multi-week sales trend                |
| GET /activities/weekly-summary | Activity targets vs actual            |
| GET /outcomes/weekly-summary   | Outcomes planned vs completed         |
| GET /insights                  | Overall momentum and flags            |
| GET /insights/momentum         | Focused momentum summary              |
