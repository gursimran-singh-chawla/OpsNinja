export function isOverdue(t: { dueAt: string | null; finishedAt: string | null }) {
  return !t.finishedAt && !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();
}

export const field =
  "mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent";
export const btn =
  "rounded-md border border-border bg-elevated px-3 py-2 text-sm text-ink hover:border-accent hover:text-accent";
export const btnPrimary =
  "rounded-md bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 disabled:opacity-50";

export function formatVisibility(task: {
  visibilityType: string;
  visibilityManager?: { name: string } | null;
}) {
  if (task.visibilityType === "GLOBAL") return "Everyone in ops";
  if (task.visibilityType === "TEAM") {
    const mgr = task.visibilityManager?.name;
    return mgr ? `Team · ${mgr}` : "Team";
  }
  if (task.visibilityType === "DIRECT") return "Shared with specific people";
  return task.visibilityType;
}
