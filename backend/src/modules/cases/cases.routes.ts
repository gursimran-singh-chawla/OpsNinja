import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import * as cases from "./cases.service.js";

export const casesRouter = Router();
casesRouter.use(requireAuth);

const createSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(1).max(8000),
  category: z.enum(["normal", "escalation", "inventory", "vendor", "customer", "other"]),
  visibilityType: z.enum(["GLOBAL", "TEAM", "DIRECT"]),
  visibilityManagerId: z.string().uuid().nullable().optional(),
  directUserIds: z.array(z.string().uuid()).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sourceMessageId: z.string().uuid().nullable().optional(),
});

casesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query;
    const data = await cases.listCases(req.user!, {
      category: q.category as never,
      visibility: q.visibility as never,
      assigneeId: q.assigneeId as string | undefined,
      createdById: q.createdById as string | undefined,
      redFlag: q.redFlag === "true" ? true : q.redFlag === "false" ? false : undefined,
      finished: q.finished === "true" ? true : q.finished === "false" ? false : undefined,
      archived: q.archived === "true" ? true : q.archived === "false" ? false : undefined,
      q: q.q as string | undefined,
    });
    res.json({ data });
  }),
);

casesRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    res.json({ data: await cases.dashboard(req.user!) });
  }),
);

casesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await cases.getCase(req.user!, req.params.id) });
  }),
);

casesRouter.get(
  "/:id/audit",
  asyncHandler(async (req, res) => {
    res.json({ data: await cases.listAudit(req.user!, req.params.id) });
  }),
);

casesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const data = await cases.createCase(req.user!, body);
    res.status(201).json({ data });
  }),
);

casesRouter.post(
  "/:id/assign",
  asyncHandler(async (req, res) => {
    const body = z.object({ assigneeId: z.string().uuid().nullable() }).parse(req.body);
    res.json({ data: await cases.assignCase(req.user!, req.params.id, body.assigneeId) });
  }),
);

casesRouter.post(
  "/:id/visibility",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        visibilityType: z.enum(["GLOBAL", "TEAM", "DIRECT"]),
        visibilityManagerId: z.string().uuid().nullable().optional(),
        directUserIds: z.array(z.string().uuid()).optional(),
      })
      .parse(req.body);
    res.json({
      data: await cases.setVisibility(
        req.user!,
        req.params.id,
        body.visibilityType,
        body.visibilityManagerId,
        body.directUserIds,
      ),
    });
  }),
);

casesRouter.post(
  "/:id/red-flag",
  asyncHandler(async (req, res) => {
    const body = z.object({ redFlag: z.boolean() }).parse(req.body);
    res.json({ data: await cases.setRedFlag(req.user!, req.params.id, body.redFlag) });
  }),
);

casesRouter.post(
  "/:id/finish",
  asyncHandler(async (req, res) => {
    const body = z.object({ finished: z.boolean() }).parse(req.body);
    res.json({ data: await cases.finishCase(req.user!, req.params.id, body.finished) });
  }),
);

casesRouter.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    const body = z.object({ archived: z.boolean() }).parse(req.body);
    res.json({ data: await cases.archiveCase(req.user!, req.params.id, body.archived) });
  }),
);

casesRouter.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const body = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
    res.status(201).json({ data: await cases.addComment(req.user!, req.params.id, body.body) });
  }),
);
