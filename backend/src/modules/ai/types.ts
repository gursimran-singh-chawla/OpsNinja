export interface TaskCommentContext {
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface TaskAiContext {
  id: string;
  title: string;
  description: string;
  category: string;
  workKind: string;
  priority: string;
  dueAt: string | null;
  overdue: boolean;
  visibilityType: string;
  assigneeName: string | null;
  creatorName: string;
  comments: TaskCommentContext[];
}

export interface DashboardAiContext {
  userName: string;
  userRole: string;
  openCount: number;
  overdueCount: number;
  urgentCount: number;
  unassignedCount: number;
  activeCount: number;
  highlightTasks: Array<{
    title: string;
    priority: string;
    category: string;
    workKind?: string;
    overdue: boolean;
    assigneeName?: string | null;
  }>;
}

export interface AiMeta {
  provider: "groq" | "gemini" | "mock";
  model: string;
  fallback: boolean;
  error?: string;
}

export interface AiProvider {
  name: string;
  model?: string;
  getMeta?(): AiMeta;
  summarizeTask(ctx: TaskAiContext): Promise<string>;
  suggestNextActions(ctx: TaskAiContext): Promise<string[]>;
  catchUpTask(ctx: TaskAiContext): Promise<string>;
  generateBriefing(ctx: DashboardAiContext): Promise<string>;
}
