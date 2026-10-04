import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { btn, btnPrimary, field, formatVisibility, isOverdue } from "../ui";

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
      setErr(e instanceof Error ? e.message : "Failed");
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
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function comment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await act("comments", { body: fd.get("body") });
    e.currentTarget.reset();
  }

  if (!t && !err) return <div className="h-40 animate-pulse rounded-xl bg-white" />;
  if (!t) return <p className="text-due">{err}</p>;

  const due = isOverdue(t);
  const associates = people.filter((p) => p.role === "associate");
  const canAssignOthers = user?.role === "lead" || user?.role === "manager";
  const canClaim = user?.role === "associate" && !t.assignee;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/list" className="text-xs text-accent hover:underline">
        ← List
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">
            {t.workKind} · {t.category}
          </div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
        </div>
        {due ? <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-due">Due</span> : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{t.description}</p>
      <dl className="mt-6 grid gap-3 rounded-xl border border-border bg-elevated p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Priority</dt>
          <dd className="capitalize">{t.priority}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Deadline</dt>
          <dd>{t.dueAt ? new Date(t.dueAt).toLocaleString() : "None"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Created by</dt>
          <dd>
            {t.createdBy.name} ({t.createdBy.role})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Who can see this</dt>
          <dd>{formatVisibility(t)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Responsible</dt>
          <dd>
            {t.assignee?.name ?? "Unassigned"}
            {t.assignedBy ? ` · assigned by ${t.assignedBy.name}` : ""}
          </dd>
        </div>
      </dl>
      {err ? <p className="mt-3 text-sm text-due">{err}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canClaim ? (
          <button className={btnPrimary} onClick={() => void act("claim", {})}>
            Take this task
          </button>
        ) : null}
        {canAssignOthers ? (
          <select
            className={field + " mt-0 w-auto"}
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
                {a.name}
              </option>
            ))}
          </select>
        ) : null}
        {user && (user.role === "lead" || user.role === "manager" || (user.role === "associate" && t.assignee?.id === user.id)) ? (
          <button className={btn} onClick={() => void act("finish", { finished: !t.finishedAt })}>
            {t.finishedAt ? "Reopen" : "Complete"}
          </button>
        ) : null}
        {user?.role === "lead" || user?.role === "manager" ? (
          <button
            className={btn}
            onClick={() => {
              if (confirm("Archive removes this task from the live queue. History is kept.")) {
                void act("archive", { archived: !t.archivedAt });
              }
            }}
          >
            {t.archivedAt ? "Unarchive" : "Archive"}
          </button>
        ) : null}
      </div>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Discussion</h2>
      <ul className="mt-3 space-y-3">
        {t.comments.map((cm) => (
          <li key={cm.id} className="border-l-2 border-accent/40 pl-3 text-sm">
            <div className="text-xs text-muted">
              {cm.author.name} · {new Date(cm.createdAt).toLocaleString()}
            </div>
            {cm.body}
          </li>
        ))}
      </ul>
      <form className="mt-4 flex gap-2" onSubmit={(e) => void comment(e)}>
        <input name="body" required placeholder="Comment — use @Name to mention" className={field + " mt-0 flex-1"} />
        <button className={btnPrimary}>Send</button>
      </form>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Audit</h2>
      <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
        {audit.map((a, i) => (
          <li key={i}>
            {a.action} · {new Date(a.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
