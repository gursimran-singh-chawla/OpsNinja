-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "archiveAfter" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_archiveAfter_idx" ON "Task"("archiveAfter");

-- Backfill completedAt and archiveAfter for existing finished tasks
UPDATE "Task"
SET "completedAt" = "finishedAt",
    "archiveAfter" = "finishedAt" + INTERVAL '48 hours'
WHERE "finishedAt" IS NOT NULL;

-- Backfill tasks in DONE column that lacked finishedAt
UPDATE "Task"
SET "finishedAt" = "updatedAt",
    "completedAt" = "updatedAt",
    "archiveAfter" = "updatedAt" + INTERVAL '48 hours'
WHERE "finishedAt" IS NULL AND "boardColumn" = 'DONE';
