import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../../middleware/requireAuth.js";

export const platformRouter = Router();
platformRouter.use(requireAuth, requireRole("admin"));

platformRouter.get(
  "/metrics",
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
