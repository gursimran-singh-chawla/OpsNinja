import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { log } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "validation", message: err.issues.map((i) => i.message).join("; ") },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  log("error", "unhandled_error", { message: err instanceof Error ? err.message : "unknown" });
  res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
};
