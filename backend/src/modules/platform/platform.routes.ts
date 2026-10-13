import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { errors } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/requireAuth.js";
import { getTaskActivityLogs, getSystemAuditLogs } from "./logs.service.js";

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

/**
 * Dedicated endpoint for regular users to retrieve permitted task activity logs.
 * Strictly forbidden for administrators (Admin sees no task content).
 */
platformRouter.get(
  "/logs/tasks",
  asyncHandler(async (req, res) => {
    if (req.user!.role === "admin") throw errors.forbidden();
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const action = typeof req.query.action === "string" ? req.query.action.trim() : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await getTaskActivityLogs(req.user!, { q, action, page, limit });
    res.json({ data: result.data, meta: { total: result.total } });
  }),
);

/**
 * Dedicated administrative audit endpoint for system and account-lifecycle events.
 * Strictly restricted to administrators only.
 */
platformRouter.get(
  "/logs/system",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const action = typeof req.query.action === "string" ? req.query.action.trim() : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await getSystemAuditLogs(req.user!, { q, action, page, limit });
    res.json({ data: result.data, meta: { total: result.total } });
  }),
);

/**
 * Canonical /logs endpoint:
 * Automatically routes to role-appropriate log view:
 * - Administrators -> System and account lifecycle events
 * - Regular users -> Scoped task activity feed (task.created, task.assigned, task.completed)
 * Rejects non-admin attempts to request administrative logs.
 */
platformRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const action = typeof req.query.action === "string" ? req.query.action.trim() : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    // Check if regular user requested administrative or user-lifecycle logs
    if (user.role !== "admin") {
      const requestedEntity = typeof req.query.entityType === "string" ? req.query.entityType.trim() : undefined;
      const requestedCategory = typeof req.query.category === "string" ? req.query.category.trim() : undefined;
      if (requestedEntity === "user" || requestedCategory === "system") {
        throw errors.forbidden();
      }
      const result = await getTaskActivityLogs(user, { q, action, page, limit });
      return res.json({ data: result.data, meta: { total: result.total } });
    }

    // Administrator requesting logs
    const result = await getSystemAuditLogs(user, { q, action, page, limit });
    return res.json({ data: result.data, meta: { total: result.total } });
  }),
);
