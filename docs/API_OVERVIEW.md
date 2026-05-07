# BG Accountability Platform - API Overview

This document provides a high-level overview of the BG Accountability Platform APIs for developers integrating with the system.

## Platform Architecture

The BG Accountability Platform uses a **multi-tenant architecture** with two separate APIs:

| API | Purpose | Audience | Port (Dev) |
|-----|---------|----------|------------|
| **Tenant API** | User-facing features for businesses | Mobile (Flutter), Web Dashboard | 3002 |
| **SuperAdmin API** | Platform administration | Internal admin dashboard | 3003 |

## API Base URLs

### Tenant API
```
Development: http://localhost:3002/api/v1
Production:  https://api.bridgegaps.app/api/v1
```

### SuperAdmin API
```
Development: http://localhost:3003/api/v1
Production:  https://superadmin-api.bridgegaps.app/api/v1
```

---

## Authentication

Both APIs use **JWT-based authentication** with access and refresh tokens.

### Login Flow

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Success - No MFA):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "TENANT_ADMIN"
  }
}
```

**Response (MFA Required):**
```json
{
  "requiresMfa": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### MFA Verification

If `requiresMfa: true`, complete authentication with:

```
POST /api/v1/auth/mfa/login
Content-Type: application/json

{
  "tempToken": "eyJhbGciOiJIUzI1NiIs...",
  "code": "123456"
}
```

### Using Access Tokens

Include the access token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Refresh

Access tokens expire after 15 minutes. Use the refresh token to get new tokens:

```
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

This revokes the current session on the server.

---

## Error Format

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional context
  }
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid input data |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Pagination

Paginated endpoints accept these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 20 | Items per page (max 100) |
| `sortBy` | string | varies | Field to sort by |
| `sortOrder` | string | `desc` | Sort direction: `asc` or `desc` |

**Paginated Response:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

---

## Date Format

All dates use **ISO 8601** format with timezone:

```
2025-11-30T14:30:00.000Z
```

For date-only fields:
```
2025-11-30
```

---

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| General API | 100 requests | 1 minute |
| File uploads | 10 requests | 1 minute |

When rate limited, you'll receive:
```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "retryAfter": 30
}
```

---

## Multi-Tenancy

### Tenant API
- Each authenticated user belongs to a **tenant**
- All data is automatically scoped to the user's tenant
- No cross-tenant data access is possible

### SuperAdmin API
- SuperAdmins can view/manage all tenants
- Tenant ID is specified in request parameters when needed

---

## Roles

### Tenant API Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `TENANT_ADMIN` | Tenant owner/admin | Full access to tenant data |
| `MANAGER` | Team manager | View + edit team data |
| `COACH` | Business coach | View + coaching features |
| `SME` | Subject matter expert | Limited view access |
| `STAFF` | Regular employee | Personal data only |
| `VIEWER` | Read-only access | View dashboards only |

### SuperAdmin API Roles

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Platform administrator - full access |

---

## API Documentation Files

| File | Description |
|------|-------------|
| `tenant-openapi.json` | OpenAPI 3.0 spec for Tenant API |
| `superadmin-openapi.json` | OpenAPI 3.0 spec for SuperAdmin API |
| `TENANT_API_GUIDE.md` | Detailed Tenant API endpoints |
| `SUPERADMIN_API_GUIDE.md` | Detailed SuperAdmin API endpoints |
| `ROLES_MATRIX.md` | Role-based access control reference |

---

## SDK & Code Generation

### Flutter/Dart
```bash
# Using openapi-generator
openapi-generator generate \
  -i docs/tenant-openapi.json \
  -g dart \
  -o lib/api/generated

# Using swagger_parser
dart run swagger_parser:generate -i docs/tenant-openapi.json
```

### TypeScript
```bash
openapi-generator generate \
  -i docs/tenant-openapi.json \
  -g typescript-axios \
  -o src/api/generated
```

---

## Support

- **Documentation**: https://docs.bridgegaps.app
- **Email**: support@bridgegaps.app
- **Status Page**: https://status.bridgegaps.app
