import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { env } from "./config/env.js";

vi.mock("./lib/prisma.js", () => {
  return {
    prisma: {
      session: {
        findUnique: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      user: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      taskAccess: {
        findMany: vi.fn(),
      },
      conversation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      message: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      notification: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      featureFlag: {
        findMany: vi.fn(),
      },
      auditEvent: {
        count: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

let server: Server;
let baseUrl: string;

const future = new Date(Date.now() + 86400000);

const adminUser = {
  id: "a0000000-0000-0000-0000-000000000001",
  email: "admin@harborlane.example",
  name: "Priya Admin",
  role: "admin",
  reportsToId: null,
  deactivatedAt: null,
};

const leadUser = {
  id: "b0000000-0000-0000-0000-000000000002",
  email: "lead@harborlane.example",
  name: "Sarah Lead",
  role: "lead",
  reportsToId: null,
  deactivatedAt: null,
};

const managerUser = {
  id: "c0000000-0000-0000-0000-000000000003",
  email: "marcus@harborlane.example",
  name: "Marcus Manager",
  role: "manager",
  reportsToId: "b0000000-0000-0000-0000-000000000002",
  deactivatedAt: null,
};

const associateUser = {
  id: "d0000000-0000-0000-0000-000000000004",
  email: "ravi@harborlane.example",
  name: "Ravi Associate",
  role: "associate",
  reportsToId: "c0000000-0000-0000-0000-000000000003",
  deactivatedAt: null,
};

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(prisma.session.findUnique).mockImplementation((args: any) => {
    const sid = args?.where?.id;
    if (sid === "admin-session") return Promise.resolve({ id: sid, expiresAt: future, user: adminUser } as never);
    if (sid === "lead-session") return Promise.resolve({ id: sid, expiresAt: future, user: leadUser } as never);
    if (sid === "mgr-session") return Promise.resolve({ id: sid, expiresAt: future, user: managerUser } as never);
    if (sid === "assoc-session") return Promise.resolve({ id: sid, expiresAt: future, user: associateUser } as never);
    return Promise.resolve(null as never);
  });
});

function cookieHeader(sid: string) {
  return { Cookie: `${env.COOKIE_NAME}=${sid}` };
}

describe("Route Authorization & Security Boundaries", () => {
  describe("Unauthenticated requests (401 Unauthorized)", () => {
    it("rejects task listing when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("unauthorized");
    });

    it("rejects task dashboard when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/dashboard`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("unauthorized");
    });

    it("rejects platform metrics when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/platform/metrics`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("unauthorized");
    });

    it("rejects chat conversations when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("unauthorized");
    });

    it("rejects notifications when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/notifications`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("unauthorized");
    });
  });

  describe("Admin boundaries: platform power vs NO task content", () => {
    it("strictly returns 403 Forbidden when Admin calls GET /api/tasks", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
    });

    it("strictly returns 403 Forbidden when Admin calls GET /api/tasks/dashboard", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/dashboard`, {
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
    });

    it("strictly returns 403 Forbidden when Admin calls GET /api/tasks/:id", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/123e4567-e89b-12d3-a456-426614174000`, {
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
    });

    it("strictly returns 403 Forbidden when Admin calls POST /api/tasks", async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: {
          ...cookieHeader("admin-session"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Admin Task",
          description: "Admin attempting to create",
          category: "normal",
          workKind: "task",
          priority: "normal",
          visibilityType: "GLOBAL",
        }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
    });

    it("strictly returns 403 Forbidden when Admin calls SimuAI briefing", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/ai/briefing`, {
        method: "POST",
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
    });

    it("strictly returns 403 Forbidden when Admin calls SimuAI task summary", async () => {
      const res = await fetch(`${baseUrl}/api/tasks/123e4567-e89b-12d3-a456-426614174000/ai/summary`, {
        method: "POST",
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");
    });

    it("permits Admin to access GET /api/platform/metrics (200 OK)", async () => {
      vi.mocked(prisma.user.count).mockResolvedValue(51);
      vi.mocked(prisma.user.groupBy).mockResolvedValue([
        { role: "admin", _count: 1 } as never,
        { role: "lead", _count: 5 } as never,
      ]);
      vi.mocked(prisma.session.count).mockResolvedValue(10);
      vi.mocked(prisma.featureFlag.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditEvent.count).mockResolvedValue(42);

      const res = await fetch(`${baseUrl}/api/platform/metrics`, {
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.users).toBe(51);
      expect(body.data.activeSessions).toBe(10);
      expect(body.data.auditEvents).toBe(42);
    });

    it("permits Admin to access POST /api/users (user onboarding passes authz)", async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          ...cookieHeader("admin-session"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // empty body to trigger validation error, not 403
      });
      // Should fail zod validation (400), proving role authorization succeeded
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("validation");
    });
  });

  describe("Non-Admin boundaries on Platform endpoints (403 Forbidden)", () => {
    it("blocks Associate from accessing GET /api/platform/metrics", async () => {
      const res = await fetch(`${baseUrl}/api/platform/metrics`, {
        headers: cookieHeader("assoc-session"),
      });
      expect(res.status).toBe(403);
    });

    it("blocks Manager from accessing GET /api/platform/metrics", async () => {
      const res = await fetch(`${baseUrl}/api/platform/metrics`, {
        headers: cookieHeader("mgr-session"),
      });
      expect(res.status).toBe(403);
    });

    it("blocks Lead from accessing GET /api/platform/metrics", async () => {
      const res = await fetch(`${baseUrl}/api/platform/metrics`, {
        headers: cookieHeader("lead-session"),
      });
      expect(res.status).toBe(403);
    });

    it("blocks Associate from calling POST /api/users (onboarding)", async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          ...cookieHeader("assoc-session"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "new@x.com", name: "New", role: "associate" }),
      });
      expect(res.status).toBe(403);
    });

    it("blocks Manager from calling POST /api/users (onboarding)", async () => {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: "POST",
        headers: {
          ...cookieHeader("mgr-session"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "new@x.com", name: "New", role: "associate" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Operational Role access to Tasks", () => {
    it("allows Lead to access GET /api/tasks (200 OK)", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      const res = await fetch(`${baseUrl}/api/tasks`, {
        headers: cookieHeader("lead-session"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("allows Manager to access GET /api/tasks (200 OK)", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      const res = await fetch(`${baseUrl}/api/tasks`, {
        headers: cookieHeader("mgr-session"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("allows Associate to access GET /api/tasks (200 OK)", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      const res = await fetch(`${baseUrl}/api/tasks`, {
        headers: cookieHeader("assoc-session"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("allows Associate to access GET /api/tasks/dashboard (200 OK)", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      const res = await fetch(`${baseUrl}/api/tasks/dashboard`, {
        headers: cookieHeader("assoc-session"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.role).toBe("associate");
    });
  });

  describe("Chat Route Boundaries", () => {
    it("rejects DM creation with oneself on POST /api/chat/dm (400 Bad Request)", async () => {
      const res = await fetch(`${baseUrl}/api/chat/dm`, {
        method: "POST",
        headers: {
          ...cookieHeader("assoc-session"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: associateUser.id }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("Cannot DM yourself");
    });

    it("rejects DM creation with Admin on POST /api/chat/dm (404 Not Found)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: adminUser.id,
        role: "admin",
      } as never);

      const res = await fetch(`${baseUrl}/api/chat/dm`, {
        method: "POST",
        headers: {
          ...cookieHeader("assoc-session"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: adminUser.id }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects Admin attempting to fetch chat messages (403)", async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
        id: "global-conv",
        type: "GLOBAL",
        participants: [],
      } as never);

      const res = await fetch(`${baseUrl}/api/chat/conversations/global-conv/messages`, {
        headers: cookieHeader("admin-session"),
      });
      expect(res.status).toBe(403);
    });
  });
});
