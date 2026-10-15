import { describe, expect, it } from "vitest";
import {
  canViewTask,
  canCreateTask,
  canArchiveTask,
  canFinishTask,
  canSelfAssignTask,
  canAssignTask,
  canUseVisibilityOnCreate,
  canMoveBoardTask,
  canEditTask,
  canEditTaskField,
  isOverdue,
  type TaskWithAccess,
} from "./policy.js";
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

function task(over: Partial<TaskWithAccess>): TaskWithAccess {
  return {
    id: "t1",
    title: "t",
    description: "d",
    category: "normal",
    workKind: "task",
    metadata: null,
    priority: "normal",
    dueAt: null,
    createdById: "lead",
    visibilityType: "GLOBAL",
    visibilityManagerId: null,
    assigneeId: null,
    assignedById: null,
    sourceMessageId: null,
    redFlag: false,
    boardColumn: "TODO",
    boardRank: "000000001024",
    finishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    access: [],
    ...over,
  };
}

describe("task policy", () => {
  it("lets ops see global tasks and blocks admin", async () => {
    const t = task({ visibilityType: "GLOBAL" });
    expect(await canViewTask(assoc, t)).toBe(true);
    expect(await canViewTask(admin, t)).toBe(false);
    expect(await canViewTask(lead, t)).toBe(true);
  });

  it("limits TEAM visibility to that manager's associates", async () => {
    const t = task({ visibilityType: "TEAM", visibilityManagerId: "m1", createdById: "m1" });
    expect(await canViewTask(assoc, t)).toBe(true);
    expect(await canViewTask(other, t)).toBe(false);
    expect(await canViewTask(mgr, t)).toBe(true);
  });

  it("DIRECT is grant-based plus creator/assignee/lead", async () => {
    const t = task({
      visibilityType: "DIRECT",
      createdById: "lead",
      assigneeId: "a1",
      access: [{ userId: "a1" }],
    });
    expect(await canViewTask(assoc, t)).toBe(true);
    expect(await canViewTask(other, t)).toBe(false);
  });

  it("admin cannot create tasks; only the assigned associate can complete", async () => {
    expect(canCreateTask(admin)).toBe(false);
    expect(canCreateTask(assoc)).toBe(true);
    const assigned = task({ assigneeId: "a1", createdById: "a2" });
    expect(await canFinishTask(assoc, assigned)).toBe(true);
    expect(await canFinishTask(other, assigned)).toBe(false);
    const createdOnly = task({ assigneeId: null, createdById: "a1" });
    expect(await canFinishTask(assoc, createdOnly)).toBe(false);
    expect(await canFinishTask(lead, createdOnly)).toBe(true);
    expect(await canArchiveTask(assoc, assigned)).toBe(false);
    expect(await canArchiveTask(mgr, assigned)).toBe(true);
    expect(await canArchiveTask(lead, assigned)).toBe(true);
  });

  it("lets an associate self-assign an unassigned visible task but not assign others", async () => {
    const open = task({ assigneeId: null, visibilityType: "GLOBAL" });
    expect(await canSelfAssignTask(assoc, open)).toBe(true);
    expect(await canAssignTask(assoc, open, "a1")).toBe(true);
    expect(await canAssignTask(assoc, open, "a2")).toBe(false);
    const taken = task({ assigneeId: "a2", visibilityType: "GLOBAL" });
    expect(await canSelfAssignTask(assoc, taken)).toBe(false);
  });

  it("blocks associates from DIRECT visibility on create", () => {
    expect(canUseVisibilityOnCreate(assoc, "GLOBAL")).toBe(true);
    expect(canUseVisibilityOnCreate(assoc, "TEAM")).toBe(true);
    expect(canUseVisibilityOnCreate(assoc, "DIRECT")).toBe(false);
    expect(canUseVisibilityOnCreate(mgr, "DIRECT")).toBe(true);
  });

  it("lets associates move their own cards but not complete another associate's work", async () => {
    const mine = task({ assigneeId: "a1", createdById: "lead" });
    expect(await canMoveBoardTask(assoc, mine, "IN_PROGRESS")).toBe(true);
    const otherOwned = task({ assigneeId: "a2", createdById: "lead", boardColumn: "IN_PROGRESS" });
    expect(await canMoveBoardTask(assoc, otherOwned, "IN_REVIEW")).toBe(false);
    expect(await canMoveBoardTask(assoc, otherOwned, "DONE")).toBe(false);
    expect(await canMoveBoardTask(mgr, otherOwned, "DONE")).toBe(true);
  });

  it("marks Due only when the deadline has passed", () => {
    const past = task({ dueAt: new Date(Date.now() - 60_000) });
    const future = task({ dueAt: new Date(Date.now() + 60_000) });
    const done = task({ dueAt: new Date(Date.now() - 60_000), finishedAt: new Date() });
    expect(isOverdue(past)).toBe(true);
    expect(isOverdue(future)).toBe(false);
    expect(isOverdue(done)).toBe(false);
  });

  describe("canEditTask and field permissions", () => {
    it("admin cannot edit any task", async () => {
      const t = task({ visibilityType: "GLOBAL", createdById: "lead" });
      expect(await canEditTask(admin, t)).toBe(false);
      expect(canEditTaskField(admin, "title")).toBe(false);
      expect(canEditTaskField(admin, "category")).toBe(false);
    });

    it("archived task cannot be edited by anyone", async () => {
      const t = task({ visibilityType: "GLOBAL", archivedAt: new Date() });
      expect(await canEditTask(lead, t)).toBe(false);
      expect(await canEditTask(mgr, t)).toBe(false);
      expect(await canEditTask(assoc, t)).toBe(false);
    });

    it("lead can edit any accessible task and all fields", async () => {
      const t = task({ visibilityType: "GLOBAL", createdById: "other" });
      expect(await canEditTask(lead, t)).toBe(true);
      expect(canEditTaskField(lead, "title")).toBe(true);
      expect(canEditTaskField(lead, "description")).toBe(true);
      expect(canEditTaskField(lead, "category")).toBe(true);
      expect(canEditTaskField(lead, "priority")).toBe(true);
      expect(canEditTaskField(lead, "dueAt")).toBe(true);
    });

    it("manager can edit tasks they created or within their team scope", async () => {
      const created = task({ visibilityType: "TEAM", visibilityManagerId: "m1", createdById: "m1" });
      expect(await canEditTask(mgr, created)).toBe(true);

      const visManager = task({ visibilityType: "TEAM", visibilityManagerId: "m1", createdById: "lead" });
      expect(await canEditTask(mgr, visManager)).toBe(true);

      const assignedToMgr = task({ visibilityType: "GLOBAL", createdById: "lead", assigneeId: "m1" });
      expect(await canEditTask(mgr, assignedToMgr)).toBe(true);

      // Manager cannot edit tasks outside their scope (e.g. other manager's team or global not owned)
      const otherTeam = task({ visibilityType: "TEAM", visibilityManagerId: "m2", createdById: "m2" });
      expect(await canEditTask(mgr, otherTeam)).toBe(false);

      const unownedGlobal = task({ visibilityType: "GLOBAL", createdById: "lead", assigneeId: null });
      expect(await canEditTask(mgr, unownedGlobal)).toBe(false);

      expect(canEditTaskField(mgr, "title")).toBe(true);
      expect(canEditTaskField(mgr, "description")).toBe(true);
      expect(canEditTaskField(mgr, "category")).toBe(true);
      expect(canEditTaskField(mgr, "priority")).toBe(true);
      expect(canEditTaskField(mgr, "dueAt")).toBe(true);
    });

    it("associate can edit tasks they created or are assigned to, but only title and description", async () => {
      const createdByAssoc = task({ visibilityType: "GLOBAL", createdById: "a1", assigneeId: null });
      expect(await canEditTask(assoc, createdByAssoc)).toBe(true);

      const assignedToAssoc = task({ visibilityType: "GLOBAL", createdById: "lead", assigneeId: "a1" });
      expect(await canEditTask(assoc, assignedToAssoc)).toBe(true);

      const otherAssocTask = task({ visibilityType: "GLOBAL", createdById: "lead", assigneeId: "a2" });
      expect(await canEditTask(assoc, otherAssocTask)).toBe(false);

      expect(canEditTaskField(assoc, "title")).toBe(true);
      expect(canEditTaskField(assoc, "description")).toBe(true);
      expect(canEditTaskField(assoc, "category")).toBe(false);
      expect(canEditTaskField(assoc, "priority")).toBe(false);
      expect(canEditTaskField(assoc, "dueAt")).toBe(false);
    });
  });
});
