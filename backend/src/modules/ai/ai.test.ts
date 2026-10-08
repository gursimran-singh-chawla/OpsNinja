import { describe, expect, it, vi, beforeEach } from "vitest";
import { MockAiProvider } from "./mockProvider.js";
import { GeminiAiProvider } from "./geminiProvider.js";
import * as aiService from "./ai.service.js";
import { prisma } from "../../lib/prisma.js";
import type { TaskAiContext, DashboardAiContext } from "./types.js";
import type { AuthUser } from "../../types/express.js";

vi.mock("../../lib/prisma.js", () => {
  return {
    prisma: {
      task: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
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

const associateA: AuthUser = {
  id: "assoc-1",
  email: "ravi@harborlane.example",
  name: "Ravi Mehta",
  role: "associate",
  reportsToId: "mgr-1",
  deactivatedAt: null,
};

const outsider: AuthUser = {
  id: "outsider-1",
  email: "stranger@harborlane.example",
  name: "Stranger",
  role: "associate",
  reportsToId: "other-mgr",
  deactivatedAt: null,
};

const sampleTaskContext: TaskAiContext = {
  id: "task-123",
  title: "POS Terminal Failure in Store #4",
  description: "Checkout register #2 is unable to process chip card payments.",
  category: "customer",
  workKind: "task",
  priority: "high",
  dueAt: new Date(Date.now() - 3600000).toISOString(),
  overdue: true,
  visibilityType: "GLOBAL",
  assigneeName: "Ravi Mehta",
  creatorName: "Sarah Okonkwo",
  comments: [
    {
      authorName: "Sarah Okonkwo",
      authorRole: "lead",
      body: "Hardware reboot attempted; still failing.",
      createdAt: new Date().toISOString(),
    },
  ],
};

const sampleDashboardContext: DashboardAiContext = {
  userName: "Sarah Okonkwo",
  userRole: "lead",
  openCount: 12,
  activeCount: 8,
  overdueCount: 2,
  urgentCount: 1,
  unassignedCount: 3,
  highlightTasks: [
    {
      title: "Stock discrepancy in produce",
      priority: "urgent",
      category: "inventory",
      overdue: true,
      assigneeName: "Marcus Hale",
    },
  ],
};

describe("SimuAI Engine & Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiService.setAiProviderForTesting(new MockAiProvider());
  });

  describe("MockAiProvider", () => {
    const mock = new MockAiProvider();

    it("generates a structured task summary", async () => {
      const summary = await mock.summarizeTask(sampleTaskContext);
      expect(summary).toContain("POS Terminal Failure");
      expect(summary).toContain("customer");
      expect(summary).toContain("Ravi Mehta");
      expect(summary).toContain("Sarah Okonkwo");
    });

    it("generates relevant category-specific next actions", async () => {
      const actions = await mock.suggestNextActions(sampleTaskContext);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.length).toBeLessThanOrEqual(4);
      // Because category is 'customer'
      expect(actions.some((a) => a.toLowerCase().includes("customer") || a.toLowerCase().includes("deadline"))).toBe(true);
    });

    it("generates next actions for unassigned inventory task", async () => {
      const actions = await mock.suggestNextActions({
        ...sampleTaskContext,
        category: "inventory",
        assigneeName: null,
      });
      expect(actions.some((a) => a.includes("Assign an operational owner"))).toBe(true);
      expect(actions.some((a) => a.includes("POS system") || a.includes("warehouse"))).toBe(true);
    });

    it("generates a catch-up digest from recent comments", async () => {
      const catchUp = await mock.catchUpTask(sampleTaskContext);
      expect(catchUp).toContain("Sarah Okonkwo");
      expect(catchUp).toContain("Hardware reboot attempted");
    });

    it("generates a role-focused morning briefing", async () => {
      const briefing = await mock.generateBriefing(sampleDashboardContext);
      expect(briefing).toContain("SimuAI Operational Briefing");
      expect(briefing).toContain("Sarah Okonkwo");
      expect(briefing).toContain("LEAD");
      expect(briefing).toContain("2 overdue tasks");
    });
  });

  describe("GeminiAiProvider Graceful Degradation", () => {
    it("falls back to MockAiProvider when external API call fails", async () => {
      // Create a Gemini provider with bad key and mock global fetch to fail
      const gemini = new GeminiAiProvider("bad-key");
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network connection failed"));

      try {
        const summary = await gemini.summarizeTask(sampleTaskContext);
        expect(summary).toContain("POS Terminal Failure");

        const actions = await gemini.suggestNextActions(sampleTaskContext);
        expect(actions.length).toBeGreaterThan(0);

        const catchUp = await gemini.catchUpTask(sampleTaskContext);
        expect(catchUp).toContain("Sarah Okonkwo");

        const briefing = await gemini.generateBriefing(sampleDashboardContext);
        expect(briefing).toContain("SimuAI Operational Briefing");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Authorization & Visibility Boundaries", () => {
    it("strictly blocks Admin from requesting task summaries (403)", async () => {
      await expect(aiService.summarizeTask(admin, "task-123")).rejects.toMatchObject({
        status: 403,
      });
    });

    it("strictly blocks Admin from requesting briefings (403)", async () => {
      await expect(aiService.generateBriefing(admin)).rejects.toMatchObject({
        status: 403,
      });
    });

    it("strictly blocks user from requesting AI on a task they cannot view (403)", async () => {
      // Direct visibility task for associateA only
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "task-direct",
        title: "Direct Task",
        description: "Confidential",
        category: "normal",
        workKind: "task",
        priority: "normal",
        dueAt: null,
        createdById: associateA.id,
        visibilityType: "DIRECT",
        visibilityManagerId: null,
        assigneeId: associateA.id,
        assignedById: null,
        sourceMessageId: null,
        redFlag: false,
        boardColumn: "TODO",
        boardRank: "000000001024",
        finishedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        access: [{ userId: associateA.id, accessType: "VIEW", grantedById: associateA.id }],
        createdBy: { name: associateA.name },
        assignee: { name: associateA.name },
        comments: [],
      } as never);

      // outsider tries to summarize task-direct
      await expect(aiService.summarizeTask(outsider, "task-direct")).rejects.toMatchObject({
        status: 403,
      });
    });

    it("allows authorized operational viewer to summarize task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: "task-global",
        title: "Global Task",
        description: "Public to team",
        category: "normal",
        workKind: "task",
        priority: "normal",
        dueAt: null,
        createdById: lead.id,
        visibilityType: "GLOBAL",
        visibilityManagerId: null,
        assigneeId: null,
        assignedById: null,
        sourceMessageId: null,
        redFlag: false,
        boardColumn: "TODO",
        boardRank: "000000001024",
        finishedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        access: [],
        createdBy: { name: lead.name },
        assignee: null,
        comments: [],
      } as never);

      const result = await aiService.summarizeTask(associateA, "task-global");
      expect(result).toContain("Global Task");
    });
  });
});
