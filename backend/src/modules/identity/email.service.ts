import { env } from "../../config/env.js";

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  code: string;
}) {
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "development") {
      console.info(`[email-verification] OTP for ${input.to}: ${input.code}`);
      return;
    }
    throw new Error("Email delivery is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: "Your OpsNinja verification code",
      text: [
        `Hi ${input.name},`,
        "",
        "Your OpsNinja verification code is:",
        "",
        input.code,
        "",
        "This code expires in 10 minutes.",
        "If you did not create an OpsNinja account, you can ignore this email.",
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto;padding:24px">
        <div style="font-size:12px;font-weight:700;letter-spacing:.18em;color:#4f46e5">OPSNINJA</div>
        <h2 style="margin:20px 0 8px">Verify your email</h2>
        <p>Hi ${escapeHtml(input.name)}, use the code below to activate your account.</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:10px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:18px;text-align:center;margin:20px 0">${input.code}</div>
        <p style="font-size:13px;color:#64748b">This code expires in 10 minutes. If you did not create an OpsNinja account, ignore this email.</p>
      </div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Resend email failed:", response.status, detail);
    throw new Error("Could not send verification email");
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}
