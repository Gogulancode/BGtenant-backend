/*
  Multi-Tenant Migration - Modified to handle existing data
  
  Strategy:
  1. Create new enums and tables (Tenant, Subscription)
  2. Update Role enum (add TENANT_ADMIN while keeping ADMIN temporarily)
  3. Insert default tenant
  4. Update existing ADMIN → TENANT_ADMIN  
  5. Remove ADMIN from enum
  6. Add tenantId columns as NULLABLE
  7. Backfill existing data with default tenant ID
  8. Make tenantId columns NOT NULL
  9. Add foreign key constraints and indexes

*/

-- STEP 1: Create new enums
CREATE TYPE "TenantType" AS ENUM ('COMPANY', 'FREELANCER');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED');

-- STEP 2: Create Tenant and Subscription tables
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxMetrics" INTEGER NOT NULL DEFAULT 10,
    "maxActivities" INTEGER NOT NULL DEFAULT 50,
    "billingEmail" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");

-- STEP 3: Insert default tenant (UUID generated deterministically)
INSERT INTO "Tenant" ("id", "name", "type", "slug", "isActive", "createdAt", "updatedAt")
VALUES ('default-tenant-id', 'Default Tenant', 'COMPANY', 'default-tenant', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- STEP 4: Insert default subscription
INSERT INTO "Subscription" ("id", "tenantId", "plan", "status", "maxUsers", "maxMetrics", "maxActivities", "createdAt", "updatedAt")
VALUES ('default-subscription-id', 'default-tenant-id', 'PROFESSIONAL', 'ACTIVE', 100, 100, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- STEP 5: Update Role enum FIRST (add TENANT_ADMIN while keeping ADMIN temporarily)
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'COACH', 'CLIENT', 'MANAGER', 'VIEWER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
COMMIT;

-- STEP 6: Now update existing User roles (ADMIN → TENANT_ADMIN, now both values exist)
UPDATE "User" SET "role" = 'TENANT_ADMIN' WHERE "role" = 'ADMIN';

-- STEP 7: Remove ADMIN from enum (now safe since no data uses it)
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'COACH', 'CLIENT', 'MANAGER', 'VIEWER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
COMMIT;

-- STEP 8: Add nullable tenantId columns to all tables
ALTER TABLE "ActionLog" ADD COLUMN "path" TEXT;
ALTER TABLE "ActionLog" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "Activity" DROP COLUMN IF EXISTS "frequency";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Activity" ADD COLUMN "description" TEXT;
ALTER TABLE "Activity" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Activity" ADD COLUMN "priority" TEXT;
ALTER TABLE "Activity" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "Activity" ADD COLUMN "title" TEXT;
ALTER TABLE "Activity" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "BusinessSnapshot" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Insight" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Metric" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Outcome" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "Review" ADD COLUMN "challenges" TEXT;
ALTER TABLE "Review" ADD COLUMN "lessons" TEXT;
ALTER TABLE "Review" ADD COLUMN "wins" TEXT;
ALTER TABLE "Review" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "SalesPlanning" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SalesTracker" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "User" ALTER COLUMN "businessType" SET DEFAULT 'Solopreneur';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';

-- STEP 9: Backfill existing data with default tenant ID
UPDATE "BusinessSnapshot" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "Insight" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "Metric" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "Outcome" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "Review" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "SalesPlanning" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "SalesTracker" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "Activity" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;

-- Assign all TENANT_ADMIN users to default tenant (SUPER_ADMIN stays null)
UPDATE "User" SET "tenantId" = 'default-tenant-id' WHERE "role" != 'SUPER_ADMIN' AND "tenantId" IS NULL;

-- Set default title for activities if empty
UPDATE "Activity" SET "title" = 'Migrated Activity' WHERE "title" IS NULL;

-- STEP 10: Make tenantId NOT NULL (now safe since all data has values)
ALTER TABLE "BusinessSnapshot" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Insight" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Metric" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Outcome" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SalesPlanning" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SalesTracker" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "title" SET NOT NULL;

-- STEP 11: Add foreign key constraints
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessSnapshot" ADD CONSTRAINT "BusinessSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesPlanning" ADD CONSTRAINT "SalesPlanning_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesTracker" ADD CONSTRAINT "SalesTracker_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 12: Add indexes for performance
CREATE INDEX "ActionLog_tenantId_createdAt_idx" ON "ActionLog"("tenantId", "createdAt");
CREATE INDEX "Activity_tenantId_userId_status_idx" ON "Activity"("tenantId", "userId", "status");
CREATE INDEX "BusinessSnapshot_tenantId_idx" ON "BusinessSnapshot"("tenantId");
CREATE INDEX "Insight_tenantId_idx" ON "Insight"("tenantId");
CREATE INDEX "Metric_tenantId_userId_idx" ON "Metric"("tenantId", "userId");
CREATE INDEX "Outcome_tenantId_userId_weekStartDate_idx" ON "Outcome"("tenantId", "userId", "weekStartDate");
CREATE INDEX "Review_tenantId_userId_type_idx" ON "Review"("tenantId", "userId", "type");
CREATE INDEX "SalesPlanning_tenantId_year_idx" ON "SalesPlanning"("tenantId", "year");
CREATE INDEX "SalesTracker_tenantId_month_idx" ON "SalesTracker"("tenantId", "month");
CREATE INDEX "User_tenantId_isActive_idx" ON "User"("tenantId", "isActive");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");

-- STEP 13: Add unique constraints (check for duplicates first)
CREATE UNIQUE INDEX "SalesPlanning_tenantId_userId_year_key" ON "SalesPlanning"("tenantId", "userId", "year");
CREATE UNIQUE INDEX "SalesTracker_tenantId_userId_month_key" ON "SalesTracker"("tenantId", "userId", "month");
