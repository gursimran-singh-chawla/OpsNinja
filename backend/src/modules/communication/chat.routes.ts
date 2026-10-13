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

chatRouter.get(
  "/users/search",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    res.json({ data: await chat.searchUsersForChat(req.user!, q) });
  }),
);

chatRouter.post(
  "/dm",
  asyncHandler(async (req, res) => {
    const body = z.object({ userId: z.string().uuid() }).parse(req.body);
    res.json({ data: await chat.openDm(req.user!, body.userId) });
  }),
);

chatRouter.post(
  "/dm/send",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        userId: z.string().uuid(),
        body: z.string().min(1).max(4000),
      })
      .parse(req.body);
    const result = await chat.sendDirectMessage(req.user!, body.userId, body.body);
    const io = req.app.get("io");
    if (io) {
      io.to(`conv:${result.conversation.id}`).emit("message", result.message);
      for (const p of result.conversation.participants) {
        io.to(`user:${p.userId}`).emit("dm_update", {
          conversationId: result.conversation.id,
          message: result.message,
        });
      }
    }
    res.status(201).json({ data: result });
  }),
);

chatRouter.delete(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await chat.deleteConversationForUser(req.user!, req.params.id) });
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
    const msg = await chat.sendMessage(req.user!, req.params.id, body.body);
    const io = req.app.get("io");
    if (io) {
      io.to(`conv:${req.params.id}`).emit("message", msg);
    }
    res.status(201).json({ data: msg });
  }),
);
