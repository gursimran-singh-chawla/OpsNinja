import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { btn, btnPrimary, field, formatVisibility, isOverdue, priorityBadgeClass } from "../ui";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

type Person = { id: string; name: string; role: string; reportsToId: string | null };
type Detail = {
  id: string;
  title: string;
  description: string;
  category: string;
  workKind: string;
  metadata: Record<string, unknown> | null;
  priority: string;
  dueAt: string | null;
  visibilityType: string;
  finishedAt: string | null;
  archivedAt: string | null;
  createdBy: { name: string; role: string };
  assignee: { id: string; name: string } | null;
  assignedBy: { name: string } | null;
  visibilityManager: { name: string } | null;
  comments: { id: string; body: string; createdAt: string; author: { name: string } }[];
};

export function TaskDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [t, setT] = useState<Detail | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [audit, setAudit] = useState<{ action: string; createdAt: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  // SimuAI states
  const [aiMode, setAiMode] = useState<"summary" | "actions" | "catch-up" | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiActions, setAiActions] = useState<string[] | null>(null);
  const [aiMeta, setAiMeta] = useState<{ provider: string; model: string; fallback: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [copiedAi, setCopiedAi] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const [d, a] = await Promise.all([
        api<Detail>(`/api/tasks/${id}`),
        api<{ action: string; createdAt: string }[]>(`/api/tasks/${id}/audit`),
      ]);
      setT(d);
      setAudit(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load task");
    }
  }

  useEffect(() => {
    void load();
    api<Person[]>("/api/users").then(setPeople).catch(() => undefined);
  }, [id]);

  async function act(path: string, body: object) {
    setErr(null);
    try {
      await api(`/api/tasks/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function comment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await act("comments", { body: commentBody.trim() });
    setCommentBody("");
  }

  async function runAi(mode: "summary" | "actions" | "catch-up") {
    if (!id) return;
    setAiMode(mode);
    setAiLoading(true);
    setAiErr(null);
    setAiResult(null);
    setAiActions(null);
    setAiMeta(null);

    try {
      if (mode === "summary") {
        const res = await api<{ summary: string; meta?: any }>(`/api/tasks/${id}/ai/summary`, { method: "POST" });
        setAiResult(res.summary);
        if (res.meta) setAiMeta(res.meta);
      } else if (mode === "actions") {
        const res = await api<{ actions: string[]; meta?: any }>(`/api/tasks/${id}/ai/actions`, { method: "POST" });
        setAiActions(res.actions);
        if (res.meta) setAiMeta(res.meta);
      } else if (mode === "catch-up") {
        const res = await api<{ catchUp: string; meta?: any }>(`/api/tasks/${id}/ai/catch-up`, { method: "POST" });
        setAiResult(res.catchUp);
        if (res.meta) setAiMeta(res.meta);
      }
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "Failed to generate AI assist");
    } finally {
      setAiLoading(false);
    }
  }

  function getAiExportText(): string {
    if (aiActions) {
      return aiActions.map((a, i) => `${i + 1}. ${a}`).join("\n");
    }
    return aiResult || "";
  }

  function copyAiOutput() {
    const text = getAiExportText();
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2000);
  }

  function insertAiIntoComment() {
    const text = getAiExportText();
    if (!text) return;
    const prefix = aiMode === "actions" ? "**Suggested Next Actions (via SimuAI):**\n" : "**SimuAI Digest:**\n";
    const toInsert = `${prefix}${text}`;
    setCommentBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${toInsert}` : toInsert));
  }

  if (!t && !err) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-44 animate-pulse rounded-2xl bg-white/70 shadow-xs" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/70 shadow-xs" />
      </div>
    );
  }

  if (!t) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center">
        <p className="text-sm font-semibold text-rose-800">{err || "Task not found"}</p>
        <Link to="/list" className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:underline">
          ← Back to task list
        </Link>
      </div>
    );
  }

  const due = isOverdue(t);
  const associates = people.filter((p) => p.role === "associate");
  const canAssignOthers = user?.role === "lead" || user?.role === "manager";
  const canClaim = user?.role === "associate" && !t.assignee;

  // Work kind styles
  const workKindBadges: Record<string, string> = {
    escalation: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
    report: "bg-purple-50 text-purple-700 ring-1 ring-purple-300",
    backlog: "bg-slate-100 text-slate-700 ring-1 ring-slate-300",
    task: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/list"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs backdrop-blur-xs transition hover:border-slate-300 hover:text-slate-900"
        >
          <span>←</span> Back to queue
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {t.archivedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300">
              Archived
            </span>
          )}
          {t.finishedAt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          ) : due ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-300 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
              Overdue
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Open
            </span>
          )}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${workKindBadges[t.workKind] ?? "bg-slate-100 text-slate-700"}`}>
            {t.workKind}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            {t.category}
          </span>
        </div>
      </div>

      {/* Main Task Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t.title}</h1>
        <div className="mt-4 prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {t.description}
        </div>

        {/* Structured Metadata Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Priority</div>
            <div className="mt-1">
              <span className={priorityBadgeClass(t.priority)}>{t.priority}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Deadline</div>
            <div className={`mt-1 font-medium ${due ? "text-rose-600 font-semibold" : "text-slate-800"}`}>
              {t.dueAt ? new Date(t.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "None set"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Responsible</div>
            <div className="mt-1 flex items-center gap-1.5">
              {t.assignee ? (
                <>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                    {t.assignee.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-900">{t.assignee.name}</span>
                </>
              ) : (
                <span className="italic text-slate-400">Unassigned</span>
              )}
            </div>
            {t.assignedBy && (
              <div className="mt-0.5 text-[10px] text-slate-400">By {t.assignedBy.name}</div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Audience</div>
            <div className="mt-1 flex items-center gap-1 font-medium text-slate-800">
              <span className="text-slate-400">👁</span> {formatVisibility(t)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">Created by {t.createdBy.name}</div>
          </div>
        </div>

        {/* Error message */}
        {err && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {err}
          </div>
        )}

        {/* Task Actions Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {canClaim && (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
              onClick={() => void act("claim", {})}
            >
              ✋ Take this task
            </button>
          )}

          {canAssignOthers && (
            <div className="flex items-center gap-1.5">
              <select
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  void act("assign", { assigneeId: v === "none" ? null : v });
                }}
              >
                <option value="">Assign associate…</option>
                <option value="none">Unassign</option>
                {associates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {!a.reportsToId ? "(free agent)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {user && (user.role === "lead" || user.role === "manager" || (user.role === "associate" && t.assignee?.id === user.id)) && (
            <button
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition ${
                t.finishedAt
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
              onClick={() => void act("finish", { finished: !t.finishedAt })}
            >
              {t.finishedAt ? "↩ Reopen task" : "✓ Mark as complete"}
            </button>
          )}

          {(user?.role === "lead" || user?.role === "manager") && (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
              onClick={() => {
                if (confirm("Archive removes this task from the live queue. History is kept.")) {
                  void act("archive", { archived: !t.archivedAt });
                }
              }}
            >
              {t.archivedAt ? "Restore from archive" : "Archive"}
            </button>
          )}
        </div>
      </div>

      {/* SimuAI Assist Panel */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-xs text-white shadow-xs">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900">SimuAI Assistant</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  On-Demand
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Autonomous reasoning & operational guidance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void runAi("summary")}
              disabled={aiLoading}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                aiMode === "summary"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-2xs"
              }`}
            >
              Summarize
            </button>
            <button
              type="button"
              onClick={() => void runAi("actions")}
              disabled={aiLoading}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                aiMode === "actions"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-2xs"
              }`}
            >
              Next Actions
            </button>
            <button
              type="button"
              onClick={() => void runAi("catch-up")}
              disabled={aiLoading}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                aiMode === "catch-up"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-2xs"
              }`}
            >
              Catch-Up
            </button>
          </div>
        </div>

        {aiLoading && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-indigo-100 bg-white/60 p-3 text-xs text-indigo-900">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span>SimuAI is synthesizing task context, timeline and comments...</span>
          </div>
        )}

        {aiErr && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {aiErr}
          </div>
        )}

        {(aiResult || aiActions) && !aiLoading && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-indigo-100 bg-white/95 p-4 text-xs leading-relaxed text-slate-800 shadow-2xs">
              <div className="mb-3 flex items-center justify-between border-b border-indigo-50/80 pb-2">
                <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-950">
                  {aiMode === "actions" ? "Recommended Actions" : aiMode === "summary" ? "Task Summary" : "Catch-Up Digest"}
                </span>
                {aiMeta && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      aiMeta.fallback
                        ? "border border-amber-300 bg-amber-50 text-amber-800"
                        : aiMeta.provider === "groq"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : aiMeta.provider === "gemini"
                        ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {aiMeta.fallback
                      ? "⚠️ Offline Fallback"
                      : aiMeta.provider === "groq"
                      ? `⚡ Groq (${aiMeta.model})`
                      : aiMeta.provider === "gemini"
                      ? `✨ Gemini (${aiMeta.model})`
                      : "🤖 Offline Engine"}
                  </span>
                )}
              </div>
              {aiActions ? (
                <div>
                  <div className="font-semibold text-indigo-950 mb-2 flex items-center gap-1.5">
                    <span>⚡</span> Action Checklist:
                  </div>
                  <ul className="space-y-2">
                    {aiActions.map((act, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-800">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <MarkdownRenderer content={aiResult} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyAiOutput}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              >
                {copiedAi ? "✓ Copied to clipboard" : "📋 Copy to clipboard"}
              </button>
              <button
                type="button"
                onClick={insertAiIntoComment}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition"
              >
                💬 Insert into comment
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Discussion Section */}
      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Discussion ({t.comments.length})
          </h2>
          <span className="text-xs text-slate-400">Use @Name to mention colleagues</span>
        </div>

        <div className="mt-4 space-y-4">
          {t.comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No comments yet. Start the conversation below.</p>
          ) : (
            t.comments.map((cm) => (
              <div key={cm.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition hover:bg-slate-50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-xs font-bold text-white shadow-xs">
                  {cm.author.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{cm.author.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(cm.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {cm.body}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Box */}
        <form className="mt-5 flex flex-col gap-2.5" onSubmit={(e) => void comment(e)}>
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            required
            placeholder="Write an update, note, or @mention teammates..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Markdown supported</span>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition">
              Send comment
            </button>
          </div>
        </form>
      </section>

      {/* Audit Trail Timeline */}
      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Activity & Audit Timeline</h2>
        <div className="mt-3 relative pl-4 border-l-2 border-slate-100 space-y-3 font-mono text-[11px]">
          {audit.map((a, i) => (
            <div key={i} className="relative flex items-center justify-between gap-3">
              <span className="absolute -left-[21px] h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white" />
              <span className="font-semibold text-slate-700 uppercase tracking-tight">{a.action}</span>
              <span className="text-slate-400">
                {new Date(a.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
