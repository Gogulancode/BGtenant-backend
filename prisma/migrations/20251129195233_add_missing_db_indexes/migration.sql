-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- DropIndex
DROP INDEX "OnboardingProgress_tenantId_idx";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM';

-- CreateIndex
CREATE INDEX "Activity_tenantId_createdAt_idx" ON "Activity"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "MetricLog_metricId_date_idx" ON "MetricLog"("metricId", "date");

-- CreateIndex
CREATE INDEX "Outcome_tenantId_status_idx" ON "Outcome"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SalesTracker_userId_month_idx" ON "SalesTracker"("userId", "month");
