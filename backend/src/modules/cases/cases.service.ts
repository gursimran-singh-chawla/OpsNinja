import type { CaseCategory, Prisma, VisibilityType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuthUser } from "../../types/express.js";
import {
  canArchiveCase,
  canAssignCase,
  canChangeVisibility,
  canCreateCase,
  canFinishCase,
  canRedFlagCase,
  canViewCase,
  type CaseWithAccess,
} from "./policy.js";

function includeAccess(): Prisma.CaseInclude {
  return { access: { select: { userId: true, accessType: true, grantedById: true } } };
}

async function loadCase(id: string): Promise<CaseWithAccess> {
  const c = await prisma.case.findUnique({ where: { id }, include: includeAccess() });
  if (!c) throw errors.notFound("Case");
  return c as CaseWithAccess;
}

async function assertView(user: AuthUser, c: CaseWithAccess) {
  if (!(await canViewCase(user, c))) throw errors.forbidden();
}

export async function listCases(
  user: AuthUser,
  filters: {
    category?: CaseCategory;
    visibility?: VisibilityType;
    assigneeId?: string;
    createdById?: string;
    redFlag?: boolean;
    finished?: boolean;
    archived?: boolean;
    q?: string;
    view?: string;
  },
) {
  const where: Prisma.CaseWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.visibility) where.visibilityType = filters.visibility;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.createdById) where.createdById = filters.createdById;
  if (filters.redFlag !== undefined) where.redFlag = filters.redFlag;
  if (filters.finished === true) where.finishedAt = { not: null };
  if (filters.finished === false) where.finishedAt = null;
  if (filters.archived === true) where.archivedAt = { not: null };
  else if (filters.archived === false || filters.archived === undefined) where.archivedAt = null;
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.case.findMany({
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
    if (await canViewCase(user, row as CaseWithAccess)) visible.push(row);
  }
  return visible;
}

export async function getCase(user: AuthUser, id: string) {
  const c = await prisma.case.findUnique({
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
  if (!c) throw errors.notFound("Case");
  await assertView(user, c as CaseWithAccess);
  return c;
}

type CreateInput = {
  title: string;
  description: string;
  category: CaseCategory;
  visibilityType: VisibilityType;
  visibilityManagerId?: string | null;
  directUserIds?: string[];
  assigneeId?: string | null;
  sourceMessageId?: string | null;
};

export async function createCase(user: AuthUser, input: CreateInput) {
  if (!canCreateCase(user)) throw errors.forbidden();
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
    if (user.role === "associate" && user.reportsToId) {
      const allowed = new Set([user.reportsToId, ...(input.directUserIds ?? [])]);
      if (![...allowed].length) throw errors.badRequest("Direct case needs a recipient");
    }
    if (user.role === "manager") {
      for (const id of input.directUserIds ?? []) {
        const t = await prisma.user.findUnique({ where: { id } });
        if (!t) throw errors.notFound("User");
        if (t.role === "associate" && t.reportsToId && t.reportsToId !== user.id) throw errors.forbidden();
      }
    }
  }
  if (input.visibilityType === "GLOBAL" && user.role === "associate" && !user.reportsToId) {
    // free agent may create global
  }

  const c = await prisma.case.create({
    data: {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      createdById: user.id,
      visibilityType: input.visibilityType,
      visibilityManagerId: input.visibilityType === "TEAM" ? input.visibilityManagerId : null,
      assigneeId: input.assigneeId ?? null,
      assignedById: input.assigneeId ? user.id : null,
      sourceMessageId: input.sourceMessageId ?? null,
    },
    include: includeAccess(),
  });

  const grantIds = new Set<string>(input.directUserIds ?? []);
  if (input.visibilityType === "DIRECT") {
    grantIds.add(user.id);
    if (input.assigneeId) grantIds.add(input.assigneeId);
  }
  for (const uid of grantIds) {
    await prisma.caseAccess.upsert({
      where: { caseId_userId: { caseId: c.id, userId: uid } },
      create: { caseId: c.id, userId: uid, grantedById: user.id, accessType: "VIEW" },
      update: {},
    });
  }

  if (input.assigneeId && !(await canAssignCase(user, { ...c, access: [] }, input.assigneeId))) {
    await prisma.case.delete({ where: { id: c.id } });
    throw errors.forbidden();
  }

  await writeAudit({
    actorId: user.id,
    action: "case.created",
    entityType: "case",
    entityId: c.id,
    metadata: { visibilityType: input.visibilityType, assigneeId: input.assigneeId },
  });

  if (input.assigneeId) {
    await prisma.notification.create({
      data: {
        recipientId: input.assigneeId,
        type: "case_assigned",
        caseId: c.id,
        actorId: user.id,
      },
    });
    const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId } });
    if (assignee?.reportsToId && assignee.reportsToId !== user.id) {
      await prisma.notification.create({
        data: {
          recipientId: assignee.reportsToId,
          type: "case_routed_to_manager",
          caseId: c.id,
          actorId: user.id,
        },
      });
    }
  }

  return getCase(user, c.id);
}

export async function assignCase(user: AuthUser, caseId: string, assigneeId: string | null) {
  const c = await loadCase(caseId);
  await assertView(user, c);
  if (assigneeId) {
    if (!(await canAssignCase(user, c, assigneeId))) throw errors.forbidden();
  } else if (user.role !== "lead" && user.role !== "manager") {
    throw errors.forbidden();
  }
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { assigneeId, assignedById: assigneeId ? user.id : null },
  });
  if (assigneeId) {
    await prisma.caseAccess.upsert({
      where: { caseId_userId: { caseId, userId: assigneeId } },
      create: { caseId, userId: assigneeId, grantedById: user.id, accessType: "ASSIGNEE" },
      update: { accessType: "ASSIGNEE" },
    });
    await prisma.notification.create({
      data: { recipientId: assigneeId, type: "case_assigned", caseId, actorId: user.id },
    });
  }
  await writeAudit({
    actorId: user.id,
    action: "case.assigned",
    entityType: "case",
    entityId: caseId,
    metadata: { from: c.assigneeId, to: assigneeId },
  });
  return updated;
}

export async function setVisibility(
  user: AuthUser,
  caseId: string,
  visibilityType: VisibilityType,
  visibilityManagerId?: string | null,
  directUserIds?: string[],
) {
  const c = await loadCase(caseId);
  if (!(await canChangeVisibility(user, c))) throw errors.forbidden();
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      visibilityType,
      visibilityManagerId: visibilityType === "TEAM" ? visibilityManagerId : null,
    },
  });
  if (visibilityType === "DIRECT" && directUserIds) {
    for (const uid of directUserIds) {
      await prisma.caseAccess.upsert({
        where: { caseId_userId: { caseId, userId: uid } },
        create: { caseId, userId: uid, grantedById: user.id, accessType: "VIEW" },
        update: {},
      });
    }
  }
  await writeAudit({
    actorId: user.id,
    action: "case.visibility_changed",
    entityType: "case",
    entityId: caseId,
    metadata: { visibilityType, visibilityManagerId },
  });
  return updated;
}

export async function setRedFlag(user: AuthUser, caseId: string, redFlag: boolean) {
  const c = await loadCase(caseId);
  if (!(await canRedFlagCase(user, c))) throw errors.forbidden();
  const updated = await prisma.case.update({ where: { id: caseId }, data: { redFlag } });
  await writeAudit({
    actorId: user.id,
    action: "case.red_flagged",
    entityType: "case",
    entityId: caseId,
    metadata: { redFlag },
  });
  if (redFlag) {
    const leads = await prisma.user.findMany({ where: { role: "lead", deactivatedAt: null } });
    await prisma.notification.createMany({
      data: leads.map((l) => ({
        recipientId: l.id,
        type: "red_flag" as const,
        caseId,
        actorId: user.id,
      })),
    });
  }
  return updated;
}

export async function finishCase(user: AuthUser, caseId: string, finished: boolean) {
  const c = await loadCase(caseId);
  if (!(await canFinishCase(user, c))) throw errors.forbidden();
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { finishedAt: finished ? new Date() : null },
  });
  await writeAudit({
    actorId: user.id,
    action: "case.finished",
    entityType: "case",
    entityId: caseId,
    metadata: { finished },
  });
  return updated;
}

export async function archiveCase(user: AuthUser, caseId: string, archived: boolean) {
  const c = await loadCase(caseId);
  if (!(await canArchiveCase(user, c))) throw errors.forbidden();
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { archivedAt: archived ? new Date() : null },
  });
  await writeAudit({
    actorId: user.id,
    action: "case.archived",
    entityType: "case",
    entityId: caseId,
    metadata: { archived },
  });
  return updated;
}

export async function addComment(user: AuthUser, caseId: string, body: string) {
  const c = await loadCase(caseId);
  await assertView(user, c);
  const comment = await prisma.comment.create({
    data: { caseId, authorId: user.id, body: body.trim() },
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
        data: { recipientId: u.id, type: "mention", caseId, actorId: user.id },
      });
    }
  }
  await writeAudit({
    actorId: user.id,
    action: "comment.added",
    entityType: "case",
    entityId: caseId,
  });
  return comment;
}

export async function dashboard(user: AuthUser) {
  const cases = await listCases(user, { archived: false });
  const open = cases.filter((c) => !c.finishedAt);
  return {
    open: open.length,
    redFlags: open.filter((c) => c.redFlag).length,
    unassigned: open.filter((c) => !c.assigneeId).length,
    finished: cases.filter((c) => c.finishedAt).length,
    mine: open.filter((c) => c.assigneeId === user.id).length,
  };
}

export async function listAudit(user: AuthUser, caseId: string) {
  await getCase(user, caseId);
  return prisma.auditEvent.findMany({
    where: { entityType: "case", entityId: caseId },
    orderBy: { createdAt: "asc" },
  });
}
