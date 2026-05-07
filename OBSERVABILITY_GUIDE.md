# Observability & Ops Surfaces

This guide describes how to monitor the Business Accountability platform via the `/api/v1/ops` routes and how to wire those responses into dashboards or alerting systems.

## Authentication & Access Control
- All endpoints except `/ops/health` require an `Authorization: Bearer <OPS_SERVICE_TOKEN>` header (service-to-service token used by the superadmin app).
- Swagger reflects the response contracts via DTOs (`src/ops/dto/ops.dto.ts`).
- Action logging records every ops access for audit parity.

## Endpoints

### `GET /api/v1/ops/environment`
Provides a quick sanity check of runtime configuration (environment, port, cache/db status, enabled feature flags).

Usage tips:
- Wire this into uptime dashboards to confirm cache/DB connectivity after deployments.
- Combine with `/ops/health` for both unauthenticated (public) and authenticated probes.

### `GET /api/v1/ops/telemetry`
Provides aggregate counters for every background job instrumented via `TelemetryService`.

```json
{
  "totals": {
    "successCount": 128,
    "failureCount": 3
  },
  "jobs": [
    {
      "job": "insights-refresh",
      "successCount": 64,
      "failureCount": 1,
      "lastSuccessAt": "2025-02-11T04:00:12.223Z",
      "lastMetadata": { "tenantBatch": 200 },
      "lastError": null
    }
  ]
}
```

Usage tips:
- Drop the `jobs` array into Grafana/Looker tiles for per-cron burn-downs.
- Alert when `failureCount` increases within a rolling window.

### `GET /api/v1/ops/insights-telemetry`
Combines momentum stats with the telemetry snapshot for the `insights-refresh` cron.

```json
{
  "summary": {
    "totalInsights": 412,
    "avgMomentum": 68.5,
    "lastRefreshAt": "2025-02-11T04:00:12.223Z",
    "lastTelemetryError": null
  },
  "flagDistribution": [
    { "flag": "Green", "count": 230 },
    { "flag": "Yellow", "count": 120 },
    { "flag": "Red", "count": 62 }
  ],
  "topTenants": [
    {
      "tenantId": "tn_123",
      "tenantName": "Northwind",
      "avgMomentum": 82.3,
      "usersTracked": 54
    }
  ],
  "telemetry": {
    "job": "insights-refresh",
    "successCount": 64,
    "failureCount": 1,
    "lastSuccessAt": "2025-02-11T04:00:12.223Z"
  }
}
```

Usage tips:
- Feed `flagDistribution` into alerting (e.g., Yellow > 35% triggers coaching review).
- `lastTelemetryError` gives the human-readable reason for any failed refresh.

### `GET /api/v1/ops/rate-limits?windowMinutes=60`
Summarizes throttle configuration, the observation window, top tenants, and module hotspots.

```json
{
  "config": { "limit": 20, "ttlMs": 60000 },
  "window": { "minutes": 60, "since": "2025-02-11T03:15:00.000Z" },
  "topTenants": [
    { "tenantId": "tn_123", "tenantName": "Northwind", "requests": 540 }
  ],
  "moduleHotspots": [
    { "module": "insights", "requests": 820 },
    { "module": "metrics", "requests": 640 }
  ]
}
```

Usage tips:
- `windowMinutes` accepts 5–240; responses are clamped in the controller.
- Plot `requests` per module to see which areas may require per-tenant throttles.

### `GET /api/v1/ops/audit-logs?limit=50&tenantId=tn_123`
Returns the most recent structured action logs, capped at 200 records.

```json
{
  "limit": 50,
  "total": 50,
  "logs": [
    {
      "id": "log_abc",
      "tenantId": "tn_123",
      "userId": "usr_456",
      "module": "metrics",
      "action": "GET /metrics",
      "statusCode": 200,
      "responseTime": 42,
      "ipAddress": "10.0.0.5",
      "createdAt": "2025-02-11T04:20:00.113Z"
    }
  ]
}
```

Usage tips:
- The payload is ready for ingestion into Splunk/ELK; `createdAt` is ISO-8601.
- Combine with rate-limit overview for tenant drill-downs.

## Alerting & Dashboards
- **Cron reliability**: Monitor `telemetry.jobs[].failureCount`; page when failures > 0 for more than 5 minutes.
- **Momentum health**: Watch `flagDistribution` for spikes in Yellow/Red.
- **Traffic anomalies**: Compare `moduleHotspots` week over week; sudden spikes may indicate automation misuse.
- **Audit drift**: Pipe `/audit-logs` into your SIEM to back investigations.

## Implementation Notes
- DTOs live in `src/ops/dto/ops.dto.ts` and keep Swagger response examples accurate.
- Action logs are serialized in `OpsService` to avoid leaking `Date` objects to clients.
- `OBSERVABILITY_GUIDE.md` should be cross-linked in platform runbooks for on-call engineers.
