import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { errors } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import * as tasks from "./tasks.service.js";
import * as aiService from "../ai/ai.service.js";

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many AI requests. Please slow down." } },
});

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const metadataSchema = z
  .record(z.unknown())
  .refine((v) => JSON.stringify(v).length <= 4000, "Metadata too large")
  .optional()
  .nullable();

const createSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(1).max(8000),
  category: z.enum(["normal", "escalation", "inventory", "vendor", "customer", "other"]),
  workKind: z.enum(["task", "escalation", "backlog", "report"]),
  metadata: metadataSchema,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  dueAt: z.string().datetime().nullable().optional(),
  visibilityType: z.enum(["GLOBAL", "TEAM", "DIRECT"]),
  visibilityManagerId: z.string().uuid().nullable().optional(),
  directUserIds: z.array(z.string().uuid()).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sourceMessageId: z.string().uuid().nullable().optional(),
  boardColumn: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
});

const patchTaskSchema = z
  .object({
    title: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(3, "Title must be at least 3 characters").max(160, "Title must be at most 160 characters"))
      .optional(),
    description: z
      .string()
      .max(8000, "Description must be at most 8000 characters")
      .transform((s) => (s.trim().length === 0 ? "" : s))
      .optional(),
    category: z.enum(["normal", "escalation", "inventory", "vendor", "customer", "other"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    dueAt: z.string().datetime({ message: "Invalid datetime" }).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "PATCH body must contain at least one field to update",
  });

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const q = req.query;
    const data = await tasks.listTasks(req.user!, {
      category: q.category as never,
      workKind: q.workKind as never,
      visibility: q.visibility as never,
      assigneeId: q.assigneeId as string | undefined,
      createdById: q.createdById as string | undefined,
      finished: q.finished === "true" ? true : q.finished === "false" ? false : undefined,
      archived: q.archived === "true" ? true : q.archived === "false" ? false : undefined,
      overdue: q.overdue === "true",
      unassigned: q.unassigned === "true",
      q: q.q as string | undefined,
    });
    res.json({ data });
  }),
);

tasksRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    res.json({ data: await tasks.dashboard(req.user!) });
  }),
);

tasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    res.json({ data: await tasks.getTask(req.user!, req.params.id) });
  }),
);

tasksRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const body = patchTaskSchema.parse(req.body);
    const data = await tasks.updateTask(req.user!, req.params.id, {
      ...body,
      dueAt: body.dueAt !== undefined ? (body.dueAt ? new Date(body.dueAt) : null) : undefined,
    });
    res.json({ data });
  }),
);

tasksRouter.get(
  "/:id/audit",
  asyncHandler(async (req, res) => {
    res.json({ data: await tasks.listAudit(req.user!, req.params.id) });
  }),
);

tasksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const data = await tasks.createTask(req.user!, {
      ...body,
      metadata: body.metadata as never,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
    res.status(201).json({ data });
  }),
);

tasksRouter.post(
  "/:id/board",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        boardColumn: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
        prevId: z.string().uuid().nullable().optional(),
        nextId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body);
    res.json({
      data: await tasks.moveTaskOnBoard(req.user!, req.params.id, body.boardColumn, body.prevId, body.nextId),
    });
  }),
);

tasksRouter.post(
  "/:id/assign",
  asyncHandler(async (req, res) => {
    const body = z.object({ assigneeId: z.string().uuid().nullable() }).parse(req.body);
    res.json({ data: await tasks.assignTask(req.user!, req.params.id, body.assigneeId) });
  }),
);

tasksRouter.post(
  "/:id/claim",
  asyncHandler(async (req, res) => {
    res.json({ data: await tasks.claimTask(req.user!, req.params.id) });
  }),
);

tasksRouter.post(
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
      data: await tasks.setVisibility(
        req.user!,
        req.params.id,
        body.visibilityType,
        body.visibilityManagerId,
        body.directUserIds,
      ),
    });
  }),
);

tasksRouter.post(
  "/:id/finish",
  asyncHandler(async (req, res) => {
    const body = z.object({ finished: z.boolean() }).parse(req.body);
    res.json({ data: await tasks.finishTask(req.user!, req.params.id, body.finished) });
  }),
);

tasksRouter.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    const body = z.object({ archived: z.boolean() }).parse(req.body);
    res.json({ data: await tasks.archiveTask(req.user!, req.params.id, body.archived) });
  }),
);

tasksRouter.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const body = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
    res.status(201).json({ data: await tasks.addComment(req.user!, req.params.id, body.body) });
  }),
);

// SimuAI endpoints
tasksRouter.get(
  "/ai/status",
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const meta = aiService.getAiMeta();
    const hasApiKey = Boolean(
      (env.GROQ_API_KEY && env.GROQ_API_KEY.trim().length > 0) ||
      (env.AI_API_KEY && env.AI_API_KEY.trim().length > 0)
    );
    res.json({
      data: {
        configuredProvider: env.AI_PROVIDER,
        configuredModel: env.AI_MODEL,
        hasApiKey,
        activeProvider: meta.provider,
        activeModel: meta.model,
        fallback: meta.fallback,
        statusText:
          meta.provider === "groq" && !meta.fallback
            ? `Live Groq (${meta.model}) active`
            : meta.provider === "gemini" && !meta.fallback
            ? `Live Gemini (${meta.model}) active`
            : meta.fallback
            ? `Operating in offline fallback mode`
            : `Offline engine active`,
      },
    });
  }),
);

tasksRouter.post(
  "/ai/briefing",
  aiLimiter,
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const briefing = await aiService.generateBriefing(req.user!);
    const meta = aiService.getAiMeta();
    res.json({ data: { briefing, meta } });
  }),
);

tasksRouter.post(
  "/:id/ai/summary",
  aiLimiter,
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const summary = await aiService.summarizeTask(req.user!, req.params.id);
    const meta = aiService.getAiMeta();
    res.json({ data: { summary, meta } });
  }),
);

tasksRouter.post(
  "/:id/ai/actions",
  aiLimiter,
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const actions = await aiService.suggestNextActions(req.user!, req.params.id);
    const meta = aiService.getAiMeta();
    res.json({ data: { actions, meta } });
  }),
);

tasksRouter.post(
  "/:id/ai/catch-up",
  aiLimiter,
  asyncHandler(async (req, res) => {
    if (req.user?.role === "admin") throw errors.forbidden();
    const catchUp = await aiService.catchUpTask(req.user!, req.params.id);
    const meta = aiService.getAiMeta();
    res.json({ data: { catchUp, meta } });
  }),
);

