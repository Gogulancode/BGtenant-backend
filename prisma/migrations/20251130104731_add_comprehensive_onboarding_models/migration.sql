-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NON_PROFIT', 'COOPERATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('TECHNOLOGY', 'HEALTHCARE', 'FINANCE', 'RETAIL', 'MANUFACTURING', 'EDUCATION', 'REAL_ESTATE', 'HOSPITALITY', 'CONSULTING', 'MARKETING', 'CONSTRUCTION', 'TRANSPORTATION', 'AGRICULTURE', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TurnoverBand" AS ENUM ('UNDER_1L', 'L1_TO_5L', 'L5_TO_10L', 'L10_TO_25L', 'L25_TO_50L', 'L50_TO_1CR', 'CR1_TO_5CR', 'CR5_TO_10CR', 'ABOVE_10CR');

-- CreateEnum
CREATE TYPE "EmployeeRange" AS ENUM ('SOLO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "OnboardingProgress" ADD COLUMN     "achievementStagesCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activityConfigCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessIdentityCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesCycleCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesPlanCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selectedPlan" "SubscriptionPlan",
ADD COLUMN     "subscriptionCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visualSetupCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "socialHandles" JSONB;

-- CreateTable
CREATE TABLE "BusinessIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyType" "CompanyType",
    "industry" "Industry",
    "industryOther" TEXT,
    "foundedYear" INTEGER,
    "turnoverBand" "TurnoverBand",
    "employeeRange" "EmployeeRange",
    "website" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "yearMinus3Value" DOUBLE PRECISION,
    "yearMinus2Value" DOUBLE PRECISION,
    "yearMinus1Value" DOUBLE PRECISION,
    "projectedYearValue" DOUBLE PRECISION NOT NULL,
    "monthlyContribution" DOUBLE PRECISION[],
    "monthlyTargets" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "marketingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "networkingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "productDevEnabled" BOOLEAN NOT NULL DEFAULT true,
    "operationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyActivityGoal" INTEGER DEFAULT 5,
    "enableReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderDays" INTEGER[] DEFAULT ARRAY[1, 3, 5]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCycleStage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "probability" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCycleStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementStage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "percentOfGoal" DOUBLE PRECISION,
    "color" TEXT,
    "icon" TEXT,
    "reward" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessIdentity_tenantId_key" ON "BusinessIdentity"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPlan_tenantId_key" ON "SalesPlan"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityConfiguration_tenantId_key" ON "ActivityConfiguration"("tenantId");

-- CreateIndex
CREATE INDEX "SalesCycleStage_tenantId_isActive_idx" ON "SalesCycleStage"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCycleStage_tenantId_order_key" ON "SalesCycleStage"("tenantId", "order");

-- CreateIndex
CREATE INDEX "AchievementStage_tenantId_isActive_idx" ON "AchievementStage"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementStage_tenantId_order_key" ON "AchievementStage"("tenantId", "order");

-- AddForeignKey
ALTER TABLE "BusinessIdentity" ADD CONSTRAINT "BusinessIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPlan" ADD CONSTRAINT "SalesPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityConfiguration" ADD CONSTRAINT "ActivityConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCycleStage" ADD CONSTRAINT "SalesCycleStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementStage" ADD CONSTRAINT "AchievementStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
