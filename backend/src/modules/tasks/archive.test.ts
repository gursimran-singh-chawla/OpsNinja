import { describe, expect, it, vi, beforeEach } from "vitest";
import { ARCHIVE_DELAY_MS, sweepArchivedTasks } from "./archive.service.js";
import { finishTask, moveTaskOnBoard, archiveTask, listTasks, dashboard } from "./tasks.service.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";

vi.mock("../../lib/prisma.js", () => {
  return {
    prisma: {
      task: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      taskAccess: {
        upsert: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    },
  };
});

describe("Task 48-Hour Auto-Archiving & Lifecycle", () => {
  const leadUser: AuthUser = {
    id: "lead-1",
    email: "lead@opsninja.local",
    name: "Lead User",
    role: "lead",
  };

  const associateUser: AuthUser = {
    id: "assoc-1",
    email: "assoc@opsninja.local",
    name: "Associate User",
    role: "associate",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ARCHIVE_DELAY_MS Constant", () => {
    it("is strictly configured to 48 hours in milliseconds", () => {
      expect(ARCHIVE_DELAY_MS).toBe(48 * 60 * 60 * 1000);
      expect(ARCHIVE_DELAY_MS).toBe(172800000);
    });
  });

  describe("finishTask Lifecycle & Countdown Management", () => {
    it("starts 48-hour countdown on first-time completion", async () => {
      const mockTask = {
        id: "task-1",
        title: "Fix cooler temperature",
        boardColumn: "IN_PROGRESS",
        boardRank: "000000500000",
        finishedAt: null,
        completedAt: null,
        archiveAfter: null,
        archivedAt: null,
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const before = Date.now();
      const updated = await finishTask(leadUser, "task-1", true);
      const after = Date.now();

      expect(updated.finishedAt).toBeInstanceOf(Date);
      expect(updated.completedAt).toBeInstanceOf(Date);
      expect(updated.archiveAfter).toBeInstanceOf(Date);
      expect(updated.archivedAt).toBeNull();
      expect(updated.boardColumn).toBe("DONE");

      const archiveAfterTime = updated.archiveAfter!.getTime();
      const finishedTime = updated.finishedAt!.getTime();
      expect(archiveAfterTime - finishedTime).toBe(ARCHIVE_DELAY_MS);
      expect(finishedTime).toBeGreaterThanOrEqual(before);
      expect(finishedTime).toBeLessThanOrEqual(after);
    });

    it("does not reset countdown or archiveAfter when re-finishing an already completed task", async () => {
      const originalFinished = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10h ago
      const originalArchiveAfter = new Date(originalFinished.getTime() + ARCHIVE_DELAY_MS);

      const mockTask = {
        id: "task-already-finished",
        title: "Inventory check",
        boardColumn: "DONE",
        boardRank: "000000500000",
        finishedAt: originalFinished,
        completedAt: originalFinished,
        archiveAfter: originalArchiveAfter,
        archivedAt: null,
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const updated = await finishTask(leadUser, "task-already-finished", true);

      expect(updated.finishedAt).toEqual(originalFinished);
      expect(updated.completedAt).toEqual(originalFinished);
      expect(updated.archiveAfter).toEqual(originalArchiveAfter);
    });

    it("clears finishedAt, completedAt, archiveAfter, and archivedAt when reopening a completed task", async () => {
      const mockTask = {
        id: "task-completed",
        title: "Inspect freezer",
        boardColumn: "DONE",
        boardRank: "000000500000",
        finishedAt: new Date(),
        completedAt: new Date(),
        archiveAfter: new Date(Date.now() + ARCHIVE_DELAY_MS),
        archivedAt: null,
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const updated = await finishTask(leadUser, "task-completed", false);

      expect(updated.finishedAt).toBeNull();
      expect(updated.completedAt).toBeNull();
      expect(updated.archiveAfter).toBeNull();
      expect(updated.archivedAt).toBeNull();
      expect(updated.boardColumn).toBe("IN_PROGRESS");
    });
  });

  describe("moveTaskOnBoard Lifecycle", () => {
    it("starts 48-hour countdown when moving an open task to DONE column", async () => {
      const mockTask = {
        id: "task-board-move",
        title: "Sweep warehouse floor",
        boardColumn: "IN_REVIEW",
        boardRank: "000000500000",
        finishedAt: null,
        completedAt: null,
        archiveAfter: null,
        archivedAt: null,
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const updated = await moveTaskOnBoard(leadUser, "task-board-move", "DONE");

      expect(updated.finishedAt).toBeInstanceOf(Date);
      expect(updated.completedAt).toBeInstanceOf(Date);
      expect(updated.archiveAfter).toBeInstanceOf(Date);
      expect(updated.archivedAt).toBeNull();
      expect(updated.boardColumn).toBe("DONE");
    });

    it("clears completion and archive countdown when moving task out of DONE column", async () => {
      const mockTask = {
        id: "task-leave-done",
        title: "Clean checkout aisle",
        boardColumn: "DONE",
        boardRank: "000000500000",
        finishedAt: new Date(Date.now() - 5000),
        completedAt: new Date(Date.now() - 5000),
        archiveAfter: new Date(Date.now() + ARCHIVE_DELAY_MS),
        archivedAt: null,
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const updated = await moveTaskOnBoard(leadUser, "task-leave-done", "IN_PROGRESS");

      expect(updated.finishedAt).toBeNull();
      expect(updated.completedAt).toBeNull();
      expect(updated.archiveAfter).toBeNull();
      expect(updated.archivedAt).toBeNull();
      expect(updated.boardColumn).toBe("IN_PROGRESS");
    });
  });

  describe("Manual archive & restoreTask (archiveTask)", () => {
    it("sets archivedAt when manually archived", async () => {
      const mockTask = {
        id: "task-manual-arch",
        title: "Vendor reconciliation",
        boardColumn: "DONE",
        boardRank: "000000500000",
        finishedAt: new Date(),
        completedAt: new Date(),
        archiveAfter: new Date(Date.now() + ARCHIVE_DELAY_MS),
        archivedAt: null,
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const updated = await archiveTask(leadUser, "task-manual-arch", true);
      expect(updated.archivedAt).toBeInstanceOf(Date);
    });

    it("clears archivedAt, preserves completedAt, and grants fresh 48-hour review window when restored", async () => {
      const originalCompleted = new Date(Date.now() - 72 * 60 * 60 * 1000); // completed 72h ago
      const mockTask = {
        id: "task-restore",
        title: "Vendor reconciliation",
        boardColumn: "DONE",
        boardRank: "000000500000",
        finishedAt: originalCompleted,
        completedAt: originalCompleted,
        archiveAfter: new Date(originalCompleted.getTime() + ARCHIVE_DELAY_MS),
        archivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // archived 24h ago
        createdById: leadUser.id,
        assigneeId: associateUser.id,
        visibilityType: "GLOBAL",
        access: [],
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce(mockTask as never);
      vi.mocked(prisma.task.update).mockImplementationOnce(async ({ data }) => {
        return { ...mockTask, ...data } as never;
      });

      const before = Date.now();
      const updated = await archiveTask(leadUser, "task-restore", false);
      const after = Date.now();

      expect(updated.archivedAt).toBeNull();
      expect(updated.finishedAt).toEqual(originalCompleted);
      expect(updated.completedAt).toEqual(originalCompleted);
      expect(updated.archiveAfter).toBeInstanceOf(Date);

      // Verify the new archive deadline is now + 48h (fresh review window)
      const newArchiveAfterTime = updated.archiveAfter!.getTime();
      expect(newArchiveAfterTime).toBeGreaterThanOrEqual(before + ARCHIVE_DELAY_MS);
      expect(newArchiveAfterTime).toBeLessThanOrEqual(after + ARCHIVE_DELAY_MS);
    });
  });

  describe("sweepArchivedTasks Background Processor", () => {
    it("archives tasks whose archiveAfter has elapsed and are finished and unarchived", async () => {
      const now = new Date();
      const overdueTask1 = {
        id: "task-overdue-1",
        completedAt: new Date(now.getTime() - 50 * 60 * 60 * 1000),
        archiveAfter: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2h past archive deadline
      };
      const overdueTask2 = {
        id: "task-overdue-2",
        completedAt: new Date(now.getTime() - 49 * 60 * 60 * 1000),
        archiveAfter: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1h past archive deadline
      };

      vi.mocked(prisma.task.findMany).mockResolvedValueOnce([overdueTask1, overdueTask2] as never);
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 2 });

      const result = await sweepArchivedTasks(now);

      expect(result.archivedCount).toBe(2);
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          finishedAt: { not: null },
          archiveAfter: { lte: now },
          archivedAt: null,
        },
        select: { id: true, completedAt: true, archiveAfter: true },
        take: 200,
      });

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["task-overdue-1", "task-overdue-2"] },
          archivedAt: null,
        },
        data: {
          archivedAt: now,
        },
      });

      // Audit logs created for each auto-archived task
      expect(prisma.auditEvent.create).toHaveBeenCalledTimes(2);
      expect(prisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: null,
            action: "task.archived",
            entityType: "task",
            entityId: "task-overdue-1",
            metadata: expect.objectContaining({ auto: true }),
          }),
        }),
      );
    });

    it("returns 0 and does not perform updates if no eligible tasks are overdue", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValueOnce([]);

      const result = await sweepArchivedTasks(new Date());

      expect(result.archivedCount).toBe(0);
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    });

    it("handles database exceptions safely without throwing or crashing", async () => {
      vi.mocked(prisma.task.findMany).mockRejectedValueOnce(new Error("DB connection pool exhausted"));

      const result = await sweepArchivedTasks(new Date());

      expect(result.archivedCount).toBe(0);
    });
  });

  describe("View Filtering & Active/Archived Isolation", () => {
    it("excludes archived tasks by default when query does not request archived", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValueOnce([]);

      await listTasks(leadUser, {});

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archivedAt: null,
          }),
        }),
      );
    });

    it("returns archived tasks when filters.archived is true", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValueOnce([]);

      await listTasks(leadUser, { archived: true });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archivedAt: { not: null },
          }),
        }),
      );
    });
  });
});
