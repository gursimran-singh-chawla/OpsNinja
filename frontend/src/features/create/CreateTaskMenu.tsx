import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { btn, btnPrimary, field } from "../../ui";
import { WhoCanSeeSection } from "./WhoCanSeeSection";
import { defaultAudience, toApiPayload, type WorkKind } from "./visibilityPresets";

export type { WorkKind };

type Person = { id: string; name: string; role: string; reportsToId: string | null };

const kinds: { id: WorkKind; title: string; blurb: string; icon: string }[] = [
  { id: "task", title: "Standard Task", blurb: "Operational action item with designated owner and audience.", icon: "📋" },
  { id: "escalation", title: "Urgent Escalation", blurb: "High-priority issue requiring swift leadership attention and deadline.", icon: "⚡" },
  { id: "backlog", title: "Backlog Item", blurb: "Known operational debt parked until resource capacity frees up.", icon: "📦" },
  { id: "report", title: "Structured Report", blurb: "Standardized safety, loss, customer, or equipment intake.", icon: "📝" },
];

const reportTypes = [
  ["safety", "Safety & Hazard Incident"],
  ["shrink_loss", "Shrink & Inventory Loss"],
  ["equipment", "Equipment & Facility Malfunction"],
  ["policy", "Policy & Compliance Breach"],
  ["customer_incident", "Customer Dispute or Escalation"],
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
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm leading-none font-bold">+</span>
        <span>Create</span>
      </button>

      {open && !kind && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-md animate-fade-in">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Create New Entry
            </div>
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-slate-50 transition"
                onClick={() => {
                  setKind(k.id);
                  setOpen(false);
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm">
                  {k.icon}
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900">{k.title}</div>
                  <div className="text-[11px] text-slate-500 leading-normal">{k.blurb}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {kind && (
        <CreateForm
          kind={kind}
          onClose={() => {
            setKind(null);
            onCreated?.();
          }}
        />
      )}
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
  const kindMeta = kinds.find((k) => k.id === kind);
  const label = kindMeta?.title ?? "Task";

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
      setErr(e2 instanceof Error ? e2.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-fade-in">
      <form
        onSubmit={(e) => void submit(e)}
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{kindMeta?.icon}</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create {label}</h2>
              <p className="text-[11px] text-slate-400">Owner, audience and creator are distinct fields.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <label className="mt-4 block text-xs font-semibold text-slate-700">
          Title
          <input name="title" required placeholder="Clear, actionable title" className={field} />
        </label>

        {/* Task fields */}
        {kind === "task" && (
          <>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Description
              <textarea name="description" required rows={3} placeholder="Describe the task and success criteria..." className={field} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Operational Domain
                <select name="category" className={field}>
                  {["normal", "inventory", "vendor", "customer", "other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Priority
                <select name="priority" defaultValue="normal" className={field}>
                  {["low", "normal", "high", "urgent"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Deadline (Optional)
              <input name="dueAt" type="datetime-local" className={field} />
            </label>
          </>
        )}

        {/* Escalation fields */}
        {kind === "escalation" && (
          <>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Escalation Reason
              <textarea name="reason" required rows={2} placeholder="Why is leadership intervention needed?" className={field} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Operational Impact
              <textarea name="impact" required rows={2} placeholder="Customer impact, revenue, or safety implications..." className={field} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Priority
                <select name="priority" defaultValue="high" className={field}>
                  {["high", "urgent"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Deadline (Required)
                <input name="dueAt" type="datetime-local" required className={field} />
              </label>
            </div>
          </>
        )}

        {/* Backlog fields */}
        {kind === "backlog" && (
          <>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Description
              <textarea name="description" required rows={3} placeholder="Details on the parked work..." className={field} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Reason Deferred
              <input name="deferReason" placeholder="e.g. Waiting on vendor shipment next quarter" className={field} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Domain
                <select name="category" defaultValue="other" className={field}>
                  {["normal", "other", "inventory", "vendor"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Priority
                <select name="priority" defaultValue="low" className={field}>
                  {["low", "normal"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Revisit Date
              <input name="revisitAt" type="date" className={field} />
            </label>
          </>
        )}

        {/* Report fields */}
        {kind === "report" && (
          <>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Report Category
              <select name="reportType" className={field}>
                {reportTypes.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Store Area / Location
              <input name="location" required placeholder="e.g. Aisle 4B or Loading Dock" className={field} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Time of Occurrence
              <input name="occurredAt" type="datetime-local" required className={field} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Incident Narrative
              <textarea name="description" required rows={3} placeholder="Comprehensive description of what happened..." className={field} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Parties Involved & Contact Information
              <input name="contacts" placeholder="Names, phone numbers, employee IDs" className={field} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700">
              Immediate Mitigation Taken
              <textarea name="immediateAction" rows={2} placeholder="What was done right away to stabilize the situation?" className={field} />
            </label>
          </>
        )}

        {/* Who Can See Section */}
        <WhoCanSeeSection user={user} people={people} workKind={kind} onPayloadChange={setVisPayload} />

        {/* Responsibility Assignment */}
        <label className="mt-4 block text-xs font-semibold text-slate-700">
          Assigned Responsibility
          {user.role === "associate" ? (
            <select name="assigneeId" className={field} defaultValue="">
              <option value="">Unassigned — wait for manager dispatch</option>
              <option value={user.id}>Assign directly to myself</option>
            </select>
          ) : (
            <select name="assigneeId" className={field}>
              <option value="">Unassigned (Open queue)</option>
              {associates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {!m.reportsToId ? "(free agent)" : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {err && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {err}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : `Create ${kind}`}
          </button>
        </div>
      </form>
    </div>
  );
}
