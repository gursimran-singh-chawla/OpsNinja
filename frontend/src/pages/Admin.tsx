import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { btn, btnPrimary, field, roleBadgeClass } from "../ui";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  reportsToId: string | null;
  deactivatedAt: string | null;
};

type Metrics = {
  users: number;
  byRole: { role: string; _count: number }[];
  activeSessions: number;
  flags: { key: string; enabled: boolean }[];
  auditEvents: number;
};

export function Admin() {
  const [m, setM] = useState<Metrics | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [metrics, users] = await Promise.all([
        api<Metrics>("/api/platform/metrics"),
        api<Person[]>("/api/users"),
      ]);
      setM(metrics);
      setPeople(users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load platform data");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function patch(id: string, body: object) {
    await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load();
  }

  async function onboard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr(null);
    setBusy(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          password: fd.get("password"),
          role: fd.get("role"),
          reportsToId: fd.get("reportsToId") || null,
        }),
      });
      form.reset();
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to onboard user");
    } finally {
      setBusy(false);
    }
  }

  const managers = people.filter((p) => p.role === "manager");

  if (!m && !err) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-xs" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform Administration</h1>
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
            Root Control
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          User lifecycle, operational roles, and platform metrics. By design and policy, task content is strictly hidden from Admin.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {err}
        </div>
      )}

      {/* Metric Cards */}
      {m && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Registered Users" value={m.users} icon="👥" sub="Platform accounts" />
          <StatCard label="Active Sessions" value={m.activeSessions} icon="⚡" sub="Logged-in users" />
          <StatCard label="Audit Log Events" value={m.auditEvents} icon="📜" sub="Security & system logs" />
          <StatCard label="Configured Roles" value={m.byRole.length} icon="🛡️" sub="RBAC hierarchy" />
        </div>
      )}

      {/* Role Distribution Pills */}
      {m && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-white/70 p-3 text-xs shadow-2xs backdrop-blur-xs">
          <span className="font-semibold text-slate-700 mr-1">Role Distribution:</span>
          {m.byRole.map((r) => (
            <span
              key={r.role}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 shadow-2xs"
            >
              <span className={roleBadgeClass(r.role)}>{r.role}</span>
              <strong className="text-slate-900">{r._count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Onboard User Card */}
      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Provision New Team Member</h2>
          <p className="text-xs text-slate-400">Create an authenticated employee profile and assign their initial role.</p>
        </div>

        <form onSubmit={(e) => void onboard(e)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-700">
            Full Name
            <input name="name" required placeholder="e.g. Alex Morgan" className={field} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Work Email
            <input name="email" type="email" required placeholder="alex@igincorporation.example" className={field} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Temporary Password
            <input name="password" minLength={8} required placeholder="At least 8 characters" className={field} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Operational Role
            <select name="role" defaultValue="associate" className={field}>
              <option value="associate">Associate (Frontline execution)</option>
              <option value="manager">Manager (Team lead & assignment)</option>
              <option value="lead">Lead (Org-wide operations)</option>
              <option value="admin">Admin (Platform management)</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-700 sm:col-span-2">
            Reports to Manager (optional for Free Agents)
            <select name="reportsToId" className={field}>
              <option value="">None (Free Agent if Associate)</option>
              {managers.map((mgr) => (
                <option key={mgr.id} value={mgr.id}>
                  {mgr.name}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <button disabled={busy} className={btnPrimary}>
              {busy ? "Provisioning..." : "Create Account"}
            </button>
          </div>
        </form>
      </section>

      {/* User Directory Management */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-xs backdrop-blur-xs">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-bold text-slate-900">User Lifecycle & Permissions</h2>
          <p className="text-xs text-slate-400">Modify live roles, manager reporting lines, or deactivate accounts.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Reporting Line</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => (
                <tr key={p.id} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                      value={p.role}
                      onChange={(e) => void patch(p.id, { role: e.target.value })}
                    >
                      {["admin", "lead", "manager", "associate"].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                      value={p.reportsToId ?? ""}
                      onChange={(e) => void patch(p.id, { reportsToId: e.target.value || null })}
                    >
                      <option value="">None (Free Agent)</option>
                      {managers.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold shadow-2xs transition ${
                        p.deactivatedAt
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                      }`}
                      onClick={() => void patch(p.id, { deactivated: !p.deactivatedAt })}
                    >
                      {p.deactivatedAt ? "Reactivate" : "Offboard"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon, sub }: { label: string; value: number; icon: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-xs backdrop-blur-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
