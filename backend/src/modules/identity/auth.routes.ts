import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { errors } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { verifyTurnstileToken } from "./turnstile.service.js";
import * as auth from "./auth.service.js";

export const authRouter = Router();

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
  role: z.enum(["lead", "manager", "associate"]).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

function cookieOpts() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  } as const;
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = creds.parse(req.body);
    if (!body.name) throw errors.badRequest("Name is required");
    if (!body.role) throw errors.badRequest("Role is required");

    const turnstileOk = await verifyTurnstileToken(body.turnstileToken, req.ip);
    if (!turnstileOk) throw errors.badRequest("Please complete the security check");

    const user = await auth.register({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role,
    });

    res.status(201).json({
      data: {
        email: user.email,
        verificationRequired: true,
      },
    });
  }),
);

authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        code: z.string().min(1).max(20),
      })
      .parse(req.body);

    const result = await auth.verifyEmail(body.email, body.code);
    res.cookie(env.COOKIE_NAME, result.sessionId, cookieOpts());
    res.json({ data: result.user });
  }),
);

authRouter.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    await auth.resendVerification(body.email);
    res.json({ data: { sent: true } });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = creds.pick({ email: true, password: true }).parse(req.body);
    const ip = req.ip ?? "unknown";
    const { sessionId, user } = await auth.login(body.email, body.password, ip);
    res.cookie(env.COOKIE_NAME, sessionId, cookieOpts());
    res.json({ data: user });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await auth.logout(req.sessionId);
    res.clearCookie(env.COOKIE_NAME, { path: "/" });
    res.json({ data: { ok: true } });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: req.user });
  }),
);
