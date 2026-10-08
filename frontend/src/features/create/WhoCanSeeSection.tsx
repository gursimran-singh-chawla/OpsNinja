import { useEffect, useState } from "react";
import { field } from "../../ui";
import {
  audienceOptions,
  defaultAudience,
  directPeopleForPicker,
  toApiPayload,
  type AudienceKey,
  type Person,
  type WorkKind,
} from "./visibilityPresets";

type Creator = { id: string; role: string; reportsToId: string | null };

export function WhoCanSeeSection({
  user,
  people,
  workKind,
  onPayloadChange,
}: {
  user: Creator;
  people: Person[];
  workKind: WorkKind;
  onPayloadChange: (payload: ReturnType<typeof toApiPayload>) => void;
}) {
  const options = audienceOptions(user.role, user.reportsToId);
  const [audience, setAudience] = useState<AudienceKey>(() => defaultAudience(user.role, workKind, user.reportsToId));
  const [teamManagerId, setTeamManagerId] = useState("");
  const [directUserId, setDirectUserId] = useState("");

  const managers = people.filter((p) => p.role === "manager");
  const directPeople = directPeopleForPicker(user.role, user.id, people);

  useEffect(() => {
    setAudience(defaultAudience(user.role, workKind, user.reportsToId));
    setTeamManagerId("");
    setDirectUserId("");
  }, [workKind, user.id, user.role, user.reportsToId]);

  useEffect(() => {
    onPayloadChange(
      toApiPayload(audience, user, {
        teamManagerId: teamManagerId || undefined,
        directUserId: directUserId || undefined,
      }),
    );
  }, [audience, teamManagerId, directUserId, user, onPayloadChange]);

  const showLeadTeamPicker = user.role === "lead" && audience === "TEAM";
  const showDirectPicker = audience === "DIRECT" && (user.role === "manager" || user.role === "lead");

  return (
    <fieldset className="mt-4 space-y-3 border-0 p-0">
      <div className="flex items-baseline justify-between">
        <legend className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Visibility & Audience
        </legend>
        <span className="text-[11px] text-slate-400">Strictly decoupled from assignment</span>
      </div>

      <div className="grid gap-2">
        {options.map((opt) => {
          const isSelected = audience === opt.key;
          return (
            <label
              key={opt.key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs"
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <input
                type="radio"
                name="audience"
                className="mt-0.5 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={isSelected}
                onChange={() => setAudience(opt.key)}
              />
              <div className="flex-1">
                <span className="block text-xs font-bold text-slate-900">{opt.title}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5 leading-normal">{opt.blurb}</span>
              </div>
            </label>
          );
        })}
      </div>

      {showLeadTeamPicker && (
        <label className="mt-2 block text-xs font-medium text-slate-700">
          Target Department / Team
          <select
            className={field}
            required
            value={teamManagerId}
            onChange={(e) => setTeamManagerId(e.target.value)}
          >
            <option value="">Select a manager's team…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}'s Team
              </option>
            ))}
          </select>
        </label>
      )}

      {showDirectPicker && (
        <label className="mt-2 block text-xs font-medium text-slate-700">
          {user.role === "manager" ? "Direct Associate" : "Target Recipient"}
          <select
            className={field}
            required
            value={directUserId}
            onChange={(e) => setDirectUserId(e.target.value)}
          >
            <option value="">Select someone…</option>
            {directPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role}
                {!p.reportsToId && p.role === "associate" ? ", free agent" : ""})
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}
