import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { btn, btnPrimary, field } from "../../ui";
import { WhoCanSeeSection } from "./WhoCanSeeSection";
import { defaultAudience, toApiPayload, type WorkKind } from "./visibilityPresets";

export type { WorkKind };

type Person = { id: string; name: string; role: string; reportsToId: string | null };

const kinds: { id: WorkKind; title: string; blurb: string }[] = [
  { id: "task", title: "Task", blurb: "Standard operational work with an owner and visibility." },
  { id: "escalation", title: "Escalation", blurb: "Needs leadership attention and a deadline." },
  { id: "backlog", title: "Backlog", blurb: "Known issue parked until there is capacity." },
  { id: "report", title: "Report", blurb: "Structured incident or store intake." },
];

const reportTypes = [
  ["safety", "Safety"],
  ["shrink_loss", "Shrink / loss"],
  ["equipment", "Equipment"],
  ["policy", "Policy"],
  ["customer_incident", "Customer incident"],
] as const;

function reportCategory(type: string) {
  if (type === "customer_incident") return "customer";
  if (type === "shrink_loss") return "inventory";
  if (type === "equipment") return "other";
  return "other";
}

export function CreateTaskMenu({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WorkKind | null>(null);

  return (
    <div className="relative">
      <button type="button" className={btnPrimary} onClick={() => setOpen((v) => !v)}>
        Create
      </button>
      {open && !kind ? (
        <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-elevated shadow-lg">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              className="block w-full px-4 py-3 text-left hover:bg-teal-50"
              onClick={() => {
                setKind(k.id);
                setOpen(false);
              }}
            >
              <div className="text-sm font-medium text-ink">{k.title}</div>
              <div className="text-xs text-muted">{k.blurb}</div>
            </button>
          ))}
        </div>
      ) : null}
      {kind ? (
        <CreateForm
          kind={kind}
          onClose={() => {
            setKind(null);
            onCreated?.();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateForm({ kind, onClose }: { kind: WorkKind; onClose: () => void }) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [visPayload, setVisPayload] = useState(() =>
    user
      ? toApiPayload(defaultAudience(user.role, kind, user.reportsToId), user, {})
      : { visibilityType: "GLOBAL" as const, visibilityManagerId: null, directUserIds: [] },
  );

  useEffect(() => {
    api<Person[]>("/api/users").then(setPeople).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    setVisPayload(toApiPayload(defaultAudience(user.role, kind, user.reportsToId), user, {}));
  }, [kind, user]);

  const associates = people.filter((p) => p.role === "associate");
  const label = kinds.find((k) => k.id === kind)?.title ?? "Task";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const dueRaw = String(fd.get("dueAt") || "");
      const workKind = kind;
      let category = String(fd.get("category") || "normal");
      let description = String(fd.get("description") || "");
      const metadata: Record<string, unknown> = {};
      let priority = String(fd.get("priority") || "normal");

      if (kind === "escalation") {
        category = "escalation";
        priority = String(fd.get("priority") || "high");
        const reason = String(fd.get("reason") || "");
        const impact = String(fd.get("impact") || "");
        description = `${reason}\n\nImpact: ${impact}`;
        metadata.reason = reason;
        metadata.impact = impact;
      }
      if (kind === "backlog") {
        category = String(fd.get("category") || "other");
        priority = String(fd.get("priority") || "low");
        metadata.deferReason = String(fd.get("deferReason") || "");
        const revisit = String(fd.get("revisitAt") || "");
        if (revisit) metadata.revisitAt = new Date(revisit).toISOString();
      }
      if (kind === "report") {
        const reportType = String(fd.get("reportType") || "policy");
        category = reportCategory(reportType);
        metadata.reportType = reportType;
        metadata.location = String(fd.get("location") || "");
        metadata.occurredAt = fd.get("occurredAt") ? new Date(String(fd.get("occurredAt"))).toISOString() : null;
        metadata.contacts = String(fd.get("contacts") || "");
        metadata.immediateAction = String(fd.get("immediateAction") || "");
        description = String(fd.get("description") || "");
      }

      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          description,
          category,
          workKind,
          metadata,
          priority,
          dueAt: dueRaw ? new Date(dueRaw).toISOString() : null,
          visibilityType: visPayload.visibilityType,
          visibilityManagerId: visPayload.visibilityManagerId,
          directUserIds: visPayload.directUserIds,
          assigneeId: fd.get("assigneeId") || null,
        }),
      });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
      <form onSubmit={(e) => void submit(e)} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-elevated p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Create {label.toLowerCase()}</h2>
        <p className="mt-1 text-xs text-muted">Who can see this and who owns it stay separate.</p>

        <label className="mt-4 block text-xs text-muted">
          Title
          <input name="title" required className={field} />
        </label>

        {kind === "task" ? (
          <>
            <label className="mt-3 block text-xs text-muted">
              Description
              <textarea name="description" required rows={4} className={field} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">
                Domain
                <select name="category" className={field}>
                  {["normal", "inventory", "vendor", "customer", "other"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Priority
                <select name="priority" defaultValue="normal" className={field}>
                  {["low", "normal", "high", "urgent"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs text-muted">
              Deadline
              <input name="dueAt" type="datetime-local" className={field} />
            </label>
          </>
        ) : null}

        {kind === "escalation" ? (
          <>
            <label className="mt-3 block text-xs text-muted">
              Escalation reason
              <textarea name="reason" required rows={2} className={field} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              Impact
              <textarea name="impact" required rows={3} className={field} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">
                Priority
                <select name="priority" defaultValue="high" className={field}>
                  {["high", "urgent"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Deadline
                <input name="dueAt" type="datetime-local" required className={field} />
              </label>
            </div>
          </>
        ) : null}

        {kind === "backlog" ? (
          <>
            <label className="mt-3 block text-xs text-muted">
              Description
              <textarea name="description" required rows={3} className={field} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              Why deferred
              <input name="deferReason" className={field} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">
                Domain
                <select name="category" defaultValue="other" className={field}>
                  {["normal", "other", "inventory", "vendor"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Priority
                <select name="priority" defaultValue="low" className={field}>
                  {["low", "normal"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs text-muted">
              Revisit by
              <input name="revisitAt" type="date" className={field} />
            </label>
          </>
        ) : null}

        {kind === "report" ? (
          <>
            <label className="mt-3 block text-xs text-muted">
              Report type
              <select name="reportType" className={field}>
                {reportTypes.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs text-muted">
              Location / store area
              <input name="location" required className={field} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              When it happened
              <input name="occurredAt" type="datetime-local" required className={field} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              What happened
              <textarea name="description" required rows={3} className={field} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              People involved / contact
              <input name="contacts" className={field} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              Immediate action taken
              <textarea name="immediateAction" rows={2} className={field} />
            </label>
          </>
        ) : null}

        <WhoCanSeeSection user={user} people={people} workKind={kind} onPayloadChange={setVisPayload} />

        <label className="mt-4 block text-xs text-muted">
          Who owns the work?
          {user.role === "associate" ? (
            <select name="assigneeId" className={field} defaultValue="">
              <option value="">Unassigned — wait for a manager or lead</option>
              <option value={user.id}>Assign to me</option>
            </select>
          ) : (
            <select name="assigneeId" className={field}>
              <option value="">Unassigned</option>
              {associates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {!m.reportsToId ? " (free agent)" : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {err ? <p className="mt-2 text-sm text-due">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={`${btn} border-0`} onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
