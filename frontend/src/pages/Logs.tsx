import { useEffect, useState } from "react";
import { api } from "../api";
import { roleBadgeClass } from "../ui";

type AuditLogEvent = {
  id: string;
  actorId: string | null;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export function Logs() {
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api<AuditLogEvent[]>("/api/platform/logs?limit=150");
      setLogs(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q) ||
      log.actor?.name.toLowerCase().includes(q) ||
      log.actor?.email.toLowerCase().includes(q);

    const matchesEntity = entityFilter === "all" || log.entityType === entityFilter;

    return matchesSearch && matchesEntity;
  });

  const userEventsCount = logs.filter((l) => l.entityType === "user").length;
  const taskEventsCount = logs.filter((l) => l.entityType === "task").length;

  function actionBadgeClass(action: string) {
    if (action.includes("approved") || action.includes("verified")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (action.includes("deactivated") || action.includes("offboarded") || action.includes("rejected")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (action.includes("created") || action.includes("onboarded")) {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    if (action.includes("assigned") || action.includes("updated")) {
      return "bg-sky-50 text-sky-700 border-sky-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Registered System Logs</h1>
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              Audit Trail
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Immutable chronological record of administrative actions, user lifecycle events, and system mutations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLogs()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          <span>{loading ? "Refreshing..." : "Refresh Logs"}</span>
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {err}
        </div>
      )}

      {/* Metric summary pills */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Audit Events</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{logs.length}</div>
          </div>
          <div className="text-2xl">📜</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">User Lifecycle Events</div>
            <div className="mt-1 text-2xl font-extrabold text-indigo-700">{userEventsCount}</div>
          </div>
          <div className="text-2xl">👥</div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Operational Events</div>
            <div className="mt-1 text-2xl font-extrabold text-sky-700">{taskEventsCount}</div>
          </div>
          <div className="text-2xl">⚡</div>
        </div>
      </div>

      {/* Main Logs Table Container */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-xs backdrop-blur-xs">
        {/* Search & Filter Bar */}
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs by action, actor name, email, or entity ID..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Entity Type Filter */}
            <div className="flex items-center gap-2">
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Entity Types</option>
                <option value="user">User Events</option>
                <option value="task">Task Events</option>
              </select>

              {(search || entityFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setEntityFilter("all");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow-2xs transition hover:bg-slate-50 hover:text-slate-800"
                >
                  Reset
                </button>
              )}

              <span className="text-xs text-slate-400 font-medium">
                {filteredLogs.length} event{filteredLogs.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                    <div>Loading system audit logs...</div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      🔍
                    </div>
                    <div className="text-xs font-semibold text-slate-800">No audit log events match your filter</div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Try searching with different terms or selecting &ldquo;All Entity Types&rdquo;.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const isExpanded = expandedId === log.id;
                  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;

                  return (
                    <tr key={log.id} className="transition hover:bg-slate-50/80">
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        <div>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                        <div className="text-slate-400 text-[10px]">{date.toLocaleTimeString()}</div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${actionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {log.actor ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 ring-1 ring-slate-200 text-[11px]">
                              {log.actor.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">{log.actor.name}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <span>{log.actor.email}</span>
                                <span className={roleBadgeClass(log.actor.role)}>{log.actor.role}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">System / Anonymous</span>
                        )}
                      </td>

                      {/* Entity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            {log.entityType}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={log.entityId}>
                            {log.entityId}
                          </span>
                        </div>
                      </td>

                      {/* Details / Metadata */}
                      <td className="px-5 py-3.5 text-right">
                        {hasMeta ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                            >
                              {isExpanded ? "Hide payload ▲" : "View payload ▼"}
                            </button>
                            {isExpanded && (
                              <pre className="mt-2 text-left font-mono text-[10px] bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto max-w-sm sm:max-w-md shadow-xs">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
