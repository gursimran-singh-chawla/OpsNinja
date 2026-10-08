import { useEffect, useMemo, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { CreateTaskMenu } from "../features/create/CreateTaskMenu";
import { defaultAudience, toApiPayload } from "../features/create/visibilityPresets";
import { formatVisibility, isOverdue, priorityBadgeClass } from "../ui";

type BoardColumnKey = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type BoardTask = {
  id: string;
  title: string;
  workKind: string;
  priority: string;
  dueAt: string | null;
  finishedAt: string | null;
  archivedAt: string | null;
  boardColumn: BoardColumnKey;
  boardRank: string;
  visibilityType: string;
  visibilityManager: { name: string } | null;
  createdBy: { name: string };
  assignee: { id: string; name: string } | null;
};

const COLUMNS: { key: BoardColumnKey; title: string; dot: string }[] = [
  { key: "TODO", title: "To Do", dot: "bg-slate-400" },
  { key: "IN_PROGRESS", title: "In Progress", dot: "bg-indigo-500" },
  { key: "IN_REVIEW", title: "In Review", dot: "bg-amber-500" },
  { key: "DONE", title: "Done", dot: "bg-emerald-500" },
];

const kindLabel: Record<string, string> = {
  task: "Task",
  escalation: "Escalation",
  backlog: "Backlog",
  report: "Report",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function avatarColor(name: string) {
  const hues = [220, 260, 160, 24, 200, 280];
  let n = 0;
  for (const c of name) n = (n + c.charCodeAt(0)) % hues.length;
  return `hsl(${hues[n]} 65% 42%)`;
}

function taskKey(id: string) {
  return `OPS-${id.slice(0, 4).toUpperCase()}`;
}

function sortCol(a: BoardTask, b: BoardTask) {
  return a.boardRank.localeCompare(b.boardRank) || a.id.localeCompare(b.id);
}

export function Board() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BoardTask[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<{ column: BoardColumnKey; index: number } | null>(null);

  async function load() {
    try {
      const data = await api<BoardTask[]>("/api/tasks");
      setRows(data.filter((t) => !t.archivedAt));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load board");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        taskKey(t.id).toLowerCase().includes(term) ||
        t.priority.toLowerCase().includes(term) ||
        (t.assignee?.name ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  function cardsIn(col: BoardColumnKey) {
    return visible.filter((t) => t.boardColumn === col).sort(sortCol);
  }

  async function onDropColumn(targetCol: BoardColumnKey, dropIndex: number) {
    if (!draggingId || !rows) return;
    const item = rows.find((t) => t.id === draggingId);
    if (!item) return;

    const destCards = visible.filter((t) => t.boardColumn === targetCol && t.id !== draggingId).sort(sortCol);
    const clamped = Math.max(0, Math.min(dropIndex, destCards.length));
    const prev = clamped > 0 ? destCards[clamped - 1] : null;
    const next = clamped < destCards.length ? destCards[clamped] : null;

    setRows((prevRows) => {
      if (!prevRows) return prevRows;
      return prevRows.map((t) => {
        if (t.id !== draggingId) return t;
        const finishedAt = targetCol === "DONE" ? t.finishedAt ?? new Date().toISOString() : null;
        return { ...t, boardColumn: targetCol, finishedAt };
      });
    });

    setDraggingId(null);
    setOver(null);

    try {
      await api(`/api/tasks/${item.id}/board`, {
        method: "POST",
        body: JSON.stringify({
          boardColumn: targetCol,
          prevId: prev?.id ?? null,
          nextId: next?.id ?? null,
        }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to move card");
      await load();
    }
  }

  return (
    <div className="flex flex-col space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Operations Board</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Drag cards between workflow stages. Moving to Done marks completion.
          </p>
        </div>
        <CreateTaskMenu onCreated={() => void load()} />
      </div>

      {/* Search & Counter */}
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted text-xs pointer-events-none">
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter cards by title, ID, priority…"
            className="w-full rounded-xl border border-slate-200/90 bg-white pl-8 pr-3 py-1.5 text-xs text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 shadow-2xs"
          />
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200 tabular-nums">
          {visible.length} tasks
        </span>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-due flex items-center gap-2">
          <span>⚠️</span>
          <span>{err}</span>
        </div>
      ) : null}

      {/* Kanban Columns */}
      <div className="flex min-h-[calc(100vh-280px)] gap-4 overflow-x-auto pb-6">
        {COLUMNS.map((col) => {
          const cards = cardsIn(col.key);
          const isOverThisCol = over?.column === col.key;
          return (
            <section
              key={col.key}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border transition-all duration-150 ${
                isOverThisCol
                  ? "border-brand/40 bg-indigo-50/20 shadow-md"
                  : "border-slate-200/80 bg-slate-100/60 shadow-2xs"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!over || over.column !== col.key) setOver({ column: col.key, index: cards.length });
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropColumn(col.key, over?.column === col.key ? over.index : cards.length);
              }}
            >
              {/* Column Header */}
              <header className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${col.dot}`} />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                    {col.title}
                  </h2>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200 shadow-2xs tabular-nums">
                  {cards.length}
                </span>
              </header>

              {/* Cards list */}
              <div className="flex flex-1 flex-col gap-2.5 p-2.5 overflow-y-auto">
                {cards.map((t, i) => (
                  <div key={t.id}>
                    {over?.column === col.key && over.index === i ? <DropLine /> : null}
                    <BoardCard
                      task={t}
                      dragging={draggingId === t.id}
                      onDragStart={() => setDraggingId(t.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOver(null);
                      }}
                      onDragOverCard={() => setOver({ column: col.key, index: i })}
                    />
                  </div>
                ))}
                {over?.column === col.key && over.index >= cards.length ? <DropLine /> : null}

                {user && (
                  <QuickCreate
                    column={col.key}
                    user={user}
                    onCreated={() => void load()}
                    onError={setErr}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DropLine() {
  return (
    <div className="my-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm shadow-indigo-500/50 animate-pulse" />
  );
}

function BoardCard({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOverCard,
}: {
  task: BoardTask;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: () => void;
}) {
  const due = isOverdue(task);
  return (
    <article
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOverCard();
      }}
      className={`group relative rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:border-brand/40 hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-30 scale-95" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/tasks/${task.id}`}
          className="text-xs font-semibold text-ink group-hover:text-brand transition-colors line-clamp-2 leading-snug"
        >
          {task.title}
        </Link>
        {task.assignee ? (
          <span
            title={task.assignee.name}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white shadow-2xs"
            style={{ background: avatarColor(task.assignee.name) }}
          >
            {initials(task.assignee.name)}
          </span>
        ) : (
          <span
            title="Unassigned"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-slate-300 text-[10px] text-muted bg-slate-50"
          >
            ?
          </span>
        )}
      </div>

      {task.dueAt ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
          {due ? (
            <span className="rounded bg-rose-100 px-1.5 py-0.2 font-bold text-rose-700 text-[10px]">
              DUE
            </span>
          ) : (
            <span className="text-muted">⏱️</span>
          )}
          <span className={due ? "text-rose-600 font-semibold" : "text-muted"}>
            {new Date(task.dueAt).toLocaleDateString()}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] text-muted">
        <span className="font-mono font-medium text-slate-500">
          {taskKey(task.id)} · {kindLabel[task.workKind] ?? task.workKind}
        </span>
        <span
          className={`rounded px-1.5 py-0.2 font-medium capitalize border ${priorityBadgeClass(
            task.priority,
          )}`}
        >
          {task.priority}
        </span>
      </div>
    </article>
  );
}

function QuickCreate({
  column,
  user,
  onCreated,
  onError,
}: {
  column: BoardColumnKey;
  user: { id: string; role: string; reportsToId: string | null };
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (trimmed.length < 3) return;
    setBusy(true);
    onError(null);
    try {
      const vis = toApiPayload(defaultAudience(user.role, "task", user.reportsToId), user, {});
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: trimmed,
          description: "Added directly from the board.",
          category: "normal",
          workKind: "task",
          priority: "normal",
          visibilityType: vis.visibilityType,
          visibilityManagerId: vis.visibilityManagerId,
          directUserIds: vis.directUserIds,
          boardColumn: column,
        }),
      });
      setTitle("");
      setOpen(false);
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not create task");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
    if (e.key === "Escape") {
      setOpen(false);
      setTitle("");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300/80 bg-white/50 px-3 py-2 text-xs font-semibold text-muted hover:border-brand hover:text-brand hover:bg-white transition cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <span>+</span>
        <span>Add card</span>
      </button>
    );
  }

  return (
    <form
      className="rounded-xl border border-brand/60 bg-white p-3 shadow-md animate-fade-in"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKey}
        placeholder="What needs to be done?"
        className="w-full resize-none text-xs text-ink outline-none placeholder:text-muted/60"
      />
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:text-ink transition cursor-pointer"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button
          disabled={busy || title.trim().length < 3}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
        >
          {busy ? "Adding…" : "Add card"}
        </button>
      </div>
    </form>
  );
}
