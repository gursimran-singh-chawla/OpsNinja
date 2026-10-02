import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Person = { id: string; name: string; role: string; reportsToId: string | null };
type CaseRow = {
  id: string;
  title: string;
  category: string;
  visibilityType: string;
  redFlag: boolean;
  finishedAt: string | null;
  archivedAt: string | null;
  createdBy: { name: string };
  assignee: { name: string } | null;
};

export function Cases() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (visibility) params.set("visibility", visibility);
    api<CaseRow[]>(`/api/cases?${params}`)
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  }

  useEffect(() => {
    load();
    api<Person[]>("/api/users").then(setPeople).catch(() => undefined);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cases</h1>
          <p className="text-sm text-zinc-500">Filter by visibility. Assignment is shown separately from who can see the case.</p>
        </div>
        <button className="bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950" onClick={() => setOpen(true)}>
          New case
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          placeholder="Search title or description"
          className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="">All visibilities</option>
          <option value="GLOBAL">Global</option>
          <option value="TEAM">Team</option>
          <option value="DIRECT">Direct</option>
        </select>
        <button className="border border-zinc-700 px-3 py-2 text-sm" onClick={load}>
          Apply
        </button>
      </div>
      {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
      <div className="mt-4 overflow-x-auto border border-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">Created by</th>
              <th className="px-3 py-2">Visible</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">State</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((c) => (
              <tr key={c.id} className="border-t border-zinc-800">
                <td className="px-3 py-3">
                  <Link to={`/cases/${c.id}`} className="font-medium hover:text-amber-500">
                    {c.redFlag ? <span className="mr-2 text-red-400">Flag</span> : null}
                    {c.title}
                  </Link>
                  <div className="text-xs capitalize text-zinc-500">{c.category}</div>
                </td>
                <td className="px-3 py-3 text-zinc-400">{c.createdBy.name}</td>
                <td className="px-3 py-3 text-zinc-400">{c.visibilityType}</td>
                <td className="px-3 py-3 text-zinc-400">{c.assignee?.name ?? "Unassigned"}</td>
                <td className="px-3 py-3 text-zinc-400">
                  {c.archivedAt ? "Archived" : c.finishedAt ? "Finished" : "Open"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 ? <p className="p-6 text-sm text-zinc-500">No cases match.</p> : null}
      </div>
      {open ? <NewCase people={people} role={user?.role ?? "associate"} onClose={() => { setOpen(false); load(); }} /> : null}
    </div>
  );
}

function NewCase({
  people,
  role,
  onClose,
}: {
  people: Person[];
  role: string;
  onClose: () => void;
}) {
  const managers = people.filter((p) => p.role === "manager");
  const associates = people.filter((p) => p.role === "associate");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const visibilityType = String(fd.get("visibilityType"));
      const direct = String(fd.get("directUserId") || "");
      await api("/api/cases", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          category: fd.get("category"),
          visibilityType,
          visibilityManagerId: visibilityType === "TEAM" ? fd.get("visibilityManagerId") || null : null,
          directUserIds: visibilityType === "DIRECT" && direct ? [direct] : [],
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

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4">
      <form onSubmit={(e) => void submit(e)} className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-zinc-700 bg-zinc-950 p-6">
        <h2 className="text-lg font-semibold">Create case</h2>
        <p className="mt-1 text-xs text-zinc-500">Who will see this, and who is responsible, are separate.</p>
        <label className="mt-4 block text-xs text-zinc-400">
          Title
          <input name="title" required className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Description
          <textarea name="description" required rows={4} className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-zinc-400">
            Category
            <select name="category" className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
              {["normal", "escalation", "inventory", "vendor", "customer", "other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Visibility
            <select name="visibilityType" className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
              <option value="GLOBAL">Global</option>
              {(role === "lead" || role === "manager" || role === "associate") && <option value="TEAM">Team</option>}
              <option value="DIRECT">Direct</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs text-zinc-400">
          Team manager (if TEAM)
          <select name="visibilityManagerId" className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
            <option value="">—</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Direct recipient (if DIRECT)
          <select name="directUserId" className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
            <option value="">—</option>
            {associates.concat(managers).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role}
                {!m.reportsToId && m.role === "associate" ? ", free agent" : ""})
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Assigned (responsible)
          <select name="assigneeId" className="mt-1 w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm">
            <option value="">Unassigned</option>
            {associates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {!m.reportsToId ? " (free agent)" : ""}
              </option>
            ))}
          </select>
        </label>
        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="px-3 py-2 text-sm text-zinc-400" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="bg-amber-600 px-3 py-2 text-sm text-zinc-950">
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
