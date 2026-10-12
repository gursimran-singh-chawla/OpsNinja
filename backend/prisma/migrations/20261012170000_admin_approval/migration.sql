-- AlterTable
ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Preserve existing users as approved
UPDATE "User" SET "approvedAt" = CURRENT_TIMESTAMP WHERE "approvedAt" IS NULL;
