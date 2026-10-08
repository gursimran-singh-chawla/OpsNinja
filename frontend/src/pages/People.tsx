import { useEffect, useState } from "react";
import { api } from "../api";
import { roleBadgeClass } from "../ui";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  reportsToId: string | null;
  deactivatedAt: string | null;
};

export function People() {
  const [rows, setRows] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Person[]>("/api/users")
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const managers = rows.filter((r) => r.role === "manager");
  const associates = rows.filter((r) => r.role === "associate");
  const freeAgents = associates.filter((r) => !r.reportsToId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team Directory</h1>
          <p className="mt-1 text-xs text-slate-500">
            IG Incorporation organizational structure and operational hierarchy.
          </p>
        </div>

        {/* Quick summary chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 font-medium text-slate-600 shadow-2xs">
            Total: <strong className="text-slate-900">{rows.length}</strong>
          </span>
          <span className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 font-medium text-slate-600 shadow-2xs">
            Managers: <strong className="text-slate-900">{managers.length}</strong>
          </span>
          <span className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 font-medium text-slate-600 shadow-2xs">
            Associates: <strong className="text-slate-900">{associates.length}</strong>
          </span>
          <span className="rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1 font-medium text-amber-800 shadow-2xs">
            Free Agents: <strong>{freeAgents.length}</strong>
          </span>
        </div>
      </div>

      {/* Info notice about Free Agents */}
      <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3.5 text-xs text-sky-900 shadow-2xs">
        <span className="text-lg">ℹ️</span>
        <div>
          <span className="font-semibold">Operational Policy:</span> Associates without an assigned manager are <strong>Free Agents</strong> and can be assigned to tasks by any authorized Lead or Manager.
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {err}
        </div>
      )}

      {/* Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-xs backdrop-blur-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Reporting Manager</th>
                <th className="px-5 py-3 text-right">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Loading directory...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">No members found.</td>
                </tr>
              ) : (
                rows.map((p) => {
                  const manager = managers.find((m) => m.id === p.reportsToId);
                  const isFreeAgent = p.role === "associate" && !p.reportsToId;

                  return (
                    <tr key={p.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 ring-1 ring-slate-200 text-xs">
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-400">{p.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={roleBadgeClass(p.role)}>{p.role}</span>
                      </td>

                      <td className="px-5 py-3.5">
                        {isFreeAgent ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                            Free Agent
                          </span>
                        ) : manager ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <span className="text-slate-400">↳</span> {manager.name}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {p.deactivatedAt ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Deactivated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
