import type { AiMeta, AiProvider, DashboardAiContext, TaskAiContext } from "./types.js";
import { MockAiProvider } from "./mockProvider.js";
import { log } from "../../lib/logger.js";

export interface GeminiProviderOptions {
  timeoutMs?: number;
  fallbackOnFailure?: boolean;
}

export class GeminiAiProvider implements AiProvider {
  name = "SimuAI (Gemini Powered)";
  public readonly apiKey: string;
  public readonly model: string;
  public readonly timeoutMs: number;
  public readonly fallbackOnFailure: boolean;

  private fallback = new MockAiProvider();
  private lastMeta: AiMeta;

  constructor(
    apiKey: string,
    model = "gemini-3.8-flash",
    options: GeminiProviderOptions = {},
  ) {
    this.apiKey = apiKey.trim();
    this.model = model.trim() || "gemini-3.8-flash";
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fallbackOnFailure = options.fallbackOnFailure ?? true;
    this.lastMeta = {
      provider: "gemini",
      model: this.model,
      fallback: false,
    };
  }

  getMeta(): AiMeta {
    return { ...this.lastMeta };
  }

  async callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Gemini API key is missing or empty");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr?.name === "AbortError") {
        throw new Error(`Gemini API request timed out after ${this.timeoutMs}ms`);
      }
      throw new Error(`Gemini API network error: ${fetchErr?.message || "Connection failed"}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as any;
        if (errJson?.error?.message) {
          errorMessage = errJson.error.message.replace(this.apiKey, "[REDACTED]");
        }
      } catch {
        const text = await res.text().catch(() => "");
        if (text) {
          errorMessage = text.slice(0, 200).replace(this.apiKey, "[REDACTED]");
        }
      }
      throw new Error(`Gemini API error (${res.status}): ${errorMessage}`);
    }

    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Invalid response format from Gemini API: missing text part");
    }

    this.lastMeta = {
      provider: "gemini",
      model: this.model,
      fallback: false,
    };

    return text.trim();
  }

  private handleFailure(operation: string, err: unknown): string {
    const rawError = err instanceof Error ? err.message : String(err);
    const safeError = rawError.replace(this.apiKey, "[REDACTED]");

    log("warn", `Gemini ${operation} failed`, {
      error: safeError,
      model: this.model,
      fallbackActive: this.fallbackOnFailure,
    });

    this.lastMeta = {
      provider: "mock",
      model: this.model,
      fallback: true,
      error: safeError,
    };

    if (!this.fallbackOnFailure) {
      throw (err instanceof Error ? err : new Error(safeError));
    }

    return safeError;
  }

  async summarizeTask(ctx: TaskAiContext): Promise<string> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal operations AI assistant. Provide a concise, clear executive summary of this operational task and its discussion. Focus on root problem, current owner, urgency, and latest progress. Use clean markdown formatting.";
      const prompt = `Task Details:\n${JSON.stringify(ctx, null, 2)}`;
      return await this.callGemini(system, prompt);
    } catch (err) {
      const safeError = this.handleFailure("summarizeTask", err);
      const mockResult = await this.fallback.summarizeTask(ctx);
      return `> [!WARNING]\n> **SimuAI Offline Fallback Active:** Live Gemini model (${this.model}) was unavailable (${safeError}). Showing rule-based offline summary.\n\n${mockResult}`;
    }
  }

  async suggestNextActions(ctx: TaskAiContext): Promise<string[]> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal operations AI assistant. Return exactly 2 to 4 concrete, actionable next steps or resolution checklist items for this task. Return ONLY a valid JSON array of strings, e.g. [\"Action 1\", \"Action 2\"]. Do not wrap in markdown code blocks if possible.";
      const prompt = `Task Details:\n${JSON.stringify(ctx, null, 2)}`;
      const text = await this.callGemini(system, prompt);

      const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
      throw new Error("Gemini did not return a valid JSON array of strings for actions");
    } catch (err) {
      this.handleFailure("suggestNextActions", err);
      return this.fallback.suggestNextActions(ctx);
    }
  }

  async catchUpTask(ctx: TaskAiContext): Promise<string> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal operations assistant. Provide a brief catch-up digest summarizing recent updates, comment activity, and pending blockers on this task.";
      const prompt = `Task Details:\n${JSON.stringify(ctx, null, 2)}`;
      return await this.callGemini(system, prompt);
    } catch (err) {
      const safeError = this.handleFailure("catchUpTask", err);
      const mockResult = await this.fallback.catchUpTask(ctx);
      return `> [!WARNING]\n> **SimuAI Offline Fallback Active:** Live Gemini model (${this.model}) was unavailable (${safeError}). Showing rule-based offline catch-up.\n\n${mockResult}`;
    }
  }

  async generateBriefing(ctx: DashboardAiContext): Promise<string> {
    try {
      const system = [
        "You are SimuAI, Harborlane Retail's internal operations intelligence analyst.",
        "Your objective is to produce a concise, professional operational briefing report for a management dashboard.",
        "",
        "TONE & STYLE GUIDELINES:",
        "- Act as a precise operational analyst, NOT a motivational speaker or cheerleader.",
        "- Absolutely NO generic motivational quotes, rhetorical fluff, ceremonial greetings, or repetitive closing platitudes.",
        "- Avoid excessive emojis (use at most 1 subtle indicator per major section if appropriate).",
        "- Use valid GitHub Flavored Markdown (GFM) with clean typography, tables, and compact bullet lists.",
        "",
        "REPORT STRUCTURE (Follow exactly):",
        "1. ### Operational Briefing: Queue Summary for " + ctx.userName + " (" + ctx.userRole.toUpperCase() + ")",
        "   **Overview:** Exactly one concise sentence summarizing current operational status.",
        "",
        "2. #### Key Operational Metrics",
        "   Present a clean GFM table with columns: `| Metric | Count | Operational Status |`",
        "   Include: Total Open Tasks, Active (On Schedule), Overdue, Urgent Priority, and Unassigned Queue using the exact figures from context.",
        "   Use concise status tags like `Nominal`, `Needs Attention`, or `Immediate Action`.",
        "",
        "3. #### Priority Items",
        "   If highlightTasks has items, display a concise GFM table with columns:",
        "   `| Task | Priority | Category | Status | Assignee |`",
        "   Only include tasks present in highlightTasks. If highlightTasks is empty, state: '*No pending critical priority items.*'",
        "",
        "4. #### Recommended Actions",
        "   Provide 3 to 5 prioritized, concrete, actionable recommendations grounded directly in the provided tasks and metrics.",
        "   Clearly frame recommendations as suggestions (e.g. 'Investigate...', 'Assign an operational owner to...', 'Prioritize resolution of...').",
        "   Never claim actions have already been completed.",
        "",
        "5. #### Workload Observations",
        "   One or two factual observations regarding queue balance, unassigned backlog, or deadline pressure.",
        "   Omit this section if the queue has no noteworthy bottlenecks.",
        "",
        "STRICT FACTUAL GROUNDING RULES (NEVER VIOLATE):",
        "- Use ONLY facts directly provided in the context.",
        "- NEVER invent employee names, team names, assignees, meeting times, schedules, SLAs, or tasks not present in context.",
        "- NEVER invent metrics or calculate speculative numbers.",
        "- If task ownership is missing, recommend assigning an appropriate owner without inventing any person's name.",
        "- Keep the report concise, readable, and tightly focused on operational decisions.",
      ].join("\n");

      const prompt = `Operational Context Data:\n${JSON.stringify(ctx, null, 2)}`;
      return await this.callGemini(system, prompt);
    } catch (err) {
      const safeError = this.handleFailure("generateBriefing", err);
      const mockResult = await this.fallback.generateBriefing(ctx);
      return `> [!WARNING]\n> **SimuAI Offline Fallback Active:** Live Gemini model (${this.model}) was unavailable (${safeError}). Showing rule-based offline briefing.\n\n${mockResult}`;
    }
  }
}
