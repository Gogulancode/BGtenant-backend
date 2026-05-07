-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('B2B', 'B2C', 'BOTH');

-- CreateEnum
CREATE TYPE "BusinessRegistrationStatus" AS ENUM ('REGISTERED', 'UNREGISTERED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('PRODUCT', 'SERVICE', 'BOTH');

-- AlterTable
ALTER TABLE "BusinessIdentity"
ADD COLUMN "customerType" "CustomerType",
ADD COLUMN "registrationStatus" "BusinessRegistrationStatus",
ADD COLUMN "offeringType" "OfferingType",
ADD COLUMN "offerings" JSONB;
