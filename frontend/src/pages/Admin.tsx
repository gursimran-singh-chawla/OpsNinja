import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { btn, btnPrimary, field } from "../ui";

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

  async function load() {
    try {
      const [metrics, users] = await Promise.all([api<Metrics>("/api/platform/metrics"), api<Person[]>("/api/users")]);
      setM(metrics);
      setPeople(users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
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
    const fd = new FormData(e.currentTarget);
    setErr(null);
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
      e.currentTarget.reset();
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  const managers = people.filter((p) => p.role === "manager");
  if (!m && !err) return <div className="h-32 animate-pulse rounded-xl bg-white" />;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform</h1>
      <p className="text-sm text-muted">System metrics and people. Task titles and comments are never shown here.</p>
      {err ? <p className="mt-3 text-sm text-due">{err}</p> : null}
      {m ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Card label="Users" value={m.users} />
          <Card label="Active sessions" value={m.activeSessions} />
          <Card label="Audit events" value={m.auditEvents} />
          <Card label="Roles" value={m.byRole.length} />
        </div>
      ) : null}
      {m ? (
        <ul className="mt-4 text-sm text-muted">
          {m.byRole.map((r) => (
            <li key={r.role}>
              {r.role}: {r._count}
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="mt-10 text-lg font-semibold">Onboard user</h2>
      <form onSubmit={(e) => void onboard(e)} className="mt-3 grid gap-3 rounded-xl border border-border bg-elevated p-4 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Name
          <input name="name" required className={field} />
        </label>
        <label className="text-xs text-muted">
          Email
          <input name="email" type="email" required className={field} />
        </label>
        <label className="text-xs text-muted">
          Temporary password
          <input name="password" minLength={8} required className={field} />
        </label>
        <label className="text-xs text-muted">
          Role
          <select name="role" className={field}>
            <option value="associate">Associate</option>
            <option value="manager">Manager</option>
            <option value="lead">Lead</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          Reports to (manager)
          <select name="reportsToId" className={field}>
            <option value="">None</option>
            {managers.map((mgr) => (
              <option key={mgr.id} value={mgr.id}>
                {mgr.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button className={btnPrimary}>Create account</button>
        </div>
      </form>

      <h2 className="mt-10 text-lg font-semibold">Directory</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-elevated">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Reports to</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {p.name}
                  <div className="text-xs text-muted">{p.email}</div>
                </td>
                <td className="px-3 py-2">
                  <select className={field + " mt-0"} value={p.role} onChange={(e) => void patch(p.id, { role: e.target.value })}>
                    {["admin", "lead", "manager", "associate"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={field + " mt-0"}
                    value={p.reportsToId ?? ""}
                    onChange={(e) => void patch(p.id, { reportsToId: e.target.value || null })}
                  >
                    <option value="">None</option>
                    {managers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>
                        {mgr.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button className={btn} onClick={() => void patch(p.id, { deactivated: !p.deactivatedAt })}>
                    {p.deactivatedAt ? "Reactivate" : "Offboard"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
}
