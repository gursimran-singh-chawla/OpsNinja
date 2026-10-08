import type { Prisma, TaskCategory, TaskPriority, VisibilityType, WorkKind, BoardColumn } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuthUser } from "../../types/express.js";
import { rankBetween, ranksForCount } from "./boardRank.js";
import {
  canArchiveTask,
  canAssignTask,
  canAssignTarget,
  canChangeVisibility,
  canCreateTask,
  canFinishTask,
  canMoveBoardTask,
  canSelfAssignTask,
  canUseVisibilityOnCreate,
  canViewTask,
  isOverdue,
  type TaskWithAccess,
} from "./policy.js";

function includeAccess(): Prisma.TaskInclude {
  return { access: { select: { userId: true, accessType: true, grantedById: true } } };
}

function assertOps(user: AuthUser) {
  if (user.role === "admin") throw errors.forbidden();
}

async function loadTask(id: string): Promise<TaskWithAccess> {
  const t = await prisma.task.findUnique({ where: { id }, include: includeAccess() });
  if (!t) throw errors.notFound("Task");
  return t as TaskWithAccess;
}

async function assertView(user: AuthUser, t: TaskWithAccess) {
  if (!(await canViewTask(user, t))) throw errors.forbidden();
}

async function rebalanceColumn(column: BoardColumn) {
  const rows = await prisma.task.findMany({
    where: { boardColumn: column, archivedAt: null },
    orderBy: [{ boardRank: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const ranks = ranksForCount(rows.length);
  for (let i = 0; i < rows.length; i++) {
    await prisma.task.update({ where: { id: rows[i].id }, data: { boardRank: ranks[i] } });
  }
}

async function rankForInsert(
  column: BoardColumn,
  prevId?: string | null,
  nextId?: string | null,
  excludeId?: string,
  retried = false,
): Promise<string> {
  let prevRank: string | null = null;
  let nextRank: string | null = null;
  if (prevId && prevId !== excludeId) {
    const prev = await prisma.task.findUnique({ where: { id: prevId }, select: { boardColumn: true, boardRank: true } });
    if (prev?.boardColumn === column) prevRank = prev.boardRank;
  }
  if (nextId && nextId !== excludeId) {
    const next = await prisma.task.findUnique({ where: { id: nextId }, select: { boardColumn: true, boardRank: true } });
    if (next?.boardColumn === column) nextRank = next.boardRank;
  }
  if (!prevId && !nextId) {
    const last = await prisma.task.findFirst({
      where: { boardColumn: column, archivedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { boardRank: "desc" },
      select: { boardRank: true },
    });
    prevRank = last?.boardRank ?? null;
  }
  const rank = rankBetween(prevRank, nextRank);
  if (rank) return rank;
  if (retried) return ranksForCount(1)[0];
  await rebalanceColumn(column);
  return rankForInsert(column, prevId, nextId, excludeId, true);
}

export async function listTasks(
  user: AuthUser,
  filters: {
    category?: TaskCategory;
    workKind?: WorkKind;
    visibility?: VisibilityType;
    assigneeId?: string;
    createdById?: string;
    finished?: boolean;
    archived?: boolean;
    overdue?: boolean;
    unassigned?: boolean;
    q?: string;
  },
) {
  assertOps(user);
  const where: Prisma.TaskWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.workKind) where.workKind = filters.workKind;
  if (filters.visibility) where.visibilityType = filters.visibility;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.createdById) where.createdById = filters.createdById;
  if (filters.unassigned) where.assigneeId = null;
  if (filters.finished === true) where.finishedAt = { not: null };
  if (filters.finished === false) where.finishedAt = null;
  if (filters.archived === true) where.archivedAt = { not: null };
  else if (filters.archived === false || filters.archived === undefined) where.archivedAt = null;
  if (filters.overdue) {
    where.finishedAt = null;
    where.dueAt = { lt: new Date() };
  }
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.task.findMany({
    where,
    include: {
      ...includeAccess(),
      createdBy: { select: { id: true, name: true, role: true } },
      assignee: { select: { id: true, name: true, role: true } },
      visibilityManager: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const visible = [];
  for (const row of rows) {
    if (await canViewTask(user, row as TaskWithAccess)) visible.push(row);
  }
  return visible;
}

export async function getTask(user: AuthUser, id: string) {
  assertOps(user);
  const t = await prisma.task.findUnique({
    where: { id },
    include: {
      ...includeAccess(),
      createdBy: { select: { id: true, name: true, role: true } },
      assignee: { select: { id: true, name: true, role: true, reportsToId: true } },
      assignedBy: { select: { id: true, name: true, role: true } },
      visibilityManager: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!t) throw errors.notFound("Task");
  await assertView(user, t as TaskWithAccess);
  return t;
}

type CreateInput = {
  title: string;
  description: string;
  category: TaskCategory;
  workKind: WorkKind;
  metadata?: Prisma.InputJsonValue | null;
  priority: TaskPriority;
  dueAt?: Date | null;
  visibilityType: VisibilityType;
  visibilityManagerId?: string | null;
  directUserIds?: string[];
  assigneeId?: string | null;
  sourceMessageId?: string | null;
  boardColumn?: BoardColumn;
};

export async function createTask(user: AuthUser, input: CreateInput) {
  if (!canCreateTask(user)) throw errors.forbidden();
  if (input.workKind === "escalation" && !input.dueAt) {
    throw errors.badRequest("Escalations require a deadline");
  }
  if (input.assigneeId) {
    if (user.role === "associate" && input.assigneeId !== user.id) throw errors.forbidden();
    if (!(await canAssignTarget(user, input.assigneeId))) throw errors.forbidden();
  }
  if (!canUseVisibilityOnCreate(user, input.visibilityType)) {
    throw errors.badRequest("Associates cannot share tasks with specific people only");
  }
  if (input.visibilityType === "TEAM") {
    if (!input.visibilityManagerId) throw errors.badRequest("Team visibility requires a manager");
    if (user.role === "manager" && input.visibilityManagerId !== user.id) {
      throw errors.forbidden();
    }
    if (user.role === "associate") {
      if (!user.reportsToId || input.visibilityManagerId !== user.reportsToId) throw errors.forbidden();
    }
  }
  if (input.visibilityType === "DIRECT") {
    if (!(input.directUserIds?.length)) throw errors.badRequest("Choose at least one person to share with");
    if (user.role === "manager") {
      for (const id of input.directUserIds ?? []) {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) throw errors.notFound("User");
        if (target.role === "associate" && target.reportsToId && target.reportsToId !== user.id) {
          throw errors.forbidden();
        }
      }
    }
  }

  const column = input.boardColumn ?? (input.workKind === "backlog" ? "TODO" : "TODO");
  const boardRank = await rankForInsert(column, null, null);

  const t = await prisma.task.create({
    data: {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      workKind: input.workKind,
      metadata: input.metadata ?? undefined,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      createdById: user.id,
      visibilityType: input.visibilityType,
      visibilityManagerId: input.visibilityType === "TEAM" ? input.visibilityManagerId : null,
      assigneeId: input.assigneeId ?? null,
      assignedById: input.assigneeId ? user.id : null,
      sourceMessageId: input.sourceMessageId ?? null,
      boardColumn: column,
      boardRank,
    },
    include: includeAccess(),
  });

  const grantIds = new Set<string>(input.directUserIds ?? []);
  if (input.visibilityType === "DIRECT") {
    grantIds.add(user.id);
    if (input.assigneeId) grantIds.add(input.assigneeId);
  }
  for (const uid of grantIds) {
    await prisma.taskAccess.upsert({
      where: { taskId_userId: { taskId: t.id, userId: uid } },
      create: { taskId: t.id, userId: uid, grantedById: user.id, accessType: "VIEW" },
      update: {},
    });
  }

  await writeAudit({
    actorId: user.id,
    action: "task.created",
    entityType: "task",
    entityId: t.id,
    metadata: {
      visibilityType: input.visibilityType,
      assigneeId: input.assigneeId,
      workKind: input.workKind,
      priority: input.priority,
    },
  });

  if (input.assigneeId) {
    await prisma.notification.create({
      data: {
        recipientId: input.assigneeId,
        type: "task_assigned",
        taskId: t.id,
        actorId: user.id,
      },
    });
    const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId } });
    if (assignee?.reportsToId && assignee.reportsToId !== user.id) {
      await prisma.notification.create({
        data: {
          recipientId: assignee.reportsToId,
          type: "task_routed_to_manager",
          taskId: t.id,
          actorId: user.id,
        },
      });
    }
  }

  return getTask(user, t.id);
}

export async function assignTask(user: AuthUser, taskId: string, assigneeId: string | null) {
  const t = await loadTask(taskId);
  await assertView(user, t);
  if (assigneeId) {
    if (!(await canAssignTask(user, t, assigneeId))) throw errors.forbidden();
  } else if (user.role !== "lead" && user.role !== "manager") {
    throw errors.forbidden();
  }
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId, assignedById: assigneeId ? user.id : null },
  });
  if (assigneeId) {
    await prisma.taskAccess.upsert({
      where: { taskId_userId: { taskId, userId: assigneeId } },
      create: { taskId, userId: assigneeId, grantedById: user.id, accessType: "ASSIGNEE" },
      update: { accessType: "ASSIGNEE" },
    });
    await prisma.notification.create({
      data: { recipientId: assigneeId, type: "task_assigned", taskId, actorId: user.id },
    });
  }
  await writeAudit({
    actorId: user.id,
    action: "task.assigned",
    entityType: "task",
    entityId: taskId,
    metadata: { from: t.assigneeId, to: assigneeId },
  });
  return updated;
}

export async function claimTask(user: AuthUser, taskId: string) {
  const t = await loadTask(taskId);
  if (!(await canSelfAssignTask(user, t))) throw errors.forbidden();
  return assignTask(user, taskId, user.id);
}

export async function setVisibility(
  user: AuthUser,
  taskId: string,
  visibilityType: VisibilityType,
  visibilityManagerId?: string | null,
  directUserIds?: string[],
) {
  const t = await loadTask(taskId);
  if (!(await canChangeVisibility(user, t))) throw errors.forbidden();
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      visibilityType,
      visibilityManagerId: visibilityType === "TEAM" ? visibilityManagerId : null,
    },
  });
  if (visibilityType === "DIRECT" && directUserIds) {
    for (const uid of directUserIds) {
      await prisma.taskAccess.upsert({
        where: { taskId_userId: { taskId, userId: uid } },
        create: { taskId, userId: uid, grantedById: user.id, accessType: "VIEW" },
        update: {},
      });
    }
  }
  await writeAudit({
    actorId: user.id,
    action: "task.visibility_changed",
    entityType: "task",
    entityId: taskId,
    metadata: { visibilityType, visibilityManagerId },
  });
  return updated;
}

export async function finishTask(user: AuthUser, taskId: string, finished: boolean) {
  const t = await loadTask(taskId);
  if (!(await canFinishTask(user, t))) throw errors.forbidden();
  const boardColumn = finished ? "DONE" : t.boardColumn === "DONE" ? "IN_PROGRESS" : t.boardColumn;
  const boardRank = boardColumn === t.boardColumn ? t.boardRank : await rankForInsert(boardColumn, null, null);
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { finishedAt: finished ? new Date() : null, boardColumn, boardRank },
  });
  await writeAudit({
    actorId: user.id,
    action: "task.completed",
    entityType: "task",
    entityId: taskId,
    metadata: { finished, boardColumn },
  });
  return updated;
}

export async function moveTaskOnBoard(
  user: AuthUser,
  taskId: string,
  boardColumn: BoardColumn,
  prevId?: string | null,
  nextId?: string | null,
) {
  const t = await loadTask(taskId);
  if (!(await canMoveBoardTask(user, t, boardColumn))) throw errors.forbidden();
  const boardRank = await rankForInsert(boardColumn, prevId, nextId, taskId);
  const finished = boardColumn === "DONE";
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      boardColumn,
      boardRank,
      finishedAt: finished ? t.finishedAt ?? new Date() : null,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "task.board_moved",
    entityType: "task",
    entityId: taskId,
    metadata: { from: t.boardColumn, to: boardColumn },
  });
  return updated;
}

export async function archiveTask(user: AuthUser, taskId: string, archived: boolean) {
  const t = await loadTask(taskId);
  if (!(await canArchiveTask(user, t))) throw errors.forbidden();
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: archived ? new Date() : null },
  });
  await writeAudit({
    actorId: user.id,
    action: "task.archived",
    entityType: "task",
    entityId: taskId,
    metadata: { archived },
  });
  return updated;
}

export async function addComment(user: AuthUser, taskId: string, body: string) {
  const t = await loadTask(taskId);
  await assertView(user, t);
  const comment = await prisma.comment.create({
    data: { taskId, authorId: user.id, body: body.trim() },
    include: { author: { select: { id: true, name: true } } },
  });
  const names = [...body.matchAll(/@([\w.\-]+)/g)].map((m) => m[1]);
  if (names.length) {
    const users = await prisma.user.findMany({
      where: { name: { in: names, mode: "insensitive" } },
    });
    for (const u of users) {
      await prisma.mention.create({
        data: { commentId: comment.id, mentionedUserId: u.id },
      });
      await prisma.notification.create({
        data: { recipientId: u.id, type: "mention", taskId, actorId: user.id },
      });
    }
  }
  await writeAudit({
    actorId: user.id,
    action: "comment.added",
    entityType: "task",
    entityId: taskId,
  });
  return comment;
}

export type WeeklyTrendPoint = {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  task: number;
  escalation: number;
  backlog: number;
  report: number;
  total: number;
};

function computeWeeklyTrends(allTasks: TaskWithAccess[]): WeeklyTrendPoint[] {
  const WEEKS_COUNT = 6;
  const now = new Date();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Align to Monday start of current week
  const currentWeekStart = new Date(now);
  const day = currentWeekStart.getDay();
  const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
  currentWeekStart.setDate(diff);
  currentWeekStart.setHours(0, 0, 0, 0);

  const points: WeeklyTrendPoint[] = [];

  for (let i = WEEKS_COUNT - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart.getTime() - i * ONE_WEEK_MS);
    const weekEnd = new Date(weekStart.getTime() + ONE_WEEK_MS);

    const weekTasks = allTasks.filter((t) => {
      const created = new Date(t.createdAt).getTime();
      return created >= weekStart.getTime() && created < weekEnd.getTime();
    });

    const taskCount = weekTasks.filter((t) => t.workKind === "task").length;
    const escalationCount = weekTasks.filter((t) => t.workKind === "escalation").length;
    const backlogCount = weekTasks.filter((t) => t.workKind === "backlog").length;
    const reportCount = weekTasks.filter((t) => t.workKind === "report").length;

    const startFmt = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endFmt = new Date(weekEnd.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    points.push({
      weekKey: i === 0 ? "Current" : `W-${i}`,
      weekLabel: `${startFmt} – ${endFmt}`,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      task: taskCount,
      escalation: escalationCount,
      backlog: backlogCount,
      report: reportCount,
      total: weekTasks.length,
    });
  }

  return points;
}

export async function dashboard(user: AuthUser) {
  assertOps(user);
  const tasks = await listTasks(user, { archived: false });
  const open = tasks.filter((t) => !t.finishedAt);
  const complete = tasks.filter((t) => t.finishedAt);
  const due = open.filter((t) => isOverdue(t));
  const unassigned = open.filter((t) => !t.assigneeId);
  const assignedOpen = open.filter((t) => t.assigneeId && !isOverdue(t));
  const unassignedNotDue = open.filter((t) => !t.assigneeId && !isOverdue(t));

  const byWorkKind = {
    task: tasks.filter((t) => t.workKind === "task").length,
    escalation: tasks.filter((t) => t.workKind === "escalation").length,
    backlog: tasks.filter((t) => t.workKind === "backlog").length,
    report: tasks.filter((t) => t.workKind === "report").length,
  };

  const archivedTasks = await listTasks(user, { archived: true });
  const allHistoricalTasks = [...tasks, ...archivedTasks];
  const weeklyTrends = computeWeeklyTrends(allHistoricalTasks);

  const base = {
    open: open.length,
    due: due.length,
    unassigned: unassigned.length,
    complete: complete.length,
    mine: open.filter((t) => t.assigneeId === user.id).length,
    chart: {
      complete: complete.length,
      due: due.length,
      unassigned: unassignedNotDue.length,
      assignedOpen: assignedOpen.length,
    },
    byWorkKind,
    weeklyTrends,
  };

  if (user.role === "associate") {
    return {
      role: "associate" as const,
      title: "My work",
      cards: [
        { key: "mine", label: "Assigned to me", value: base.mine, hint: "Open tasks you own" },
        { key: "unassigned", label: "Unassigned", value: unassigned.length, hint: "You can take these if you can see them" },
        { key: "due", label: "Due", value: due.length, hint: "Deadline has passed" },
        { key: "complete", label: "Complete", value: complete.length, hint: "Finished on your board" },
      ],
      ...base,
    };
  }
  if (user.role === "manager") {
    const teamUnassigned = unassigned.filter(
      (t) => t.visibilityType === "TEAM" && t.visibilityManagerId === user.id,
    ).length;
    return {
      role: "manager" as const,
      title: "Team operations",
      cards: [
        { key: "open", label: "Open", value: open.length, hint: "Visible operational work" },
        { key: "unassigned", label: "Unassigned", value: unassigned.length, hint: "Needs an owner" },
        { key: "due", label: "Due", value: due.length, hint: "Past deadline" },
        { key: "complete", label: "Complete", value: complete.length, hint: "Finished, not archived" },
      ],
      teamUnassigned,
      ...base,
    };
  }
  return {
    role: "lead" as const,
    title: "Operations command",
    cards: [
      { key: "open", label: "Open", value: open.length, hint: "Across IG Incorporation ops" },
      { key: "unassigned", label: "Unassigned", value: unassigned.length, hint: "No owner yet" },
      { key: "due", label: "Due", value: due.length, hint: "Past deadline" },
      { key: "complete", label: "Complete", value: complete.length, hint: "Finished on the board" },
    ],
    ...base,
  };
}

export async function listAudit(user: AuthUser, taskId: string) {
  await getTask(user, taskId);
  return prisma.auditEvent.findMany({
    where: { entityType: "task", entityId: taskId },
    orderBy: { createdAt: "asc" },
  });
}
