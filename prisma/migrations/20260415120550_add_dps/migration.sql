-- CreateTable
CREATE TABLE "dps" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyDeposit" DECIMAL(15,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "interestType" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dps_installments" (
    "id" TEXT NOT NULL,
    "dpsId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "depositAmount" DECIMAL(15,2) NOT NULL,
    "accruedValue" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "dps_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dps_profileId_status_idx" ON "dps"("profileId", "status");

-- CreateIndex
CREATE INDEX "dps_installments_dpsId_installmentNumber_idx" ON "dps_installments"("dpsId", "installmentNumber");

-- CreateIndex
CREATE INDEX "dps_installments_profileId_status_dueDate_idx" ON "dps_installments"("profileId", "status", "dueDate");

-- AddForeignKey
ALTER TABLE "dps" ADD CONSTRAINT "dps_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dps_installments" ADD CONSTRAINT "dps_installments_dpsId_fkey" FOREIGN KEY ("dpsId") REFERENCES "dps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dps_installments" ADD CONSTRAINT "dps_installments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
