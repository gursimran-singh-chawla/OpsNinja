import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: resolve(process.cwd(), "backend/.env") });
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  COOKIE_NAME: z.string().default("opsninja.sid"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_SECURE: z
    .string()
    .default(process.env.NODE_ENV === "production" ? "true" : "false")
    .transform((v) => v === "true"),
  COOKIE_SAMESITE: z
    .enum(["lax", "strict", "none"])
    .default(process.env.NODE_ENV === "production" ? "none" : "lax"),
  AI_PROVIDER: z.string().default("none"),
  AI_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_API_KEY: z.string().optional().default(""),
  AI_API_KEY: z.string().optional().default(""),
  EMAILJS_SERVICE_ID: z.string().optional().default(""),
  EMAILJS_TEMPLATE_ID: z.string().optional().default(""),
  EMAILJS_PUBLIC_KEY: z.string().optional().default(""),
  EMAILJS_PRIVATE_KEY: z.string().optional().default(""),
  TURNSTILE_SECRET_KEY: z.string().optional().default(""),
  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    throw new Error("Missing or invalid environment variables");
  }
  const data = parsed.data;
  if (data.COOKIE_SAMESITE === "none" && !data.COOKIE_SECURE) {
    data.COOKIE_SECURE = true;
  }
  return data;
}

export const env = loadEnv();
