-- AlterTable
ALTER TABLE "user" ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en';
