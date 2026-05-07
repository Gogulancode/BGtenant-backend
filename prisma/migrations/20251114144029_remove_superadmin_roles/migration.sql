/*
  Warnings:

  - The values [SUPER_ADMIN,COACH,CLIENT] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/

-- Normalize legacy role data before shrinking enum
DELETE FROM "Invitation" WHERE role = 'SUPER_ADMIN';
DELETE FROM "User" WHERE role = 'SUPER_ADMIN';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('TENANT_ADMIN', 'MANAGER', 'STAFF', 'VIEWER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'COACH' THEN 'MANAGER'
    WHEN 'CLIENT' THEN 'STAFF'
    ELSE "role"::text
  END::"Role_new"
);
ALTER TABLE "Invitation" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'COACH' THEN 'MANAGER'
    WHEN 'CLIENT' THEN 'STAFF'
    ELSE "role"::text
  END::"Role_new"
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
COMMIT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
