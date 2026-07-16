-- Add updatedAt columns required for last-write-wins offline conflict
-- resolution. Existing rows are backfilled to their createdAt value (or
-- CURRENT_TIMESTAMP for tables without a createdAt) so the NOT NULL
-- constraint can be enforced. Prisma's @updatedAt decorator handles all
-- subsequent writes from the application layer.

-- AlterTable: emi_payments has no createdAt — backfill to dueDate, which is
-- the closest stable timestamp we have for an existing payment row.
ALTER TABLE "emi_payments" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "emi_payments" SET "updatedAt" = "dueDate" WHERE "updatedAt" IS NULL;
ALTER TABLE "emi_payments" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: emis has createdAt — backfill from there.
ALTER TABLE "emis" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "emis" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "emis" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: investment_deposits has createdAt — backfill from there.
ALTER TABLE "investment_deposits" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "investment_deposits" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "investment_deposits" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: investment_withdrawals has createdAt — backfill from there.
ALTER TABLE "investment_withdrawals" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "investment_withdrawals" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "investment_withdrawals" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: profiles has createdAt — backfill from there.
ALTER TABLE "profiles" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "profiles" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "profiles" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "processed_mutations" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_mutations_createdAt_idx" ON "processed_mutations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "processed_mutations_profileId_clientMutationId_key" ON "processed_mutations"("profileId", "clientMutationId");

-- AddForeignKey
ALTER TABLE "processed_mutations" ADD CONSTRAINT "processed_mutations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
