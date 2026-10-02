import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

type Detail = {
  id: string;
  title: string;
  description: string;
  category: string;
  visibilityType: string;
  redFlag: boolean;
  finishedAt: string | null;
  archivedAt: string | null;
  createdBy: { name: string; role: string };
  assignee: { name: string } | null;
  assignedBy: { name: string } | null;
  visibilityManager: { name: string } | null;
  comments: { id: string; body: string; createdAt: string; author: { name: string } }[];
};

export function CaseDetail() {
  const { id } = useParams();
  const [c, setC] = useState<Detail | null>(null);
  const [audit, setAudit] = useState<{ action: string; createdAt: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      const [d, a] = await Promise.all([api<Detail>(`/api/cases/${id}`), api<{ action: string; createdAt: string }[]>(`/api/cases/${id}/audit`)]);
      setC(d);
      setAudit(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function act(path: string, body: object) {
    setErr(null);
    try {
      await api(`/api/cases/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
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

  if (!c && !err) return <div className="h-40 animate-pulse bg-zinc-900" />;
  if (!c) return <p className="text-red-400">{err}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">{c.category}</div>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
        </div>
        {c.redFlag ? <span className="border border-red-500/40 px-2 py-1 text-xs text-red-400">Red flag</span> : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-300">{c.description}</p>
      <dl className="mt-6 grid gap-3 border border-zinc-800 bg-zinc-900/40 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-500">Created by</dt>
          <dd>
            {c.createdBy.name} ({c.createdBy.role})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Who can see this</dt>
          <dd>
            {c.visibilityType}
            {c.visibilityManager ? ` · ${c.visibilityManager.name}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Responsible</dt>
          <dd>
            {c.assignee?.name ?? "Unassigned"}
            {c.assignedBy ? ` · assigned by ${c.assignedBy.name}` : ""}
          </dd>
        </div>
      </dl>
      {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="border border-zinc-700 px-3 py-1.5 text-xs" onClick={() => void act("red-flag", { redFlag: !c.redFlag })}>
          {c.redFlag ? "Clear flag" : "Red flag"}
        </button>
        <button className="border border-zinc-700 px-3 py-1.5 text-xs" onClick={() => void act("finish", { finished: !c.finishedAt })}>
          {c.finishedAt ? "Reopen" : "Finish"}
        </button>
        <button
          className="border border-zinc-700 px-3 py-1.5 text-xs"
          onClick={() => {
            if (confirm("Archive removes this case from the live queue. History is kept.")) {
              void act("archive", { archived: !c.archivedAt });
            }
          }}
        >
          {c.archivedAt ? "Unarchive" : "Archive"}
        </button>
      </div>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">Discussion</h2>
      <ul className="mt-3 space-y-3">
        {c.comments.map((cm) => (
          <li key={cm.id} className="border-l-2 border-zinc-800 pl-3 text-sm">
            <div className="text-xs text-zinc-500">
              {cm.author.name} · {new Date(cm.createdAt).toLocaleString()}
            </div>
            {cm.body}
          </li>
        ))}
      </ul>
      <form className="mt-4 flex gap-2" onSubmit={(e) => void comment(e)}>
        <input name="body" required placeholder="Comment — use @Name to mention" className="flex-1 border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        <button className="bg-zinc-100 px-3 py-2 text-sm text-zinc-950">Send</button>
      </form>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">Audit</h2>
      <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-500">
        {audit.map((a, i) => (
          <li key={i}>
            {a.action} · {new Date(a.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
