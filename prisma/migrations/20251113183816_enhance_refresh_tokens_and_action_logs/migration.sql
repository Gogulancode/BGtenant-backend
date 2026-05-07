-- AlterTable
ALTER TABLE "ActionLog" ADD COLUMN     "endpoint" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "responseTime" INTEGER,
ADD COLUMN     "statusCode" INTEGER,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "replacedByToken" TEXT,
ALTER COLUMN "expiresAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ActionLog_userId_createdAt_idx" ON "ActionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_module_action_idx" ON "ActionLog"("module", "action");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");
