-- CreateTable
CREATE TABLE "personal_loans" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "principal" DECIMAL(15,2) NOT NULL,
    "totalRepayable" DECIMAL(15,2),
    "startDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_loan_repayments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_loans_profileId_status_idx" ON "personal_loans"("profileId", "status");

-- CreateIndex
CREATE INDEX "personal_loan_repayments_loanId_paidAt_idx" ON "personal_loan_repayments"("loanId", "paidAt");

-- CreateIndex
CREATE INDEX "personal_loan_repayments_profileId_idx" ON "personal_loan_repayments"("profileId");

-- AddForeignKey
ALTER TABLE "personal_loans" ADD CONSTRAINT "personal_loans_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_loan_repayments" ADD CONSTRAINT "personal_loan_repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "personal_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_loan_repayments" ADD CONSTRAINT "personal_loan_repayments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

