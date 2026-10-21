import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { errors } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import * as auth from "./auth.service.js";
import { verifyTurnstileToken } from "./turnstile.service.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80),
  role: z.enum(["lead", "manager", "associate"]),
  turnstileToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 numeric digits"),
});

const resendSchema = z.object({
  email: z.string().email(),
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
    const body = registerSchema.parse(req.body);

    // Validate Cloudflare Turnstile token
    await verifyTurnstileToken(body.turnstileToken, req.ip);

    // Create unverified user and dispatch OTP email
    const result = await auth.register({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role,
    });

    // Unverified user receives NO session
    res.status(201).json({ data: result });
  }),
);

authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const body = verifyEmailSchema.parse(req.body);

    const result = await auth.verifyEmail(body.email, body.code);
    if (result.sessionId) {
      res.cookie(env.COOKIE_NAME, result.sessionId, cookieOpts());
    }
    res.json({
      data: {
        user: result.user ? { ...result.user, token: result.sessionId } : result.user,
        approved: result.approved,
        message: result.message,
        token: result.sessionId,
      },
    });
  }),
);

authRouter.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const body = resendSchema.parse(req.body);

    const result = await auth.resendVerification(body.email);
    res.json({ data: result });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const ip = req.ip ?? "unknown";
    const { sessionId, user } = await auth.login(body.email, body.password, ip);
    res.cookie(env.COOKIE_NAME, sessionId, cookieOpts());
    res.json({ data: { ...user, token: sessionId } });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await auth.logout(req.sessionId);
    res.clearCookie(env.COOKIE_NAME, cookieOpts());
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
