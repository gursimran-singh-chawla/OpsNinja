import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/requireAuth.js";

export const platformRouter = Router();
platformRouter.use(requireAuth);

platformRouter.get(
  "/metrics",
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const [users, byRole, sessions, flags, auditEvents] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.session.count(),
      prisma.featureFlag.findMany(),
      prisma.auditEvent.count(),
    ]);
    res.json({
      data: {
        users,
        byRole,
        activeSessions: sessions,
        flags,
        auditEvents,
      },
    });
  }),
);

platformRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType.trim() : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);

    const where: any = {};
    if (entityType && entityType !== "all") {
      where.entityType = entityType;
    }
    if (q) {
      where.OR = [
        { action: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { actor: { name: { contains: q, mode: "insensitive" } } },
        { actor: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const events = await prisma.auditEvent.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Enforce AGENTS.md locked rule: Admin sees NO task content (no exceptions)
    const sanitized = events.map((ev) => {
      if (req.user?.role === "admin" && ev.entityType === "task" && ev.metadata && typeof ev.metadata === "object") {
        const meta = { ...(ev.metadata as Record<string, unknown>) };
        if ("title" in meta) meta.title = "[Task Content Redacted — Admin Policy]";
        if ("description" in meta) meta.description = "[Task Content Redacted — Admin Policy]";
        return { ...ev, metadata: meta };
      }
      return ev;
    });

    res.json({ data: sanitized });
  }),
);
