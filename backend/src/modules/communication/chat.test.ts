import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  listMessages,
  sendMessage,
  openDm,
  listConversations,
  getOrCreateGlobal,
  assertParticipant,
  getDirectKey,
  searchUsersForChat,
  getOrCreateDirectConversation,
  sendDirectMessage,
  deleteConversationForUser,
} from "./chat.service.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { setupSocketServer } from "../../server.js";
import { env } from "../../config/env.js";
import { io as ioClient, type Socket as ClientSocket } from "../../../../frontend/node_modules/socket.io-client/build/esm/index.js";

vi.mock("../../lib/prisma.js", () => {
  return {
    prisma: {
      session: {
        findUnique: vi.fn(),
      },
      conversation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      conversationParticipant: {
        update: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
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

  describe("Socket.IO Room Authorization and DM Privacy (Real Socket Client)", () => {
    let testServer: http.Server;
    let serverPort: number;
    let ioServer: ReturnType<typeof setupSocketServer>;
    const openClients: ClientSocket[] = [];

    const mgrLeadDm = {
      id: "mgr-lead-dm-uuid",
      type: "DM",
      participants: [{ userId: manager.id }, { userId: lead.id }],
    };

    beforeAll(async () => {
      testServer = http.createServer();
      ioServer = setupSocketServer(testServer);
      await new Promise<void>((resolve) => testServer.listen(0, resolve));
      serverPort = (testServer.address() as AddressInfo).port;
    });

    afterAll(async () => {
      for (const client of openClients) {
        if (client.connected) client.close();
      }
      ioServer.close();
      await new Promise<void>((resolve, reject) => {
        testServer.close((err) => (err ? reject(err) : resolve()));
      });
    });

    beforeEach(() => {
      const future = new Date(Date.now() + 86400000);
      vi.mocked(prisma.session.findUnique).mockImplementation((args: any) => {
        const sid = args?.where?.id;
        if (sid === "lead-session") return Promise.resolve({ id: sid, expiresAt: future, user: { ...lead, approvedAt: future } } as never);
        if (sid === "mgr-session") return Promise.resolve({ id: sid, expiresAt: future, user: { ...manager, approvedAt: future } } as never);
        if (sid === "assoc-session") return Promise.resolve({ id: sid, expiresAt: future, user: { ...associateA, approvedAt: future } } as never);
        if (sid === "outsider-session") return Promise.resolve({ id: sid, expiresAt: future, user: { ...outsider, approvedAt: future } } as never);
        return Promise.resolve(null as never);
      });
    });

    function connectClient(sid?: string): Promise<ClientSocket> {
      return new Promise((resolve, reject) => {
        const client = ioClient(`http://127.0.0.1:${serverPort}`, {
          transports: ["websocket"],
          reconnection: false,
          extraHeaders: sid ? { cookie: `${env.COOKIE_NAME}=${sid}` } : {},
        });
        openClients.push(client);
        client.on("connect", () => resolve(client));
        client.on("connect_error", (err) => reject(err));
      });
    }

    it("1. Participant joins own DM -> ack ok: true, receives subsequent broadcast", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mgrLeadDm as never);

      const sarah = await connectClient("lead-session");
      const marcus = await connectClient("mgr-session");

      // Sarah joins her DM with Marcus
      const joinAck = await new Promise<any>((resolve) => {
        sarah.emit("join", mgrLeadDm.id, resolve);
      });
      expect(joinAck).toEqual({ ok: true });

      // Marcus sends a message in that DM
      vi.mocked(prisma.message.create).mockResolvedValue({
        id: "msg-live-1",
        body: "Hey Sarah, syncing on warehouse inventory.",
        conversationId: mgrLeadDm.id,
        sender: manager,
      } as never);
      vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

      const messagePromise = new Promise<any>((resolve) => {
        sarah.on("message", resolve);
      });

      const sendAck = await new Promise<any>((resolve) => {
        marcus.emit("message", { conversationId: mgrLeadDm.id, body: "Hey Sarah, syncing on warehouse inventory." }, resolve);
      });
      expect(sendAck.ok).toBe(true);

      const receivedMsg = await messagePromise;
      expect(receivedMsg.body).toBe("Hey Sarah, syncing on warehouse inventory.");
    });

    it("2. Non-participant (Associate Ravi) joins Manager<->Lead DM -> ack ok: false, receives NO broadcast", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mgrLeadDm as never);

      const ravi = await connectClient("assoc-session");
      const marcus = await connectClient("mgr-session");

      // Ravi tries to join DM where he is not a participant
      const joinAck = await new Promise<any>((resolve) => {
        ravi.emit("join", mgrLeadDm.id, resolve);
      });
      expect(joinAck).toEqual({ ok: false, error: "FORBIDDEN" });

      // Listen for unauthorized broadcast on Ravi's socket
      let raviReceivedBroadcast = false;
      ravi.on("message", () => {
        raviReceivedBroadcast = true;
      });

      // Marcus sends a confidential message in the DM
      vi.mocked(prisma.message.create).mockResolvedValue({
        id: "msg-confidential-1",
        body: "Confidential manager meeting",
        conversationId: mgrLeadDm.id,
        sender: manager,
      } as never);
      vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);

      await new Promise<any>((resolve) => {
        marcus.emit("message", { conversationId: mgrLeadDm.id, body: "Confidential manager meeting" }, resolve);
      });

      // Allow event loop to process any potential broadcast leaks
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(raviReceivedBroadcast).toBe(false);
    });

    it("3. Non-existent conversation ID -> returns identical error to forbidden ({ ok: false, error: 'FORBIDDEN' })", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

      const ravi = await connectClient("assoc-session");
      const joinAck = await new Promise<any>((resolve) => {
        ravi.emit("join", "non-existent-uuid-9999", resolve);
      });

      expect(joinAck).toEqual({ ok: false, error: "FORBIDDEN" });
    });

    it("4. Malformed payloads (undefined, object, empty string, very long string) -> rejected gracefully, server stays up", async () => {
      const ravi = await connectClient("assoc-session");

      // Empty string
      const ackEmpty = await new Promise<any>((resolve) => ravi.emit("join", "", resolve));
      expect(ackEmpty).toEqual({ ok: false, error: "INVALID_CONVERSATION_ID" });

      // Object
      const ackObj = await new Promise<any>((resolve) => ravi.emit("join", { id: "some-id" } as any, resolve));
      expect(ackObj).toEqual({ ok: false, error: "INVALID_CONVERSATION_ID" });

      // Undefined
      const ackUndef = await new Promise<any>((resolve) => ravi.emit("join", undefined as any, resolve));
      expect(ackUndef).toEqual({ ok: false, error: "INVALID_CONVERSATION_ID" });

      // Excessively long string (> 100 chars)
      const ackLong = await new Promise<any>((resolve) => ravi.emit("join", "a".repeat(150), resolve));
      expect(ackLong).toEqual({ ok: false, error: "INVALID_CONVERSATION_ID" });

      // Server is still healthy and accepts valid request
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
        id: "global-conv-id",
        type: "GLOBAL",
        participants: [],
      } as never);

      const ackGlobal = await new Promise<any>((resolve) => ravi.emit("join", "global-conv-id", resolve));
      expect(ackGlobal).toEqual({ ok: true });
    });

    it("5. Unauthenticated socket attempts to connect -> rejected at middleware level with 'unauthorized'", async () => {
      await expect(connectClient(undefined)).rejects.toThrow("unauthorized");
    });

    it("6. User removed from a conversation can no longer join", async () => {
      // Initially, user was a participant; but now conversation has been updated and user is removed
      const updatedDmWithoutRavi = {
        id: "project-dm-1",
        type: "DM",
        participants: [{ userId: lead.id }, { userId: manager.id }],
      };
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(updatedDmWithoutRavi as never);

      const ravi = await connectClient("assoc-session");
      const joinAck = await new Promise<any>((resolve) => {
        ravi.emit("join", "project-dm-1", resolve);
      });
      expect(joinAck).toEqual({ ok: false, error: "FORBIDDEN" });
    });

    it("7. Non-participant cannot send a message to the room by emitting directly to it", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mgrLeadDm as never);

      const ravi = await connectClient("assoc-session");
      const sendAck = await new Promise<any>((resolve) => {
        ravi.emit("message", { conversationId: mgrLeadDm.id, body: "Injected text" }, resolve);
      });

      expect(sendAck.ok).toBe(false);
      expect(sendAck.error).toBe("You do not have access");
    });
  });

  describe("User search for Direct Messages", () => {
    it("returns an empty array when query is empty or whitespace without querying database", async () => {
      const resEmpty = await searchUsersForChat(associateA, "");
      const resWhitespace = await searchUsersForChat(associateA, "   ");
      expect(resEmpty).toEqual([]);
      expect(resWhitespace).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("filters out caller, admin users, unapproved users, and deactivated users", async () => {
      const matchingUsers = [
        { id: associateB.id, name: associateB.name, email: associateB.email, role: associateB.role },
      ];
      vi.mocked(prisma.user.findMany).mockResolvedValue(matchingUsers as never);

      const results = await searchUsersForChat(associateA, "june");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("June Park");

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: associateA.id },
          role: { not: "admin" },
          approvedAt: { not: null },
          deactivatedAt: null,
          OR: [
            { name: { contains: "june", mode: "insensitive" } },
            { email: { contains: "june", mode: "insensitive" } },
          ],
        },
        take: 20,
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    });

    it("strictly blocks admin from searching operational users (403)", async () => {
      await expect(searchUsersForChat(admin, "ravi")).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe("DirectKey deterministic calculation and concurrency safety", () => {
    it("computes deterministic directKey regardless of argument ordering", () => {
      const key1 = getDirectKey("user-abc", "user-xyz");
      const key2 = getDirectKey("user-xyz", "user-abc");
      expect(key1).toBe("user-abc:user-xyz");
      expect(key2).toBe("user-abc:user-xyz");
    });

    it("recovers gracefully from P2002 unique constraint error during concurrent DM creation", async () => {
      const directKey = getDirectKey(associateA.id, associateB.id);
      const existingConv = {
        id: "recovered-dm",
        type: "DM",
        directKey,
        participants: [{ userId: associateA.id }, { userId: associateB.id }],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: associateB.id,
        role: "associate",
        approvedAt: new Date(),
        deactivatedAt: null,
      } as never);
      vi.mocked(prisma.conversation.findUnique)
        .mockResolvedValueOnce(null as never) // first lookup
        .mockResolvedValueOnce(existingConv as never); // recovery lookup after P2002
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null as never);

      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as any).code = "P2002";
      vi.mocked(prisma.conversation.create).mockRejectedValueOnce(p2002Error);

      const conv = await getOrCreateDirectConversation(associateA, associateB.id);
      expect(conv.id).toBe("recovered-dm");
    });

    it("sendDirectMessage atomically gets/creates DM and persists the first message", async () => {
      const dmConv = {
        id: "atomic-dm-id",
        type: "DM",
        directKey: getDirectKey(associateA.id, associateB.id),
        participants: [{ userId: associateA.id }, { userId: associateB.id }],
      };
      const createdMsg = {
        id: "first-msg-id",
        body: "First message to start conversation",
        conversationId: dmConv.id,
        sender: associateA,
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({
          id: associateB.id,
          role: "associate",
          approvedAt: new Date(),
          deactivatedAt: null,
        } as never)
        .mockResolvedValueOnce(dmConv as never); // for assertParticipant in sendMessage
      vi.mocked(prisma.conversation.findUnique)
        .mockResolvedValueOnce(dmConv as never) // find existing DM
        .mockResolvedValueOnce(dmConv as never); // assertParticipant
      vi.mocked(prisma.message.create).mockResolvedValue(createdMsg as never);
      vi.mocked(prisma.conversation.update).mockResolvedValue(dmConv as never);

      const res = await sendDirectMessage(associateA, associateB.id, "First message to start conversation");
      expect(res.conversation.id).toBe("atomic-dm-id");
      expect(res.message.body).toBe("First message to start conversation");
    });
  });

  describe("Empty Direct Messages filtering in listConversations", () => {
    it("excludes empty DMs that have zero messages", async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "global", type: "GLOBAL" } as never);
      vi.mocked(prisma.conversation.findMany).mockResolvedValue([
        {
          id: "empty-dm",
          type: "DM",
          participants: [{ userId: associateA.id, user: associateA }, { userId: associateB.id, user: associateB }],
          messages: [], // 0 messages!
        },
        {
          id: "active-dm",
          type: "DM",
          participants: [{ userId: associateA.id, user: associateA }, { userId: associateB.id, user: associateB }],
          messages: [{ id: "m1", body: "Active", createdAt: new Date() }],
        },
      ] as never);

      const result = await listConversations(associateA);
      expect(result.dms).toHaveLength(1);
      expect(result.dms[0].id).toBe("active-dm");
    });
  });

  describe("Delete Direct Message ('Delete for me') semantics", () => {
    const dmId = "dm-to-delete";
    const dmConv = {
      id: dmId,
      type: "DM",
      participants: [
        { id: "p-assocA", userId: associateA.id, clearedAt: null },
        { id: "p-assocB", userId: associateB.id, clearedAt: null },
      ],
    };

    it("rejects deleting a non-DM conversation (e.g. GLOBAL channel)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
        id: "global-channel",
        type: "GLOBAL",
        participants: [],
      } as never);

      await expect(deleteConversationForUser(associateA, "global-channel")).rejects.toMatchObject({
        status: 400,
        message: "Only direct messages can be deleted",
      });
    });

    it("rejects non-participant from deleting a DM (403)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(dmConv as never);

      await expect(deleteConversationForUser(outsider, dmId)).rejects.toMatchObject({
        status: 403,
      });
    });

    it("successfully sets clearedAt timestamp on caller's participant row", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(dmConv as never);
      vi.mocked(prisma.conversationParticipant.update).mockResolvedValue({} as never);

      const res = await deleteConversationForUser(associateA, dmId);
      expect(res).toEqual({ success: true });
      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: { id: "p-assocA" },
        data: { clearedAt: expect.any(Date) },
      });
    });

    it("hides the DM from listConversations for the user who cleared it, while retaining it for other user", async () => {
      const clearedTime = new Date("2026-10-13T10:00:00Z");
      const messageBeforeClear = {
        id: "m-old",
        body: "Old msg",
        createdAt: new Date("2026-10-13T09:30:00Z"),
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "global", type: "GLOBAL" } as never);

      // Caller associateA has clearedAt: clearedTime
      vi.mocked(prisma.conversation.findMany).mockResolvedValue([
        {
          id: dmId,
          type: "DM",
          participants: [
            { userId: associateA.id, clearedAt: clearedTime, user: associateA },
            { userId: associateB.id, clearedAt: null, user: associateB },
          ],
          messages: [messageBeforeClear],
        },
      ] as never);

      // associateA should NOT see this conversation
      const listA = await listConversations(associateA);
      expect(listA.dms).toHaveLength(0);

      // associateB (who did NOT clear) should STILL see this conversation
      const listB = await listConversations(associateB);
      expect(listB.dms).toHaveLength(1);
      expect(listB.dms[0].id).toBe(dmId);
    });

    it("filters out messages sent prior to clearedAt for the caller in listMessages", async () => {
      const clearedTime = new Date("2026-10-13T10:00:00Z");
      const convWithClearedA = {
        id: dmId,
        type: "DM",
        participants: [
          { userId: associateA.id, clearedAt: clearedTime },
          { userId: associateB.id, clearedAt: null },
        ],
      };

      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(convWithClearedA as never);
      vi.mocked(prisma.message.findMany).mockResolvedValue([]);

      await listMessages(associateA, dmId);
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: dmId,
            createdAt: { gt: clearedTime },
          }),
        }),
      );
    });

    it("reappears in listConversations when a new message arrives after clearedAt", async () => {
      const clearedTime = new Date("2026-10-13T10:00:00Z");
      const messageAfterClear = {
        id: "m-new",
        body: "Hey, are you free now?",
        createdAt: new Date("2026-10-13T10:05:00Z"), // after clearedTime!
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: "global", type: "GLOBAL" } as never);
      vi.mocked(prisma.conversation.findMany).mockResolvedValue([
        {
          id: dmId,
          type: "DM",
          participants: [
            { userId: associateA.id, clearedAt: clearedTime, user: associateA },
            { userId: associateB.id, clearedAt: null, user: associateB },
          ],
          messages: [messageAfterClear],
        },
      ] as never);

      const listA = await listConversations(associateA);
      expect(listA.dms).toHaveLength(1);
      expect(listA.dms[0].id).toBe(dmId);
    });
  });
});
