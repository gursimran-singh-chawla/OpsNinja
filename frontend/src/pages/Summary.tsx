import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { CreateTaskMenu } from "../features/create/CreateTaskMenu";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

type Card = { key: string; label: string; value: number; hint: string };

type WeeklyTrendPoint = {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  task: number;
  escalation: number;
  backlog: number;
  report: number;
  total: number;
};

type Dash = {
  role: string;
  title: string;
  cards: Card[];
  chart: { complete: number; due: number; unassigned: number; assignedOpen: number };
  byWorkKind?: { task: number; escalation: number; backlog: number; report: number };
  weeklyTrends?: WeeklyTrendPoint[];
};

const DONUT_COLORS: Record<
  string,
  {
    stroke: string;
    label: string;
    link: string;
    bg: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  complete: {
    stroke: "#10b981",
    label: "Complete",
    link: "/list?finished=true",
    bg: "bg-emerald-500",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200/80",
  },
  due: {
    stroke: "#f43f5e",
    label: "Due",
    link: "/list?overdue=true",
    bg: "bg-rose-500",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200/80",
  },
  unassigned: {
    stroke: "#f59e0b",
    label: "Unassigned",
    link: "/list?unassigned=true",
    bg: "bg-amber-500",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-200/80",
  },
  assignedOpen: {
    stroke: "#6366f1",
    label: "Open (owned)",
    link: "/list",
    bg: "bg-indigo-500",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-200/80",
  },
};

function Donut({ chart }: { chart: Dash["chart"] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const slices = [
    { key: "complete", val: chart.complete },
    { key: "due", val: chart.due },
    { key: "unassigned", val: chart.unassigned },
    { key: "assignedOpen", val: chart.assignedOpen },
  ];

  const total = slices.reduce((s, x) => s + x.val, 0);

  // SVG circle math: Radius 62, viewBox 180x180, center (90, 90)
  const R = 62;
  const C = 2 * Math.PI * R; // ~389.557

  let accumulated = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6 py-2">
      {/* SVG Donut Circle */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg viewBox="0 0 180 180" className="h-40 w-40 sm:h-44 sm:w-44 drop-shadow-2xs">
          {/* Subtle background track */}
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="20"
          />

          {total === 0 ? (
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="20"
            />
          ) : (
            slices.map((slice) => {
              if (slice.val <= 0) return null;
              const strokeDash = (slice.val / total) * C;
              const strokeOffset = (accumulated / total) * C;
              accumulated += slice.val;
              const isHovered = hovered === slice.key;

              return (
                <circle
                  key={slice.key}
                  cx="90"
                  cy="90"
                  r={R}
                  fill="transparent"
                  stroke={DONUT_COLORS[slice.key].stroke}
                  strokeWidth={isHovered ? "24" : "20"}
                  strokeDasharray={`${strokeDash} ${C - strokeDash}`}
                  strokeDashoffset={-strokeOffset}
                  transform="rotate(-90 90 90)"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHovered(slice.key)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })
          )}
        </svg>

        {/* Center Counter */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
            {total}
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            Total Tasks
          </span>
        </div>
      </div>

      {/* Interactive Legend Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full min-w-0">
        {slices.map((slice) => {
          const meta = DONUT_COLORS[slice.key];
          const pct = total > 0 ? Math.round((slice.val / total) * 100) : 0;
          const isHovered = hovered === slice.key;

          return (
            <Link
              key={slice.key}
              to={meta.link}
              onMouseEnter={() => setHovered(slice.key)}
              onMouseLeave={() => setHovered(null)}
              className={`group relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-200 min-w-0 overflow-hidden ${
                isHovered
                  ? "border-slate-400 bg-slate-50/90 shadow-sm scale-[1.02]"
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs"
              }`}
            >
              {/* Top row: Indicator dot + Status label + Percentage Pill */}
              <div className="flex items-center justify-between gap-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs transition-transform group-hover:scale-125"
                    style={{ background: meta.stroke }}
                  />
                  <span
                    className="text-xs font-bold text-slate-800 truncate"
                    title={meta.label}
                  >
                    {meta.label}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border shrink-0 ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                >
                  {pct}%
                </span>
              </div>

              {/* Bottom row: Value count + Action link */}
              <div className="mt-2.5 flex items-baseline justify-between gap-1.5 min-w-0">
                <div className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                  {slice.val}
                </div>
                <div className="text-[10px] font-medium text-slate-400 group-hover:text-indigo-600 transition-colors truncate">
                  Filter →
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Line Graph Series definitions
const SERIES_CONFIG: Record<
  string,
  { key: "task" | "escalation" | "backlog" | "report"; label: string; color: string; icon: string }
> = {
  task: { key: "task", label: "Standard Tasks", color: "#6366f1", icon: "📋" },
  escalation: { key: "escalation", label: "Escalations", color: "#f43f5e", icon: "⚡" },
  backlog: { key: "backlog", label: "Backlog Items", color: "#64748b", icon: "📦" },
  report: { key: "report", label: "Reports", color: "#a855f7", icon: "📝" },
};

function WeeklyTaskTrendChart({ data }: { data: WeeklyTrendPoint[] }) {
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    task: true,
    escalation: true,
    backlog: true,
    report: true,
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400">
        No historical weekly activity logged yet.
      </div>
    );
  }

  // Find max value across all selected series to calibrate Y-axis
  let maxVal = 4;
  data.forEach((d) => {
    if (activeSeries.task && d.task > maxVal) maxVal = d.task;
    if (activeSeries.escalation && d.escalation > maxVal) maxVal = d.escalation;
    if (activeSeries.backlog && d.backlog > maxVal) maxVal = d.backlog;
    if (activeSeries.report && d.report > maxVal) maxVal = d.report;
  });
  // Round up to nearest even ceiling for clean horizontal gridlines
  const yCeil = Math.ceil(maxVal * 1.15) || 5;

  // SVG dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getX = (index: number) => {
    if (data.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (data.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padTop + plotHeight - (val / yCeil) * plotHeight;
  };

  const createPath = (seriesKey: "task" | "escalation" | "backlog" | "report") => {
    return data
      .map((d, i) => {
        const x = getX(i);
        const y = getY(d[seriesKey]);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

  // Calculate high-level summary metrics
  const totalVolume = data.reduce((s, d) => s + d.total, 0);
  const totalEscalations = data.reduce((s, d) => s + d.escalation, 0);
  const avgWeekly = (totalVolume / data.length).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Series Toggle Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(SERIES_CONFIG).map(([k, cfg]) => {
            const isActive = activeSeries[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleSeries(k)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? "border border-slate-300 bg-white text-slate-800 shadow-2xs"
                    : "border border-transparent bg-slate-100/70 text-slate-400 opacity-60 hover:opacity-100"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: isActive ? cfg.color : "#94a3b8" }}
                />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick summary indicators */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>6-Wk Volume: <strong className="text-slate-900">{totalVolume}</strong></span>
          <span>Avg: <strong className="text-slate-900">{avgWeekly}</strong>/wk</span>
          <span>Escalations: <strong className="text-rose-600">{totalEscalations}</strong></span>
        </div>
      </div>

      {/* Line Graph SVG Container */}
      <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/40 p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio);
            const labelVal = Math.round(yCeil * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {labelVal}
                </text>
              </g>
            );
          })}

          {/* Vertical Week Cursor guide on Hover */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={padTop + plotHeight}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
          )}

          {/* Line Series */}
          {Object.entries(SERIES_CONFIG).map(([key, cfg]) => {
            if (!activeSeries[key]) return null;
            return (
              <g key={key}>
                <path
                  d={createPath(cfg.key)}
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
                {/* Data point nodes */}
                {data.map((d, i) => {
                  const val = d[cfg.key];
                  const cx = getX(i);
                  const cy = getY(val);
                  const isHovered = hoverIndex === i;

                  return (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#ffffff"
                      stroke={cfg.color}
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all duration-200 cursor-pointer"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Invisible hover intercept columns */}
          {data.map((_, i) => {
            const x = getX(i);
            const w = plotWidth / data.length;
            return (
              <rect
                key={i}
                x={x - w / 2}
                y={padTop}
                width={w}
                height={plotHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}

          {/* X-Axis Labels (Weeks) */}
          {data.map((d, i) => {
            const x = getX(i);
            const isHovered = hoverIndex === i;
            return (
              <text
                key={i}
                x={x}
                y={svgHeight - 12}
                textAnchor="middle"
                className={`text-[11px] font-medium transition-colors ${
                  isHovered ? "fill-indigo-600 font-bold" : "fill-slate-500"
                }`}
              >
                {d.weekKey}
              </text>
            );
          })}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredData && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white/95 p-3 text-xs shadow-xs backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{hoveredData.weekKey}</span>
              <span className="text-[11px] text-slate-500">({hoveredData.weekLabel})</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-slate-600">Tasks:</span>
                <strong className="text-slate-900">{hoveredData.task}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-slate-600">Escalations:</span>
                <strong className="text-slate-900">{hoveredData.escalation}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span className="text-slate-600">Backlog:</span>
                <strong className="text-slate-900">{hoveredData.backlog}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-slate-600">Reports:</span>
                <strong className="text-slate-900">{hoveredData.report}</strong>
              </div>
              <div className="border-l border-slate-200 pl-3 font-semibold text-indigo-700">
                Total Inflow: {hoveredData.total}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Summary() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingMeta, setBriefingMeta] = useState<{ provider: string; model: string; fallback: boolean } | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingErr, setBriefingErr] = useState<string | null>(null);
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [briefingGeneratedAt, setBriefingGeneratedAt] = useState<Date | null>(null);

  function load() {
    api<Dash>("/api/tasks/dashboard")
      .then(setD)
      .catch((e: Error) => setErr(e.message));
  }

  async function loadBriefing() {
    setLoadingBriefing(true);
    setBriefingErr(null);
    try {
      const res = await api<{ briefing: string; meta?: any }>("/api/tasks/ai/briefing", { method: "POST" });
      setBriefing(res.briefing);
      setBriefingGeneratedAt(new Date());
      if (res.meta) setBriefingMeta(res.meta);
    } catch (e) {
      setBriefingErr(e instanceof Error ? e.message : "Failed to generate briefing");
    } finally {
      setLoadingBriefing(false);
    }
  }

  function copyBriefing() {
    if (!briefing) return;
    try {
      void navigator.clipboard.writeText(briefing);
      setCopiedBriefing(true);
      setTimeout(() => setCopiedBriefing(false), 2000);
    } catch {
      // Safe fallback if clipboard API is restricted in sandbox
      const textarea = document.createElement("textarea");
      textarea.value = briefing;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedBriefing(true);
      setTimeout(() => setCopiedBriefing(false), 2000);
    }
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

  const cardIcon = (key: string) => {
    switch (key) {
      case "due":
        return { icon: "🚨", bg: "bg-rose-50 text-rose-600 border-rose-200" };
      case "unassigned":
        return { icon: "📌", bg: "bg-amber-50 text-amber-600 border-amber-200" };
      case "complete":
        return { icon: "✅", bg: "bg-emerald-50 text-emerald-600 border-emerald-200" };
      default:
        return { icon: "📋", bg: "bg-indigo-50 text-indigo-600 border-indigo-200" };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {d?.title ?? "Summary"}
            </h1>
            <span className="hidden sm:inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200 uppercase tracking-wide">
              {d?.role}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Separation of duties: Who created it, who can see it, and who owns the work remain distinct.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <CreateTaskMenu onCreated={load} />
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-due flex items-center gap-2">
          <span>⚠️</span>
          <span>{err}</span>
        </div>
      ) : null}

      {/* SimuAI Operational Briefing */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-5 sm:p-6 shadow-sm shadow-indigo-100/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/20">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-ink">SimuAI Operational Briefing</h2>
                {briefingMeta ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      briefingMeta.fallback
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : briefingMeta.provider === "groq"
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                        : briefingMeta.provider === "gemini"
                        ? "border-indigo-200 bg-indigo-100 text-indigo-700"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {briefingMeta.fallback
                      ? "⚠️ Offline Fallback"
                      : briefingMeta.provider === "groq"
                      ? `⚡ Groq (${briefingMeta.model})`
                      : briefingMeta.provider === "gemini"
                      ? `✨ Gemini (${briefingMeta.model})`
                      : "🤖 Offline Engine"}
                  </span>
                ) : (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200/60">
                    AI Copilot
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                On-demand intelligence synthesizing your visible tasks, overdue deadlines, and routing priorities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!briefing && !loadingBriefing ? (
              <button
                onClick={() => void loadBriefing()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition cursor-pointer"
              >
                <span>✨</span>
                <span>Generate Briefing</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadBriefing()}
                  disabled={loadingBriefing}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:border-slate-300 disabled:opacity-50 transition cursor-pointer shadow-2xs"
                >
                  {loadingBriefing ? "Thinking…" : "Refresh"}
                </button>
                {briefing && (
                  <button
                    onClick={copyBriefing}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:border-slate-300 transition cursor-pointer shadow-2xs"
                  >
                    {copiedBriefing ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading skeleton when generating initial briefing */}
        {loadingBriefing && !briefing && (
          <div className="mt-4 rounded-xl border border-indigo-100/90 bg-white/90 p-5 shadow-2xs space-y-4 animate-pulse">
            <div className="flex items-center gap-2.5 text-xs text-indigo-700 font-medium">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span>SimuAI is synthesizing queue metrics, priority items, and operational recommendations...</span>
            </div>
            {/* Header skeleton */}
            <div className="space-y-1.5 pt-1">
              <div className="h-4 bg-slate-200/80 rounded w-2/5" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
            {/* Metrics table skeleton */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2">
              <div className="h-3.5 bg-slate-200/70 rounded w-1/4" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="h-10 bg-white rounded border border-slate-200/50" />
                <div className="h-10 bg-white rounded border border-slate-200/50" />
                <div className="h-10 bg-white rounded border border-slate-200/50" />
                <div className="h-10 bg-white rounded border border-slate-200/50" />
              </div>
            </div>
            {/* Recommendations skeleton */}
            <div className="space-y-2 pt-1">
              <div className="h-3.5 bg-slate-200/70 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-5/6" />
              <div className="h-3 bg-slate-100 rounded w-4/6" />
            </div>
          </div>
        )}

        {/* Refreshing banner when regenerating an existing briefing */}
        {loadingBriefing && briefing && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50/90 px-4 py-2.5 text-xs text-indigo-700 border border-indigo-100 shadow-2xs">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span>Updating operational report with latest queue metrics...</span>
          </div>
        )}

        {/* Error message */}
        {briefingErr && (
          <div className="mt-3 flex items-start justify-between gap-3 text-xs text-rose-800 bg-rose-50/90 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-sm">⚠️</span>
              <div>
                <span className="font-semibold">Unable to generate operational briefing</span>
                <p className="mt-0.5 text-rose-700 leading-relaxed">{briefingErr}</p>
              </div>
            </div>
            <button
              onClick={() => void loadBriefing()}
              className="shrink-0 font-semibold underline hover:text-rose-950 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Rendered Briefing Card */}
        {briefing && (
          <div
            className={`mt-4 rounded-xl border border-indigo-100/90 bg-white/95 p-5 text-xs text-ink shadow-2xs transition-opacity ${
              loadingBriefing ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center justify-between border-b border-indigo-50/80 pb-2.5 mb-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-950 uppercase tracking-wider">
                <span>📋</span>
                <span>Operations Intelligence Report</span>
              </div>
              {briefingGeneratedAt && (
                <span className="text-[10px] text-muted flex items-center gap-1 font-normal">
                  <span>🕒</span>
                  <span>Generated {briefingGeneratedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              )}
            </div>

            {briefing.trim().length === 0 ? (
              <p className="text-xs text-muted italic py-3">No operational briefing content returned. Click Refresh to regenerate.</p>
            ) : (
              <MarkdownRenderer content={briefing} />
            )}
          </div>
        )}
      </section>

      {/* Main Metrics Grid */}
      {!d ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-border" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {d.cards.map((c) => {
              const meta = cardIcon(c.key);
              return (
                <Link
                  key={c.key}
                  to={linkFor(c.key)}
                  className="group relative rounded-2xl border border-border bg-white p-5 shadow-xs hover:border-brand/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted group-hover:text-ink transition-colors">
                      {c.label}
                    </span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs border ${meta.bg}`}>
                      {meta.icon}
                    </span>
                  </div>
                  <div className="mt-3 text-3xl font-extrabold text-ink tracking-tight tabular-nums">
                    {c.value}
                  </div>
                  <div className="mt-1 text-xs text-muted leading-tight">{c.hint}</div>
                </Link>
              );
            })}
          </div>

          {/* Charts Row: Donut Chart + Historical Weekly Trend Line Graph */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Status Overview Donut Chart */}
            <section className="lg:col-span-5 rounded-2xl border border-border bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div>
                    <h2 className="text-base font-bold text-ink">Queue Distribution</h2>
                    <p className="text-xs text-muted mt-0.5">Live status of active operations</p>
                  </div>
                  <Link
                    to="/list"
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    View queue →
                  </Link>
                </div>
                <div className="mt-4">
                  <Donut chart={d.chart} />
                </div>
              </div>
            </section>

            {/* Historical Task Type Trend Line Graph */}
            <section className="lg:col-span-7 rounded-2xl border border-border bg-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
                <div>
                  <h2 className="text-base font-bold text-ink">Historical Inflow by Task Type</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Weekly operational patterns across Standard Tasks, Escalations, Backlog & Reports
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <WeeklyTaskTrendChart data={d.weeklyTrends ?? []} />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
