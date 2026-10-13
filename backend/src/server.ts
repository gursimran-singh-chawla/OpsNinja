import http from "node:http";
import { Server } from "socket.io";
import cookie from "cookie";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { log } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { sendMessage, assertParticipant } from "./modules/communication/chat.service.js";
import { startArchiveWorker } from "./modules/tasks/archive.service.js";

export function setupSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: { origin: env.FRONTEND_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie ?? "");
      const sid = cookies[env.COOKIE_NAME];
      if (!sid) return next(new Error("unauthorized"));
      const session = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
      if (!session || session.expiresAt < new Date() || session.user.deactivatedAt || session.user.approvedAt == null) {
        return next(new Error("unauthorized"));
      }
      socket.data.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        reportsToId: session.user.reportsToId,
        deactivatedAt: session.user.deactivatedAt,
      };
      next();
    } catch (e) {
      next(e as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.user.id}`);

    socket.on("join", async (conversationId: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        if (typeof conversationId !== "string" || !conversationId.trim() || conversationId.length > 100) {
          ack?.({ ok: false, error: "INVALID_CONVERSATION_ID" });
          socket.emit("error", { event: "join", code: "INVALID_CONVERSATION_ID" });
          return;
        }
        await assertParticipant(socket.data.user, conversationId);
        await socket.join(`conv:${conversationId}`);
        ack?.({ ok: true });
      } catch {
        log("warn", "socket_join_forbidden", {
          userId: socket.data.user?.id,
          conversationId: typeof conversationId === "string" ? conversationId : undefined,
        });
        // Same generic response for "not a participant" and "does not exist"
        ack?.({ ok: false, error: "FORBIDDEN" });
        socket.emit("error", { event: "join", code: "FORBIDDEN" });
      }
    });

    socket.on("message", async (payload: { conversationId: string; body: string }, ack?: (v: unknown) => void) => {
      try {
        if (
          !payload ||
          typeof payload !== "object" ||
          typeof payload.conversationId !== "string" ||
          typeof payload.body !== "string" ||
          !payload.body.trim()
        ) {
          ack?.({ ok: false, error: "INVALID_PAYLOAD" });
          return;
        }
        const msg = await sendMessage(socket.data.user, payload.conversationId, payload.body);
        io.to(`conv:${payload.conversationId}`).emit("message", msg);
        const conv = await prisma.conversation.findUnique({
          where: { id: payload.conversationId },
          include: { participants: true },
        });
        if (conv && conv.type === "DM") {
          for (const p of conv.participants) {
            io.to(`user:${p.userId}`).emit("dm_update", {
              conversationId: conv.id,
              message: msg,
            });
          }
        }
        ack?.({ ok: true, data: msg });
      } catch (e) {
        ack?.({ ok: false, error: e instanceof Error ? e.message : "failed" });
      }
    });
  });

  return io;
}

const app = createApp();
const server = http.createServer(app);
const io = setupSocketServer(server);
app.set("io", io);
export { io, server, app };

async function main() {
  await prisma.$connect();
  log("info", "database_connected");
  startArchiveWorker();
  server.listen(env.PORT, () => {
    log("info", "listening", { port: env.PORT });
  });
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    log("error", "startup_failed", { message: err instanceof Error ? err.message : "unknown" });
    process.exit(1);
  });
}
