import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { btn, btnPrimary, field, formatVisibility, isOverdue, priorityBadgeClass } from "../ui";

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

function userInitials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

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

  const activeFilterCount =
    (params.get("overdue") ? 1 : 0) +
    (params.get("unassigned") ? 1 : 0) +
    (params.get("finished") ? 1 : 0) +
    (params.get("mine") ? 1 : 0) +
    (visibility ? 1 : 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Task Inventory</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            All tasks across IG Incorporation operations scoped by your role and visibility authority.
          </p>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setVisibility("");
              setParams(new URLSearchParams());
            }}
            className="text-xs font-medium text-brand hover:underline self-start sm:self-auto cursor-pointer"
          >
            Clear active filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white p-3 rounded-2xl border border-border shadow-2xs">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted text-xs pointer-events-none">
            🔍
          </span>
          <input
            placeholder="Search by title, description or keyword…"
            className={`${field} mt-0 pl-8 w-full border-slate-200/90`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = new URLSearchParams(params);
                if (q) next.set("q", q);
                else next.delete("q");
                setParams(next);
              }
            }}
          />
        </div>

        <select
          className={`${field} mt-0 w-full sm:w-44 border-slate-200/90 cursor-pointer`}
          value={visibility}
          onChange={(e) => {
            const v = e.target.value;
            setVisibility(v);
            const next = new URLSearchParams(params);
            if (v) next.set("visibility", v);
            else next.delete("visibility");
            setParams(next);
          }}
        >
          <option value="">All Visibilities</option>
          <option value="GLOBAL">Global (Everyone)</option>
          <option value="TEAM">Team Only</option>
          <option value="DIRECT">Direct Grants</option>
        </select>

        <button
          className={`${btnPrimary} shrink-0 px-4`}
          onClick={() => {
            const next = new URLSearchParams(params);
            if (q) next.set("q", q);
            else next.delete("q");
            if (visibility) next.set("visibility", visibility);
            else next.delete("visibility");
            setParams(next);
          }}
        >
          Apply Filter
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-due flex items-center gap-2">
          <span>⚠️</span>
          <span>{err}</span>
        </div>
      ) : null}

      {/* Data Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted/90">
              <tr>
                <th className="px-4 py-3">Task & Category</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Responsible</th>
                <th className="px-4 py-3">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows?.map((t) => {
                const due = isOverdue(t);
                const complete = !!t.finishedAt;
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <Link to={`/tasks/${t.id}`} className="block">
                        <div className="flex items-center gap-2">
                          {due && (
                            <span className="shrink-0 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              DUE
                            </span>
                          )}
                          <span className="font-semibold text-ink group-hover:text-brand transition-colors">
                            {t.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                          <span className="capitalize font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                            {t.category}
                          </span>
                          <span>•</span>
                          <span>by {t.createdBy.name}</span>
                        </div>
                      </Link>
                    </td>

                    <td className="px-4 py-3.5 text-xs capitalize text-muted font-medium">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                        {t.workKind}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs capitalize ${priorityBadgeClass(
                          t.priority,
                        )}`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-muted">
                      {t.dueAt ? (
                        <span className={due ? "text-rose-600 font-semibold" : ""}>
                          {new Date(t.dueAt).toLocaleDateString()}{" "}
                          <span className="text-[10px] text-muted">
                            {new Date(t.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-muted font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                        {formatVisibility(t)}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      {t.assignee ? (
                        <div className="flex items-center gap-1.5 text-ink font-medium">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                            {userInitials(t.assignee.name)}
                          </div>
                          <span>{t.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/80">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      {t.archivedAt ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          Archived
                        </span>
                      ) : complete ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700 border border-emerald-200">
                          Complete
                        </span>
                      ) : due ? (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700 border border-rose-200">
                          Due
                        </span>
                      ) : (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700 border border-indigo-200/60">
                          Open
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows && rows.length === 0 && (
          <div className="p-12 text-center">
            <span className="text-3xl">📭</span>
            <h3 className="mt-2 text-sm font-semibold text-ink">No tasks match your criteria</h3>
            <p className="mt-1 text-xs text-muted">Try resetting search filters or changing the visibility scope.</p>
          </div>
        )}

        {!rows && (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
