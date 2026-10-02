import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import * as chat from "./chat.service.js";

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    res.json({ data: await chat.listConversations(req.user!) });
  }),
);

chatRouter.post(
  "/dm",
  asyncHandler(async (req, res) => {
    const body = z.object({ userId: z.string().uuid() }).parse(req.body);
    res.json({ data: await chat.openDm(req.user!, body.userId) });
  }),
);

chatRouter.get(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const cursor = req.query.cursor as string | undefined;
    res.json({ data: await chat.listMessages(req.user!, req.params.id, cursor) });
  }),
);

chatRouter.post(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const body = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
    res.status(201).json({ data: await chat.sendMessage(req.user!, req.params.id, body.body) });
  }),
);
