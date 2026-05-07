-- Cleanup script for partially applied migration

-- Drop foreign key constraints first
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_tenantId_fkey" CASCADE;
ALTER TABLE "BusinessSnapshot" DROP CONSTRAINT IF EXISTS "BusinessSnapshot_tenantId_fkey" CASCADE;
ALTER TABLE "Metric" DROP CONSTRAINT IF EXISTS "Metric_tenantId_fkey" CASCADE;
ALTER TABLE "Outcome" DROP CONSTRAINT IF EXISTS "Outcome_tenantId_fkey" CASCADE;
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_tenantId_fkey" CASCADE;
ALTER TABLE "SalesPlanning" DROP CONSTRAINT IF EXISTS "SalesPlanning_tenantId_fkey" CASCADE;
ALTER TABLE "SalesTracker" DROP CONSTRAINT IF EXISTS "SalesTracker_tenantId_fkey" CASCADE;
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_fkey" CASCADE;
ALTER TABLE "Insight" DROP CONSTRAINT IF EXISTS "Insight_tenantId_fkey" CASCADE;

-- Drop indexes created by partial migration
DROP INDEX IF EXISTS "Activity_tenantId_userId_status_idx";
DROP INDEX IF EXISTS "BusinessSnapshot_tenantId_idx";
DROP INDEX IF EXISTS "Metric_tenantId_userId_idx";
DROP INDEX IF EXISTS "Outcome_tenantId_userId_weekStartDate_idx";
DROP INDEX IF EXISTS "Review_tenantId_userId_type_idx";
DROP INDEX IF EXISTS "SalesPlanning_tenantId_year_idx";
DROP INDEX IF EXISTS "SalesPlanning_tenantId_userId_year_key";
DROP INDEX IF EXISTS "SalesTracker_tenantId_month_idx";
DROP INDEX IF EXISTS "SalesTracker_tenantId_userId_month_key";
DROP INDEX IF EXISTS "User_tenantId_isActive_idx";
DROP INDEX IF EXISTS "ActionLog_tenantId_createdAt_idx";
DROP INDEX IF EXISTS "Subscription_tenantId_status_idx";
DROP INDEX IF EXISTS "Subscription_stripeCustomerId_key";
DROP INDEX IF EXISTS "Subscription_stripeSubscriptionId_key";
DROP INDEX IF EXISTS "Tenant_slug_key";
DROP INDEX IF EXISTS "Tenant_slug_idx";
DROP INDEX IF EXISTS "Tenant_isActive_idx";

-- Drop tenantId columns if they exist
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "BusinessSnapshot" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Metric" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Outcome" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Review" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "SalesPlanning" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "SalesTracker" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "isActive";
ALTER TABLE "Insight" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "ActionLog" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "ActionLog" DROP COLUMN IF EXISTS "path";

-- Drop Activity columns added by migration
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "title";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "dueDate";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "description";

-- Drop Review columns added by migration
ALTER TABLE "Review" DROP COLUMN IF EXISTS "wins";
ALTER TABLE "Review" DROP COLUMN IF EXISTS "challenges";
ALTER TABLE "Review" DROP COLUMN IF EXISTS "lessons";

-- Drop tables if they exist (created by partial migration)
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "Tenant" CASCADE;

-- Drop enums if they exist
DROP TYPE IF EXISTS "SubscriptionStatus" CASCADE;
DROP TYPE IF EXISTS "SubscriptionPlan" CASCADE;
DROP TYPE IF EXISTS "TenantType" CASCADE;
