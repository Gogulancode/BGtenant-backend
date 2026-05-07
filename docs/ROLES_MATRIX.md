# Roles & Permissions Matrix

This document defines which roles can access which endpoints across the BG Accountability Platform.

---

## Role Definitions

### Tenant API Roles

| Role | Description | Scope |
|------|-------------|-------|
| `TENANT_ADMIN` | Tenant owner/administrator | Full tenant access |
| `MANAGER` | Team/department manager | Team-level access |
| `COACH` | Business coach | Coaching + view access |
| `SME` | Subject matter expert | Limited view + input |
| `STAFF` | Regular team member | Personal data only |
| `VIEWER` | Read-only observer | View dashboards only |

### SuperAdmin API Roles

| Role | Description | Scope |
|------|-------------|-------|
| `SUPER_ADMIN` | Platform administrator | Full platform access |

---

## Tenant API Permissions

### Authentication (`/auth/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/register` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST /auth/refresh` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/logout` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /auth/mfa/status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/mfa/enroll` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/mfa/verify` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/mfa/disable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### User Management (`/user/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /user/me` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /user/me` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `POST /user/change-password` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /user/team` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `POST /user/invite` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `DELETE /user/:id` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Dashboard (`/dashboard/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /dashboard/team` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Business (`/business/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /business` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /business` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /business/nsm-suggestions` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Metrics (`/metrics/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /metrics` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /metrics` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `PATCH /metrics/:id` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `DELETE /metrics/:id` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST /metrics/:id/log` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /metrics/:id/history` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Outcomes (`/outcomes/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /outcomes` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /outcomes` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PATCH /outcomes/:id` | ✅ | ✅ | ✅ | ✅ | ✅* | ❌ |
| `DELETE /outcomes/:id` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*STAFF can only update their own outcomes

### Sales (`/sales/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /sales/quarterly` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `POST /sales/quarterly` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /sales/monthly` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `POST /sales/monthly` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Reviews (`/reviews/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /reviews` | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* |
| `POST /reviews/daily` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `POST /reviews/weekly` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

*STAFF/VIEWER can only view their own reviews

### Activities (`/activities/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /activities` | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* |
| `POST /activities` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PATCH /activities/:id` | ✅ | ✅ | ✅ | ✅* | ✅* | ❌ |
| `DELETE /activities/:id` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*Limited to own activities

### Insights (`/insights/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /insights/momentum` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /insights/trends` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `GET /insights/team` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Settings (`/settings/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /settings/tenant` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `PATCH /settings/tenant` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Support (`/support/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /support/tickets` | ✅ | ✅ | ✅ | ✅ | ✅* | ❌ |
| `POST /support/tickets` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /support/tickets/:id` | ✅ | ✅ | ✅ | ✅* | ✅* | ❌ |
| `POST /support/tickets/:id/comments` | ✅ | ✅ | ✅ | ✅* | ✅* | ❌ |

*Limited to own tickets

### Templates (`/templates/*`)

| Endpoint | TENANT_ADMIN | MANAGER | COACH | SME | STAFF | VIEWER |
|----------|:------------:|:-------:|:-----:|:---:|:-----:|:------:|
| `GET /templates` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /templates/:id/apply` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## SuperAdmin API Permissions

All SuperAdmin API endpoints require `SUPER_ADMIN` role.

### Authentication (`/auth/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `POST /auth/login` | ✅ (public) |
| `POST /auth/refresh` | ✅ |
| `POST /auth/logout` | ✅ |
| `GET /auth/mfa/*` | ✅ |
| `POST /auth/mfa/*` | ✅ |
| `GET /auth/sessions` | ✅ |
| `DELETE /auth/sessions/:id` | ✅ |

### Tenants (`/tenants/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `GET /tenants` | ✅ |
| `POST /tenants` | ✅ |
| `GET /tenants/:id` | ✅ |
| `PATCH /tenants/:id` | ✅ |
| `DELETE /tenants/:id` | ✅ |
| `POST /tenants/:id/suspend` | ✅ |
| `POST /tenants/:id/reactivate` | ✅ |
| `GET /tenants/:id/stats` | ✅ |

### Dashboard (`/dashboard/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `GET /dashboard` | ✅ |

### Templates (`/templates/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `GET /templates` | ✅ |
| `POST /templates` | ✅ |
| `PATCH /templates/:id` | ✅ |
| `DELETE /templates/:id` | ✅ |
| `POST /templates/:id/assign` | ✅ |

### Support (`/support/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `GET /support/tickets` | ✅ |
| `GET /support/tickets/:id` | ✅ |
| `PATCH /support/tickets/:id` | ✅ |
| `POST /support/tickets/:id/assign` | ✅ |
| `POST /support/tickets/:id/notes` | ✅ |
| `POST /support/tickets/:id/resolve` | ✅ |

### Audit (`/audit/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `GET /audit` | ✅ |
| `GET /audit/export` | ✅ |

### Reports (`/reports/*`)

| Endpoint | SUPER_ADMIN |
|----------|:-----------:|
| `GET /reports/tenant/:id` | ✅ |
| `GET /reports/platform` | ✅ |
| `POST /reports/schedule` | ✅ |

---

## Permission Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full access |
| ✅* | Limited access (own data only) |
| ❌ | No access |

---

## Implementation Notes

### Guard Implementation

Permissions are enforced via NestJS guards:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'MANAGER')
@Get('team')
async getTeam() { ... }
```

### Resource-Level Permissions

For endpoints marked with *, additional checks ensure users can only access their own data:

```typescript
if (user.role === 'STAFF' && resource.userId !== user.id) {
  throw new ForbiddenException('Access denied');
}
```

### Tenant Isolation

All Tenant API endpoints automatically scope queries to the user's tenant:

```typescript
// Automatically applied in service layer
where: {
  tenantId: user.tenantId,
  ...otherConditions
}
```
