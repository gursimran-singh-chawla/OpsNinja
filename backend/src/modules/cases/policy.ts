import type { Case, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";

export type CaseWithAccess = Case & { access: { userId: string }[] };

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

export async function canViewCase(user: AuthUser, c: CaseWithAccess): Promise<boolean> {
  if (user.role === "lead") return true;
  if (user.role === "admin") return false;
  if (c.createdById === user.id) return true;
  if (c.assigneeId === user.id) return true;
  if (c.access.some((a) => a.userId === user.id)) return true;
  if (c.visibilityType === "GLOBAL" && isOps(user.role)) return true;
  if (c.visibilityType === "TEAM" && c.visibilityManagerId) {
    if (user.id === c.visibilityManagerId) return true;
    if (user.role === "associate" && user.reportsToId === c.visibilityManagerId) return true;
  }
  return false;
}

export function canCreateCase(user: AuthUser) {
  return user.role !== "admin";
}

export async function canAssignCase(user: AuthUser, c: CaseWithAccess, targetUserId: string) {
  if (!(await canViewCase(user, c))) return false;
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deactivatedAt || target.role !== "associate") return false;
  if (user.role === "lead") return true;
  if (user.role === "manager") {
    if (!target.reportsToId) return true;
    return target.reportsToId === user.id;
  }
  return false;
}

export async function canChangeVisibility(user: AuthUser, c: CaseWithAccess) {
  if (user.role === "lead") return true;
  if (user.role === "manager" && (c.createdById === user.id || c.visibilityManagerId === user.id)) return true;
  return false;
}

export async function canRedFlagCase(user: AuthUser, c: CaseWithAccess) {
  return (await canViewCase(user, c)) && user.role !== "admin";
}

export async function canFinishCase(user: AuthUser, c: CaseWithAccess) {
  if (!(await canViewCase(user, c))) return false;
  if (user.role === "lead" || user.role === "manager") return true;
  return c.assigneeId === user.id || c.createdById === user.id;
}

export async function canArchiveCase(user: AuthUser, c: CaseWithAccess) {
  if (!(await canViewCase(user, c))) return false;
  return user.role === "lead" || user.role === "manager";
}

export async function canComment(user: AuthUser, c: CaseWithAccess) {
  return (await canViewCase(user, c)) && user.role !== "admin";
}
