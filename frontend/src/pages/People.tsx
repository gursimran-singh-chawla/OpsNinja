import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  reportsToId: string | null;
  deactivatedAt: string | null;
};

export function People() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Person[]>("/api/users")
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  }, []);

  async function patch(id: string, body: object) {
    await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setRows(await api<Person[]>("/api/users"));
  }

  const managers = rows.filter((r) => r.role === "manager");

  return (
    <div>
      <h1 className="text-2xl font-semibold">People</h1>
      <p className="text-sm text-zinc-500">Associates with no manager are free agents.</p>
      {err ? <p className="text-red-400">{err}</p> : null}
      <div className="mt-4 overflow-x-auto border border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Reports to</th>
              <th className="px-3 py-2">Status</th>
              {user?.role === "admin" ? <th className="px-3 py-2">Admin</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-zinc-800">
                <td className="px-3 py-2">
                  {p.name}
                  <div className="text-xs text-zinc-500">{p.email}</div>
                </td>
                <td className="px-3 py-2 capitalize">{p.role}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {p.role === "associate" && !p.reportsToId
                    ? "Free agent"
                    : managers.find((m) => m.id === p.reportsToId)?.name ?? "—"}
                </td>
                <td className="px-3 py-2">{p.deactivatedAt ? "Deactivated" : "Active"}</td>
                {user?.role === "admin" ? (
                  <td className="px-3 py-2">
                    <select
                      className="bg-zinc-900 text-xs"
                      value={p.reportsToId ?? ""}
                      onChange={(e) => void patch(p.id, { reportsToId: e.target.value || null })}
                    >
                      <option value="">No manager</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
