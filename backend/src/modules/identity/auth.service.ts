import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { writeAudit } from "../audit/audit.service.js";
import { sendVerificationEmail } from "./email.service.js";
import type { AuthUser } from "../../types/express.js";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  reportsToId: string | null;
  deactivatedAt: Date | null;
  emailVerifiedAt?: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    reportsToId: u.reportsToId,
    deactivatedAt: u.deactivatedAt,
    emailVerifiedAt: u.emailVerifiedAt ?? null,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashVerificationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function codesMatch(code: string, hash: string) {
  const actual = Buffer.from(hashVerificationCode(code), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_MS),
    },
  });
  return session.id;
}

async function issueVerificationCode(user: {
  id: string;
  email: string;
  name: string;
}) {
  const now = Date.now();
  const code = randomInt(100000, 1000000).toString();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCodeHash: hashVerificationCode(code),
      emailVerificationExpiresAt: new Date(now + VERIFICATION_TTL_MS),
      emailVerificationAttempts: 0,
      emailVerificationSentAt: new Date(now),
    },
  });
  await sendVerificationEmail({ to: user.email, name: user.name, code });
}

export function checkLoginRate(key: string) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || rec.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  rec.count += 1;
  if (rec.count > 10) throw errors.tooMany();
}

export async function register(input: {
  email: string;
  name: string;
  password: string;
  role: "lead" | "manager" | "associate";
}) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw errors.conflict("Email already registered");

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
    },
  });

  try {
    await issueVerificationCode(user);
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw err;
  }

  await writeAudit({
    actorId: user.id,
    action: "user.created_pending_email_verification",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role },
  });

  return publicUser(user);
}

export async function verifyEmail(emailInput: string, codeInput: string) {
  const email = normalizeEmail(emailInput);
  const code = codeInput.replace(/\s/g, "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw errors.badRequest("Invalid verification code");
  if (user.emailVerifiedAt) {
    return { sessionId: await createSession(user.id), user: publicUser(user) };
  }

  if (!/^\d{6}$/.test(code)) {
    throw errors.badRequest("Enter the 6-digit verification code");
  }

  if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
    throw errors.badRequest("This verification code has expired. Request a new code.");
  }

  if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
    throw errors.badRequest("This verification code has expired. Request a new code.");
  }

  if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
    throw errors.tooMany();
  }

  if (!codesMatch(code, user.emailVerificationCodeHash)) {
    const attempts = user.emailVerificationAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationAttempts: attempts,
        ...(attempts >= MAX_VERIFICATION_ATTEMPTS
          ? {
              emailVerificationCodeHash: null,
              emailVerificationExpiresAt: null,
              emailVerificationSentAt: null,
            }
          : {}),
      },
    });
    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw errors.tooMany();
    }
    throw errors.badRequest("Incorrect verification code");
  }

  const verifiedAt = new Date();
  const verified = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: verifiedAt,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: null,
    },
  });

  const sessionId = await createSession(verified.id);
  await writeAudit({
    actorId: verified.id,
    action: "user.email_verified",
    entityType: "user",
    entityId: verified.id,
  });

  return { sessionId, user: publicUser(verified) };
}

export async function resendVerification(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.deactivatedAt || user.emailVerifiedAt) {
    return { sent: true };
  }

  if (
    user.emailVerificationSentAt &&
    user.emailVerificationSentAt.getTime() + VERIFICATION_RESEND_COOLDOWN_MS > Date.now()
  ) {
    throw errors.tooMany();
  }

  await issueVerificationCode(user);
  return { sent: true };
}

export async function login(emailInput: string, password: string, ip: string) {
  const email = normalizeEmail(emailInput);
  checkLoginRate(`${ip}:${email}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deactivatedAt) throw errors.unauthorized();

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw errors.unauthorized();

  if (!user.emailVerifiedAt) throw errors.emailNotVerified();

  const sessionId = await createSession(user.id);
  return { sessionId, user: publicUser(user) };
}

export async function logout(sessionId?: string) {
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      reportsToId: true,
      deactivatedAt: true,
      emailVerifiedAt: true,
    },
  });
  return users;
}

export async function onboardUser(
  actorId: string,
  input: {
    email: string;
    name: string;
    password: string;
    role: AuthUser["role"];
    reportsToId?: string | null;
  },
) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw errors.conflict("Email already registered");
  if (input.reportsToId) {
    const manager = await prisma.user.findUnique({ where: { id: input.reportsToId } });
    if (!manager) throw errors.notFound("Manager");
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      reportsToId: input.reportsToId ?? null,
      emailVerifiedAt: new Date(),
    },
  });
  await writeAudit({
    actorId,
    action: "user.onboarded",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role },
  });
  return publicUser(user);
}
