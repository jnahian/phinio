-- Add InvestmentWithdrawal table so lump-sum/savings can record withdrawals
-- and DPS schemes can capture premature-closure payouts.

CREATE TABLE "investment_withdrawals" (
    "id"             TEXT          NOT NULL,
    "investmentId"   TEXT          NOT NULL,
    "profileId"      TEXT          NOT NULL,
    "amount"         DECIMAL(15,2) NOT NULL,
    "withdrawalDate" DATE          NOT NULL,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_withdrawals_investmentId_withdrawalDate_idx"
  ON "investment_withdrawals"("investmentId", "withdrawalDate");

CREATE INDEX "investment_withdrawals_profileId_idx"
  ON "investment_withdrawals"("profileId");

ALTER TABLE "investment_withdrawals"
  ADD CONSTRAINT "investment_withdrawals_investmentId_fkey"
    FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_withdrawals"
  ADD CONSTRAINT "investment_withdrawals_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
