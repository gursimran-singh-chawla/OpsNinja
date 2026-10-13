/**
 * Role-Based Activity Logs & System Audit Log Separation Service
 *
 * Enforces strict separation between:
 * 1. Task Activity Logs (Regular Users: Lead, Manager, Associate):
 *    - Restricted to permitted operational actions: task.created, task.assigned, task.completed.
 *    - Filtered dynamically: users only see events for tasks they are authorized to view (canViewTask).
 *    - Admins receive HTTP 403 (Admin Isolation Rule: Admin sees no task content).
 *
 * 2. System Audit Logs (Administrators):
 *    - Platform infrastructure, user account lifecycle (registration, OTP verification, approval, deactivation).
 *    - Platform maintenance events (auto-archival sweeps, settings changes).
 *    - Task title and content are strictly redacted if task audit records are inspected.
 */

import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { canViewTask, type TaskWithAccess } from "../tasks/policy.js";
import type { AuthUser } from "../../types/express.js";

export const PERMITTED_TASK_ACTIONS = [
  "task.created",
  "task.assigned",
  "task.completed",
] as const;

export type PermittedTaskAction = (typeof PERMITTED_TASK_ACTIONS)[number];

export const SYSTEM_ACCOUNT_ACTIONS = [
  "user.created",
  "user.email_verified",
  "user.approved",
  "user.approval_revoked",
  "user.deactivated",
  "user.updated",
  "user.onboarded",
] as const;

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "hash",
  "code",
  "otp",
  "token",
  "sessiontoken",
  "session_token",
  "secret",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
]);

/**
 * Strips secrets, password hashes, OTPs, session tokens, and sensitive credentials
 * from audit metadata payloads.
 */
export function sanitizeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeMetadata(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export type TaskActivityLogItem = {
  id: string;
  action: PermittedTaskAction;
  entityType: "task";
  entityId: string;
  task: {
    id: string;
    title: string;
    boardColumn: string;
    finishedAt: Date | null;
  };
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  assignee?: {
    id: string;
    name: string;
    role: string;
  } | null;
  description: string;
  createdAt: Date;
};

export type LogQueryOptions = {
  q?: string;
  action?: string;
  page?: number;
  limit?: number;
};

/**
 * Retrieves task activity logs strictly scoped to authorized tasks for regular users.
 * Regular users ONLY see: task.created, task.assigned, task.completed.
 * Board moves (non-completion), title/description edits, comments, visibility changes,
 * and system/account events are strictly excluded.
 */
export async function getTaskActivityLogs(
  user: AuthUser,
  options: LogQueryOptions = {},
): Promise<{ data: TaskActivityLogItem[]; total: number }> {
  // Admin sees NO task activity (strict AGENTS.md locked rule)
  if (user.role === "admin") {
    throw errors.forbidden();
  }

  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
  const page = Math.max(Number(options.page) || 1, 1);
  const skip = (page - 1) * limit;

  // Determine allowed actions filter
  let actionFilter: PermittedTaskAction[] = [...PERMITTED_TASK_ACTIONS];
  if (options.action) {
    if (PERMITTED_TASK_ACTIONS.includes(options.action as PermittedTaskAction)) {
      actionFilter = [options.action as PermittedTaskAction];
    } else {
      // Disallowed action filter requested by client (e.g. task.board_moved or comment.added)
      return { data: [], total: 0 };
    }
  }

  // Fetch recent candidate task audit events
  // Fetch a larger window to account for authorization filtering
  const candidateEvents = await prisma.auditEvent.findMany({
    where: {
      entityType: "task",
      action: { in: actionFilter },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (candidateEvents.length === 0) {
    return { data: [], total: 0 };
  }

  // Retrieve unique task IDs
  const taskIds = [...new Set(candidateEvents.map((e) => e.entityId))];

  // Fetch live tasks with access control data
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    include: {
      access: { select: { userId: true } },
      assignee: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Also prefetch target assignee users mentioned in metadata if applicable
  const targetUserIds = new Set<string>();
  for (const ev of candidateEvents) {
    const meta = ev.metadata as Record<string, unknown> | null;
    if (meta?.to && typeof meta.to === "string") {
      targetUserIds.add(meta.to);
    }
    if (meta?.assigneeId && typeof meta.assigneeId === "string") {
      targetUserIds.add(meta.assigneeId);
    }
  }

  const targetUsers = targetUserIds.size > 0
    ? await prisma.user.findMany({
        where: { id: { in: [...targetUserIds] } },
        select: { id: true, name: true, role: true },
      })
    : [];
  const targetUserMap = new Map(targetUsers.map((u) => [u.id, u]));

  // Filter and authorize events
  const authorizedItems: TaskActivityLogItem[] = [];
  const queryLower = options.q ? options.q.trim().toLowerCase() : "";

  for (const ev of candidateEvents) {
    const task = taskMap.get(ev.entityId);
    if (!task) {
      // Task was removed or does not exist
      continue;
    }

    // Verify task visibility against canonical policy
    const isVisible = await canViewTask(user, task as TaskWithAccess);
    if (!isVisible) {
      continue;
    }

    const actorName = ev.actor?.name || "System";
    const meta = ev.metadata as Record<string, unknown> | null;

    // Resolve assignee for assigned events
    let resolvedAssignee: { id: string; name: string; role: string } | null = null;
    if (ev.action === "task.assigned") {
      const targetId = (meta?.to as string) || (meta?.assigneeId as string) || task.assigneeId;
      if (targetId) {
        resolvedAssignee = targetUserMap.get(targetId) || task.assignee || null;
      }
    }

    // Generate clear human-readable description
    let description = "";
    if (ev.action === "task.created") {
      description = `${actorName} created task: "${task.title}"`;
    } else if (ev.action === "task.assigned") {
      if (resolvedAssignee) {
        if (ev.actor && resolvedAssignee.id === ev.actor.id) {
          description = `${actorName} self-assigned task: "${task.title}"`;
        } else {
          description = `${actorName} assigned task "${task.title}" to ${resolvedAssignee.name}`;
        }
      } else {
        description = `${actorName} unassigned task: "${task.title}"`;
      }
    } else if (ev.action === "task.completed") {
      description = `${actorName} completed task: "${task.title}"`;
    }

    // Text search filter if provided
    if (queryLower) {
      const matches =
        task.title.toLowerCase().includes(queryLower) ||
        description.toLowerCase().includes(queryLower) ||
        ev.actor?.name.toLowerCase().includes(queryLower) ||
        ev.actor?.email.toLowerCase().includes(queryLower) ||
        resolvedAssignee?.name.toLowerCase().includes(queryLower);
      if (!matches) {
        continue;
      }
    }

    authorizedItems.push({
      id: ev.id,
      action: ev.action as PermittedTaskAction,
      entityType: "task",
      entityId: ev.entityId,
      task: {
        id: task.id,
        title: task.title,
        boardColumn: task.boardColumn,
        finishedAt: task.finishedAt,
      },
      actor: ev.actor,
      assignee: resolvedAssignee,
      description,
      createdAt: ev.createdAt,
    });
  }

  // Apply pagination over authorized items
  const total = authorizedItems.length;
  const paginated = authorizedItems.slice(skip, skip + limit);

  return { data: paginated, total };
}

export type SystemAuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  metadata: Record<string, unknown> | null;
  description: string;
  createdAt: Date;
};

/**
 * Retrieves system and account-lifecycle audit logs strictly for administrators.
 * Strips all sensitive credentials, password hashes, OTPs, and tokens.
 * Regular users are strictly forbidden.
 */
export async function getSystemAuditLogs(
  user: AuthUser,
  options: LogQueryOptions = {},
): Promise<{ data: SystemAuditLogItem[]; total: number }> {
  // Only administrators can access system and account logs
  if (user.role !== "admin") {
    throw errors.forbidden();
  }

  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
  const page = Math.max(Number(options.page) || 1, 1);
  const skip = (page - 1) * limit;

  const where: any = {
    // Admin sees NO task content (strict AGENTS.md locked rule)
    entityType: { not: "task" },
  };

  if (options.action) {
    where.action = options.action;
  }

  if (options.q) {
    const q = options.q.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { actor: { name: { contains: q, mode: "insensitive" } } },
      { actor: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);

  const sanitizedItems: SystemAuditLogItem[] = events.map((ev) => {
    const actorName = ev.actor?.name || "System";
    const sanitizedMeta = sanitizeMetadata(ev.metadata);

    let description = `${actorName} performed ${ev.action}`;
    if (ev.action === "user.created") {
      description = `New user account registered (${ev.actor?.email || ev.entityId})`;
    } else if (ev.action === "user.email_verified") {
      description = `Email verification completed for user (${ev.actor?.email || ev.entityId})`;
    } else if (ev.action === "user.approved") {
      description = `Account approved by ${actorName}`;
    } else if (ev.action === "user.approval_revoked") {
      description = `Account approval revoked by ${actorName}`;
    } else if (ev.action === "user.deactivated") {
      description = `User account deactivated by ${actorName}`;
    } else if (ev.action === "user.updated") {
      description = `User account updated by ${actorName}`;
    } else if (ev.action === "user.onboarded") {
      description = `User onboarded by ${actorName}`;
    }

    return {
      id: ev.id,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      actor: ev.actor,
      metadata: sanitizedMeta,
      description,
      createdAt: ev.createdAt,
    };
  });

  return { data: sanitizedItems, total };
}
