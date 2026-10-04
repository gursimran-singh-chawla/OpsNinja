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
    <fieldset className="mt-4 space-y-2 border-0 p-0">
      <legend className="text-sm font-medium text-ink">Who can see this?</legend>
      <p className="text-xs text-muted">Separate from who owns the work.</p>
      <div className="mt-2 space-y-2">
        {options.map((opt) => (
          <label
            key={opt.key}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              audience === opt.key ? "border-accent bg-teal-50/80" : "border-border hover:border-accent/50"
            }`}
          >
            <input
              type="radio"
              name="audience"
              className="mt-1"
              checked={audience === opt.key}
              onChange={() => setAudience(opt.key)}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{opt.title}</span>
              <span className="block text-xs text-muted">{opt.blurb}</span>
            </span>
          </label>
        ))}
      </div>
      {showLeadTeamPicker ? (
        <label className="mt-2 block text-xs text-muted">
          Which team?
          <select
            className={field}
            required
            value={teamManagerId}
            onChange={(e) => setTeamManagerId(e.target.value)}
          >
            <option value="">Select a manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showDirectPicker ? (
        <label className="mt-2 block text-xs text-muted">
          {user.role === "manager" ? "Team member" : "Person"}
          <select
            className={field}
            required
            value={directUserId}
            onChange={(e) => setDirectUserId(e.target.value)}
          >
            <option value="">Select someone</option>
            {directPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role}
                {!p.reportsToId && p.role === "associate" ? ", free agent" : ""})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}
