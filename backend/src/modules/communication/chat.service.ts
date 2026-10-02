import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import type { AuthUser } from "../../types/express.js";

export async function getOrCreateGlobal() {
  const existing = await prisma.conversation.findFirst({ where: { type: "GLOBAL" } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { type: "GLOBAL" } });
}

export async function listMessages(user: AuthUser, conversationId: string, cursor?: string) {
  await assertParticipant(user, conversationId);
  const take = 40;
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  return messages.reverse();
}

async function assertParticipant(user: AuthUser, conversationId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conv) throw errors.notFound("Conversation");
  if (conv.type === "GLOBAL") {
    if (user.role === "admin") throw errors.forbidden();
    return conv;
  }
  if (!conv.participants.some((p) => p.userId === user.id)) throw errors.forbidden();
  return conv;
}

export async function sendMessage(user: AuthUser, conversationId: string, body: string) {
  if (user.role === "admin") throw errors.forbidden();
  await assertParticipant(user, conversationId);
  const msg = await prisma.message.create({
    data: { conversationId, senderId: user.id, body: body.trim() },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  const tags = [...body.matchAll(/@([\w.\- ]{1,40})/g)].map((m) => m[1].trim());
  if (tags.length) {
    const users = await prisma.user.findMany({
      where: { OR: tags.map((t) => ({ name: { equals: t, mode: "insensitive" as const } })) },
    });
    for (const u of users) {
      if (u.id === user.id) continue;
      await prisma.mention.create({ data: { messageId: msg.id, mentionedUserId: u.id } });
      await prisma.notification.create({
        data: { recipientId: u.id, type: "mention", messageId: msg.id, actorId: user.id },
      });
    }
  }
  return msg;
}

export async function listConversations(user: AuthUser) {
  const global = await getOrCreateGlobal();
  const dms = await prisma.conversation.findMany({
    where: { type: "DM", participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return { global, dms };
}

export async function openDm(user: AuthUser, otherUserId: string) {
  if (user.id === otherUserId) throw errors.badRequest("Cannot DM yourself");
  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other || other.role === "admin") throw errors.notFound("User");
  const existing = await prisma.conversation.findFirst({
    where: {
      type: "DM",
      AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: otherUserId } } }],
    },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      type: "DM",
      createdById: user.id,
      participants: {
        create: [{ userId: user.id }, { userId: otherUserId }],
      },
    },
  });
}
