import { env } from "../../config/env.js";

export async function verifyTurnstileToken(token: string | undefined, remoteip?: string) {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.NODE_ENV === "development") return true;
    throw new Error("Turnstile is not configured");
  }

  if (!token) return false;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip,
    }),
  });

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
