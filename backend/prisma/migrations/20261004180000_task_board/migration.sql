-- CreateEnum
CREATE TYPE "BoardColumn" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "boardColumn" "BoardColumn" NOT NULL DEFAULT 'TODO';
ALTER TABLE "Task" ADD COLUMN "boardRank" TEXT NOT NULL DEFAULT '000000500000';

UPDATE "Task" SET "boardColumn" = 'DONE' WHERE "finishedAt" IS NOT NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "boardColumn" ORDER BY "createdAt" ASC) AS rn
  FROM "Task"
)
UPDATE "Task" t
SET "boardRank" = lpad((ranked.rn * 1024)::text, 12, '0')
FROM ranked
WHERE t.id = ranked.id;

CREATE INDEX "Task_boardColumn_boardRank_idx" ON "Task"("boardColumn", "boardRank");
