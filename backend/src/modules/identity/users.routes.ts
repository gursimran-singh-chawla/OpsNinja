import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { errors } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/requireAuth.js";
import * as auth from "./auth.service.js";
import { writeAudit } from "../audit/audit.service.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ data: await auth.listUsers() });
  }),
);

const patchUser = z.object({
  role: z.enum(["admin", "lead", "manager", "associate"]).optional(),
  reportsToId: z.string().uuid().nullable().optional(),
  deactivated: z.boolean().optional(),
});

usersRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = patchUser.parse(req.body);
    const id = req.params.id;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw errors.notFound("User");
    const user = await prisma.user.update({
      where: { id },
      data: {
        role: body.role,
        reportsToId: body.reportsToId === undefined ? undefined : body.reportsToId,
        deactivatedAt: body.deactivated === undefined ? undefined : body.deactivated ? new Date() : null,
      },
      select: { id: true, email: true, name: true, role: true, reportsToId: true, deactivatedAt: true },
    });
    if (body.deactivated) {
      await writeAudit({
        actorId: req.user!.id,
        action: "user.deactivated",
        entityType: "user",
        entityId: id,
      });
    }
    res.json({ data: user });
  }),
);
