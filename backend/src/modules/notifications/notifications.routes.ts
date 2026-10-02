import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { recipientId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = items.filter((n) => !n.readAt).length;
    res.json({ data: { items, unread } });
  }),
);

notificationsRouter.post(
  "/read",
  asyncHandler(async (req, res) => {
    const body = z.object({ id: z.string().uuid().optional() }).parse(req.body);
    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, recipientId: req.user!.id },
        data: { readAt: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { recipientId: req.user!.id, readAt: null },
        data: { readAt: new Date() },
      });
    }
    res.json({ data: { ok: true } });
  }),
);
