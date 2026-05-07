# Business Accountability Backend

A comprehensive NestJS backend API for a Business Accountability Platform serving:
- **Tenant Web Dashboard** (Next.js) at `http://localhost:3000`
- **Platform Admin Dashboard** (Next.js) at `http://localhost:3001`
- **Mobile App** (Flutter)

## 🏗️ Architecture

### **Three-Application System**

1. **Backend API** (Port 3002) - NestJS
   - Serves both tenant and platform admin endpoints
   - JWT authentication with role-based access
   - Tenant-scoped data isolation
   
2. **Tenant Dashboard** (Port 3000) - Next.js
   - For business users: TENANT_ADMIN, COACH, SME, CLIENT, MANAGER, VIEWER
   - Dashboard, metrics, outcomes, sales, reviews, activities, settings
   - Blocks SUPER_ADMIN access (redirects to platform admin)
   
3. **Platform Admin** (Port 3001) - Next.js
   - For SUPER_ADMIN only
   - Tenant management, subscriptions, platform analytics, operations
   - Separate application at `d:\superadmin-app`

## 🚀 Features

### **Tenant-Scoped Features** (Port 3000 Dashboard)
- **Authentication**: JWT-based with refresh tokens
- **User Management**: Profile management with business type
- **Business Insights**: Onboarding snapshot and NSM suggestions
- **Metrics Tracking**: KPI logging with time-series data
- **Outcomes Management**: Weekly goal tracking
- **Reviews**: Daily and weekly reflections
- **Sales Planning**: Quarterly planning and monthly tracking
- **Activities**: Task management by category
- **Insights Engine**: Momentum scoring, flag system, streaks

### **Platform-Level Features** (Port 3001 Admin)
- **Tenant Management**: Create, list, update tenants
- **Subscription Management**: Plans, billing, limits
- **Platform Analytics**: Cross-tenant insights
- **System Operations**: Health monitoring, diagnostics
- **User Management**: Platform-wide user administration
- **Tenant-Ready Ops**: Per-tenant throttles, onboarding automation, MFA enforcement

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## 🛠️ Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accountability?schema=public"
   JWT_SECRET="supersecretkey"
   PORT=3002
   ```

3. **Initialize Prisma**:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Seed the database** (optional):
   ```bash
   npx prisma db seed
   ```

## 🏃‍♂️ Running the Application

### Development mode
```bash
npm run start:dev
```

### Production mode
```bash
npm run build
npm run start:prod
```

## 📚 API Documentation

Once the application is running, access the Swagger documentation at:
- **Swagger UI**: `http://localhost:3002/api/docs`
- **API Base**: `http://localhost:3002/api/v1`
- **Observability Guide**: See `OBSERVABILITY_GUIDE.md` for telemetry, rate-limit, and audit-log payloads used by on-call dashboards.

> Swagger UI now includes request/response examples, role requirements, and shared error states for every tenant module (User, Settings, Sessions, Templates, Dashboard, etc.), so the docs double as a contract for the web + mobile clients.

### **API Endpoint Categories**

#### **Public Endpoints**
- `/api/v1/auth/*` - Authentication (no token required)
- `/api/v1/ops/health` - Health check

#### **Tenant-Scoped Endpoints** (Requires tenant role)
- `/api/v1/users/*` - User profile
- `/api/v1/business/*` - Business snapshot & NSM
- `/api/v1/metrics/*` - Metrics tracking
- `/api/v1/outcomes/*` - Weekly outcomes
- `/api/v1/reviews/*` - Daily/weekly reviews
- `/api/v1/sales/*` - Sales planning
- `/api/v1/activities/*` - Task management
- `/api/v1/insights/*` - Momentum & analytics
- `/api/v1/settings/*` - User settings
- `/api/v1/templates/*` - Metric templates
- `/api/v1/support/*` - Support tickets
- `/api/v1/reports/*` - Reports
- `/api/v1/performance/*` - Performance analytics
- `/api/v1/sessions/*` - Coaching sessions

#### **Platform Admin Endpoints** (SUPER_ADMIN only)
- `/api/v1/platform/tenants/*` - Tenant management
- `/api/v1/super-admin/*` - Legacy super admin routes
- `/api/v1/auth/mfa/*` - Admins can enforce MFA for their own accounts

## 🏗️ Project Structure

```
src/
├── auth/               # Authentication & JWT
├── user/               # User profile management
├── business/           # Business snapshot & NSM
├── metrics/            # Metrics and logs
├── outcomes/           # Weekly outcomes
├── reviews/            # Daily/weekly reviews
├── sales/              # Sales planning & tracking
├── activities/         # Activity management
├── insights/           # Momentum & insights
├── settings/           # User settings
├── templates/          # Metric templates
├── support/            # Support tickets
├── reports/            # Report generation
├── performance/        # Performance analytics
├── sessions/           # Coaching sessions
├── ops/                # Health & diagnostics
├── platform/           # Platform management (SUPER_ADMIN)
│   └── tenants/        # Tenant CRUD
├── super-admin/        # Legacy super admin module
├── action-log/         # Action logging
├── prisma/             # Prisma service
├── common/             # Guards, decorators, middleware, filters
├── app.module.ts       # Main application module
└── main.ts             # Application entry point
```

### Business
- `POST /api/v1/business/snapshot` - Create/update snapshot
- `GET /api/v1/business/snapshot` - Get snapshot
- `GET /api/v1/business/nsm` - Get NSM suggestion

### Metrics
- `GET /api/v1/metrics` - Get all metrics
- `POST /api/v1/metrics` - Create metric
- `POST /api/v1/metrics/:id/logs` - Create log entry

### Outcomes
- `GET /api/v1/outcomes` - Get outcomes
- `POST /api/v1/outcomes` - Create outcome
- `PUT /api/v1/outcomes/:id` - Update outcome
- `DELETE /api/v1/outcomes/:id` - Delete outcome
- `POST /api/v1/outcomes/carry-forward` - Carry forward missed

### Reviews
- `GET /api/v1/reviews` - Get reviews
- `POST /api/v1/reviews` - Create review

### Sales
- `GET /api/v1/sales/planning` - Get planning
- `POST /api/v1/sales/planning` - Create/update planning
- `GET /api/v1/sales/tracker` - Get tracker
- `POST /api/v1/sales/tracker` - Create/update tracker

### Activities
- `GET /api/v1/activities` - Get activities
- `POST /api/v1/activities` - Create activity
- `PUT /api/v1/activities/:id` - Update activity
- `DELETE /api/v1/activities/:id` - Delete activity

### Insights
- `GET /api/v1/insights` - Get insights

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Database Schema

The application uses Prisma with PostgreSQL and includes:

- **User**: With business type (Solopreneur, Startup, MSME)
- **RefreshToken**: For JWT refresh token management
- **BusinessSnapshot**: Onboarding data and NSM
- **Metric & MetricLog**: KPI tracking
- **Outcome**: Weekly goals
- **Review**: Daily/weekly reflections
- **SalesPlanning & SalesTracker**: Sales management
- **Activity**: Task tracking
- **Insight**: Momentum scoring

## 🔐 Authentication

The API uses JWT Bearer tokens:

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}'

# Use token in requests
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Password Policy & MFA
- Passwords must be **≥10 characters** and include uppercase, lowercase, number, and symbol characters.
- Endpoints:
   - `POST /auth/mfa/enroll` – generate a TOTP secret/QR payload.
   - `POST /auth/mfa/enable` – verify a 6-digit code to enable MFA.
   - `POST /auth/mfa/disable` – disable MFA with a final verification code.
- Login requests require the `mfaCode` field when MFA is enabled for the user.

## 🌍 Client Integration

### Next.js (Web Dashboard)
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL; // http://localhost:3000/api/v1
```

### Flutter (Mobile App)
```dart
final baseUrl = dotenv.env['BASE_API_URL']; // http://10.0.2.2:3000/api/v1
```

## 📝 Business Logic

### NSM Suggestion Algorithm
- **Solopreneur**: Monthly Revenue
- **Startup** (>100 orders/month): Active Customers
- **MSME** (<20% profit margin): Net Profit
- **Default**: Monthly Revenue

### Momentum Scoring
```
momentum = (completedOutcomes / totalOutcomes) × 50% + (activeDays / 7) × 50%
```

### Flag System
- **Green**: ≥70% momentum
- **Yellow**: 40-69% momentum
- **Red**: <40% momentum

## 🚢 Deployment

### Railway / Render
1. Connect your repository
2. Add environment variables
3. Deploy automatically

### Environment Variables (Production)
```env
DATABASE_URL=your_production_database_url
JWT_SECRET=your_secure_jwt_secret
PORT=3000
```

## 📄 License

UNLICENSED

## 👥 Support

For issues and questions, please refer to the project documentation or contact the development team.