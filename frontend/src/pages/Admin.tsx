import { useEffect, useState } from "react";
import { api } from "../api";

type Metrics = {
  users: number;
  byRole: { role: string; _count: number }[];
  activeSessions: number;
  cases: { total: number; open: number; finished: number; archived: number };
  flags: { key: string; enabled: boolean }[];
};

export function Admin() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Metrics>("/api/platform/metrics")
      .then(setM)
      .catch((e: Error) => setErr(e.message));
  }, []);
  if (err) return <p className="text-red-400">{err}</p>;
  if (!m) return <div className="h-32 animate-pulse bg-zinc-900" />;
  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform</h1>
      <p className="text-sm text-zinc-500">Counts only. Case titles and comments are not listed here.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card label="Users" value={m.users} />
        <Card label="Active sessions" value={m.activeSessions} />
        <Card label="Open cases (count)" value={m.cases.open} />
      </div>
      <h2 className="mt-8 text-sm uppercase text-zinc-500">By role</h2>
      <ul className="mt-2 text-sm">
        {m.byRole.map((r) => (
          <li key={r.role}>
            {r.role}: {r._count}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-sm uppercase text-zinc-500">Feature flags</h2>
      <ul className="mt-2 text-sm">
        {m.flags.map((f) => (
          <li key={f.key}>
            {f.key}: {f.enabled ? "on" : "off"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-800 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  );
}
