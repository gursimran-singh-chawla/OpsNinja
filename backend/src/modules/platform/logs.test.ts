import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getTaskActivityLogs,
  getSystemAuditLogs,
  sanitizeMetadata,
  PERMITTED_TASK_ACTIONS,
} from "./logs.service.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";

vi.mock("../../lib/prisma.js", () => {
  return {
    prisma: {
      auditEvent: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

const admin: AuthUser = {
  id: "admin-1",
  email: "admin@harborlane.example",
  name: "Priya Nair",
  role: "admin",
  reportsToId: null,
  deactivatedAt: null,
};

const lead: AuthUser = {
  id: "lead-1",
  email: "lead@harborlane.example",
  name: "Sarah Okonkwo",
  role: "lead",
  reportsToId: null,
  deactivatedAt: null,
};

const manager: AuthUser = {
  id: "mgr-1",
  email: "marcus@harborlane.example",
  name: "Marcus Hale",
  role: "manager",
  reportsToId: "lead-1",
  deactivatedAt: null,
};

const associateA: AuthUser = {
  id: "assoc-1",
  email: "ravi@harborlane.example",
  name: "Ravi Mehta",
  role: "associate",
  reportsToId: "mgr-1",
  deactivatedAt: null,
};

const associateB: AuthUser = {
  id: "assoc-2",
  email: "june@harborlane.example",
  name: "June Park",
  role: "associate",
  reportsToId: "mgr-1",
  deactivatedAt: null,
};

const outsiderAssociate: AuthUser = {
  id: "assoc-outside",
  email: "outsider@harborlane.example",
  name: "Amira Hassan",
  role: "associate",
  reportsToId: null,
  deactivatedAt: null,
};

describe("Role-Based Activity Logs and System Audit Log Separation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Section 1 & 3: Regular-User Task Activity Logs", () => {
    const authorizedTask = {
      id: "task-101",
      title: "Store inventory audit",
      boardColumn: "IN_PROGRESS",
      finishedAt: null,
      createdById: associateA.id,
      assigneeId: associateA.id,
      visibilityType: "GLOBAL",
      visibilityManagerId: null,
      access: [{ userId: associateA.id }],
    };

    const privateDirectTask = {
      id: "task-secret",
      title: "Confidential manager review",
      boardColumn: "TODO",
      finishedAt: null,
      createdById: manager.id,
      assigneeId: manager.id,
      visibilityType: "DIRECT",
      visibilityManagerId: null,
      access: [{ userId: manager.id }],
    };

    it("1. A regular user sees an authorized task-created event", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-1",
          action: "task.created",
          entityType: "task",
          entityId: authorizedTask.id,
          actor: { id: lead.id, name: lead.name, email: lead.email, role: lead.role },
          metadata: { visibilityType: "GLOBAL" },
          createdAt: new Date(),
        } as never,
      ]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([authorizedTask as never]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await getTaskActivityLogs(associateA);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe("task.created");
      expect(result.data[0].task.title).toBe("Store inventory audit");
      expect(result.data[0].description).toBe('Sarah Okonkwo created task: "Store inventory audit"');
    });

    it("2. A regular user sees an authorized task-assigned or reassigned event", async () => {
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-2",
          action: "task.assigned",
          entityType: "task",
          entityId: authorizedTask.id,
          actor: { id: manager.id, name: manager.name, email: manager.email, role: manager.role },
          metadata: { from: null, to: associateA.id },
          createdAt: new Date(),
        } as never,
      ]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([authorizedTask as never]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: associateA.id, name: associateA.name, role: associateA.role } as never,
      ]);

      const result = await getTaskActivityLogs(associateA);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe("task.assigned");
      expect(result.data[0].description).toBe('Marcus Hale assigned task "Store inventory audit" to Ravi Mehta');
    });

    it("3. A regular user sees an authorized task-completed event", async () => {
      const completedTask = {
        ...authorizedTask,
        boardColumn: "DONE",
        finishedAt: new Date(),
      };
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-3",
          action: "task.completed",
          entityType: "task",
          entityId: completedTask.id,
          actor: { id: associateA.id, name: associateA.name, email: associateA.email, role: associateA.role },
          metadata: { finished: true, boardColumn: "DONE" },
          createdAt: new Date(),
        } as never,
      ]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([completedTask as never]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await getTaskActivityLogs(associateA);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe("task.completed");
      expect(result.data[0].description).toBe('Ravi Mehta completed task: "Store inventory audit"');
    });

    it("4. A regular user does NOT see a Lead moving a task between Board columns", async () => {
      // Database has both board_moved and task.created
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-created",
          action: "task.created",
          entityType: "task",
          entityId: authorizedTask.id,
          actor: { id: lead.id, name: lead.name, email: lead.email, role: lead.role },
          createdAt: new Date(),
        } as never,
      ]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([authorizedTask as never]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await getTaskActivityLogs(associateA);

      // Verify Prisma query strictly limits action to PERMITTED_TASK_ACTIONS
      expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: "task",
            action: { in: expect.arrayContaining(["task.created", "task.assigned", "task.completed"]) },
          }),
        }),
      );
      // Board moved is NOT in permitted actions
      expect(PERMITTED_TASK_ACTIONS).not.toContain("task.board_moved");
      expect(result.data.every((d) => d.action !== ("task.board_moved" as any))).toBe(true);
    });

    it("5. A regular user does NOT see task edits, comments, priority changes, or unrelated events in general Logs view", async () => {
      // If client requests disallowed action filter (e.g. comment.added or task.archived), returns empty immediately
      const resComment = await getTaskActivityLogs(associateA, { action: "comment.added" });
      const resArchived = await getTaskActivityLogs(associateA, { action: "task.archived" });
      const resVisibility = await getTaskActivityLogs(associateA, { action: "task.visibility_changed" });

      expect(resComment.data).toEqual([]);
      expect(resArchived.data).toEqual([]);
      expect(resVisibility.data).toEqual([]);
    });

    it("6. A regular user cannot see events belonging to tasks outside their authorized scope", async () => {
      // Event belongs to a DIRECT task between manager and lead
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-secret",
          action: "task.created",
          entityType: "task",
          entityId: privateDirectTask.id,
          actor: { id: manager.id, name: manager.name, email: manager.email, role: manager.role },
          createdAt: new Date(),
        } as never,
      ]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([privateDirectTask as never]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      // Outsider associate tries to query activity
      const result = await getTaskActivityLogs(outsiderAssociate);
      expect(result.data).toHaveLength(0);
    });

    it("7. A regular user cannot retrieve system or account-verification logs (strictly forbidden)", async () => {
      // Trying to query task activity logs as admin throws forbidden
      await expect(getTaskActivityLogs(admin)).rejects.toMatchObject({
        status: 403,
      });
    });

    it("8. A user cannot bypass restrictions by supplying another user's actor ID or task ID", async () => {
      // When searching with a specific task title that the user cannot access
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-secret",
          action: "task.created",
          entityType: "task",
          entityId: privateDirectTask.id,
          actor: { id: manager.id, name: manager.name, email: manager.email, role: manager.role },
          createdAt: new Date(),
        } as never,
      ]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([privateDirectTask as never]);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await getTaskActivityLogs(associateB, { q: "Confidential" });
      expect(result.data).toHaveLength(0);
    });
  });

  describe("Section 1 & 2: Administrator System & Account Logs", () => {
    it("9. An administrator can view permitted registration and email-verification events", async () => {
      vi.mocked(prisma.auditEvent.count).mockResolvedValue(2);
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-reg",
          action: "user.created",
          entityType: "user",
          entityId: "u-new",
          actor: { id: "u-new", name: "New User", email: "new@example.com", role: "associate" },
          metadata: { role: "associate", verificationRequired: true },
          createdAt: new Date(),
        } as never,
        {
          id: "ev-verif",
          action: "user.email_verified",
          entityType: "user",
          entityId: "u-new",
          actor: { id: "u-new", name: "New User", email: "new@example.com", role: "associate" },
          metadata: { email: "new@example.com" },
          createdAt: new Date(),
        } as never,
      ]);

      const result = await getSystemAuditLogs(admin);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].action).toBe("user.created");
      expect(result.data[1].action).toBe("user.email_verified");
      expect(result.data[0].description).toContain("New user account registered");
    });

    it("10. An administrator can view relevant account approval and administrative events", async () => {
      vi.mocked(prisma.auditEvent.count).mockResolvedValue(1);
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([
        {
          id: "ev-appr",
          action: "user.approved",
          entityType: "user",
          entityId: "u-new",
          actor: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
          metadata: { approved: true },
          createdAt: new Date(),
        } as never,
      ]);

      const result = await getSystemAuditLogs(admin);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe("user.approved");
      expect(result.data[0].description).toBe("Account approved by Priya Nair");
    });

    it("11. Administrative events are not exposed to non-admin users (throws 403)", async () => {
      await expect(getSystemAuditLogs(lead)).rejects.toMatchObject({
        status: 403,
      });
      await expect(getSystemAuditLogs(manager)).rejects.toMatchObject({
        status: 403,
      });
      await expect(getSystemAuditLogs(associateA)).rejects.toMatchObject({
        status: 403,
      });
    });

    it("12. Admin system logs strictly exclude task events (entityType: { not: 'task' })", async () => {
      vi.mocked(prisma.auditEvent.count).mockResolvedValue(0);
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      await getSystemAuditLogs(admin);

      expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: { not: "task" },
          }),
        }),
      );
    });
  });

  describe("Section 6 & 7: Consistency, Failure & Metadata Sanitization", () => {
    it("13. Sensitive metadata (passwords, OTPs, session tokens, keys) is recursively stripped", () => {
      const rawMetadata = {
        email: "user@example.com",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$abc",
        otp: "123456",
        sessionToken: "secret-token-32-bytes",
        nested: {
          apiKey: "sk-live-secret-key",
          publicRole: "manager",
        },
      };

      const sanitized = sanitizeMetadata(rawMetadata);
      expect(sanitized).toEqual({
        email: "user@example.com",
        nested: {
          publicRole: "manager",
        },
      });
      expect(sanitized).not.toHaveProperty("passwordHash");
      expect(sanitized).not.toHaveProperty("otp");
      expect(sanitized).not.toHaveProperty("sessionToken");
      expect(sanitized?.nested).not.toHaveProperty("apiKey");
    });

    it("14. Bounded pagination limits prevent excessive data fetches", async () => {
      vi.mocked(prisma.auditEvent.count).mockResolvedValue(250);
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      // Client requests limit=500
      await getSystemAuditLogs(admin, { limit: 500, page: 2 });

      expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Clamped to maximum 100
          skip: 100, // page 2 * 100
        }),
      );
    });

    it("15. Search filter queries by action, entityId, actor name or email", async () => {
      vi.mocked(prisma.auditEvent.count).mockResolvedValue(1);
      vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([]);

      await getSystemAuditLogs(admin, { q: "approved" });

      expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { action: { contains: "approved", mode: "insensitive" } },
              { entityId: { contains: "approved", mode: "insensitive" } },
              { actor: { name: { contains: "approved", mode: "insensitive" } } },
              { actor: { email: { contains: "approved", mode: "insensitive" } } },
            ],
          }),
        }),
      );
    });
  });
});
