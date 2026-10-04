import { useEffect, useMemo, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { CreateTaskMenu } from "../features/create/CreateTaskMenu";
import { defaultAudience, toApiPayload } from "../features/create/visibilityPresets";
import { formatVisibility, isOverdue } from "../ui";

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

const COLUMNS: { key: BoardColumnKey; title: string }[] = [
  { key: "TODO", title: "To Do" },
  { key: "IN_PROGRESS", title: "In Progress" },
  { key: "IN_REVIEW", title: "In Review" },
  { key: "DONE", title: "Done" },
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
  const hues = [160, 24, 200, 280, 40, 340];
  let n = 0;
  for (const c of name) n = (n + c.charCodeAt(0)) % hues.length;
  return `hsl(${hues[n]} 45% 38%)`;
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
    const needle = q.trim().toLowerCase();
    const list = (rows ?? []).filter((t) => {
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.createdBy.name.toLowerCase().includes(needle) ||
        (t.assignee?.name ?? "").toLowerCase().includes(needle)
      );
    });
    return list;
  }, [rows, q]);

  function cardsIn(column: BoardColumnKey) {
    return visible.filter((t) => t.boardColumn === column).sort(sortCol);
  }

  async function persistMove(id: string, column: BoardColumnKey, index: number) {
    const snapshot = rows;
    const moving = rows?.find((t) => t.id === id);
    if (!moving || !rows) return;
    const others = rows.filter((t) => t.id !== id);
    const col = others.filter((t) => t.boardColumn === column).sort(sortCol);
    const clamped = Math.max(0, Math.min(index, col.length));
    const prev = col[clamped - 1];
    const next = col[clamped];
    const optimistic: BoardTask = {
      ...moving,
      boardColumn: column,
      boardRank: `${prev?.boardRank ?? "000000000000"}~`,
    };
    setRows([...others.filter((t) => t.boardColumn !== column), ...col.slice(0, clamped), optimistic, ...col.slice(clamped)]);
    try {
      await api(`/api/tasks/${id}/board`, {
        method: "POST",
        body: JSON.stringify({ boardColumn: column, prevId: prev?.id ?? null, nextId: next?.id ?? null }),
      });
      await load();
    } catch (e) {
      setRows(snapshot);
      setErr(e instanceof Error ? e.message : "Could not move task");
    }
  }

  function onDropColumn(column: BoardColumnKey, index: number) {
    if (!draggingId) return;
    void persistMove(draggingId, column, index);
    setDraggingId(null);
    setOver(null);
  }

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100vh-180px)] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Board</h1>
          <p className="mt-1 text-sm text-muted">Same tasks as List, arranged by workflow. Drag cards between columns or up and down.</p>
        </div>
        <CreateTaskMenu onCreated={() => void load()} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search board"
          className="w-64 rounded-md border border-border bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">{visible.length} tasks</span>
      </div>
      {err ? <p className="mt-3 text-sm text-due">{err}</p> : null}

      <div className="mt-4 flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = cardsIn(col.key);
          return (
            <section
              key={col.key}
              className="flex w-[272px] shrink-0 flex-col rounded-xl bg-[#ebecf0]"
              onDragOver={(e) => {
                e.preventDefault();
                if (!over || over.column !== col.key) setOver({ column: col.key, index: cards.length });
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropColumn(col.key, over?.column === col.key ? over.index : cards.length);
              }}
            >
              <header className="flex items-center justify-between px-3 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  {col.title} {cards.length}
                </h2>
              </header>
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
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
                <QuickCreate column={col.key} user={user} onCreated={() => void load()} onError={setErr} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DropLine() {
  return <div className="mb-1 h-1 rounded-full bg-accent" />;
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
      className={`cursor-grab rounded-md border border-transparent bg-elevated p-3 shadow-sm hover:bg-white ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className="text-sm font-medium text-ink hover:text-accent">
          {task.title}
        </Link>
        {task.assignee ? (
          <span
            title={task.assignee.name}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: avatarColor(task.assignee.name) }}
          >
            {initials(task.assignee.name)}
          </span>
        ) : (
          <span title="Unassigned" className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted">
            ·
          </span>
        )}
      </div>
      {task.dueAt ? (
        <div className={`mt-2 text-xs ${due ? "font-medium text-due" : "text-muted"}`}>
          {due ? "Due · " : ""}
          {new Date(task.dueAt).toLocaleDateString()}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          {taskKey(task.id)} · {kindLabel[task.workKind] ?? task.workKind}
        </span>
        <span className="truncate" title={formatVisibility(task)}>
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
          description: "Added from the board.",
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
        className="mt-1 rounded-md px-2 py-2 text-left text-sm text-muted hover:bg-white/80"
        onClick={() => setOpen(true)}
      >
        + Create
      </button>
    );
  }

  return (
    <form
      className="rounded-md border border-accent bg-elevated p-2 shadow-sm"
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
        className="w-full resize-none text-sm outline-none"
      />
      <div className="mt-1 flex justify-end gap-1">
        <button type="button" className="px-2 py-1 text-xs text-muted" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button disabled={busy || title.trim().length < 3} className="rounded bg-accent px-2 py-1 text-xs text-white disabled:opacity-50">
          {busy ? "Saving…" : "Add"}
        </button>
      </div>
    </form>
  );
}
