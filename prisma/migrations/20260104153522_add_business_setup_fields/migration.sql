-- AlterTable
ALTER TABLE "BusinessIdentity" ADD COLUMN     "businessAge" INTEGER,
ADD COLUMN     "keywords" TEXT[],
ADD COLUMN     "usp" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "painPoints" JSONB;

-- CreateTable
CREATE TABLE "BusinessSetupChecklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uspDefined" BOOLEAN NOT NULL DEFAULT false,
    "uspValue" TEXT,
    "menuCardDefined" BOOLEAN NOT NULL DEFAULT false,
    "menuCardValue" TEXT,
    "packagesDefined" BOOLEAN NOT NULL DEFAULT false,
    "packagesValue" TEXT,
    "customerSegmentDefined" BOOLEAN NOT NULL DEFAULT false,
    "customerSegmentValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSetupChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSetupChecklist_tenantId_key" ON "BusinessSetupChecklist"("tenantId");

-- AddForeignKey
ALTER TABLE "BusinessSetupChecklist" ADD CONSTRAINT "BusinessSetupChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
