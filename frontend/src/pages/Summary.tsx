import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { CreateTaskMenu } from "../features/create/CreateTaskMenu";

type Card = { key: string; label: string; value: number; hint: string };
type Dash = {
  role: string;
  title: string;
  cards: Card[];
  chart: { complete: number; due: number; unassigned: number; assignedOpen: number };
};

const COLORS: Record<string, string> = {
  complete: "#0f766e",
  due: "#ea580c",
  unassigned: "#d97706",
  assignedOpen: "#64748b",
};

function Donut({ chart }: { chart: Dash["chart"] }) {
  const slices = [
    ["complete", "Complete", chart.complete],
    ["due", "Due", chart.due],
    ["unassigned", "Unassigned", chart.unassigned],
    ["assignedOpen", "Open (owned)", chart.assignedOpen],
  ] as const;
  const total = slices.reduce((s, x) => s + x[2], 0) || 1;
  let acc = 0;
  const segs = slices.map(([key, label, n]) => {
    const start = acc / total;
    acc += n;
    return { key, label, n, start, end: acc / total };
  });
  const describe = (start: number, end: number) => {
    const a0 = start * Math.PI;
    const a1 = end * Math.PI;
    const x0 = 80 + 70 * Math.cos(Math.PI - a0);
    const y0 = 80 - 70 * Math.sin(Math.PI - a0);
    const x1 = 80 + 70 * Math.cos(Math.PI - a1);
    const y1 = 80 - 70 * Math.sin(Math.PI - a1);
    const large = end - start > 0.5 ? 1 : 0;
    return `M ${x0} ${y0} A 70 70 0 ${large} 1 ${x1} ${y1}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 160 90" className="h-36 w-64">
        {segs.map((s) =>
          s.n ? (
            <path
              key={s.key}
              d={describe(s.start, s.end)}
              fill="none"
              stroke={COLORS[s.key]}
              strokeWidth="18"
              strokeLinecap="butt"
            />
          ) : null,
        )}
      </svg>
      <ul className="space-y-1 text-sm">
        {slices.map(([key, label, n]) => (
          <li key={key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[key] }} />
            <span className="text-muted">{label}</span>
            <span className="font-medium">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Summary() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    api<Dash>("/api/tasks/dashboard")
      .then(setD)
      .catch((e: Error) => setErr(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  const linkFor = (key: string) => {
    if (key === "unassigned") return "/list?unassigned=true";
    if (key === "due") return "/list?overdue=true";
    if (key === "complete") return "/list?finished=true";
    if (key === "mine") return "/list?mine=1";
    return "/list";
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{d?.title ?? "Summary"}</h1>
          <p className="mt-1 text-sm text-muted">Attention on work you can see. Creator, visibility, and assignee stay separate.</p>
        </div>
        <CreateTaskMenu onCreated={load} />
      </div>
      {err ? <p className="mt-4 text-sm text-due">{err}</p> : null}
      {!d ? (
        <div className="mt-6 h-24 animate-pulse rounded-xl bg-white" />
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {d.cards.map((c) => (
              <Link
                key={c.key}
                to={linkFor(c.key)}
                className="rounded-xl border border-border bg-elevated p-5 shadow-sm hover:border-accent hover:shadow-md"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{c.label}</div>
                <div className="mt-2 text-3xl font-semibold">{c.value}</div>
                <div className="mt-1 text-xs text-muted">{c.hint}</div>
              </Link>
            ))}
          </div>
          <section className="mt-8 rounded-xl border border-border bg-elevated p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Status overview</h2>
              <Link to="/list" className="text-sm text-accent hover:underline">
                View all in List
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted">
              Mutually exclusive: Complete · Due (overdue open) · Unassigned (open, not overdue) · Open owned.
            </p>
            <div className="mt-4">
              <Donut chart={d.chart} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
