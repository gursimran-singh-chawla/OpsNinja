export type CaseStatus = "open" | "in_progress" | "resolved";
export type CasePriority = "low" | "medium" | "high";

export type OpsCase = {
  id: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  createdAt: string;
};

const seed: OpsCase[] = [
  {
    id: "case-001",
    title: "Elevated error rate on checkout API",
    status: "in_progress",
    priority: "high",
    createdAt: new Date().toISOString(),
  },
  {
    id: "case-002",
    title: "Scheduled maintenance window confirmation",
    status: "open",
    priority: "low",
    createdAt: new Date().toISOString(),
  },
];

let cases: OpsCase[] = [...seed];

export function listCases(): OpsCase[] {
  return [...cases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createCase(input: {
  title: string;
  priority?: CasePriority;
}): OpsCase {
  const title = input.title.trim();
  if (!title) {
    throw new Error("title is required");
  }
  const caseItem: OpsCase = {
    id: `case-${Date.now()}`,
    title,
    status: "open",
    priority: input.priority ?? "medium",
    createdAt: new Date().toISOString(),
  };
  cases = [caseItem, ...cases];
  return caseItem;
}

/** Reset in-memory store (for tests). */
export function resetCases(): void {
  cases = [...seed];
}
