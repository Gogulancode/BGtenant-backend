CREATE TYPE "SalesProspectStatus" AS ENUM ('COLD', 'WARM', 'HOT', 'CONVERTED', 'REJECTED');
CREATE TYPE "SalesProspectReason" AS ENUM ('BUDGET', 'AUTHORITY', 'NEED', 'TIMELINE', 'AVAILABILITY', 'CLOSURE', 'OTHER');

CREATE TABLE "SalesProspect" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "firstCallAt" TIMESTAMP(3),
  "prospectName" TEXT NOT NULL,
  "mobileNumber" TEXT,
  "offeringType" TEXT,
  "proposalValue" DOUBLE PRECISION,
  "referralSource" TEXT,
  "lastFollowUpAt" TIMESTAMP(3),
  "status" "SalesProspectStatus" NOT NULL DEFAULT 'COLD',
  "reason" "SalesProspectReason",
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesProspect_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesProspect_tenantId_userId_month_idx" ON "SalesProspect"("tenantId", "userId", "month");
CREATE INDEX "SalesProspect_tenantId_status_idx" ON "SalesProspect"("tenantId", "status");
CREATE INDEX "SalesProspect_tenantId_lastFollowUpAt_idx" ON "SalesProspect"("tenantId", "lastFollowUpAt");

ALTER TABLE "SalesProspect" ADD CONSTRAINT "SalesProspect_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesProspect" ADD CONSTRAINT "SalesProspect_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
