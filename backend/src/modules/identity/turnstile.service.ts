import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { log } from "../../lib/logger.js";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
};

export async function verifyTurnstileToken(token?: string, ip?: string): Promise<boolean> {
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim();

  // In development and test environments, allow signup when Turnstile secret key is not configured
  if (!secretKey) {
    if (env.NODE_ENV === "production") {
      log("error", "turnstile_missing_secret_in_production");
      throw new AppError(500, "security_config_error", "Bot verification configuration missing in production");
    }
    log("info", "turnstile_bypassed_in_dev", { reason: "TURNSTILE_SECRET_KEY not set in dev/test" });
    return true;
  }

  if (!token) {
    throw new AppError(400, "turnstile_failed", "Please complete the security verification challenge");
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip && ip !== "unknown") {
      formData.append("remoteip", ip);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      log("warn", "turnstile_http_error", { status: response.status });
      throw new AppError(400, "turnstile_failed", "Security challenge verification failed");
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    if (!data.success) {
      log("warn", "turnstile_validation_failed", { errors: data["error-codes"] });
      throw new AppError(400, "turnstile_failed", "Security verification failed. Please try again.");
    }

    return true;
  } catch (err) {
    if (err instanceof AppError) throw err;
    log("error", "turnstile_network_error", { message: err instanceof Error ? err.message : "unknown" });
    throw new AppError(400, "turnstile_failed", "Unable to verify security challenge. Please try again.");
  }
}
