import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { btn, field, formatVisibility, isOverdue } from "../ui";

type TaskRow = {
  id: string;
  title: string;
  category: string;
  workKind: string;
  priority: string;
  dueAt: string | null;
  visibilityType: string;
  visibilityManager: { name: string } | null;
  finishedAt: string | null;
  archivedAt: string | null;
  createdBy: { name: string };
  assignee: { id: string; name: string } | null;
};

export function List() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [visibility, setVisibility] = useState(params.get("visibility") ?? "");
  const [err, setErr] = useState<string | null>(null);

  function load() {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (visibility) sp.set("visibility", visibility);
    if (params.get("overdue") === "true") sp.set("overdue", "true");
    if (params.get("unassigned") === "true") sp.set("unassigned", "true");
    if (params.get("finished") === "true") sp.set("finished", "true");
    api<TaskRow[]>(`/api/tasks?${sp}`)
      .then((data) => {
        if (params.get("mine") === "1" && user) {
          setRows(data.filter((t) => t.assignee?.id === user.id));
        } else setRows(data);
      })
      .catch((e: Error) => setErr(e.message));
  }

  useEffect(() => {
    load();
  }, [params.toString()]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold">List</h1>
        <p className="text-sm text-muted">Filter by visibility. Assignment is shown separately from who can see the task.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input placeholder="Search title or description" className={field + " mt-0"} value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className={field + " mt-0 w-auto"}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="">All visibilities</option>
          <option value="GLOBAL">Global</option>
          <option value="TEAM">Team</option>
          <option value="DIRECT">Direct</option>
        </select>
        <button
          className={btn}
          onClick={() => {
            const next = new URLSearchParams(params);
            if (q) next.set("q", q);
            else next.delete("q");
            if (visibility) next.set("visibility", visibility);
            else next.delete("visibility");
            setParams(next);
          }}
        >
          Apply
        </button>
      </div>
      {err ? <p className="mt-3 text-sm text-due">{err}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-elevated">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Deadline</th>
              <th className="px-3 py-2">Created by</th>
              <th className="px-3 py-2">Visible</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">State</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((t) => {
              const due = isOverdue(t);
              return (
                <tr key={t.id} className="border-t border-border hover:bg-teal-50/60">
                  <td className="px-3 py-3">
                    <Link to={`/tasks/${t.id}`} className="font-medium hover:text-accent">
                      {due ? <span className="mr-2 text-due">Due</span> : null}
                      {t.title}
                    </Link>
                    <div className="text-xs capitalize text-muted">{t.category}</div>
                  </td>
                  <td className="px-3 py-3 capitalize text-muted">{t.workKind}</td>
                  <td className="px-3 py-3 capitalize">{t.priority}</td>
                  <td className="px-3 py-3 text-muted">{t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</td>
                  <td className="px-3 py-3 text-muted">{t.createdBy.name}</td>
                  <td className="px-3 py-3 text-muted">{formatVisibility(t)}</td>
                  <td className="px-3 py-3 text-muted">{t.assignee?.name ?? "Unassigned"}</td>
                  <td className="px-3 py-3 text-muted">
                    {t.archivedAt ? "Archived" : t.finishedAt ? "Complete" : due ? "Due" : "Open"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows && rows.length === 0 ? <p className="p-6 text-sm text-muted">No tasks match.</p> : null}
      </div>
    </div>
  );
}
