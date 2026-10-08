export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: () => new AppError(401, "unauthorized", "Authentication required"),
  forbidden: () => new AppError(403, "forbidden", "You do not have access"),
  emailNotVerified: () => new AppError(403, "email_not_verified", "Please verify your email before signing in"),
  notFound: (entity = "Resource") => new AppError(404, "not_found", `${entity} not found`),
  badRequest: (message: string) => new AppError(400, "bad_request", message),
  conflict: (message: string) => new AppError(409, "conflict", message),
  tooMany: () => new AppError(429, "rate_limited", "Too many attempts"),
};
