import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { errors, AppError } from "../../lib/errors.js";
import { writeAudit } from "../audit/audit.service.js";
import { sendVerificationEmail } from "./email.service.js";
import type { AuthUser } from "../../types/express.js";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  reportsToId: string | null;
  deactivatedAt: Date | null;
  emailVerifiedAt?: Date | null;
  approvedAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    reportsToId: u.reportsToId,
    deactivatedAt: u.deactivatedAt,
    emailVerifiedAt: u.emailVerifiedAt,
    approvedAt: u.approvedAt,
  };
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

export function generateOtp(): string {
  // Always exactly 6 numeric digits using cryptographically secure random generation
  return randomInt(100000, 1000000).toString();
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function safeCompareHashes(hashA: string, hashB: string): boolean {
  if (hashA.length !== hashB.length) return false;
  return timingSafeEqual(Buffer.from(hashA, "utf8"), Buffer.from(hashB, "utf8"));
}

export async function register(input: {
  email: string;
  name: string;
  password: string;
  role: "lead" | "manager" | "associate";
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Only verified accounts cannot be re-registered
    if (existing.emailVerifiedAt != null) {
      throw errors.conflict("Email already in use. Please sign in instead.");
    }

    // If an account exists but is UNVERIFIED, the user did not complete signup.
    // Allow them to retry signup with the same email: update credentials, generate fresh OTP, and dispatch email.
    const passwordHash = await hashPassword(input.password);
    const otp = generateOtp();
    const codeHash = hashOtp(otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        passwordHash,
        role: input.role,
        emailVerificationCodeHash: codeHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationAttempts: 0,
        emailVerificationSentAt: now,
      },
    });

    try {
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        code: otp,
      });
    } catch (err) {
      // If email delivery fails, remove the unverified user record so no failed email lingers in the system
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw err;
    }

    return {
      email: user.email,
      verificationRequired: true,
    };
  }

  const role = input.role;
  const passwordHash = await hashPassword(input.password);
  const otp = generateOtp();
  const codeHash = hashOtp(otp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  // Self-registered accounts MUST be created as UNVERIFIED (emailVerifiedAt = null) and PENDING APPROVAL (approvedAt = null)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name.trim(),
      passwordHash,
      role,
      emailVerifiedAt: null,
      approvedAt: null,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: now,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    metadata: { role, verificationRequired: true },
  });

  try {
    // Dispatch transactional email with 6-digit OTP
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      code: otp,
    });
  } catch (err) {
    // If sending fails during registration, clean up the incomplete user record immediately!
    // Never leave a failed signup saved in the system.
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw err;
  }

  // Registration MUST NOT return session or OTP secret
  return {
    email: user.email,
    verificationRequired: true,
  };
}

export async function verifyEmail(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.deactivatedAt) {
    throw errors.notFound("Account");
  }

  // If already verified, reject session creation
  if (user.emailVerifiedAt) {
    throw new AppError(400, "already_verified", "Email is already verified. Please sign in.");
  }

  // Validate OTP existence and expiration
  const now = new Date();
  if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < now) {
    throw new AppError(400, "expired_code", "Verification code has expired. Please request a new one.");
  }

  // Validate attempts
  if (user.emailVerificationAttempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError(429, "rate_limited", "Too many incorrect verification attempts. Please request a new code.");
  }

  const incomingHash = hashOtp(code.trim());
  const isValid = safeCompareHashes(incomingHash, user.emailVerificationCodeHash);

  if (!isValid) {
    const nextAttempts = user.emailVerificationAttempts + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      // Invalidate OTP after fifth incorrect attempt
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationCodeHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationAttempts: nextAttempts,
        },
      });
      throw new AppError(429, "rate_limited", "Too many incorrect verification attempts. Please request a new code.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationAttempts: nextAttempts,
      },
    });

    throw new AppError(400, "invalid_code", "Invalid verification code");
  }

  // Success: mark verified and wipe OTP metadata
  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: now,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "user.email_verified",
    entityType: "user",
    entityId: user.id,
    metadata: { email: user.email },
  });

  const isApproved = verifiedUser.approvedAt != null;

  if (!isApproved) {
    return {
      approved: false,
      message: "Your email has been verified. Your account is waiting for administrator approval and will be available to log in in some time once approved.",
      user: publicUser(verifiedUser),
    };
  }

  // Create authenticated session only if approved
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_MS),
    },
  });

  return {
    approved: true,
    sessionId: session.id,
    user: publicUser(verifiedUser),
  };
}

export async function resendVerification(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Prevent account enumeration: return generic success if user doesn't exist or already verified
  if (!user || user.deactivatedAt || user.emailVerifiedAt) {
    return {
      ok: true,
      message: "If an unverified account exists for this email, a new verification code has been sent.",
    };
  }

  // Enforce 60-second cooldown
  const now = new Date();
  const previousSentAt = user.emailVerificationSentAt;
  if (previousSentAt) {
    const elapsed = now.getTime() - previousSentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new AppError(429, "rate_limited", `Please wait ${waitSeconds} seconds before requesting a new code.`);
    }
  }

  // Generate fresh OTP, replace old OTP, reset attempts, update sent timestamp
  const otp = generateOtp();
  const codeHash = hashOtp(otp);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: now,
    },
  });

  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      code: otp,
    });
  } catch (err) {
    // Failure recovery: revert sent timestamp so the user is not locked into an incorrect cooldown
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationSentAt: previousSentAt },
    }).catch(() => undefined);
    throw err;
  }

  return {
    ok: true,
    message: "A new verification code has been sent to your email.",
  };
}

export async function login(email: string, password: string, ip: string) {
  checkLoginRate(`${ip}:${email}`);
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.deactivatedAt) throw errors.unauthorized();

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw errors.unauthorized();

  // Enforce mandatory email verification before issuing session
  if (user.emailVerifiedAt == null) {
    throw new AppError(403, "email_not_verified", "Please verify your email before signing in");
  }

  // Enforce mandatory admin approval before issuing session
  if (user.approvedAt == null) {
    throw new AppError(
      403,
      "account_pending_approval",
      "Your account is waiting for administrator approval and will be available to log in in some time once approved."
    );
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_MS),
    },
  });

  return { sessionId: session.id, user: publicUser(user) };
}

export async function logout(sessionId?: string) {
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}

export async function listUsers(query?: string) {
  const filter = query?.trim();
  const where = filter
    ? {
        OR: [
          { name: { contains: filter, mode: "insensitive" as const } },
          { email: { contains: filter, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      reportsToId: true,
      deactivatedAt: true,
      emailVerifiedAt: true,
      approvedAt: true,
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
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw errors.conflict("Email already registered");

  if (input.reportsToId) {
    const manager = await prisma.user.findUnique({ where: { id: input.reportsToId } });
    if (!manager) throw errors.notFound("Manager");
  }

  // Admin-onboarded users are immediately verified and approved
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      reportsToId: input.reportsToId ?? null,
      emailVerifiedAt: new Date(),
      approvedAt: new Date(),
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
