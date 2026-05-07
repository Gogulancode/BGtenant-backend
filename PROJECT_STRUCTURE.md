# Business Accountability Backend - Project Structure

```
business-accountability-backend/
│
├── .github/
│   └── copilot-instructions.md      # GitHub Copilot workspace instructions
│
├── .vscode/
│   └── tasks.json                   # VS Code tasks for development
│
├── prisma/
│   ├── schema.prisma                # Database schema definition
│   └── seed.ts                      # Database seed script
│
├── src/
│   ├── activities/                  # Activity management module
│   │   ├── dto/
│   │   │   └── activity.dto.ts
│   │   ├── activities.controller.ts
│   │   ├── activities.module.ts
│   │   └── activities.service.ts
│   │
│   ├── auth/                        # Authentication & JWT module
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   │
│   ├── business/                    # Business snapshot & NSM module
│   │   ├── dto/
│   │   │   └── snapshot.dto.ts
│   │   ├── business.controller.ts
│   │   ├── business.module.ts
│   │   └── business.service.ts
│   │
│   ├── common/                      # Shared utilities
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── utils/
│   │       └── pagination.ts
│   │
│   ├── insights/                    # Momentum & insights module
│   │   ├── insights.controller.ts
│   │   ├── insights.module.ts
│   │   └── insights.service.ts
│   │
│   ├── metrics/                     # Metrics tracking module
│   │   ├── dto/
│   │   │   ├── create-metric.dto.ts
│   │   │   └── create-metric-log.dto.ts
│   │   ├── metrics.controller.ts
│   │   ├── metrics.module.ts
│   │   └── metrics.service.ts
│   │
│   ├── outcomes/                    # Weekly outcomes module
│   │   ├── dto/
│   │   │   └── outcome.dto.ts
│   │   ├── outcomes.controller.ts
│   │   ├── outcomes.module.ts
│   │   └── outcomes.service.ts
│   │
│   ├── prisma/                      # Prisma ORM integration
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── reviews/                     # Daily/weekly reviews module
│   │   ├── dto/
│   │   │   └── create-review.dto.ts
│   │   ├── reviews.controller.ts
│   │   ├── reviews.module.ts
│   │   └── reviews.service.ts
│   │
│   ├── sales/                       # Sales planning & tracking module
│   │   ├── dto/
│   │   │   └── sales.dto.ts
│   │   ├── sales.controller.ts
│   │   ├── sales.module.ts
│   │   └── sales.service.ts
│   │
│   ├── settings/                    # User settings module
│   │   ├── settings.controller.ts
│   │   └── settings.module.ts
│   │
│   ├── user/                        # User profile module
│   │   ├── dto/
│   │   │   └── update-profile.dto.ts
│   │   ├── user.controller.ts
│   │   ├── user.module.ts
│   │   └── user.service.ts
│   │
│   ├── app.module.ts                # Main application module
│   └── main.ts                      # Application entry point
│
├── test/                            # E2E tests directory
│
├── .env                             # Environment variables (not in git)
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── nest-cli.json                    # Nest CLI configuration
├── package.json                     # Dependencies & scripts
├── README.md                        # Main documentation
├── QUICKSTART.md                    # Quick start guide
├── tsconfig.json                    # TypeScript configuration
└── tsconfig.build.json              # Build-specific TS config

```

## Module Overview

### Core Modules

1. **Auth Module** (`src/auth`)
   - User registration with email/password
   - JWT-based authentication
   - Refresh token rotation
   - Login/logout endpoints

2. **User Module** (`src/user`)
   - User profile management
   - Business type classification
   - Profile updates

3. **Business Module** (`src/business`)
   - Business snapshot onboarding
   - North Star Metric (NSM) suggestions
   - Business data tracking

4. **Metrics Module** (`src/metrics`)
   - KPI definition and tracking
   - Time-series metric logging
   - Target-based metrics

5. **Outcomes Module** (`src/outcomes`)
   - Weekly goal setting
   - Outcome status tracking (Planned/Done/Missed)
   - Automatic carry-forward of missed outcomes

6. **Reviews Module** (`src/reviews`)
   - Daily reflections
   - Weekly retrospectives
   - Mood tracking

7. **Sales Module** (`src/sales`)
   - Quarterly sales planning
   - Monthly sales tracking
   - Growth percentage calculations
   - MTD/YTD analytics

8. **Activities Module** (`src/activities`)
   - Task categorization (Leads, Sales, etc.)
   - Frequency tracking
   - Activity management

9. **Insights Module** (`src/insights`)
   - Momentum score calculation
   - Flag system (Green/Yellow/Red)
   - Streak tracking
   - Performance analytics

10. **Settings Module** (`src/settings`)
    - User preferences
    - Configuration management

### Supporting Infrastructure

- **Prisma Module** (`src/prisma`)
  - Database connection management
  - ORM service provider

- **Common Module** (`src/common`)
  - JWT authentication guard
  - JWT strategy for Passport
  - Custom decorators (@CurrentUser)
  - Utility functions (pagination)

## Key Features

### Authentication Flow
```
Register/Login → JWT Access Token (15min) + Refresh Token (7d)
→ Protected Routes (Bearer Token)
→ Token Refresh → New Access Token
```

### Database Models
- User, RefreshToken
- BusinessSnapshot
- Metric, MetricLog
- Outcome
- Review
- SalesPlanning, SalesTracker
- Activity
- Insight

### API Endpoints

All endpoints are prefixed with `/api/v1`:

- **Auth**: `/auth/*` (public)
- **User**: `/users/*` (protected)
- **Business**: `/business/*` (protected)
- **Metrics**: `/metrics/*` (protected)
- **Outcomes**: `/outcomes/*` (protected)
- **Reviews**: `/reviews/*` (protected)
- **Sales**: `/sales/*` (protected)
- **Activities**: `/activities/*` (protected)
- **Insights**: `/insights/*` (protected)
- **Settings**: `/settings/*` (protected)

### Documentation

- **Swagger UI**: `http://localhost:3000/api/docs`
- **README.md**: Comprehensive project documentation
- **QUICKSTART.md**: Quick setup guide
- **.github/copilot-instructions.md**: AI assistant context

## Technology Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL
- **ORM**: Prisma 5.x
- **Authentication**: JWT + Passport
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest

## Development Workflow

1. Make changes to code
2. Auto-reload watches for changes
3. Run tests: `npm test`
4. Build: `npm run build`
5. Start production: `npm run start:prod`

## Deployment Checklist

- [ ] Set secure `JWT_SECRET` in production
- [ ] Configure production database URL
- [ ] Enable CORS for your frontend domain
- [ ] Set up environment-specific configs
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Build the project: `npm run build`
- [ ] Start with PM2 or similar process manager

## Client Integration

### Next.js (Web)
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL; // http://api.domain.com/api/v1
```

### Flutter (Mobile)
```dart
final baseUrl = dotenv.env['BASE_API_URL']; // http://api.domain.com/api/v1
```

Both use Bearer token authentication with the same API endpoints.