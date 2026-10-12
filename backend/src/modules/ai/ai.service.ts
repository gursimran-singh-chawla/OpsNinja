import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import type { AuthUser } from "../../types/express.js";
import { canViewTask, isOverdue, type TaskWithAccess } from "../tasks/policy.js";
import * as tasksService from "../tasks/tasks.service.js";
import type { AiMeta, AiProvider, TaskAiContext, DashboardAiContext } from "./types.js";
import { MockAiProvider } from "./mockProvider.js";
import { GroqAiProvider } from "./groqProvider.js";
import { GeminiAiProvider } from "./geminiProvider.js";

let providerInstance: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (providerInstance) return providerInstance;

  const providerType = (env.AI_PROVIDER || "none").toLowerCase().trim();
  const groqKey = (env.GROQ_API_KEY || env.AI_API_KEY || "").trim();
  const geminiKey = (env.AI_API_KEY || "").trim();
  const model = (env.AI_MODEL || "openai/gpt-oss-20b").trim();

  if (providerType === "groq") {
    if (groqKey.length > 0) {
      providerInstance = new GroqAiProvider(groqKey, model);
    } else {
      throw errors.badRequest("AI_PROVIDER is set to 'groq' but GROQ_API_KEY is missing or empty.");
    }
  } else if (providerType === "gemini") {
    if (geminiKey.length > 0) {
      providerInstance = new GeminiAiProvider(geminiKey, model);
    } else {
      throw errors.badRequest("AI_PROVIDER is set to 'gemini' but AI_API_KEY is missing or empty.");
    }
  } else {
    providerInstance = new MockAiProvider();
  }

  return providerInstance;
}

export function getAiMeta(): AiMeta {
  const provider = getAiProvider();
  if (provider.getMeta) {
    return provider.getMeta();
  }
  return {
    provider: "mock",
    model: "offline-engine",
    fallback: false,
  };
}

export function setAiProviderForTesting(provider: AiProvider | null) {
  providerInstance = provider;
}

async function loadAndAuthorizeTask(user: AuthUser, taskId: string): Promise<TaskWithAccess> {
  if (user.role === "admin") throw errors.forbidden();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      access: { select: { userId: true, accessType: true, grantedById: true } },
      createdBy: { select: { name: true } },
      assignee: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, role: true } } },
      },
    },
  });

  if (!task) throw errors.notFound("Task");

  const taskWithAccess = task as unknown as TaskWithAccess;
  const allowed = await canViewTask(user, taskWithAccess);
  if (!allowed) throw errors.forbidden();

  return taskWithAccess;
}

function buildTaskContext(task: any): TaskAiContext {
  const overdue = isOverdue(task);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    workKind: task.workKind,
    priority: task.priority,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    overdue,
    visibilityType: task.visibilityType,
    assigneeName: task.assignee?.name ?? null,
    creatorName: task.createdBy?.name ?? "Unknown",
    comments: (task.comments || []).map((c: any) => ({
      authorName: c.author?.name ?? "Unknown",
      authorRole: c.author?.role ?? "associate",
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function summarizeTask(user: AuthUser, taskId: string): Promise<string> {
  const task = await loadAndAuthorizeTask(user, taskId);
  const ctx = buildTaskContext(task);
  const provider = getAiProvider();
  return provider.summarizeTask(ctx);
}

export async function suggestNextActions(user: AuthUser, taskId: string): Promise<string[]> {
  const task = await loadAndAuthorizeTask(user, taskId);
  const ctx = buildTaskContext(task);
  const provider = getAiProvider();
  return provider.suggestNextActions(ctx);
}

export async function catchUpTask(user: AuthUser, taskId: string): Promise<string> {
  const task = await loadAndAuthorizeTask(user, taskId);
  const ctx = buildTaskContext(task);
  const provider = getAiProvider();
  return provider.catchUpTask(ctx);
}

export async function generateBriefing(user: AuthUser): Promise<string> {
  if (user.role === "admin") throw errors.forbidden();

  const dashboard = await tasksService.dashboard(user);

  // Collect some recent highlights from visible tasks
  const recentTasks = await tasksService.listTasks(user, {
    archived: false,
    finished: false,
  });

  const urgentCount = recentTasks.filter((t: any) => t.priority === "urgent" && !t.finishedAt).length;

  // Prioritize highlight tasks by urgency (overdue first, then priority weight, then updated date)
  const prioritizedTasks = [...recentTasks].sort((a: any, b: any) => {
    const aOverdue = isOverdue(a) ? 1 : 0;
    const bOverdue = isOverdue(b) ? 1 : 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;

    const prioWeight: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 };
    const aPrio = prioWeight[a.priority] ?? 0;
    const bPrio = prioWeight[b.priority] ?? 0;
    if (bPrio !== aPrio) return bPrio - aPrio;

    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });

  const highlightTasks = prioritizedTasks.slice(0, 5).map((t: any) => ({
    title: t.title,
    priority: t.priority,
    category: t.category,
    workKind: t.workKind,
    overdue: isOverdue(t),
    assigneeName: t.assignee?.name ?? null,
  }));

  const ctx: DashboardAiContext = {
    userName: user.name,
    userRole: user.role,
    openCount: dashboard.open,
    activeCount: Math.max(0, dashboard.open - dashboard.due),
    overdueCount: dashboard.due,
    urgentCount,
    unassignedCount: dashboard.unassigned,
    highlightTasks,
  };

  const provider = getAiProvider();
  return provider.generateBriefing(ctx);
}
