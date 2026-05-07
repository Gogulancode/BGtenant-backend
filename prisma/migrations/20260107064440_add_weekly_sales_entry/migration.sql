-- CreateTable
CREATE TABLE "WeeklySalesEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "achieved" DOUBLE PRECISION NOT NULL,
    "orders" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySalesEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklySalesEntry_tenantId_year_week_idx" ON "WeeklySalesEntry"("tenantId", "year", "week");

-- CreateIndex
CREATE INDEX "WeeklySalesEntry_userId_year_idx" ON "WeeklySalesEntry"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySalesEntry_tenantId_userId_year_week_key" ON "WeeklySalesEntry"("tenantId", "userId", "year", "week");

-- AddForeignKey
ALTER TABLE "WeeklySalesEntry" ADD CONSTRAINT "WeeklySalesEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySalesEntry" ADD CONSTRAINT "WeeklySalesEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
