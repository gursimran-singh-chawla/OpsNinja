import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listMessages,
  sendMessage,
  openDm,
  listConversations,
  getOrCreateGlobal,
} from "./chat.service.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";

vi.mock("../../lib/prisma.js", () => {
  return {
    prisma: {
      conversation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      message: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      mention: {
        create: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    },
  };
});

const lead: AuthUser = {
  id: "lead-1",
  email: "sarah@harborlane.example",
  name: "Sarah Okonkwo",
  role: "lead",
  reportsToId: null,
  deactivatedAt: null,
};

const admin: AuthUser = {
  id: "admin-1",
  email: "priya@harborlane.example",
  name: "Priya Nair",
  role: "admin",
  reportsToId: null,
  deactivatedAt: null,
};

const manager: AuthUser = {
  id: "mgr-1",
  email: "marcus@harborlane.example",
  name: "Marcus Hale",
  role: "manager",
  reportsToId: "lead-1",
  deactivatedAt: null,
};

const associateA: AuthUser = {
  id: "assoc-1",
  email: "ravi@harborlane.example",
  name: "Ravi Mehta",
  role: "associate",
  reportsToId: "mgr-1",
  deactivatedAt: null,
};

const associateB: AuthUser = {
  id: "assoc-2",
  email: "june@harborlane.example",
  name: "June Park",
  role: "associate",
  reportsToId: "mgr-1",
  deactivatedAt: null,
};

const outsider: AuthUser = {
  id: "outsider-1",
  email: "amira@harborlane.example",
  name: "Amira Hassan",
  role: "associate",
  reportsToId: null,
  deactivatedAt: null,
};

describe("chat boundaries and privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Global conversation boundaries", () => {
    const globalConv = {
      id: "global-conv-id",
      type: "GLOBAL",
      participants: [],
    };

    it("allows operational users (lead, manager, associate) to view global messages", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(globalConv as never);
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { id: "m1", body: "Hello world", conversationId: globalConv.id, sender: associateA } as never,
      ]);

      const messages = await listMessages(associateA, globalConv.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe("Hello world");
    });

    it("strictly blocks admin from reading global messages (403)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(globalConv as never);

      await expect(listMessages(admin, globalConv.id)).rejects.toMatchObject({
        status: 403,
        code: "forbidden",
      });
    });

    it("strictly blocks admin from sending global messages (403)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(globalConv as never);

      await expect(sendMessage(admin, globalConv.id, "Hello from admin")).rejects.toMatchObject({
        status: 403,
        code: "forbidden",
      });
    });

    it("allows operational user to send a global message", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(globalConv as never);
      vi.mocked(prisma.message.create).mockResolvedValue({
        id: "msg-123",
        body: "All hands meeting",
        conversationId: globalConv.id,
        sender: lead,
      } as never);
      vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

      const msg = await sendMessage(lead, globalConv.id, "All hands meeting");
      expect(msg.body).toBe("All hands meeting");
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: globalConv.id,
            senderId: lead.id,
            body: "All hands meeting",
          }),
        }),
      );
    });
  });

  describe("Direct Message (DM) privacy boundaries", () => {
    const dmConv = {
      id: "dm-conv-id",
      type: "DM",
      participants: [{ userId: associateA.id }, { userId: associateB.id }],
    };

    it("allows participants of the DM to view messages", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(dmConv as never);
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { id: "dm-m1", body: "Private DM text", conversationId: dmConv.id, sender: associateA } as never,
      ]);

      const messagesA = await listMessages(associateA, dmConv.id);
      expect(messagesA).toHaveLength(1);

      const messagesB = await listMessages(associateB, dmConv.id);
      expect(messagesB).toHaveLength(1);
    });

    it("blocks non-participant (outsider) from reading DM messages (403)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(dmConv as never);

      await expect(listMessages(outsider, dmConv.id)).rejects.toMatchObject({
        status: 403,
        code: "forbidden",
      });
    });

    it("blocks non-participant (outsider) from sending a message into the DM (403)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(dmConv as never);

      await expect(sendMessage(outsider, dmConv.id, "Sneaking in")).rejects.toMatchObject({
        status: 403,
        code: "forbidden",
      });
    });

    it("blocks even Lead and Manager from reading DMs they are not participants in", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(dmConv as never);

      await expect(listMessages(lead, dmConv.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(listMessages(manager, dmConv.id)).rejects.toMatchObject({
        status: 403,
      });
    });

    it("returns 404 if conversation does not exist", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

      await expect(listMessages(associateA, "nonexistent-id")).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("Opening Direct Messages (openDm)", () => {
    it("rejects opening a DM with oneself (400)", async () => {
      await expect(openDm(associateA, associateA.id)).rejects.toMatchObject({
        status: 400,
        message: "Cannot DM yourself",
      });
    });

    it("rejects opening a DM with Admin (404 - admin is not an ops chat target)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: admin.id,
        role: "admin",
      } as never);

      await expect(openDm(associateA, admin.id)).rejects.toMatchObject({
        status: 404,
      });
    });

    it("returns existing DM if already created between the two users", async () => {
      const existing = { id: "existing-dm", type: "DM" };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: associateB.id,
        role: "associate",
      } as never);
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue(existing as never);

      const conv = await openDm(associateA, associateB.id);
      expect(conv.id).toBe("existing-dm");
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it("creates a new DM conversation with both participants when none exists", async () => {
      const newDm = { id: "new-dm", type: "DM" };
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: associateB.id,
        role: "associate",
      } as never);
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.conversation.create).mockResolvedValue(newDm as never);

      const conv = await openDm(associateA, associateB.id);
      expect(conv.id).toBe("new-dm");
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "DM",
            createdById: associateA.id,
            participants: {
              create: [{ userId: associateA.id }, { userId: associateB.id }],
            },
          }),
        }),
      );
    });
  });

  describe("Mentions and notifications", () => {
    const globalConv = {
      id: "global-conv-id",
      type: "GLOBAL",
      participants: [],
    };

    it("creates mentions and notifications for mentioned users, but ignores self-mentions", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(globalConv as never);
      vi.mocked(prisma.message.create).mockResolvedValue({
        id: "msg-mention",
        body: "Hey @Ravi Mehta and @June Park, take a look",
        conversationId: globalConv.id,
        sender: associateA,
      } as never);
      vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: associateA.id, name: "Ravi Mehta" } as never,
        { id: associateB.id, name: "June Park" } as never,
      ]);

      await sendMessage(associateA, globalConv.id, "Hey @Ravi Mehta and @June Park, take a look");

      // associateA mentioned self (Ravi Mehta) and associateB (June Park).
      // Should NOT notify self, but SHOULD notify associateB.
      expect(prisma.mention.create).toHaveBeenCalledTimes(1);
      expect(prisma.mention.create).toHaveBeenCalledWith({
        data: { messageId: "msg-mention", mentionedUserId: associateB.id },
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          recipientId: associateB.id,
          type: "mention",
          messageId: "msg-mention",
          actorId: associateA.id,
        },
      });
    });
  });
});
