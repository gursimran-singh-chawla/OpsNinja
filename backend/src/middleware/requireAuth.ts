import type { RequestHandler } from "express";
import { errors } from "../lib/errors.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(errors.unauthorized());
  next();
};

export const requireRole =
  (...roles: Array<"admin" | "lead" | "manager" | "associate">): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(errors.unauthorized());
    if (!roles.includes(req.user.role)) return next(errors.forbidden());
    next();
  };
