-- DropForeignKey
ALTER TABLE "device_tokens" DROP CONSTRAINT "device_tokens_profileId_fkey";

-- DropTable
DROP TABLE "device_tokens";
