import http from "node:http";
import { Server } from "socket.io";
import cookie from "cookie";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { log } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { sendMessage } from "./modules/communication/chat.service.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.FRONTEND_ORIGIN, credentials: true },
});

io.use(async (socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie ?? "");
    const sid = cookies[env.COOKIE_NAME];
    if (!sid) return next(new Error("unauthorized"));
    const session = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
    if (!session || session.expiresAt < new Date() || session.user.deactivatedAt) {
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
  socket.on("join", (conversationId: string) => {
    socket.join(`conv:${conversationId}`);
  });
  socket.on("message", async (payload: { conversationId: string; body: string }, ack?: (v: unknown) => void) => {
    try {
      const msg = await sendMessage(socket.data.user, payload.conversationId, payload.body);
      io.to(`conv:${payload.conversationId}`).emit("message", msg);
      ack?.({ ok: true, data: msg });
    } catch (e) {
      ack?.({ ok: false, error: e instanceof Error ? e.message : "failed" });
    }
  });
});

async function main() {
  await prisma.$connect();
  log("info", "database_connected");
  server.listen(env.PORT, () => {
    log("info", "listening", { port: env.PORT });
  });
}

main().catch((err) => {
  log("error", "startup_failed", { message: err instanceof Error ? err.message : "unknown" });
  process.exit(1);
});
