import type { AiProvider, DashboardAiContext, TaskAiContext } from "./types.js";

export class MockAiProvider implements AiProvider {
  name = "SimuAI (Offline Engine)";

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

    lines.push(`### 🌅 SimuAI Operational Briefing for **${ctx.userName}** (${ctx.userRole.toUpperCase()})`);

    // Workload summary
    lines.push(
      `You currently have oversight of **${ctx.openCount} open task${ctx.openCount !== 1 ? "s" : ""}** ` +
        `(**${ctx.activeCount} active**).`,
    );

    // Urgent / Overdue alerts
    if (ctx.overdueCount > 0 || ctx.urgentCount > 0) {
      const alerts: string[] = [];
      if (ctx.overdueCount > 0) alerts.push(`🚨 **${ctx.overdueCount} overdue task${ctx.overdueCount > 1 ? "s" : ""}** requiring immediate intervention`);
      if (ctx.urgentCount > 0) alerts.push(`⚡ **${ctx.urgentCount} urgent task${ctx.urgentCount > 1 ? "s" : ""}**`);
      lines.push(`> [!WARNING]\n> **Critical Items:** ${alerts.join(" and ")}.`);
    } else {
      lines.push(`✅ **Clean Queue:** No overdue or urgent items pending in your active view.`);
    }

    // Unassigned note
    if (ctx.unassignedCount > 0) {
      if (ctx.userRole === "lead" || ctx.userRole === "manager") {
        lines.push(`📌 **Routing Focus:** There are **${ctx.unassignedCount} unassigned tasks** ready for team assignment.`);
      } else {
        lines.push(`📌 **Opportunity:** **${ctx.unassignedCount} visible tasks** are unassigned. You may self-assign any task you can assist with.`);
      }
    }

    // Role-specific operational guidance
    if (ctx.userRole === "lead") {
      lines.push(`**Strategic Focus:** Monitor department-wide bottlenecks, review escalations, and confirm managers are clearing aged inventory and vendor tickets.`);
    } else if (ctx.userRole === "manager") {
      lines.push(`**Team Management:** Check your direct reports' queues, allocate unassigned tickets to available Associates or free agents, and ensure high-priority customer items are resolved.`);
    } else if (ctx.userRole === "associate") {
      lines.push(`**Daily Focus:** Complete your assigned items first. If you have bandwidth, claim visible unassigned tasks to maintain store operations velocity.`);
    }

    if (ctx.highlightTasks.length > 0) {
      lines.push(`\n**Top Priority Tasks:**\n` + ctx.highlightTasks.map((t) => `• [${t.priority.toUpperCase()}] **${t.title}** (${t.category}${t.overdue ? " - OVERDUE" : ""})`).join("\n"));
    }

    return lines.join("\n\n");
  }
}
