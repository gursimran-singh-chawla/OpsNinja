import type { AiProvider, DashboardAiContext, TaskAiContext } from "./types.js";
import { MockAiProvider } from "./mockProvider.js";
import { log } from "../../lib/logger.js";

export class GeminiAiProvider implements AiProvider {
  name = "SimuAI (Gemini Powered)";
  private fallback = new MockAiProvider();

  constructor(private apiKey: string, private model = "gemini-1.5-flash") {}

  private async callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      return this.fallbackText();
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nUser Context:\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API returned status ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Invalid response format from Gemini API");
    }

    return text.trim();
  }

  private fallbackText(): string {
    return "";
  }

  async summarizeTask(ctx: TaskAiContext): Promise<string> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal AI operations assistant. Provide a concise, clear executive summary of this operational task and its comments thread. Keep it actionable and professional.";
      const prompt = JSON.stringify(ctx, null, 2);
      return await this.callGemini(system, prompt);
    } catch (err) {
      log("warn", "Gemini API error, falling back to mock engine", { error: String(err) });
      return this.fallback.summarizeTask(ctx);
    }
  }

  async suggestNextActions(ctx: TaskAiContext): Promise<string[]> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal AI operations assistant. Return exactly 2 to 4 concrete, actionable next steps or resolution checklist items for this task. Return ONLY a valid JSON array of strings, e.g. [\"Action 1\", \"Action 2\"]. Do not wrap in markdown code blocks if possible.";
      const prompt = JSON.stringify(ctx, null, 2);
      const text = await this.callGemini(system, prompt);

      const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
      throw new Error("Gemini did not return string array for actions");
    } catch (err) {
      log("warn", "Gemini suggestNextActions failed, falling back to mock engine", { error: String(err) });
      return this.fallback.suggestNextActions(ctx);
    }
  }

  async catchUpTask(ctx: TaskAiContext): Promise<string> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal operations assistant. Provide a brief catch-up digest summarizing recent updates, comment activity, and pending blockers on this task.";
      const prompt = JSON.stringify(ctx, null, 2);
      return await this.callGemini(system, prompt);
    } catch (err) {
      log("warn", "Gemini catchUpTask failed, falling back to mock engine", { error: String(err) });
      return this.fallback.catchUpTask(ctx);
    }
  }

  async generateBriefing(ctx: DashboardAiContext): Promise<string> {
    try {
      const system =
        "You are SimuAI, Harborlane Retail's internal AI operations assistant. Generate an inspiring, clear, actionable morning operational briefing tailored to this user's role and queue (overdue tasks, urgent tickets, unassigned work). Use GitHub flavored markdown formatting.";
      const prompt = JSON.stringify(ctx, null, 2);
      return await this.callGemini(system, prompt);
    } catch (err) {
      log("warn", "Gemini generateBriefing failed, falling back to mock engine", { error: String(err) });
      return this.fallback.generateBriefing(ctx);
    }
  }
}
