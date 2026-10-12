import type { AiMeta, AiProvider, DashboardAiContext, TaskAiContext } from "./types.js";

export class MockAiProvider implements AiProvider {
  name = "SimuAI (Offline Engine)";
  model = "offline-engine";

  getMeta(): AiMeta {
    return {
      provider: "mock",
      model: this.model,
      fallback: false,
    };
  }

  async summarizeTask(ctx: TaskAiContext): Promise<string> {
    const parts: string[] = [];

    const urgencyText = ctx.overdue
      ? "🚨 Overdue"
      : ctx.priority === "urgent"
        ? "⚠️ Urgent Priority"
        : `${ctx.priority.toUpperCase()} priority`;

    parts.push(
      `**Task Overview:** "${ctx.title}" is a ${ctx.workKind.toUpperCase()} categorized under **${ctx.category}** (${urgencyText}).`,
    );

    parts.push(`**Core Scope:** ${ctx.description.slice(0, 300)}${ctx.description.length > 300 ? "..." : ""}`);

    if (ctx.assigneeName) {
      parts.push(`**Ownership:** Currently assigned to **${ctx.assigneeName}**.`);
    } else {
      parts.push(`**Ownership:** Currently **unassigned**; pending assignment or self-assignment.`);
    }

    if (ctx.comments.length > 0) {
      const recent = ctx.comments.slice(-3);
      const authors = [...new Set(recent.map((c) => c.authorName))].join(", ");
      parts.push(
        `**Discussion (${ctx.comments.length} comments):** Recent activity from ${authors}. Latest update: "${recent[recent.length - 1].body.slice(0, 160)}..."`,
      );
    } else {
      parts.push(`**Discussion:** No comments recorded yet.`);
    }

    return parts.join("\n\n");
  }

  async suggestNextActions(ctx: TaskAiContext): Promise<string[]> {
    const actions: string[] = [];

    if (!ctx.assigneeName) {
      actions.push("Assign an operational owner or self-assign to begin execution.");
    }

    if (ctx.overdue) {
      actions.push("Review missed deadline, update target resolution time, and notify stakeholders in comments.");
    }

    switch (ctx.category) {
      case "inventory":
        actions.push("Verify stock counts in POS system and check backroom discrepancy log.");
        actions.push("Coordinate with warehouse supervisor for replenishment or adjustment verification.");
        break;
      case "vendor":
        actions.push("Contact vendor representative with purchase order details and request SLA escalation.");
        actions.push("Log shipment tracking number or credit memo reference in task comments.");
        break;
      case "customer":
        actions.push("Review customer complaint details and reach out with resolution or compensation offer.");
        actions.push("Update store manager on customer satisfaction outcome.");
        break;
      case "escalation":
        actions.push("Brief operations Lead on immediate risk factors and financial impact.");
        actions.push("Formulate interim containment plan before implementing final operational fix.");
        break;
      default:
        actions.push("Validate task acceptance criteria and complete required checklist items.");
        actions.push("Document resolution findings in comment thread and transition board card to 'In Review' or 'Done'.");
    }

    return actions.slice(0, 4);
  }

  async catchUpTask(ctx: TaskAiContext): Promise<string> {
    if (ctx.comments.length === 0) {
      return `No recent comment activity on "${ctx.title}". The task remains in ${ctx.priority} priority with status open.`;
    }

    const latest = ctx.comments[ctx.comments.length - 1];
    const total = ctx.comments.length;

    return (
      `**Catch-Up Digest (${total} total comment${total > 1 ? "s" : ""}):**\n\n` +
      `• **Latest update:** ${latest.authorName} (${latest.authorRole}) commented: "${latest.body}"\n` +
      `• **Status:** Ownership is ${ctx.assigneeName ? `with ${ctx.assigneeName}` : "currently unassigned"}.\n` +
      `• **Priority & Timing:** Priority is **${ctx.priority}**${ctx.overdue ? " (⚠️ DEADLINE PASSED)" : ctx.dueAt ? ` (Due: ${new Date(ctx.dueAt).toLocaleDateString()})` : " (No deadline specified)"}.\n` +
      `• **Recommendation:** Check latest feedback from ${latest.authorName} and verify next operational checkpoint.`
    );
  }

  async generateBriefing(ctx: DashboardAiContext): Promise<string> {
    const lines: string[] = [];

    const roleUpper = ctx.userRole.toUpperCase();
    lines.push(`### Operational Briefing: SimuAI Operational Briefing for **${ctx.userName}** (${roleUpper})`);

    // 1. Overview
    if (ctx.overdueCount > 0) {
      lines.push(
        `**Overview:** Queue requires immediate operational intervention with **${ctx.overdueCount} overdue task${ctx.overdueCount > 1 ? "s" : ""}** and **${ctx.openCount} open task${ctx.openCount !== 1 ? "s" : ""}** under active management.`,
      );
    } else {
      lines.push(
        `**Overview:** Operational queue is healthy with **${ctx.openCount} open task${ctx.openCount !== 1 ? "s" : ""}** (**${ctx.activeCount} active on schedule**) and zero overdue deadlines.`,
      );
    }

    // 2. Key Operational Metrics (GFM Table)
    lines.push(
      `#### Key Operational Metrics\n\n` +
        `| Metric | Count | Operational Status |\n` +
        `| :--- | :--- | :--- |\n` +
        `| Total Open Tasks | ${ctx.openCount} | ${ctx.openCount > 15 ? "Elevated" : "Nominal"} |\n` +
        `| Active (On Schedule) | ${ctx.activeCount} | Nominal |\n` +
        `| Overdue | ${ctx.overdueCount} | ${ctx.overdueCount > 0 ? "Immediate Action Needed" : "Nominal"} |\n` +
        `| Urgent Priority | ${ctx.urgentCount} | ${ctx.urgentCount > 0 ? "Critical Focus" : "Nominal"} |\n` +
        `| Unassigned Queue | ${ctx.unassignedCount} | ${ctx.unassignedCount > 0 ? "Pending Owner" : "Clear"} |`,
    );

    // 3. Priority Items (GFM Table)
    lines.push(`#### Priority Items`);
    if (ctx.highlightTasks.length > 0) {
      const rows = ctx.highlightTasks
        .map((t) => {
          const status = t.overdue ? "⚠️ Overdue" : "In Progress";
          const assignee = t.assigneeName ?? "Unassigned";
          return `| ${t.title} | ${t.priority.toUpperCase()} | ${t.category} | ${status} | ${assignee} |`;
        })
        .join("\n");
      lines.push(
        `| Task | Priority | Category | Status | Assignee |\n` +
          `| :--- | :--- | :--- | :--- | :--- |\n` +
          rows,
      );
    } else {
      lines.push(`*No pending critical priority items.*`);
    }

    // 4. Recommended Actions
    lines.push(`#### Recommended Actions`);
    const actions: string[] = [];
    if (ctx.overdueCount > 0) {
      actions.push(
        `1. **Triage Overdue Tickets:** Immediately address the **${ctx.overdueCount} overdue tasks** to avoid SLA breach.`,
      );
    }
    if (ctx.urgentCount > 0) {
      actions.push(
        `2. **Escalate Urgent Blockers:** Expedite operational resolution on urgent tickets.`,
      );
    }
    if (ctx.unassignedCount > 0) {
      if (ctx.userRole === "lead" || ctx.userRole === "manager") {
        actions.push(
          `3. **Assign Pending Queue:** Allocate the **${ctx.unassignedCount} unassigned tasks** to appropriate floor Associates.`,
        );
      } else {
        actions.push(
          `3. **Self-Assign Capacity:** Review the **${ctx.unassignedCount} unassigned tasks** and claim visible items if capacity permits.`,
        );
      }
    }
    if (actions.length === 0) {
      actions.push(`1. **Maintain Workflow:** Continue progressing open tasks on schedule.`);
      actions.push(`2. **Queue Hygiene:** Confirm task completions are finished and archived promptly.`);
    }
    lines.push(actions.join("\n"));

    // 5. Workload Observations
    if (ctx.unassignedCount > 0 || ctx.overdueCount > 0) {
      lines.push(
        `#### Workload Observations\nAttention required on queue bottlenecks: ${ctx.overdueCount} overdue item${ctx.overdueCount !== 1 ? "s" : ""} and ${ctx.unassignedCount} unassigned ticket${ctx.unassignedCount !== 1 ? "s" : ""} require routing attention.`,
      );
    }

    return lines.join("\n\n");
  }
}
