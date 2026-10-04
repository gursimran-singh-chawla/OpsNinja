import { hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuthUser } from "../../types/express.js";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  reportsToId: string | null;
  deactivatedAt: Date | null;
  createdAt?: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    reportsToId: u.reportsToId,
    deactivatedAt: u.deactivatedAt,
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

export async function register(input: {
  email: string;
  name: string;
  password: string;
  role: "lead" | "manager" | "associate";
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw errors.conflict("Email already registered");
  const role = input.role;
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name.trim(),
      passwordHash,
      role,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    metadata: { role },
  });
  return publicUser(user);
}

export async function login(email: string, password: string, ip: string) {
  checkLoginRate(`${ip}:${email}`);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.deactivatedAt) throw errors.unauthorized();
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw errors.unauthorized();
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
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw errors.conflict("Email already registered");
  if (input.reportsToId) {
    const manager = await prisma.user.findUnique({ where: { id: input.reportsToId } });
    if (!manager) throw errors.notFound("Manager");
  }
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      reportsToId: input.reportsToId ?? null,
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
