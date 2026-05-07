# Tenant API Guide

Complete endpoint reference for the BG Accountability Tenant API.

**Base URL:** `https://api.bridgegaps.app/api/v1`  
**Authentication:** Bearer Token (JWT)

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Dashboard](#dashboard)
4. [Business & Onboarding](#business--onboarding)
5. [Metrics](#metrics)
6. [Outcomes](#outcomes)
7. [Sales](#sales)
8. [Reviews](#reviews)
9. [Activities](#activities)
10. [Insights](#insights)
11. [Settings](#settings)
12. [Support](#support)
13. [Templates](#templates)

---

## Authentication

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@company.com",
    "name": "John Doe",
    "role": "TENANT_ADMIN",
    "tenantId": "tenant-uuid"
  }
}
```

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@company.com",
  "password": "securePassword123",
  "name": "Jane Smith",
  "tenantName": "Acme Corp"
}
```

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout

```http
POST /auth/logout
Authorization: Bearer <access_token>
```

### MFA Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/mfa/status` | Check if MFA is enabled |
| POST | `/auth/mfa/enroll` | Start MFA enrollment |
| POST | `/auth/mfa/verify` | Verify code and enable MFA |
| POST | `/auth/mfa/disable` | Disable MFA (requires password + code) |
| POST | `/auth/mfa/login` | Complete login with MFA code |

---

## User Management

### Get Current User

```http
GET /user/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@company.com",
  "name": "John Doe",
  "role": "TENANT_ADMIN",
  "tenantId": "tenant-uuid",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Update Profile

```http
PATCH /user/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John D. Doe",
  "phone": "+1234567890"
}
```

### Change Password

```http
POST /user/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldPassword",
  "newPassword": "newSecurePassword123"
}
```

---

## Dashboard

### Get Dashboard Summary

```http
GET /dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "momentumScore": 78,
  "flag": "GREEN",
  "streak": 12,
  "outcomesCompleted": 8,
  "outcomesTotal": 10,
  "activitiesLogged": 45,
  "metricsLogged": 120,
  "weeklyProgress": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": false,
    "friday": false
  }
}
```

---

## Business & Onboarding

### Get Business Snapshot

```http
GET /business
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "business-uuid",
  "businessType": "STARTUP",
  "industry": "Technology",
  "teamSize": "11-50",
  "annualRevenue": "$1M-$5M",
  "nsmId": "metric-uuid",
  "nsmName": "Monthly Recurring Revenue",
  "isOnboarded": true,
  "onboardingCompletedAt": "2025-01-20T14:00:00Z"
}
```

### Update Business Snapshot

```http
PATCH /business
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessType": "MSME",
  "industry": "E-commerce",
  "teamSize": "51-200"
}
```

### Get NSM Suggestions

```http
GET /business/nsm-suggestions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "metric-uuid-1",
      "name": "Monthly Recurring Revenue",
      "description": "Track recurring subscription revenue",
      "category": "REVENUE"
    },
    {
      "id": "metric-uuid-2",
      "name": "Customer Acquisition Cost",
      "description": "Cost to acquire new customers",
      "category": "GROWTH"
    }
  ]
}
```

---

## Metrics

### List Metrics

```http
GET /metrics?page=1&pageSize=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "items": [
    {
      "id": "metric-uuid",
      "name": "Revenue",
      "category": "FINANCIAL",
      "unit": "USD",
      "targetValue": 100000,
      "currentValue": 85000,
      "isNSM": true
    }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 20
}
```

### Create Metric

```http
POST /metrics
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Customer Satisfaction",
  "category": "CUSTOMER",
  "unit": "%",
  "targetValue": 90,
  "description": "NPS-based satisfaction score"
}
```

### Log Metric Value

```http
POST /metrics/:id/log
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": 87.5,
  "date": "2025-11-30",
  "notes": "Post-launch survey results"
}
```

### Get Metric History

```http
GET /metrics/:id/history?startDate=2025-01-01&endDate=2025-11-30
Authorization: Bearer <token>
```

---

## Outcomes

### List Weekly Outcomes

```http
GET /outcomes?weekStart=2025-11-25
Authorization: Bearer <token>
```

**Response:**
```json
{
  "items": [
    {
      "id": "outcome-uuid",
      "title": "Launch new feature",
      "description": "Complete and deploy user dashboard",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2025-11-29",
      "completedAt": null
    }
  ],
  "total": 5
}
```

### Create Outcome

```http
POST /outcomes
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Close 3 enterprise deals",
  "description": "Focus on Q4 pipeline",
  "priority": "HIGH",
  "weekStart": "2025-11-25"
}
```

### Update Outcome Status

```http
PATCH /outcomes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

---

## Sales

### Get Quarterly Plan

```http
GET /sales/quarterly?year=2025&quarter=4
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "plan-uuid",
  "year": 2025,
  "quarter": 4,
  "targetRevenue": 500000,
  "targetDeals": 20,
  "strategies": ["Enterprise focus", "Upsell existing"],
  "createdAt": "2025-10-01T00:00:00Z"
}
```

### Log Monthly Sales

```http
POST /sales/monthly
Authorization: Bearer <token>
Content-Type: application/json

{
  "year": 2025,
  "month": 11,
  "revenue": 175000,
  "dealsWon": 7,
  "dealsLost": 2,
  "pipelineValue": 450000
}
```

---

## Reviews

### Submit Daily Review

```http
POST /reviews/daily
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2025-11-30",
  "wins": ["Closed major deal", "Team aligned on Q1 goals"],
  "challenges": ["Resource constraints"],
  "tomorrowFocus": ["Finalize budget", "Team 1:1s"],
  "energyLevel": 8,
  "notes": "Productive day overall"
}
```

### Submit Weekly Review

```http
POST /reviews/weekly
Authorization: Bearer <token>
Content-Type: application/json

{
  "weekStart": "2025-11-25",
  "outcomesCompleted": 4,
  "outcomesTotal": 5,
  "keyWins": ["Launched feature X", "Hired 2 engineers"],
  "keyLearnings": ["Need better sprint planning"],
  "nextWeekPriorities": ["Complete onboarding", "Start Q1 planning"],
  "overallRating": 4
}
```

### Get Review History

```http
GET /reviews?type=daily&startDate=2025-11-01&endDate=2025-11-30
Authorization: Bearer <token>
```

---

## Activities

### List Activities

```http
GET /activities?category=SALES&status=PENDING
Authorization: Bearer <token>
```

**Response:**
```json
{
  "items": [
    {
      "id": "activity-uuid",
      "title": "Follow up with Acme Corp",
      "category": "SALES",
      "status": "PENDING",
      "priority": "HIGH",
      "dueDate": "2025-12-01",
      "assignedTo": "user-uuid"
    }
  ],
  "total": 25
}
```

### Create Activity

```http
POST /activities
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Send proposal to client",
  "category": "SALES",
  "priority": "HIGH",
  "dueDate": "2025-12-02",
  "description": "Include pricing for enterprise tier"
}
```

### Activity Categories

| Category | Description |
|----------|-------------|
| `SALES` | Sales-related tasks |
| `MARKETING` | Marketing activities |
| `OPERATIONS` | Operational tasks |
| `PRODUCT` | Product development |
| `CUSTOMER_SUCCESS` | Customer support/success |
| `ADMIN` | Administrative tasks |

---

## Insights

### Get Momentum Score

```http
GET /insights/momentum
Authorization: Bearer <token>
```

**Response:**
```json
{
  "score": 78,
  "flag": "GREEN",
  "trend": "UP",
  "components": {
    "outcomesCompletion": 80,
    "activeDays": 76,
    "metricsLogged": 85,
    "reviewsSubmitted": 70
  },
  "streak": 12,
  "lastActiveAt": "2025-11-30T15:30:00Z"
}
```

### Get Trend Analysis

```http
GET /insights/trends?period=30d
Authorization: Bearer <token>
```

---

## Settings

### Get User Settings

```http
GET /settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "notifications": {
    "email": true,
    "push": true,
    "dailyReminder": true,
    "weeklyDigest": true
  },
  "preferences": {
    "timezone": "America/New_York",
    "dateFormat": "MM/DD/YYYY",
    "theme": "light"
  }
}
```

### Update Settings

```http
PATCH /settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "notifications": {
    "dailyReminder": false
  },
  "preferences": {
    "timezone": "Europe/London"
  }
}
```

---

## Support

### Create Support Ticket

```http
POST /support/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "Cannot access dashboard",
  "description": "Getting 403 error when loading dashboard",
  "priority": "HIGH",
  "category": "BUG"
}
```

### List My Tickets

```http
GET /support/tickets
Authorization: Bearer <token>
```

### Add Comment to Ticket

```http
POST /support/tickets/:id/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "I've tried clearing cache but issue persists"
}
```

---

## Templates

### List Available Templates

```http
GET /templates?category=SALES
Authorization: Bearer <token>
```

### Apply Template

```http
POST /templates/:id/apply
Authorization: Bearer <token>
```

---

## Required Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer <access_token>` | Yes (except auth endpoints) |
| `Content-Type` | `application/json` | Yes (for POST/PUT/PATCH) |
| `Accept` | `application/json` | Recommended |

---

## Error Responses

### Validation Error (400)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "code": "TOKEN_EXPIRED"
}
```

### Forbidden (403)
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "requiredRole": "TENANT_ADMIN"
}
```

### Not Found (404)
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "resource": "Outcome",
  "id": "invalid-uuid"
}
```
