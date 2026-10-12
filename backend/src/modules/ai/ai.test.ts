import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MockAiProvider } from "./mockProvider.js";
import { GeminiAiProvider } from "./geminiProvider.js";
import { GroqAiProvider } from "./groqProvider.js";
import * as aiService from "./ai.service.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
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

function createMockGeminiResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    }),
  };
}

function createMockGroqResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: "chatcmpl-test-123",
      object: "chat.completion",
      created: 1720000000,
      model: "openai/gpt-oss-20b",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
          },
          finish_reason: "stop",
        },
      ],
    }),
  };
}

describe("SimuAI Engine & Providers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService.setAiProviderForTesting(new MockAiProvider());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("MockAiProvider", () => {
    const mock = new MockAiProvider();

    it("generates a structured task summary", async () => {
      const summary = await mock.summarizeTask(sampleTaskContext);
      expect(summary).toContain("POS Terminal Failure");
      expect(summary).toContain("customer");
      expect(summary).toContain("Ravi Mehta");
      expect(summary).toContain("Sarah Okonkwo");
      expect(mock.getMeta().provider).toBe("mock");
      expect(mock.getMeta().fallback).toBe(false);
    });

    it("generates relevant category-specific next actions", async () => {
      const actions = await mock.suggestNextActions(sampleTaskContext);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.length).toBeLessThanOrEqual(4);
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

    it("generates a role-focused operational briefing with GFM tables and metrics", async () => {
      const briefing = await mock.generateBriefing(sampleDashboardContext);
      expect(briefing).toContain("SimuAI Operational Briefing");
      expect(briefing).toContain("Sarah Okonkwo");
      expect(briefing).toContain("LEAD");
      expect(briefing).toContain("2 overdue tasks");
      expect(briefing).toContain("| Metric | Count | Operational Status |");
      expect(briefing).toContain("#### Priority Items");
      expect(briefing).toContain("| Task | Priority | Category | Status | Assignee |");
      expect(briefing).toContain("Stock discrepancy in produce");
      expect(briefing).toContain("#### Recommended Actions");
    });
  });

  describe("GeminiAiProvider Live Operations (Mocked External API)", () => {
    it("successfully generates task summary using Gemini endpoint and headers", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGeminiResponse("Gemini executive summary: Register #2 chip reader has physical hardware failure.")
      );
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-gemini-key", "gemini-3.8-flash");
      const summary = await gemini.summarizeTask(sampleTaskContext);

      expect(summary).toBe("Gemini executive summary: Register #2 chip reader has physical hardware failure.");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
      // Key must be in header, not in URL
      expect(url).not.toContain("key=test-gemini-key");
      expect(options.headers["x-goog-api-key"]).toBe("test-gemini-key");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.systemInstruction.parts[0].text).toContain("SimuAI");
      expect(body.contents[0].parts[0].text).toContain("POS Terminal Failure");

      expect(gemini.getMeta().provider).toBe("gemini");
      expect(gemini.getMeta().model).toBe("gemini-3.8-flash");
      expect(gemini.getMeta().fallback).toBe(false);
    });

    it("successfully generates next actions parsing JSON array", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGeminiResponse('["Swap EMV reader with spare unit", "Run diagnostic self-test", "Update store manager"]')
      );
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-gemini-key", "gemini-3.8-flash");
      const actions = await gemini.suggestNextActions(sampleTaskContext);

      expect(actions).toEqual([
        "Swap EMV reader with spare unit",
        "Run diagnostic self-test",
        "Update store manager",
      ]);
      expect(gemini.getMeta().provider).toBe("gemini");
      expect(gemini.getMeta().fallback).toBe(false);
    });

    it("handles next actions wrapped in markdown code blocks", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGeminiResponse('```json\n["Action 1", "Action 2"]\n```')
      );
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-gemini-key", "gemini-3.8-flash");
      const actions = await gemini.suggestNextActions(sampleTaskContext);

      expect(actions).toEqual(["Action 1", "Action 2"]);
    });

    it("successfully generates catch-up digest", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGeminiResponse("Gemini Catch-Up: Hardware reboot failed. Ticket is assigned to Ravi Mehta.")
      );
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-gemini-key", "gemini-3.8-flash");
      const catchUp = await gemini.catchUpTask(sampleTaskContext);

      expect(catchUp).toBe("Gemini Catch-Up: Hardware reboot failed. Ticket is assigned to Ravi Mehta.");
      expect(gemini.getMeta().provider).toBe("gemini");
    });

    it("successfully generates morning briefing with structured prompt and strict grounding", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGeminiResponse("### Operational Briefing: Queue Summary for Sarah Okonkwo (LEAD)\n\n#### Key Operational Metrics")
      );
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-gemini-key", "gemini-3.8-flash");
      const briefing = await gemini.generateBriefing(sampleDashboardContext);

      expect(briefing).toContain("Operational Briefing");
      expect(gemini.getMeta().provider).toBe("gemini");

      const [url, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      const systemInstruction = body.systemInstruction.parts[0].text;
      expect(systemInstruction).toContain("STRICT FACTUAL GROUNDING RULES");
      expect(systemInstruction).toContain("NEVER invent employee names");
      expect(systemInstruction).toContain("GitHub Flavored Markdown");
    });
  });

  describe("GeminiAiProvider Error Handling & Fallback Behaviour", () => {
    it("handles invalid credentials (HTTP 400/401) with fallback and warning notice", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "API_KEY_INVALID" } }),
      });
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("invalid-key", "gemini-3.8-flash", { fallbackOnFailure: true });
      const summary = await gemini.summarizeTask(sampleTaskContext);

      // Must clearly flag fallback and never pretend Gemini generated it
      expect(summary).toContain("SimuAI Offline Fallback Active");
      expect(summary).toContain("API_KEY_INVALID");
      expect(summary).toContain("POS Terminal Failure"); // mock content appended

      const meta = gemini.getMeta();
      expect(meta.provider).toBe("mock");
      expect(meta.fallback).toBe(true);
      expect(meta.error).toContain("API_KEY_INVALID");
    });

    it("throws descriptive error when fallbackOnFailure is false", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "The caller does not have permission" } }),
      });
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("bad-key", "gemini-3.8-flash", { fallbackOnFailure: false });
      await expect(gemini.summarizeTask(sampleTaskContext)).rejects.toThrow("Gemini API error (403)");
    });

    it("handles provider HTTP 500 error gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "Internal server error" } }),
      });
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-key", "gemini-3.8-flash", { fallbackOnFailure: true });
      const briefing = await gemini.generateBriefing(sampleDashboardContext);

      expect(briefing).toContain("SimuAI Offline Fallback Active");
      expect(gemini.getMeta().fallback).toBe(true);
    });

    it("handles malformed JSON / missing candidates part", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] }), // missing content
      });
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-key", "gemini-3.8-flash", { fallbackOnFailure: true });
      const catchUp = await gemini.catchUpTask(sampleTaskContext);

      expect(catchUp).toContain("SimuAI Offline Fallback Active");
      expect(catchUp).toContain("missing text part");
    });

    it("handles network connection timeout or failure", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));
      global.fetch = mockFetch;

      const gemini = new GeminiAiProvider("test-key", "gemini-3.8-flash", { fallbackOnFailure: true });
      const actions = await gemini.suggestNextActions(sampleTaskContext);

      expect(actions.length).toBeGreaterThan(0);
      expect(gemini.getMeta().fallback).toBe(true);
    });
  });

  describe("GroqAiProvider Live Operations (Mocked External API)", () => {
    it("successfully generates task summary using Groq endpoint, headers, and Bearer auth", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGroqResponse("Groq executive summary: Register #2 chip reader has physical hardware failure.")
      );
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      const summary = await groq.summarizeTask(sampleTaskContext);

      expect(summary).toBe("Groq executive summary: Register #2 chip reader has physical hardware failure.");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
      expect(options.headers["Authorization"]).toBe("Bearer test-groq-key");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("openai/gpt-oss-20b");
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toContain("SimuAI");
      expect(body.messages[1].role).toBe("user");
      expect(body.messages[1].content).toContain("POS Terminal Failure");

      expect(groq.getMeta().provider).toBe("groq");
      expect(groq.getMeta().model).toBe("openai/gpt-oss-20b");
      expect(groq.getMeta().fallback).toBe(false);
    });

    it("successfully generates next actions parsing JSON array", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGroqResponse('["Replace EMV reader", "Run diagnostic test", "Notify store lead"]')
      );
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      const actions = await groq.suggestNextActions(sampleTaskContext);

      expect(actions).toEqual([
        "Replace EMV reader",
        "Run diagnostic test",
        "Notify store lead",
      ]);
      expect(groq.getMeta().provider).toBe("groq");
      expect(groq.getMeta().fallback).toBe(false);
    });

    it("handles next actions wrapped in markdown code blocks", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGroqResponse('```json\n["Action 1", "Action 2"]\n```')
      );
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      const actions = await groq.suggestNextActions(sampleTaskContext);

      expect(actions).toEqual(["Action 1", "Action 2"]);
    });

    it("successfully generates catch-up digest", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGroqResponse("Groq Catch-Up: Hardware reboot failed. Ticket assigned to Ravi Mehta.")
      );
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      const catchUp = await groq.catchUpTask(sampleTaskContext);

      expect(catchUp).toBe("Groq Catch-Up: Hardware reboot failed. Ticket assigned to Ravi Mehta.");
      expect(groq.getMeta().provider).toBe("groq");
    });

    it("successfully generates morning operational briefing with structured prompt and strict grounding", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockGroqResponse("### Operational Briefing: Queue Summary for Sarah Okonkwo (LEAD)\n\n#### Key Operational Metrics\n| Metric | Count | Operational Status |\n| :--- | :--- | :--- |\n| Total Open Tasks | 12 | Elevated |")
      );
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      const briefing = await groq.generateBriefing(sampleDashboardContext);

      expect(briefing).toContain("Operational Briefing");
      expect(groq.getMeta().provider).toBe("groq");

      const [url, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      const systemPrompt = body.messages[0].content;
      expect(systemPrompt).toContain("operations intelligence analyst");
      expect(systemPrompt).toContain("STRICT FACTUAL GROUNDING RULES");
      expect(systemPrompt).toContain("NEVER invent employee names");
      expect(systemPrompt).toContain("GitHub Flavored Markdown");
      expect(systemPrompt).toContain("Key Operational Metrics");
    });
  });

  describe("GroqAiProvider Error Handling & Rate Limiting", () => {
    it("throws descriptive error when GROQ_API_KEY is missing or empty", async () => {
      const groq = new GroqAiProvider("", "openai/gpt-oss-20b");
      await expect(groq.summarizeTask(sampleTaskContext)).rejects.toThrow("GROQ_API_KEY is missing or unconfigured");
    });

    it("handles Groq rate-limit (HTTP 429) by throwing clear rate limit error without falling back to mock", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "Rate limit reached for model openai/gpt-oss-20b in organization org_123: Limit 30 RPM",
            type: "tokens",
            code: "rate_limit_exceeded",
          },
        }),
      });
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      await expect(groq.summarizeTask(sampleTaskContext)).rejects.toThrow(
        /Groq API rate limit reached \(HTTP 429\)/
      );
    });

    it("handles authentication failure (HTTP 401) with descriptive error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: "Invalid API Key provided: gsk_secret_123" },
        }),
      });
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("gsk_secret_123", "openai/gpt-oss-20b");
      try {
        await groq.summarizeTask(sampleTaskContext);
        expect.unreachable();
      } catch (err: any) {
        expect(err.message).toMatch(/Groq API authentication failed \(HTTP 401\)/);
        expect(err.message).not.toContain("gsk_secret_123");
        expect(err.message).toContain("[REDACTED]");
      }
    });

    it("handles upstream HTTP 500 error from Groq", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "Internal server error" } }),
      });
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      await expect(groq.generateBriefing(sampleDashboardContext)).rejects.toThrow(
        /Groq API error \(500\)/
      );
    });

    it("handles malformed JSON / missing choices", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      });
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b");
      await expect(groq.catchUpTask(sampleTaskContext)).rejects.toThrow(
        /missing choices\[0\]\.message\.content/
      );
    });

    it("handles request timeout via AbortController", async () => {
      const abortError = new Error("This operation was aborted");
      abortError.name = "AbortError";
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      global.fetch = mockFetch;

      const groq = new GroqAiProvider("test-groq-key", "openai/gpt-oss-20b", { timeoutMs: 50 });
      await expect(groq.suggestNextActions(sampleTaskContext)).rejects.toThrow(
        /Groq API request timed out/
      );
    });
  });

  describe("AI Provider Factory & Configuration", () => {
    it("instantiates MockAiProvider when AI_PROVIDER is mock or none", () => {
      const prevProvider = env.AI_PROVIDER;
      try {
        (env as any).AI_PROVIDER = "mock";
        aiService.setAiProviderForTesting(null);
        const provider = aiService.getAiProvider();
        expect(provider.getMeta?.().provider).toBe("mock");
      } finally {
        (env as any).AI_PROVIDER = prevProvider;
      }
    });

    it("instantiates GroqAiProvider when AI_PROVIDER is groq and key is provided", () => {
      const prevProvider = env.AI_PROVIDER;
      const prevKey = env.GROQ_API_KEY;
      try {
        (env as any).AI_PROVIDER = "groq";
        (env as any).GROQ_API_KEY = "gsk_test_123";
        aiService.setAiProviderForTesting(null);
        const provider = aiService.getAiProvider();
        expect(provider.getMeta?.().provider).toBe("groq");
      } finally {
        (env as any).AI_PROVIDER = prevProvider;
        (env as any).GROQ_API_KEY = prevKey;
      }
    });

    it("throws badRequest when AI_PROVIDER is groq but GROQ_API_KEY is empty", () => {
      const prevProvider = env.AI_PROVIDER;
      const prevKey = env.GROQ_API_KEY;
      const prevAiKey = env.AI_API_KEY;
      try {
        (env as any).AI_PROVIDER = "groq";
        (env as any).GROQ_API_KEY = "";
        (env as any).AI_API_KEY = "";
        aiService.setAiProviderForTesting(null);
        expect(() => aiService.getAiProvider()).toThrow(/GROQ_API_KEY is missing/);
      } finally {
        (env as any).AI_PROVIDER = prevProvider;
        (env as any).GROQ_API_KEY = prevKey;
        (env as any).AI_API_KEY = prevAiKey;
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

    it("strictly blocks Admin from requesting next actions (403)", async () => {
      await expect(aiService.suggestNextActions(admin, "task-123")).rejects.toMatchObject({
        status: 403,
      });
    });

    it("strictly blocks Admin from requesting catch-up (403)", async () => {
      await expect(aiService.catchUpTask(admin, "task-123")).rejects.toMatchObject({
        status: 403,
      });
    });

    it("strictly blocks user from requesting AI on a task they cannot view (403)", async () => {
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
