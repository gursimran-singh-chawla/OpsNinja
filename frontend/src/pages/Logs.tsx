import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { roleBadgeClass } from "../ui";

type TaskActivityItem = {
  id: string;
  action: "task.created" | "task.assigned" | "task.completed";
  entityType: "task";
  entityId: string;
  task: {
    id: string;
    title: string;
    boardColumn: string;
    finishedAt: string | null;
  };
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  assignee?: {
    id: string;
    name: string;
    role: string;
  } | null;
  description: string;
  createdAt: string;
};

type SystemAuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  metadata: Record<string, unknown> | null;
  description: string;
  createdAt: string;
};

export function Logs() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [taskLogs, setTaskLogs] = useState<TaskActivityItem[]>([]);
  const [adminLogs, setAdminLogs] = useState<SystemAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setErr(null);
    try {
      if (isAdmin) {
        const data = await api<SystemAuditItem[]>("/api/platform/logs?limit=100");
        setAdminLogs(data);
      } else {
        const data = await api<TaskActivityItem[]>("/api/platform/logs?limit=100");
        setTaskLogs(data);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [isAdmin]);

  // Regular users view filter
  const filteredTaskLogs = taskLogs.filter((log) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      log.task.title.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.actor?.name.toLowerCase().includes(q) ||
      log.actor?.email.toLowerCase().includes(q);

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  // Admin users view filter
  const filteredAdminLogs = adminLogs.filter((log) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q) ||
      log.actor?.name.toLowerCase().includes(q) ||
      log.actor?.email.toLowerCase().includes(q);

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  function taskActionBadge(action: string) {
    switch (action) {
      case "task.created":
        return { label: "Created", class: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "task.assigned":
        return { label: "Assigned", class: "bg-sky-50 text-sky-700 border-sky-200" };
      case "task.completed":
        return { label: "Completed", class: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      default:
        return { label: action, class: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  }

  function adminActionBadge(action: string) {
    if (action.includes("approved") || action.includes("verified")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (action.includes("deactivated") || action.includes("revoked")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (action.includes("created") || action.includes("onboarded")) {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isAdmin ? "System & Account Audit Logs" : "Task Activity Logs"}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isAdmin ? "bg-slate-900 text-white" : "bg-indigo-600 text-white"
              }`}
            >
              {isAdmin ? "Platform Audit" : "Task Feed"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin
              ? "Chronological audit trail of user lifecycle events, administrative management actions, and security operations."
              : "Recent task creations, assignments, and completions for tasks within your authorized operational scope."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLogs()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {err}
        </div>
      )}

      {/* Metric Summary Cards */}
      {isAdmin ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total System Events</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{adminLogs.length}</div>
            </div>
            <div className="text-2xl">🛡️</div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Account Approvals</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                {adminLogs.filter((l) => l.action === "user.approved").length}
              </div>
            </div>
            <div className="text-2xl">✅</div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Registrations & OTP</div>
              <div className="mt-1 text-2xl font-extrabold text-indigo-700">
                {adminLogs.filter((l) => l.action === "user.created" || l.action === "user.email_verified").length}
              </div>
            </div>
            <div className="text-2xl">👥</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Activities</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{taskLogs.length}</div>
            </div>
            <div className="text-2xl">📋</div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tasks Created</div>
              <div className="mt-1 text-2xl font-extrabold text-indigo-700">
                {taskLogs.filter((l) => l.action === "task.created").length}
              </div>
            </div>
            <div className="text-2xl">📝</div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tasks Assigned</div>
              <div className="mt-1 text-2xl font-extrabold text-sky-700">
                {taskLogs.filter((l) => l.action === "task.assigned").length}
              </div>
            </div>
            <div className="text-2xl">👤</div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tasks Completed</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                {taskLogs.filter((l) => l.action === "task.completed").length}
              </div>
            </div>
            <div className="text-2xl">✅</div>
          </div>
        </div>
      )}

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
                placeholder={
                  isAdmin
                    ? "Search system logs by action, actor name, email, or entity ID..."
                    : "Search activity by task title, actor name, or email..."
                }
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

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {isAdmin ? (
                  <>
                    <option value="all">All System Events</option>
                    <option value="user.created">User Registered</option>
                    <option value="user.email_verified">Email Verified</option>
                    <option value="user.approved">Account Approved</option>
                    <option value="user.approval_revoked">Approval Revoked</option>
                    <option value="user.deactivated">User Deactivated</option>
                    <option value="user.updated">User Updated</option>
                    <option value="user.onboarded">User Onboarded</option>
                  </>
                ) : (
                  <>
                    <option value="all">All Permitted Events</option>
                    <option value="task.created">Task Created</option>
                    <option value="task.assigned">Task Assigned</option>
                    <option value="task.completed">Task Completed</option>
                  </>
                )}
              </select>

              {(search || actionFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActionFilter("all");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow-2xs transition hover:bg-slate-50 hover:text-slate-800"
                >
                  Reset
                </button>
              )}

              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                {isAdmin
                  ? `${filteredAdminLogs.length} event${filteredAdminLogs.length === 1 ? "" : "s"}`
                  : `${filteredTaskLogs.length} event${filteredTaskLogs.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
        </div>

        {/* Regular Users: Task Activity View */}
        {!isAdmin && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Activity Description</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3 text-right">Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                      <div>Loading task activity logs...</div>
                    </td>
                  </tr>
                ) : filteredTaskLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        📋
                      </div>
                      <div className="text-xs font-semibold text-slate-800">No task activity events match your filter</div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Only task created, assigned, and completed events for your authorized tasks are displayed.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTaskLogs.map((log) => {
                    const date = new Date(log.createdAt);
                    const badge = taskActionBadge(log.action);

                    return (
                      <tr key={log.id} className="transition hover:bg-slate-50/80">
                        {/* Timestamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          <div>
                            {date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-slate-400 text-[10px]">{date.toLocaleTimeString()}</div>
                        </td>

                        {/* Event Badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${badge.class}`}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Activity Description */}
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-800 text-xs">
                            {log.description}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Status: <span className="font-semibold text-slate-600">{log.task.boardColumn}</span>
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {log.actor ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700 ring-1 ring-indigo-200 text-[11px]">
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
                            <span className="text-slate-400 italic">System</span>
                          )}
                        </td>

                        {/* Open Task Link */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            to="/tasks"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <span>Open task</span>
                            <span>→</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Administrators: System Audit View */}
        {isAdmin && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Target Entity</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                      <div>Loading system audit logs...</div>
                    </td>
                  </tr>
                ) : filteredAdminLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        🔍
                      </div>
                      <div className="text-xs font-semibold text-slate-800">No system audit log events match your filter</div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Try searching with different terms or selecting &ldquo;All System Events&rdquo;.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAdminLogs.map((log) => {
                    const date = new Date(log.createdAt);
                    const isExpanded = expandedId === log.id;
                    const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;

                    return (
                      <tr key={log.id} className="transition hover:bg-slate-50/80">
                        {/* Timestamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          <div>
                            {date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-slate-400 text-[10px]">{date.toLocaleTimeString()}</div>
                        </td>

                        {/* Action Badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${adminActionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="px-5 py-3.5 font-medium text-slate-800 text-xs">
                          {log.description}
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
                            <span className="text-slate-400 italic">System</span>
                          )}
                        </td>

                        {/* Target Entity */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              {log.entityType}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 max-w-[120px] truncate" title={log.entityId}>
                              {log.entityId}
                            </span>
                          </div>
                        </td>

                        {/* Details / Sanitized Metadata */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
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
        )}
      </section>
    </div>
  );
}
