export type WorkKind = "task" | "escalation" | "backlog" | "report";

export type AudienceKey = "GLOBAL" | "TEAM" | "DIRECT";

export type AudienceOption = {
  key: AudienceKey;
  title: string;
  blurb: string;
};

export type Person = { id: string; name: string; role: string; reportsToId: string | null };

export type Creator = { id: string; role: string; reportsToId: string | null };

export function audienceOptions(role: string, reportsToId: string | null): AudienceOption[] {
  const everyone: AudienceOption = {
    key: "GLOBAL",
    title: "Everyone in ops",
    blurb: "Visible to leads, managers, and associates across IG Incorporation.",
  };
  if (role === "associate") {
    const opts = [everyone];
    if (reportsToId) {
      opts.push({
        key: "TEAM",
        title: "My team",
        blurb: "Your manager and teammates on your reporting line.",
      });
    }
    return opts;
  }
  if (role === "manager") {
    return [
      everyone,
      {
        key: "TEAM",
        title: "My team",
        blurb: "You and the associates who report to you.",
      },
      {
        key: "DIRECT",
        title: "Specific people on my team",
        blurb: "Only selected associates you manage (plus you).",
      },
    ];
  }
  if (role === "lead") {
    return [
      everyone,
      {
        key: "TEAM",
        title: "A manager's team",
        blurb: "That manager and their associates.",
      },
      {
        key: "DIRECT",
        title: "Specific people",
        blurb: "Share with one or more people you choose.",
      },
    ];
  }
  return [everyone];
}

export function defaultAudience(role: string, workKind: WorkKind, reportsToId: string | null): AudienceKey {
  if (role === "associate") return reportsToId ? "TEAM" : "GLOBAL";
  if (role === "manager") return "TEAM";
  if (workKind === "escalation") return "GLOBAL";
  if (workKind === "report") return "TEAM";
  return "GLOBAL";
}

export function directPeopleForPicker(role: string, userId: string, people: Person[]): Person[] {
  const ops = people.filter((p) => p.role !== "admin");
  if (role === "manager") {
    return ops.filter((p) => p.role === "associate" && p.reportsToId === userId);
  }
  if (role === "lead") {
    return ops;
  }
  return [];
}

export function toApiPayload(
  audience: AudienceKey,
  user: Creator,
  selections: { teamManagerId?: string; directUserId?: string },
): {
  visibilityType: AudienceKey;
  visibilityManagerId: string | null;
  directUserIds: string[];
} {
  if (audience === "GLOBAL") {
    return { visibilityType: "GLOBAL", visibilityManagerId: null, directUserIds: [] };
  }
  if (audience === "TEAM") {
    let managerId: string | null = selections.teamManagerId ?? null;
    if (user.role === "associate") managerId = user.reportsToId;
    if (user.role === "manager") managerId = user.id;
    return { visibilityType: "TEAM", visibilityManagerId: managerId, directUserIds: [] };
  }
  const direct = selections.directUserId ?? "";
  return {
    visibilityType: "DIRECT",
    visibilityManagerId: null,
    directUserIds: direct ? [direct] : [],
  };
}
