export function isOverdue(t: { dueAt: string | null; finishedAt: string | null }) {
  return !t.finishedAt && !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();
}

export const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 outline-none transition-all focus:border-brand focus:ring-3 focus:ring-brand/15 disabled:bg-slate-50 disabled:text-muted";

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-indigo-500 hover:to-indigo-600 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 transition-all hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer";

export const card =
  "rounded-xl border border-border bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm";

export function formatVisibility(task: {
  visibilityType: string;
  visibilityManager?: { name: string } | null;
}) {
  if (task.visibilityType === "GLOBAL") return "Everyone in ops";
  if (task.visibilityType === "TEAM") {
    const mgr = task.visibilityManager?.name;
    return mgr ? `Team · ${mgr}` : "Team";
  }
  if (task.visibilityType === "DIRECT") return "Direct recipients";
  return task.visibilityType;
}

export function roleBadgeClass(role: string) {
  switch (role.toLowerCase()) {
    case "admin":
      return "bg-purple-50 text-purple-700 border-purple-200/80";
    case "lead":
      return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
    case "manager":
      return "bg-sky-50 text-sky-700 border-sky-200/80";
    case "associate":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function priorityBadgeClass(priority: string) {
  switch (priority.toLowerCase()) {
    case "urgent":
      return "bg-rose-50 text-rose-700 border-rose-200/80 font-semibold";
    case "high":
      return "bg-amber-50 text-amber-700 border-amber-200/80";
    case "normal":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "low":
      return "bg-slate-50 text-slate-500 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}
