import { describe, expect, it } from "vitest";
import { canViewCase, canCreateCase, canArchiveCase, canFinishCase, type CaseWithAccess } from "./policy.js";
import type { AuthUser } from "../../types/express.js";

const lead: AuthUser = {
  id: "lead",
  email: "l@x",
  name: "Lead",
  role: "lead",
  reportsToId: null,
  deactivatedAt: null,
};
const admin: AuthUser = { ...lead, id: "admin", role: "admin", name: "Admin" };
const mgr: AuthUser = { ...lead, id: "m1", role: "manager", name: "Mgr" };
const assoc: AuthUser = { ...lead, id: "a1", role: "associate", name: "A", reportsToId: "m1" };
const other: AuthUser = { ...lead, id: "a2", role: "associate", name: "B", reportsToId: "m2" };

function cse(over: Partial<CaseWithAccess>): CaseWithAccess {
  return {
    id: "c1",
    title: "t",
    description: "d",
    category: "normal",
    createdById: "lead",
    visibilityType: "GLOBAL",
    visibilityManagerId: null,
    assigneeId: null,
    assignedById: null,
    sourceMessageId: null,
    redFlag: false,
    finishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    access: [],
    ...over,
  };
}

describe("case policy", () => {
  it("lets ops see global cases and blocks admin", async () => {
    const c = cse({ visibilityType: "GLOBAL" });
    expect(await canViewCase(assoc, c)).toBe(true);
    expect(await canViewCase(admin, c)).toBe(false);
    expect(await canViewCase(lead, c)).toBe(true);
  });

  it("limits TEAM visibility to that manager's associates", async () => {
    const c = cse({ visibilityType: "TEAM", visibilityManagerId: "m1", createdById: "m1" });
    expect(await canViewCase(assoc, c)).toBe(true);
    expect(await canViewCase(other, c)).toBe(false);
    expect(await canViewCase(mgr, c)).toBe(true);
  });

  it("DIRECT is grant-based plus creator/assignee/lead", async () => {
    const c = cse({
      visibilityType: "DIRECT",
      createdById: "lead",
      assigneeId: "a1",
      access: [{ userId: "a1" }],
    });
    expect(await canViewCase(assoc, c)).toBe(true);
    expect(await canViewCase(other, c)).toBe(false);
  });

  it("admin cannot create cases; associate can finish own assignment", async () => {
    expect(canCreateCase(admin)).toBe(false);
    expect(canCreateCase(assoc)).toBe(true);
    const c = cse({ assigneeId: "a1", createdById: "lead" });
    expect(await canFinishCase(assoc, c)).toBe(true);
    expect(await canArchiveCase(assoc, c)).toBe(false);
    expect(await canArchiveCase(mgr, c)).toBe(true);
  });
});
