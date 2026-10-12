import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { log } from "../../lib/logger.js";

export type SendVerificationEmailInput = {
  to: string;
  name: string;
  code: string;
};

/**
 * Returns true if all required EmailJS configuration variables are supplied.
 */
export function isEmailConfigured(): boolean {
  return Boolean(
    env.EMAILJS_SERVICE_ID?.trim() &&
    env.EMAILJS_TEMPLATE_ID?.trim() &&
    env.EMAILJS_PUBLIC_KEY?.trim() &&
    env.EMAILJS_PRIVATE_KEY?.trim()
  );
}

/**
 * Returns a list of any missing EmailJS environment variable names for diagnostics.
 */
export function getMissingEmailConfig(): string[] {
  const missing: string[] = [];
  if (!env.EMAILJS_SERVICE_ID?.trim()) missing.push("EMAILJS_SERVICE_ID");
  if (!env.EMAILJS_TEMPLATE_ID?.trim()) missing.push("EMAILJS_TEMPLATE_ID");
  if (!env.EMAILJS_PUBLIC_KEY?.trim()) missing.push("EMAILJS_PUBLIC_KEY");
  if (!env.EMAILJS_PRIVATE_KEY?.trim()) missing.push("EMAILJS_PRIVATE_KEY");
  return missing;
}

/**
 * Dispatches a 6-digit OTP verification email via EmailJS REST API.
 * Never logs OTP codes, private keys, or passwords.
 * Never silently pretends an email was sent if unconfigured.
 */
export async function sendVerificationEmail({ to, name, code }: SendVerificationEmailInput): Promise<void> {
  const missingConfig = getMissingEmailConfig();
  if (missingConfig.length > 0) {
    log("error", "emailjs_configuration_missing", {
      missing: missingConfig,
      isProduction: env.NODE_ENV === "production",
    });

    if (env.NODE_ENV === "production") {
      throw new AppError(
        500,
        "email_delivery_failed",
        "Transactional email delivery is not configured in production."
      );
    }

    throw new AppError(
      500,
      "email_delivery_failed",
      `EmailJS is not configured. Missing environment variables: ${missingConfig.join(", ")}.`
    );
  }

  const serviceId = env.EMAILJS_SERVICE_ID.trim();
  const templateId = env.EMAILJS_TEMPLATE_ID.trim();
  const publicKey = env.EMAILJS_PUBLIC_KEY.trim();
  const privateKey = env.EMAILJS_PRIVATE_KEY.trim();

  // Dynamic template variables supplied to the EmailJS email template
  const templateParams = {
    to_email: to,
    email: to,
    to_name: name,
    name,
    passcode: code,
    otp_code: code,
    code,
    expires_in_minutes: 10,
    app_name: "OpsNinja",
  };

  const recipientDomain = to.includes("@") ? to.split("@")[1] : "unknown";

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OpsNinja-Backend/1.0",
        origin: env.FRONTEND_ORIGIN || "http://localhost:5173",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: templateParams,
      }),
    });

    if (!res.ok) {
      let errorBody = "";
      try {
        errorBody = (await res.text()).trim().slice(0, 300);
      } catch {
        errorBody = res.statusText;
      }

      log("error", "emailjs_api_error", {
        status: res.status,
        error: errorBody,
        recipientDomain,
      });

      if (res.status === 403 && errorBody.includes("non-browser environments")) {
        throw new AppError(
          500,
          "email_delivery_failed",
          "EmailJS error: API access from non-browser environments is disabled. Enable it in EmailJS Dashboard under Account > Security (https://dashboard.emailjs.com/admin/account/security)."
        );
      }

      throw new AppError(
        500,
        "email_delivery_failed",
        "Failed to send verification email. Please try again."
      );
    }

    log("info", "emailjs_email_sent", {
      recipientDomain,
    });
  } catch (err) {
    if (err instanceof AppError) throw err;

    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");

    log("error", isTimeout ? "emailjs_timeout" : "emailjs_network_error", {
      message: err instanceof Error ? err.message : "unknown",
      recipientDomain,
    });

    throw new AppError(
      500,
      "email_delivery_failed",
      isTimeout
        ? "Verification email service timed out. Please try again."
        : "Failed to deliver verification email. Please try again."
    );
  }
}
