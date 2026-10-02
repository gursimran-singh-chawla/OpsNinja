import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/requireAuth.js";

export const platformRouter = Router();
platformRouter.use(requireAuth, requireRole("admin"));

platformRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    const [users, byRole, sessions, total, open, finished, archived, flags] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.session.count(),
      prisma.case.count(),
      prisma.case.count({ where: { archivedAt: null, finishedAt: null } }),
      prisma.case.count({ where: { finishedAt: { not: null } } }),
      prisma.case.count({ where: { archivedAt: { not: null } } }),
      prisma.featureFlag.findMany(),
    ]);
    res.json({
      data: {
        users,
        byRole,
        activeSessions: sessions,
        cases: { total, open, finished, archived },
        flags,
      },
    });
  }),
);
