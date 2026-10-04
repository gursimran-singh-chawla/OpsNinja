-- Rename enums
ALTER TYPE "CaseCategory" RENAME TO "TaskCategory";
ALTER TYPE "CasePriority" RENAME TO "TaskPriority";

CREATE TYPE "WorkKind" AS ENUM ('task', 'escalation', 'backlog', 'report');

ALTER TYPE "NotificationType" RENAME VALUE 'case_assigned' TO 'task_assigned';
ALTER TYPE "NotificationType" RENAME VALUE 'case_shared' TO 'task_shared';
ALTER TYPE "NotificationType" RENAME VALUE 'case_routed_to_manager' TO 'task_routed_to_manager';
ALTER TYPE "NotificationType" RENAME VALUE 'red_flag' TO 'task_overdue';
ALTER TYPE "NotificationType" RENAME VALUE 'case_updated' TO 'task_updated';

-- Rename Case table and columns
ALTER TABLE "Case" RENAME TO "Task";
ALTER TABLE "Task" ADD COLUMN "workKind" "WorkKind" NOT NULL DEFAULT 'task';
ALTER TABLE "Task" ADD COLUMN "metadata" JSONB;

ALTER INDEX "Case_pkey" RENAME TO "Task_pkey";
ALTER INDEX "Case_assigneeId_idx" RENAME TO "Task_assigneeId_idx";
ALTER INDEX "Case_createdById_idx" RENAME TO "Task_createdById_idx";
ALTER INDEX "Case_visibilityType_idx" RENAME TO "Task_visibilityType_idx";
ALTER INDEX "Case_visibilityManagerId_idx" RENAME TO "Task_visibilityManagerId_idx";
ALTER INDEX "Case_redFlag_idx" RENAME TO "Task_redFlag_idx";
ALTER INDEX "Case_archivedAt_idx" RENAME TO "Task_archivedAt_idx";
ALTER INDEX "Case_priority_idx" RENAME TO "Task_priority_idx";
ALTER INDEX "Case_dueAt_idx" RENAME TO "Task_dueAt_idx";
DROP INDEX IF EXISTS "Case_redFlag_idx";
DROP INDEX IF EXISTS "Task_redFlag_idx";

ALTER TABLE "Task" RENAME CONSTRAINT "Case_createdById_fkey" TO "Task_createdById_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "Case_visibilityManagerId_fkey" TO "Task_visibilityManagerId_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "Case_assigneeId_fkey" TO "Task_assigneeId_fkey";
ALTER TABLE "Task" RENAME CONSTRAINT "Case_assignedById_fkey" TO "Task_assignedById_fkey";

CREATE INDEX "Task_workKind_idx" ON "Task"("workKind");

-- CaseAccess -> TaskAccess
ALTER TABLE "CaseAccess" RENAME TO "TaskAccess";
ALTER TABLE "TaskAccess" RENAME COLUMN "caseId" TO "taskId";
ALTER INDEX "CaseAccess_pkey" RENAME TO "TaskAccess_pkey";
ALTER INDEX "CaseAccess_userId_idx" RENAME TO "TaskAccess_userId_idx";
ALTER INDEX "CaseAccess_caseId_userId_key" RENAME TO "TaskAccess_taskId_userId_key";
ALTER TABLE "TaskAccess" RENAME CONSTRAINT "CaseAccess_caseId_fkey" TO "TaskAccess_taskId_fkey";
ALTER TABLE "TaskAccess" RENAME CONSTRAINT "CaseAccess_userId_fkey" TO "TaskAccess_userId_fkey";
ALTER TABLE "TaskAccess" RENAME CONSTRAINT "CaseAccess_grantedById_fkey" TO "TaskAccess_grantedById_fkey";

-- Comment
ALTER TABLE "Comment" RENAME COLUMN "caseId" TO "taskId";
ALTER INDEX "Comment_caseId_createdAt_idx" RENAME TO "Comment_taskId_createdAt_idx";
ALTER TABLE "Comment" RENAME CONSTRAINT "Comment_caseId_fkey" TO "Comment_taskId_fkey";

-- Notification
ALTER TABLE "Notification" RENAME COLUMN "caseId" TO "taskId";

-- BreakGlassAccess
ALTER TABLE "BreakGlassAccess" RENAME COLUMN "caseId" TO "taskId";

-- Audit entity type
UPDATE "AuditEvent" SET "entityType" = 'task' WHERE "entityType" = 'case';
UPDATE "AuditEvent" SET "action" = replace("action", 'case.', 'task.') WHERE "action" LIKE 'case.%';
