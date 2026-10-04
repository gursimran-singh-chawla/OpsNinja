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

const createUser = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "lead", "manager", "associate"]),
  reportsToId: z.string().uuid().nullable().optional(),
});

usersRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = createUser.parse(req.body);
    const data = await auth.onboardUser(req.user!.id, body);
    res.status(201).json({ data });
  }),
);

const patchUser = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
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
    if (body.email) {
      const clash = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (clash && clash.id !== id) throw errors.conflict("Email already registered");
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email?.toLowerCase(),
        role: body.role,
        reportsToId: body.reportsToId === undefined ? undefined : body.reportsToId,
        deactivatedAt: body.deactivated === undefined ? undefined : body.deactivated ? new Date() : null,
      },
      select: { id: true, email: true, name: true, role: true, reportsToId: true, deactivatedAt: true },
    });
    await writeAudit({
      actorId: req.user!.id,
      action: body.deactivated ? "user.deactivated" : "user.updated",
      entityType: "user",
      entityId: id,
      metadata: { role: body.role, reportsToId: body.reportsToId },
    });
    res.json({ data: user });
  }),
);
