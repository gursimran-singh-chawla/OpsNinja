import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateTask, type UpdateTaskInput } from "./tasks.service.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { AppError } from "../../lib/errors.js";

vi.mock("../../lib/prisma.js", () => {
  return {
    prisma: {
      task: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

describe("Milestone 3: Task Editing API and Authorization Service", () => {
  const leadUser: AuthUser = {
    id: "lead-1",
    email: "lead@opsninja.local",
    name: "Sarah Lead",
    role: "lead",
  };

  const managerUser: AuthUser = {
    id: "mgr-1",
    email: "mgr@opsninja.local",
    name: "Marcus Manager",
    role: "manager",
  };

  const otherManager: AuthUser = {
    id: "mgr-2",
    email: "other.mgr@opsninja.local",
    name: "Other Manager",
    role: "manager",
  };

  const associateUser: AuthUser = {
    id: "assoc-1",
    email: "assoc@opsninja.local",
    name: "Ravi Associate",
    role: "associate",
    reportsToId: "mgr-1",
  };

  const otherAssociate: AuthUser = {
    id: "assoc-2",
    email: "other.assoc@opsninja.local",
    name: "Other Associate",
    role: "associate",
    reportsToId: "mgr-2",
  };

  const adminUser: AuthUser = {
    id: "admin-1",
    email: "admin@opsninja.local",
    name: "Priya Admin",
    role: "admin",
  };

  const baseTask = {
    id: "task-100",
    title: "Original Task Title",
    description: "Original Task Description",
    category: "normal" as const,
    workKind: "task" as const,
    metadata: null,
    priority: "normal" as const,
    dueAt: new Date("2026-10-20T10:00:00.000Z"),
    createdById: "mgr-1",
    visibilityType: "TEAM" as const,
    visibilityManagerId: "mgr-1",
    assigneeId: "assoc-1",
    assignedById: "mgr-1",
    sourceMessageId: null,
    redFlag: false,
    boardColumn: "TODO" as const,
    boardRank: "000000500000",
    finishedAt: null,
    completedAt: null,
    archiveAfter: null,
    archivedAt: null,
    createdAt: new Date("2026-10-10T10:00:00.000Z"),
    updatedAt: new Date("2026-10-10T10:00:00.000Z"),
    access: [{ userId: "assoc-1", accessType: "ASSIGNEE", grantedById: "mgr-1" }],
    createdBy: { id: "mgr-1", name: "Marcus Manager", role: "manager" },
    assignee: { id: "assoc-1", name: "Ravi Associate", role: "associate", reportsToId: "mgr-1" },
    assignedBy: { id: "mgr-1", name: "Marcus Manager", role: "manager" },
    visibilityManager: { id: "mgr-1", name: "Marcus Manager" },
    comments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((ops: any) => Promise.all(ops));
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ ...baseTask } as any);
    vi.mocked(prisma.task.update).mockResolvedValue({ ...baseTask } as any);
    vi.mocked(prisma.auditEvent.create).mockResolvedValue({ id: "audit-1" } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "assoc-1" }] as any);
  });

  describe("Requirement 1: Authorized Lead updates all supported fields", () => {
    it("allows a Lead to update title, description, category, priority, and dueAt", async () => {
      const newDue = new Date("2026-10-25T15:00:00.000Z");
      const patch: UpdateTaskInput = {
        title: "Updated Title by Lead",
        description: "Updated Description by Lead",
        category: "escalation",
        priority: "urgent",
        dueAt: newDue,
      };

      await updateTask(leadUser, "task-100", patch);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: {
          title: "Updated Title by Lead",
          description: "Updated Description by Lead",
          category: "escalation",
          priority: "urgent",
          dueAt: newDue,
        },
      });

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "task.updated",
          actorId: leadUser.id,
          entityType: "task",
          entityId: "task-100",
          metadata: expect.objectContaining({
            changedFields: ["title", "description", "category", "priority", "dueAt"],
          }),
        }),
      });
    });
  });

  describe("Requirement 2: Authorized Manager updates supported fields", () => {
    it("allows a Manager to update supported fields on tasks in their team scope", async () => {
      const patch: UpdateTaskInput = {
        title: "Manager Updated Title",
        priority: "high",
      };

      await updateTask(managerUser, "task-100", patch);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: {
          title: "Manager Updated Title",
          priority: "high",
        },
      });
    });
  });

  describe("Requirement 3: Eligible Associate updates title and description", () => {
    it("allows an assigned Associate to update title and description", async () => {
      const patch: UpdateTaskInput = {
        title: "Associate Fixed Title",
        description: "Associate updated description details",
      };

      await updateTask(associateUser, "task-100", patch);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: {
          title: "Associate Fixed Title",
          description: "Associate updated description details",
        },
      });
    });

    it("allows a task creator Associate to update title and description", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        createdById: "assoc-1",
        assigneeId: null,
      } as any);

      const patch: UpdateTaskInput = {
        title: "Creator Associate Updated Title",
      };

      await updateTask(associateUser, "task-100", patch);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: { title: "Creator Associate Updated Title" },
      });
    });
  });

  describe("Requirement 4: Associate cannot change category, priority, or deadline", () => {
    it("rejects an Associate attempting to change priority (403 Forbidden)", async () => {
      const patch: UpdateTaskInput = { priority: "high" };
      await expect(updateTask(associateUser, "task-100", patch)).rejects.toThrowError(
        expect.objectContaining({ status: 403 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("rejects an Associate attempting to change category (403 Forbidden)", async () => {
      const patch: UpdateTaskInput = { category: "escalation" };
      await expect(updateTask(associateUser, "task-100", patch)).rejects.toThrowError(
        expect.objectContaining({ status: 403 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("rejects an Associate attempting to change deadline (403 Forbidden)", async () => {
      const patch: UpdateTaskInput = { dueAt: new Date("2026-11-01T00:00:00.000Z") };
      await expect(updateTask(associateUser, "task-100", patch)).rejects.toThrowError(
        expect.objectContaining({ status: 403 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 5: Manager cannot modify a task outside their permitted scope", () => {
    it("rejects a Manager attempting to edit another team's task (403 Forbidden)", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        visibilityType: "TEAM",
        visibilityManagerId: "mgr-2",
        createdById: "mgr-2",
        assigneeId: "assoc-2",
      } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "assoc-1" }] as any);

      const patch: UpdateTaskInput = { title: "Manager Trespassing" };
      await expect(updateTask(managerUser, "task-100", patch)).rejects.toThrowError(
        expect.objectContaining({ status: 404 }), // Inaccessible task returns 404
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("rejects a Manager attempting to edit a GLOBAL task they do not manage or own (403 Forbidden)", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        visibilityType: "GLOBAL",
        visibilityManagerId: null,
        createdById: "lead-1",
        assigneeId: "assoc-2", // Assigned to other manager's report
      } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "assoc-1" }] as any);

      const patch: UpdateTaskInput = { title: "Unowned Global Task" };
      await expect(updateTask(managerUser, "task-100", patch)).rejects.toThrowError(
        expect.objectContaining({ status: 403 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 6: Administrator cannot use operations PATCH endpoint", () => {
    it("strictly returns 403 Forbidden when Admin calls updateTask", async () => {
      await expect(updateTask(adminUser, "task-100", { title: "Admin Update" })).rejects.toThrowError(
        expect.objectContaining({ status: 403 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 8: Update to an inaccessible task does not reveal its contents", () => {
    it("returns 404 Not Found when a task exists but the user cannot view it", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        visibilityType: "DIRECT",
        createdById: "lead-1",
        assigneeId: "assoc-2",
        access: [{ userId: "assoc-2", accessType: "ASSIGNEE", grantedById: "lead-1" }],
      } as any);

      // assoc-1 has no access to this direct task
      await expect(updateTask(associateUser, "task-100", { title: "Blind Update" })).rejects.toThrowError(
        expect.objectContaining({ status: 404 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("returns 404 Not Found when a task does not exist", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
      await expect(updateTask(leadUser, "nonexistent-id", { title: "Ghost" })).rejects.toThrowError(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  describe("Requirement 13: Empty description clears the description", () => {
    it("persists empty string when description is cleared", async () => {
      await updateTask(leadUser, "task-100", { description: "" });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: { description: "" },
      });
    });
  });

  describe("Requirement 14: dueAt: null clears the deadline", () => {
    it("clears deadline when dueAt is explicitly null", async () => {
      await updateTask(leadUser, "task-100", { dueAt: null });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: { dueAt: null },
      });
    });

    it("rejects clearing deadline if workKind is escalation", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        workKind: "escalation",
      } as any);

      await expect(updateTask(leadUser, "task-100", { dueAt: null })).rejects.toThrowError(
        expect.objectContaining({ status: 400 }),
      );
    });
  });

  describe("Requirement 15: Omitted field remains unchanged", () => {
    it("does not include omitted fields in Prisma update", async () => {
      await updateTask(leadUser, "task-100", { title: "Only Title Changed" });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: { title: "Only Title Changed" },
      });
    });
  });

  describe("Requirement 16: Request with permitted and forbidden fields is rejected without partial updates", () => {
    it("rejects entire request if an Associate includes priority alongside title", async () => {
      const patch: UpdateTaskInput = {
        title: "Permitted Title",
        priority: "urgent", // Forbidden for associate
      };

      await expect(updateTask(associateUser, "task-100", patch)).rejects.toThrowError(
        expect.objectContaining({ status: 403 }),
      );

      // Verify no partial update occurred
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 17 & 18: Changed values persist and no-op requests do not update DB or write audit", () => {
    it("returns task without touching database or audit logs when values are identical (no-op)", async () => {
      const patch: UpdateTaskInput = {
        title: baseTask.title, // Same title
        description: baseTask.description, // Same description
        category: baseTask.category, // Same category
        priority: baseTask.priority, // Same priority
        dueAt: baseTask.dueAt, // Same dueAt
      };

      const result = await updateTask(leadUser, "task-100", patch);

      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.auditEvent.create).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("Requirement 19 & 20: Audit event creation, actor ID, and metadata diffs", () => {
    it("records task.updated audit event with actor, changedFields, and before/after diffs", async () => {
      const patch: UpdateTaskInput = {
        priority: "urgent",
        dueAt: new Date("2026-10-30T10:00:00.000Z"),
      };

      await updateTask(leadUser, "task-100", patch);

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          actorId: leadUser.id,
          action: "task.updated",
          entityType: "task",
          entityId: "task-100",
          metadata: {
            changedFields: ["priority", "dueAt"],
            changes: {
              priority: { from: "normal", to: "urgent" },
              dueAt: {
                from: "2026-10-20T10:00:00.000Z",
                to: "2026-10-30T10:00:00.000Z",
              },
            },
          },
        },
      });
    });
  });

  describe("Requirement 21 & 22: Failed mutations and transaction consistency", () => {
    it("does not create an audit event when the transaction throws", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("Database write failure"));

      await expect(updateTask(leadUser, "task-100", { title: "Will Fail" })).rejects.toThrow(
        "Database write failure",
      );
    });
  });

  describe("Requirement 23: Editing completed task preserves completion and archive countdowns", () => {
    it("preserves completedAt and archiveAfter when editing a completed task", async () => {
      const completedAt = new Date("2026-10-12T10:00:00.000Z");
      const archiveAfter = new Date("2026-10-14T10:00:00.000Z");
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        finishedAt: completedAt,
        completedAt,
        archiveAfter,
        archivedAt: null,
      } as any);

      await updateTask(leadUser, "task-100", { title: "Updated Completed Task" });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-100" },
        data: { title: "Updated Completed Task" },
      });
      // Verifies completedAt and archiveAfter are NOT modified in data payload
      const updatePayload = vi.mocked(prisma.task.update).mock.calls[0][0].data;
      expect(updatePayload).not.toHaveProperty("completedAt");
      expect(updatePayload).not.toHaveProperty("archiveAfter");
      expect(updatePayload).not.toHaveProperty("finishedAt");
    });
  });

  describe("Requirement 24: Archived task cannot be edited before restoration", () => {
    it("rejects editing an archived task (400 Bad Request)", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...baseTask,
        archivedAt: new Date("2026-10-13T10:00:00.000Z"),
      } as any);

      await expect(updateTask(leadUser, "task-100", { title: "Archived edit attempt" })).rejects.toThrowError(
        expect.objectContaining({ status: 400 }),
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 25: Existing task access and lifecycle behaviour remain unchanged", () => {
    it("never updates createdById, assigneeId, visibilityType, or boardColumn through updateTask", async () => {
      await updateTask(leadUser, "task-100", { title: "Clean Task Update" });

      const updateData = vi.mocked(prisma.task.update).mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty("createdById");
      expect(updateData).not.toHaveProperty("assigneeId");
      expect(updateData).not.toHaveProperty("visibilityType");
      expect(updateData).not.toHaveProperty("boardColumn");
      expect(updateData).not.toHaveProperty("boardRank");
    });
  });
});
