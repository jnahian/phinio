-- Unify DPS + savings into the single Investment model.
-- This migration:
--   1. Adds unified columns to "investments"
--   2. Makes "dateOfInvestment" nullable (needed for scheduled/flexible modes)
--   3. Creates the "investment_deposits" table
--   4. Drops the old "dps_installments" and "dps" tables

-- Step 1: Add new columns to "investments"
ALTER TABLE "investments"
  ADD COLUMN "mode"           TEXT NOT NULL DEFAULT 'lump_sum',
  ADD COLUMN "monthlyDeposit" DECIMAL(15,2),
  ADD COLUMN "tenureMonths"   INTEGER,
  ADD COLUMN "interestRate"   DECIMAL(5,2),
  ADD COLUMN "interestType"   TEXT,
  ADD COLUMN "startDate"      DATE;

-- Step 2: Make "dateOfInvestment" nullable
ALTER TABLE "investments"
  ALTER COLUMN "dateOfInvestment" DROP NOT NULL;

-- Step 3: Add index on (profileId, mode)
CREATE INDEX "investments_profileId_mode_idx" ON "investments"("profileId", "mode");

-- Step 4: Create "investment_deposits"
CREATE TABLE "investment_deposits" (
    "id"                TEXT          NOT NULL,
    "investmentId"      TEXT          NOT NULL,
    "profileId"         TEXT          NOT NULL,
    "amount"            DECIMAL(15,2) NOT NULL,
    "dueDate"           DATE,
    "paidAt"            TIMESTAMP(3),
    "accruedValue"      DECIMAL(15,2),
    "installmentNumber" INTEGER,
    "status"            TEXT          NOT NULL DEFAULT 'upcoming',
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_deposits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_deposits_investmentId_installmentNumber_idx"
  ON "investment_deposits"("investmentId", "installmentNumber");

CREATE INDEX "investment_deposits_profileId_status_dueDate_idx"
  ON "investment_deposits"("profileId", "status", "dueDate");

ALTER TABLE "investment_deposits"
  ADD CONSTRAINT "investment_deposits_investmentId_fkey"
    FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_deposits"
  ADD CONSTRAINT "investment_deposits_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop old DPS tables (data is gone since we force-reset the prod DB)
DROP TABLE IF EXISTS "dps_installments";
DROP TABLE IF EXISTS "dps";
