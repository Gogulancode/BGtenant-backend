# Outcomes Weekly Summary Feature

## Overview

The Outcomes Weekly Summary feature provides a `/outcomes/weekly-summary` endpoint that compares planned outcomes against completed outcomes for a specific week, enabling users to track their weekly commitment fulfillment.

## Endpoint

### GET /api/v1/outcomes/weekly-summary

Returns the weekly outcome summary comparing planned vs completed.

**Authentication:** Required (JWT Bearer Token)

**Query Parameters:**

| Parameter | Type   | Required | Default      | Description                          |
|-----------|--------|----------|--------------|--------------------------------------|
| year      | number | No       | Current year | Year (2020-2100)                     |
| week      | number | No       | Current week | ISO week number (1-52)               |

**Response:**

```json
{
  "year": 2026,
  "week": 10,
  "planned": 5,
  "completed": 3,
  "completionPercent": 60
}
```

**Response Fields:**

| Field             | Type   | Description                                        |
|-------------------|--------|----------------------------------------------------|
| year              | number | The year being queried                             |
| week              | number | The ISO week number being queried                  |
| planned           | number | Total outcomes created within the week date range  |
| completed         | number | Outcomes with status = "Done"                      |
| completionPercent | number | (completed / planned) × 100, rounded to 1 decimal  |

## Business Logic

### Outcome Status Types

The `OutcomeStatus` enum has three values:
- **Planned**: Outcome created but not yet worked on
- **Done**: Outcome completed successfully
- **Missed**: Outcome not completed within the week

### Calculations

1. **Planned Count**: All outcomes where `weekStartDate` falls within the specified week's date range
2. **Completed Count**: Outcomes from above where `status = Done`
3. **Completion Percent**: `(completed / planned) × 100`
   - Returns 0 when no outcomes are planned
   - Rounded to 1 decimal place

### Week Calculation

Uses ISO week numbering via `getWeekDateRange(year, weekNumber)`:
- Week 1 contains January 4th
- Weeks start on Monday and end on Sunday
- The function returns `{ start: Date, end: Date }` for the week boundaries

### Tenant Isolation

All queries are filtered by:
- `tenantId`: From JWT token
- `userId`: From JWT token

This ensures users only see their own data within their tenant.

## Example Requests

### Get current week summary
```bash
curl -X GET "http://localhost:3002/api/v1/outcomes/weekly-summary" \
  -H "Authorization: Bearer <token>"
```

### Get specific week summary
```bash
curl -X GET "http://localhost:3002/api/v1/outcomes/weekly-summary?year=2026&week=10" \
  -H "Authorization: Bearer <token>"
```

## Error Responses

### 400 Bad Request - Invalid Week
```json
{
  "statusCode": 400,
  "message": ["Week must be between 1 and 52"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## Integration with Frontend

### React Query Hook

```typescript
export function useOutcomesWeeklySummary(year?: number, week?: number) {
  return useQuery({
    queryKey: ['outcomes', 'weekly-summary', year, week],
    queryFn: () => api.get('/outcomes/weekly-summary', { params: { year, week } }),
  });
}
```

### Usage in Component

```tsx
function WeeklyOutcomesSummary() {
  const { data, isLoading } = useOutcomesWeeklySummary();
  
  if (isLoading) return <Skeleton />;
  
  return (
    <Card>
      <CardHeader>Weekly Outcomes</CardHeader>
      <CardContent>
        <Progress value={data.completionPercent} />
        <p>{data.completed} of {data.planned} completed</p>
      </CardContent>
    </Card>
  );
}
```

## Testing

Run the E2E tests:

```bash
npm run test:e2e -- --testPathPattern="outcomes-weekly-summary"
```

### Test Coverage

| Test Case                        | Description                                |
|----------------------------------|--------------------------------------------|
| No outcomes                      | Returns 0 for all metrics                  |
| Planned but none completed       | Returns planned > 0, completed = 0         |
| Some completed                   | Calculates correct percentage              |
| All completed                    | Returns 100% completion                    |
| Week validation                  | Rejects weeks outside 1-52 range           |
| Tenant isolation                 | Only counts user's outcomes                |
| Year handling                    | Defaults to current year                   |
| Decimal percentages              | Handles rounding correctly                 |
| Mixed statuses                   | Only counts Done as completed              |

## Related Endpoints

| Endpoint                       | Description                           |
|--------------------------------|---------------------------------------|
| GET /sales/weekly-summary      | Weekly sales target vs actual         |
| GET /activities/weekly-summary | Weekly activity targets vs logged     |
| GET /outcomes                  | List all outcomes                     |
| POST /outcomes                 | Create new outcome                    |

## Schema Reference

```prisma
model Outcome {
  id            String         @id @default(cuid())
  userId        String
  tenantId      String
  title         String
  description   String?
  weekStartDate DateTime
  status        OutcomeStatus  @default(Planned)
  isCarriedOver Boolean        @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

enum OutcomeStatus {
  Planned
  Done
  Missed
}
```
