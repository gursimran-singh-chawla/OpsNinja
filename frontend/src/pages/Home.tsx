import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Dash = { open: number; redFlags: number; unassigned: number; finished: number; mine: number };

export function Home() {
  const { user } = useAuth();
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "admin") return;
    api<Dash>("/api/cases/dashboard")
      .then(setD)
      .catch((e: Error) => setErr(e.message));
  }, [user]);

  if (user?.role === "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Platform</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          You manage people, roles, and usage. Operational case text is not in your queue. Open Platform for aggregates.
        </p>
        <Link to="/admin" className="mt-4 inline-block text-sm text-amber-500">
          Open platform metrics →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {user?.role === "lead" ? "Operations command" : user?.role === "manager" ? "Team operations" : "My work"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Created, visible, and assigned are three different facts.</p>
      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}
      {!d ? (
        <div className="mt-6 h-24 animate-pulse bg-zinc-900" />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Open", d.open],
            ["Red flags", d.redFlags],
            ["Unassigned", d.unassigned],
            ["Assigned to me", d.mine],
            ["Finished (active board)", d.finished],
          ].map(([l, n]) => (
            <div key={String(l)} className="border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">{l}</div>
              <div className="mt-2 text-3xl font-semibold">{n}</div>
            </div>
          ))}
        </div>
      )}
      <Link to="/cases" className="mt-8 inline-block text-sm text-amber-500">
        Open cases →
      </Link>
    </div>
  );
}
