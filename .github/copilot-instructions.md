# Business Accountability Backend - NestJS API

This is a NestJS backend API for a Business Accountability Platform that serves both Next.js web dashboard and Flutter mobile clients.

## Architecture
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Documentation**: Swagger/OpenAPI
- **API Prefix**: `/api/v1`

## Core Modules
- **Auth**: Registration, login, JWT tokens, refresh tokens
- **User**: Profile management
- **Business**: Onboarding snapshot, NSM suggestions
- **Metrics**: Key performance indicators with logging
- **Outcomes**: Weekly goal tracking
- **Reviews**: Daily/weekly reflections
- **Sales**: Planning and tracking (quarterly/monthly)
- **Activities**: Task management by category
- **Insights**: Momentum scoring, flags, streaks
- **Settings**: User preferences

## Database Schema
Uses Prisma with PostgreSQL, includes:
- Users with business types (Solopreneur, Startup, MSME)
- Metrics with time-series logging
- Outcomes with weekly planning
- Sales planning (quarterly) and tracking (monthly)
- Review system (daily/weekly)
- Automated insights calculation

## API Design
- RESTful endpoints with consistent responses
- Bearer token authentication (except /auth routes)
- Input validation with class-validator
- Swagger documentation at `/api/docs`
- Proper error handling and status codes

## Business Logic
- NSM (North Star Metric) suggestions based on business type and snapshot
- Momentum scoring: (completed outcomes * 50%) + (active days * 50%)
- Flag system: Green (70+), Yellow (40-69), Red (<40)
- Automatic carry-forward of missed outcomes
- Refresh token rotation for security

## Development Workflow
1. Environment setup with `.env`
2. Prisma migrations and seed data
3. Module-based architecture
4. Guard-protected routes
5. DTO validation on all endpoints

## Client Integration
- Next.js Admin: Uses `NEXT_PUBLIC_API_URL` environment variable
- Flutter Mobile: Uses `BASE_API_URL` environment variable
- Both clients use Bearer token authentication
- Consistent JSON responses with IDs and timestamps