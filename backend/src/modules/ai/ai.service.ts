import { prisma } from "../../lib/prisma.js";
import { errors } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import type { AuthUser } from "../../types/express.js";
import { canViewTask, isOverdue, type TaskWithAccess } from "../tasks/policy.js";
import * as tasksService from "../tasks/tasks.service.js";
import type { AiProvider, TaskAiContext, DashboardAiContext } from "./types.js";
import { MockAiProvider } from "./mockProvider.js";
import { GeminiAiProvider } from "./geminiProvider.js";

let providerInstance: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (providerInstance) return providerInstance;

  const providerType = (env.AI_PROVIDER || "mock").toLowerCase();
  const apiKey = env.AI_API_KEY || "";

  if (providerType === "gemini" && apiKey.trim().length > 0) {
    providerInstance = new GeminiAiProvider(apiKey);
  } else {
    providerInstance = new MockAiProvider();
  }

  return providerInstance;
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

  const highlightTasks = recentTasks.slice(0, 5).map((t: any) => ({
    title: t.title,
    priority: t.priority,
    category: t.category,
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
