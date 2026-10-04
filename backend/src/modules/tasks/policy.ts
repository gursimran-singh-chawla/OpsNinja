import type { BoardColumn, Role, Task } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";

export type TaskWithAccess = Task & { access: { userId: string }[] };

export async function teamAssociateIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({
    where: { reportsToId: managerId, role: "associate", deactivatedAt: null },
    select: { id: true },
  });
  return team.map((u) => u.id);
}

export function isOps(role: Role) {
  return role === "lead" || role === "manager" || role === "associate";
}

export function isOverdue(t: { dueAt: Date | null; finishedAt: Date | null }) {
  return !t.finishedAt && t.dueAt !== null && t.dueAt.getTime() < Date.now();
}

export async function canViewTask(user: AuthUser, t: TaskWithAccess): Promise<boolean> {
  if (user.role === "lead") return true;
  if (user.role === "admin") return false;
  if (t.createdById === user.id) return true;
  if (t.assigneeId === user.id) return true;
  if (t.access.some((a) => a.userId === user.id)) return true;
  if (t.visibilityType === "GLOBAL" && isOps(user.role)) return true;
  if (t.visibilityType === "TEAM" && t.visibilityManagerId) {
    if (user.id === t.visibilityManagerId) return true;
    if (user.role === "associate" && user.reportsToId === t.visibilityManagerId) return true;
  }
  return false;
}

export function canCreateTask(user: AuthUser) {
  return user.role !== "admin";
}

export function canUseVisibilityOnCreate(user: AuthUser, visibilityType: "GLOBAL" | "TEAM" | "DIRECT") {
  if (user.role === "associate" && visibilityType === "DIRECT") return false;
  return true;
}

export async function canAssignTarget(user: AuthUser, targetUserId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deactivatedAt || target.role !== "associate") return false;
  if (user.role === "lead") return true;
  if (user.role === "manager") {
    if (!target.reportsToId) return true;
    return target.reportsToId === user.id;
  }
  if (user.role === "associate") return targetUserId === user.id;
  return false;
}

export async function canSelfAssignTask(user: AuthUser, t: TaskWithAccess): Promise<boolean> {
  if (user.role !== "associate") return false;
  if (t.assigneeId) return false;
  return canViewTask(user, t);
}

export async function canAssignTask(user: AuthUser, t: TaskWithAccess, targetUserId: string) {
  if (!(await canViewTask(user, t))) return false;
  if (user.role === "associate") {
    return (await canSelfAssignTask(user, t)) && targetUserId === user.id;
  }
  return canAssignTarget(user, targetUserId);
}

export async function canChangeVisibility(user: AuthUser, t: TaskWithAccess) {
  if (user.role === "lead") return true;
  if (user.role === "manager" && (t.createdById === user.id || t.visibilityManagerId === user.id)) return true;
  return false;
}

export async function canFinishTask(user: AuthUser, t: TaskWithAccess) {
  if (!(await canViewTask(user, t))) return false;
  if (user.role === "lead" || user.role === "manager") return true;
  return user.role === "associate" && t.assigneeId === user.id;
}

export async function canArchiveTask(user: AuthUser, t: TaskWithAccess) {
  if (!(await canViewTask(user, t))) return false;
  return user.role === "lead" || user.role === "manager";
}

export async function canMoveBoardTask(user: AuthUser, t: TaskWithAccess, toColumn: BoardColumn) {
  if (!(await canViewTask(user, t))) return false;
  if (t.archivedAt) return false;
  const leavingOrEnteringDone = toColumn === "DONE" || t.boardColumn === "DONE";
  if (leavingOrEnteringDone && !(await canFinishTask(user, t))) return false;
  if (user.role === "lead" || user.role === "manager") return true;
  if (user.role === "associate") {
    return t.assigneeId === user.id || t.createdById === user.id || !t.assigneeId;
  }
  return false;
}

export async function canComment(user: AuthUser, t: TaskWithAccess) {
  return (await canViewTask(user, t)) && user.role !== "admin";
}
