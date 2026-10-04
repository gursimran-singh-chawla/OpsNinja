-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- AlterTable
ALTER TABLE "Case" ADD COLUMN "priority" "CasePriority" NOT NULL DEFAULT 'normal';
ALTER TABLE "Case" ADD COLUMN "dueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Case_priority_idx" ON "Case"("priority");
CREATE INDEX "Case_dueAt_idx" ON "Case"("dueAt");
