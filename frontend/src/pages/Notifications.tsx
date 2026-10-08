import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type N = { id: string; type: string; taskId: string | null; readAt: string | null; createdAt: string };

export function Notifications() {
  const [data, setData] = useState<{ items: N[]; unread: number } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await api<{ items: N[]; unread: number }>("/api/notifications");
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function read(id?: string) {
    await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ id }) });
    await load();
  }

  function getNotificationMeta(type: string) {
    const t = type.toUpperCase();
    if (t.includes("MENTION")) {
      return { icon: "💬", color: "bg-purple-50 text-purple-700 ring-purple-200", label: "Mentioned you" };
    }
    if (t.includes("ASSIGN")) {
      return { icon: "👤", color: "bg-blue-50 text-blue-700 ring-blue-200", label: "Task Assignment" };
    }
    if (t.includes("DUE") || t.includes("OVERDUE")) {
      return { icon: "⏰", color: "bg-rose-50 text-rose-700 ring-rose-200", label: "Deadline Alert" };
    }
    if (t.includes("FINISH") || t.includes("COMPLETE")) {
      return { icon: "✓", color: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Task Completed" };
    }
    return { icon: "🔔", color: "bg-slate-50 text-slate-700 ring-slate-200", label: t.replaceAll("_", " ") };
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="h-8 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-white shadow-xs" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
            {data && data.unread > 0 ? (
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {data.unread} unread
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                All caught up
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Live operational alerts, mentions, and assignment changes.</p>
        </div>

        {data && data.unread > 0 && (
          <button
            onClick={() => void read()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <span>✓</span> Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-xs backdrop-blur-xs">
        {data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-3xl mb-2">🎉</span>
            <p className="text-sm font-semibold text-slate-700">Inbox zero</p>
            <p className="mt-1 text-xs text-slate-400">You don't have any notifications right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data?.items.map((n) => {
              const meta = getNotificationMeta(n.type);
              const isUnread = !n.readAt;
              return (
                <li
                  key={n.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 transition ${
                    isUnread ? "bg-indigo-50/40" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${meta.color}`}
                    >
                      {meta.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{meta.label}</span>
                        {isUnread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {n.type.replaceAll("_", " ")}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {n.taskId && (
                      <Link
                        to={`/tasks/${n.taskId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                      >
                        View Task →
                      </Link>
                    )}
                    {isUnread && (
                      <button
                        onClick={() => void read(n.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
