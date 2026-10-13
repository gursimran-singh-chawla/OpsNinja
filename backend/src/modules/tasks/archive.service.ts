import { prisma } from "../../lib/prisma.js";
import { writeAudit } from "../audit/audit.service.js";

/**
 * Retention policy: Completed tasks remain in active views for 48 hours
 * before transitioning to archived status.
 */
export const ARCHIVE_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Idempotently sweeps completed tasks whose 48-hour review window has passed.
 *
 * Query conditions:
 * - finishedAt != null (task has been marked complete)
 * - archiveAfter <= now (the 48-hour post-completion window has elapsed)
 * - archivedAt == null (not already archived)
 *
 * Batching and updateMany ensure safe concurrent execution and zero-duplicate transitions.
 */
export async function sweepArchivedTasks(now: Date = new Date()): Promise<{ archivedCount: number }> {
  try {
    // Find all completed tasks whose archiveAfter deadline has passed and are not yet archived
    const eligibleTasks = await prisma.task.findMany({
      where: {
        finishedAt: { not: null },
        archiveAfter: { lte: now },
        archivedAt: null,
      },
      select: { id: true, completedAt: true, archiveAfter: true },
      take: 200,
    });

    if (eligibleTasks.length === 0) {
      return { archivedCount: 0 };
    }

    const taskIds = eligibleTasks.map((t) => t.id);

    const result = await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        archivedAt: null,
      },
      data: {
        archivedAt: now,
      },
    });

    for (const t of eligibleTasks) {
      try {
        await writeAudit({
          actorId: null,
          action: "task.archived",
          entityType: "task",
          entityId: t.id,
          metadata: {
            auto: true,
            reason: "auto_archive_48h",
            completedAt: t.completedAt,
            archiveAfter: t.archiveAfter,
          },
        });
      } catch (err) {
        console.error(`Failed to write auto-archive audit for task ${t.id}:`, err);
      }
    }

    return { archivedCount: result.count };
  } catch (err) {
    console.error("Error executing auto-archive sweep:", err);
    return { archivedCount: 0 };
  }
}

let archiveInterval: NodeJS.Timeout | null = null;

/**
 * Initializes the background task archival worker:
 * 1. Dispatches an immediate catch-up sweep on startup.
 * 2. Establishes a periodic sweep (default: 5 minutes).
 * 3. Unrefs the timer so it does not block clean process termination.
 */
export function startArchiveWorker(intervalMs: number = 5 * 60 * 1000): void {
  if (archiveInterval) return;

  // Run catch-up sweep immediately on startup
  void sweepArchivedTasks().catch((err) => {
    console.error("Initial auto-archive catch-up sweep failed:", err);
  });

  archiveInterval = setInterval(() => {
    void sweepArchivedTasks().catch((err) => {
      console.error("Scheduled auto-archive sweep failed:", err);
    });
  }, intervalMs);

  archiveInterval.unref?.();
}

/**
 * Halts the background task archival worker (used during graceful shutdown or tests).
 */
export function stopArchiveWorker(): void {
  if (archiveInterval) {
    clearInterval(archiveInterval);
    archiveInterval = null;
  }
}
