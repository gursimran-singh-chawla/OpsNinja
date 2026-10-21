import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export const attachSession: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    const sid = (req.cookies?.[env.COOKIE_NAME] as string | undefined) || bearerToken;
    if (!sid) return next();
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: sid } }).catch(() => undefined);
      return next();
    }
    if (session.user.deactivatedAt || session.user.approvedAt == null) return next();
    req.sessionId = session.id;
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      reportsToId: session.user.reportsToId,
      deactivatedAt: session.user.deactivatedAt,
      emailVerifiedAt: session.user.emailVerifiedAt,
      approvedAt: session.user.approvedAt,
    };
    next();
  } catch (e) {
    next(e);
  }
};
