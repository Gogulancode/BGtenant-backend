# Tenant Production Readiness Flow Design

## Goal
Tighten the tenant web app for production by making auth routing, onboarding gating, and recoverable error states predictable across the main user journey.

## Current Context
The tenant app has the major product surfaces in place: registration, onboarding, Today, Dashboard, Sales, Activities, Outcomes, Reports, Settings, and support pages. `ProtectedRoute` already checks for a token and onboarding progress, but it allows app access if onboarding status fails to load. Login and Register also perform direct route decisions that can bypass onboarding correctness.

## Design
Production routing should have one source of truth:
- Public auth pages are only for logged-out users.
- Logged-in users visiting Login or Register should be routed based on onboarding status.
- Main tenant app pages should not render until token and onboarding status are known.
- Incomplete onboarding should redirect to `/onboarding`.
- Completed onboarding should land on `/today`.
- If onboarding status cannot be loaded, show a retryable setup-check error instead of allowing app access with unknown setup state.

The app shell should only render after route protection passes. This prevents unauthenticated users from seeing the sidebar/topbar while redirects are happening.

Login and Register should use consistent response validation:
- Failed login must not write undefined tokens.
- Successful login should store tokens and route through `/today`, where the guard can redirect to onboarding if needed.
- Successful registration should store tokens and route directly to onboarding.

Onboarding should show a retryable error state if the setup state request fails. It should not silently render step 1 with missing server state.

## Components
- `ProtectedRoute`: central private route guard with optional onboarding requirement.
- `PublicOnlyRoute`: central public route guard for `/login` and `/register`.
- `AuthRouteStatus`: shared loading and error presentation for route checks.
- `Login`: use existing auth hook instead of raw fetch.
- `Register`: keep registration form behavior but align logged-in redirect target with onboarding.
- `App`: protect the dashboard layout as a parent route instead of protecting every child route separately.

## Testing
The verification pass will run the frontend build and local route smoke checks. Browser route checks should confirm that `/login`, `/register`, `/onboarding`, `/today`, `/dashboard`, `/sales`, `/activities`, `/outcomes`, and `/reports` return the frontend shell without server errors.
