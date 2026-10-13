import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import type { AuthUser } from "../../types/express.js";

/**
 * Computes a deterministic pairing key for two users in lexicographical order:
 * "min(userA, userB):max(userA, userB)"
 *
 * Guarantees that conversations between any two users resolve to the exact same unique record.
 */
export function getDirectKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(":");
}

export async function getOrCreateGlobal() {
  const existing = await prisma.conversation.findFirst({ where: { type: "GLOBAL" } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { type: "GLOBAL" } });
}

export async function listMessages(user: AuthUser, conversationId: string, cursor?: string) {
  const conv = await assertParticipant(user, conversationId);
  const myParticipant = conv.type === "DM" ? conv.participants?.find((p) => p.userId === user.id) : null;
  const take = 40;
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      ...(myParticipant?.clearedAt ? { createdAt: { gt: myParticipant.clearedAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  return messages.reverse();
}

/**
 * Asserts that the authenticated user is an authorized participant of the conversation.
 * - GLOBAL: All operational roles (lead, manager, associate) have access.
 *   Admin role is strictly forbidden (AGENTS.md locked rule: Admin sees no task or ops chat content).
 * - DM / direct: Only explicitly listed participants in ConversationParticipant are allowed.
 * - Throws notFound (404) if the conversation does not exist, or forbidden (403) if user is not authorized.
 */
export async function assertParticipant(user: AuthUser, conversationId: string) {
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
  if (user.role === "admin") throw errors.forbidden();
  const global = await getOrCreateGlobal();
  const dms = await prisma.conversation.findMany({
    where: { type: "DM", participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeDms = dms.filter((d) => {
    // Only display established conversations with at least 1 message
    if (d.messages.length === 0) return false;
    const myParticipant = d.participants.find((p) => p.userId === user.id);
    if (myParticipant?.clearedAt) {
      const latestMessage = d.messages[0];
      // If there are no messages sent after clearedAt, hide conversation for caller
      if (!latestMessage || latestMessage.createdAt <= myParticipant.clearedAt) {
        return false;
      }
    }
    return true;
  });

  return { global, dms: activeDms };
}

export async function searchUsersForChat(user: AuthUser, query: string) {
  if (user.role === "admin") throw errors.forbidden();
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.user.findMany({
    where: {
      id: { not: user.id },
      role: { not: "admin" },
      approvedAt: { not: null },
      deactivatedAt: null,
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    take: 20,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getOrCreateDirectConversation(user: AuthUser, otherUserId: string) {
  if (user.role === "admin") throw errors.forbidden();
  if (user.id === otherUserId) throw errors.badRequest("Cannot DM yourself");
  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other || other.role === "admin" || other.deactivatedAt || other.approvedAt === null) {
    throw errors.notFound("User");
  }

  const directKey = getDirectKey(user.id, otherUserId);
  let existing =
    (await prisma.conversation.findUnique({
      where: { directKey },
      include: {
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    })) ||
    (await prisma.conversation.findFirst({
      where: {
        type: "DM",
        AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: otherUserId } } }],
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    }));

  if (existing) {
    if (!existing.directKey) {
      try {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: { directKey },
        });
      } catch {
        // safe ignore
      }
    }
    return existing;
  }

  try {
    return await prisma.conversation.create({
      data: {
        type: "DM",
        directKey,
        createdById: user.id,
        participants: {
          create: [{ userId: user.id }, { userId: otherUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      const recovered = await prisma.conversation.findUnique({
        where: { directKey },
        include: {
          participants: { include: { user: { select: { id: true, name: true, role: true } } } },
        },
      });
      if (recovered) return recovered;
    }
    throw err;
  }
}

export async function openDm(user: AuthUser, otherUserId: string) {
  return getOrCreateDirectConversation(user, otherUserId);
}

export async function sendDirectMessage(user: AuthUser, otherUserId: string, body: string) {
  const conv = await getOrCreateDirectConversation(user, otherUserId);
  const msg = await sendMessage(user, conv.id, body);
  return { conversation: conv, message: msg };
}

/**
 * Deletes a DM conversation for the calling user only ("delete for me").
 *
 * Updates the user's ConversationParticipant.clearedAt timestamp to now.
 * Past messages are hidden from the user's view, while preserving complete
 * message history for the counterparty. A new message will revive the conversation.
 */
export async function deleteConversationForUser(user: AuthUser, conversationId: string) {
  if (user.role === "admin") throw errors.forbidden();
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conv) throw errors.notFound("Conversation");
  if (conv.type !== "DM") throw errors.badRequest("Only direct messages can be deleted");
  const myParticipant = conv.participants.find((p) => p.userId === user.id);
  if (!myParticipant) throw errors.forbidden();

  await prisma.conversationParticipant.update({
    where: { id: myParticipant.id },
    data: { clearedAt: new Date() },
  });
  return { success: true };
}
