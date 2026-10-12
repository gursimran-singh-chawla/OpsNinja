import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { btn, btnPrimary, field, roleBadgeClass } from "../ui";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  reportsToId: string | null;
  deactivatedAt: string | null;
  approvedAt: string | null;
  emailVerifiedAt: string | null;
};

type Metrics = {
  users: number;
  byRole: { role: string; _count: number }[];
  activeSessions: number;
  flags: { key: string; enabled: boolean }[];
  auditEvents: number;
};

export function Admin() {
  const navigate = useNavigate();
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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  const managers = people.filter((p) => p.role === "manager");
  const pendingUsers = people.filter((p) => !p.approvedAt);
  const pendingCount = pendingUsers.length;

  const filteredPeople = people.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q);
    const matchesRole =
      selectedRole === "all"
        ? true
        : selectedRole === "pending"
        ? !p.approvedAt
        : p.role === selectedRole;
    return matchesSearch && matchesRole;
  });

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
          <StatCard
            label="Registered Users"
            value={m.users}
            icon="👥"
            sub="Click to view all users"
            onClick={() => setSelectedRole("all")}
          />
          <StatCard label="Active Sessions" value={m.activeSessions} icon="⚡" sub="Logged-in users" />
          <StatCard
            label="Audit Log Events"
            value={m.auditEvents}
            icon="📜"
            sub="Click to view system logs"
            onClick={() => navigate("/logs")}
          />
          <StatCard label="Configured Roles" value={m.byRole.length} icon="🛡️" sub="RBAC hierarchy" />
        </div>
      )}

      {/* Role Distribution Pills - Interactive Filter Buttons */}
      {m && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-white/70 p-3 text-xs shadow-2xs backdrop-blur-xs">
          <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
            <span>Filter by Role:</span>
          </span>

          {/* All Users button */}
          <button
            type="button"
            onClick={() => setSelectedRole("all")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition cursor-pointer active:scale-95 ${
              selectedRole === "all"
                ? "border-indigo-500 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-400/50 shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
            }`}
          >
            <span>All Users</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                selectedRole === "all" ? "bg-indigo-200 text-indigo-900" : "bg-slate-100 text-slate-700"
              }`}
            >
              {m.users}
            </span>
            {selectedRole === "all" && <span className="text-indigo-600 text-xs">✓</span>}
          </button>

          {/* Dynamic Role buttons: associate, lead, manager, admin */}
          {m.byRole.map((r) => {
            const isSelected = selectedRole === r.role;
            return (
              <button
                key={r.role}
                type="button"
                onClick={() => setSelectedRole(isSelected ? "all" : r.role)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition cursor-pointer active:scale-95 capitalize ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-400/50 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                }`}
                title={`Click to view only ${r.role}s (${r._count} total)`}
              >
                <span className={roleBadgeClass(r.role)}>{r.role}</span>
                <strong className={isSelected ? "text-indigo-950 font-bold" : "text-slate-900"}>{r._count}</strong>
                {isSelected && <span className="text-indigo-600 text-xs">✓</span>}
              </button>
            );
          })}

          {/* Pending Approval Filter Button if any */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedRole(selectedRole === "pending" ? "all" : "pending")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition cursor-pointer active:scale-95 ${
                selectedRole === "pending"
                  ? "border-amber-500 bg-amber-100 text-amber-900 font-bold ring-2 ring-amber-400/50 shadow-xs"
                  : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 shadow-2xs"
              }`}
              title="Click to view accounts waiting for approval"
            >
              <span>⏳ Pending</span>
              <strong className="text-amber-900">{pendingCount}</strong>
              {selectedRole === "pending" && <span className="text-amber-700 text-xs">✓</span>}
            </button>
          )}

          {/* Clear filter indicator button */}
          {selectedRole !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedRole("all")}
              className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
            >
              Reset filter
            </button>
          )}
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

      {/* Pending Account Approvals Notice */}
      {pendingCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-base shadow-xs">
              ⏳
            </span>
            <div>
              <div className="font-bold text-amber-950">
                {pendingCount} Account{pendingCount > 1 ? "s" : ""} Waiting for Administrator Approval
              </div>
              <div className="text-[11px] text-amber-800">
                Self-registered accounts must be verified and approved by admin before they can log in.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedRole("pending")}
            className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-3.5 py-1.5 font-semibold text-white shadow-2xs transition hover:bg-amber-700"
          >
            Review Pending ({pendingCount})
          </button>
        </div>
      )}

      {/* User Directory Management */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-xs backdrop-blur-xs">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">User Lifecycle & Permissions</h2>
              <p className="text-xs text-slate-400">Modify live roles, manager reporting lines, or deactivate accounts.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                {searchTerm || selectedRole !== "all" ? (
                  <>
                    Showing <strong className="text-slate-900">{filteredPeople.length}</strong> of {people.length} users
                  </>
                ) : (
                  <>
                    Total: <strong className="text-slate-900">{people.length}</strong> users
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Search and Role Filter Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users by name or email ID..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter by Role */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Role:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                {pendingCount > 0 && (
                  <option value="pending">⚠️ Pending Approval ({pendingCount})</option>
                )}
                <option value="admin">Admin</option>
                <option value="lead">Lead</option>
                <option value="manager">Manager</option>
                <option value="associate">Associate</option>
              </select>

              {(searchTerm || selectedRole !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedRole("all");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow-2xs transition hover:bg-slate-50 hover:text-slate-800"
                  title="Reset all filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Reporting Line</th>
                <th className="px-5 py-3">Account Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">No users match your search</div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      No results found for &ldquo;{searchTerm}&rdquo;{selectedRole !== "all" ? ` with role "${selectedRole}"` : ""}. Try a different name, email, or role filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedRole("all");
                      }}
                      className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50"
                    >
                      Clear search
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPeople.map((p) => (
                  <tr key={p.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-3">
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
                    <td className="px-5 py-3">
                      {!p.approvedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300">
                          ⏳ Waiting Approval
                        </span>
                      ) : p.deactivatedAt ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                          Deactivated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Approved
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right space-x-1.5">
                      {!p.approvedAt && (
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer"
                          onClick={() => void patch(p.id, { approved: true })}
                          title="Verify and approve this account for login"
                        >
                          ✓ Approve ID
                        </button>
                      )}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  sub: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-xs backdrop-blur-xs text-left transition ${
        onClick
          ? "cursor-pointer hover:border-indigo-400 hover:shadow-sm hover:bg-slate-50/80 active:scale-[0.99] group"
          : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition">
          {label}
        </span>
        <span className="text-base group-hover:scale-110 transition">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
        <span>{sub}</span>
        {onClick && <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition">→</span>}
      </div>
    </Tag>
  );
}
