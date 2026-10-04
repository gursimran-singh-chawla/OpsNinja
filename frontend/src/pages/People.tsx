import { useEffect, useState } from "react";
import { api } from "../api";

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

  useEffect(() => {
    api<Person[]>("/api/users")
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const managers = rows.filter((r) => r.role === "manager");

  return (
    <div>
      <h1 className="text-2xl font-semibold">People</h1>
      <p className="text-sm text-muted">Associates with no manager are free agents.</p>
      {err ? <p className="text-due">{err}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-elevated">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Reports to</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-teal-50/60">
                <td className="px-3 py-2">
                  {p.name}
                  <div className="text-xs text-muted">{p.email}</div>
                </td>
                <td className="px-3 py-2 capitalize">{p.role}</td>
                <td className="px-3 py-2 text-muted">
                  {p.role === "associate" && !p.reportsToId
                    ? "Free agent"
                    : managers.find((m) => m.id === p.reportsToId)?.name ?? "—"}
                </td>
                <td className="px-3 py-2">{p.deactivatedAt ? "Deactivated" : "Active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
