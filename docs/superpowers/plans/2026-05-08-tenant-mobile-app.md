# Tenant Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first client-demo slice of the BG tenant mobile app: login, protected navigation, Today workspace, Dashboard snapshot, Sales snapshot, Activities snapshot, and Profile/logout.

**Architecture:** Create a fresh Expo Router app at `D:\BG-mobile-app`. Use a small API layer pointed at the tenant Vercel proxy (`https://bridge-gaps-dashboard-main.vercel.app`) so mobile calls `/api/v1/...` without relying on Railway DNS. Keep screens data-driven but resilient with loading, error, and empty states.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, Expo SecureStore, React Context, native Fetch API.

---

### Task 1: Scaffold Expo Router App

**Files:**
- Create project directory: `D:\BG-mobile-app`
- Create standard Expo Router folders: `app`, `src`, `assets`

- [ ] Run `npx create-expo-app@latest D:\BG-mobile-app --template tabs`
- [ ] Confirm `npm run lint` or `npx expo-doctor` if available
- [ ] Commit scaffold as `chore: scaffold tenant mobile app`

### Task 2: Configure API And Auth Storage

**Files:**
- Create: `D:\BG-mobile-app\src\config\env.ts`
- Create: `D:\BG-mobile-app\src\lib\tokens.ts`
- Create: `D:\BG-mobile-app\src\lib\api.ts`
- Create: `D:\BG-mobile-app\src\types\api.ts`

- [ ] Add `API_BASE_URL = "https://bridge-gaps-dashboard-main.vercel.app"`
- [ ] Store access and refresh tokens with `expo-secure-store`
- [ ] Implement `apiFetch(path, options)` with bearer token injection and JSON error handling
- [ ] Implement `loginTenant(email, password)` and `getDashboardSummary()`
- [ ] Verify login API returns tokens with the staging demo account
- [ ] Commit as `feat: add tenant mobile api client`

### Task 3: Build Auth Shell

**Files:**
- Create: `D:\BG-mobile-app\src\context\AuthContext.tsx`
- Modify: `D:\BG-mobile-app\app\_layout.tsx`
- Create or replace: `D:\BG-mobile-app\app\login.tsx`
- Create route group: `D:\BG-mobile-app\app\(tabs)\_layout.tsx`

- [ ] Wrap the app in `AuthProvider`
- [ ] Restore session from SecureStore on startup
- [ ] Redirect unauthenticated users to `/login`
- [ ] Redirect authenticated users to `/(tabs)/today`
- [ ] Build a polished login screen with staging demo-friendly error states
- [ ] Commit as `feat: add mobile auth flow`

### Task 4: Build Client-Demo Tabs

**Files:**
- Create: `D:\BG-mobile-app\app\(tabs)\today.tsx`
- Create: `D:\BG-mobile-app\app\(tabs)\dashboard.tsx`
- Create: `D:\BG-mobile-app\app\(tabs)\sales.tsx`
- Create: `D:\BG-mobile-app\app\(tabs)\activities.tsx`
- Create: `D:\BG-mobile-app\app\(tabs)\profile.tsx`
- Create: `D:\BG-mobile-app\src\components\MetricCard.tsx`
- Create: `D:\BG-mobile-app\src\components\ScreenState.tsx`

- [ ] Today shows setup progress, weekly sales target, weekly activity completion, due-today actions, and recommendations
- [ ] Dashboard shows business overview, sales progress, CRM summary, outcomes, and momentum
- [ ] Sales shows monthly/weekly targets, pipeline, converted value, and next follow-ups
- [ ] Activities shows active/completed counts, weekly goal progress, and due-today list
- [ ] Profile shows user/business info and logout
- [ ] Commit as `feat: add tenant mobile demo tabs`

### Task 5: Verify And Prepare Demo

**Files:**
- Create: `D:\BG-mobile-app\README.md`

- [ ] Run `npm run lint` if scaffold provides lint
- [ ] Run `npx expo-doctor`
- [ ] Start Expo with `npx expo start --web` or `npx expo start`
- [ ] Verify login with `tenant@bgstaging.com / Admin@12345`
- [ ] Verify each tab renders without crashes
- [ ] Document demo URL/command and credentials in README
- [ ] Commit as `docs: add mobile demo instructions`

