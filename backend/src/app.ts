import "./types/express.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { attachSession } from "./middleware/session.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/identity/auth.routes.js";
import { usersRouter } from "./modules/identity/users.routes.js";
import { casesRouter } from "./modules/cases/cases.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { chatRouter } from "./modules/communication/chat.routes.js";
import { platformRouter } from "./modules/platform/platform.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(attachSession);
  app.use(
    "/api/auth/login",
    rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ data: { ok: true, service: "opsninja" } });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/cases", casesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/platform", platformRouter);

  app.use(errorHandler);
  return app;
}
