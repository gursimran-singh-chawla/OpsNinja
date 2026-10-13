# OpsNinja — Product specification

**Status:** Current. v2 UI and task domain are in the codebase.

Canonical name: **OpsNinja**. Historical name OpsPilot is obsolete. Domain object: **task** (not case).

Harborlane Retail is the fictional company.

## Overview

OpsNinja is an internal operations platform. People communicate about operational problems, turn them into accountable **tasks**, control who can see each task, assign responsibility, escalate, complete, and keep a full history.

Two surfaces:

- **Operations:** users, roles, tasks, visibility, routing, assignment, escalation, completion, history, dashboards
- **Communication:** global chat, DMs, mentions, notifications, persistent messages

AI is an assistance layer. It does not run the company.

Not a Slack clone, Jira clone, HR system, social network, autonomous-agent product, or multi-tenant SaaS. Jira informs **layout hierarchy only**.

## Problem

Operational issues at Harborlane scatter across email, spreadsheets, and chat. Ownership, visibility, and responsibility get mixed up. OpsNinja keeps **who created it**, **who can see it**, and **who owns the work** as three separate facts.

## Roles

| Role | Purpose |
|---|---|
| Admin | User onboard/offboard, roles, reporting lines, feature flags, **system metrics with no task content**. Not a task superuser. Strictly no task content access. |
| Lead | Organization-wide operational visibility, routing, dashboards, full task verbs. |
| Manager | Own team + free-agent Associates. Cannot assign another Manager’s Associates. |
| Associate | Do assigned work. May **self-assign** unassigned visible tasks. May not assign others. May be a free agent (`reportsToId` null). |

Lead, Manager, and Associate may **create** every work kind. Post-create permissions depend on role, visibility, assignment, and server policy. Admin cannot create or view tasks.

## Navigation

- **Top Bar / Navigation:** Summary, Tasks (List & Board views), Calendar (due date visualization), Meetings (Jitsi syncs), People (team directory), Logs (activity & system logs).
- **Sidebar / Relays:** Chat (Global + 1:1 DMs), Notifications, Platform (Admin authority).
- **Create:** Dropdown on Summary and Tasks: Task / Escalation / Backlog / Report.

Summary dashboards are **role-specific** and use only tasks the user can see.

## Task visibility

`GLOBAL` | `TEAM` | `DIRECT`

- **GLOBAL:** visible to operational workspace users (not Admin).
- **TEAM:** selected Manager, that Manager’s Associates, Lead, creator as applicable.
- **DIRECT:** explicitly granted users + Lead org-wide visibility.

Assignment (`assigneeId`) is independent of visibility. **Unassigned** until an Associate self-assigns or a Manager/Lead assigns an Associate.

**Create UX:** the create form asks **Who can see this?** with plain-language audience choices scoped by role (Associates: everyone or my team; Managers: add specific team members; Leads: pick a manager’s team or specific people). The UI maps to `GLOBAL` / `TEAM` / `DIRECT` on the API; assignee is a separate **Who owns the work?** field.

## Work kinds

`task` | `escalation` | `backlog` | `report`

Retail domain category remains: `normal`, `escalation`, `inventory`, `vendor`, `customer`, `other`. Extra structured fields live in `metadata` JSON (reports, backlog deferral).

## Task lifecycle & 48-Hour Auto-Archiving

`ACTIVE` → **Complete** (`finishedAt`, `completedAt`) → `ARCHIVED` (`archivedAt`). No hard delete.

- **Board:** Kanban columns To Do, In Progress, In Review, Done. Column + rank are stored (`boardColumn`, `boardRank`). Moving to Done sets `finishedAt`, `completedAt`, and starts the 48-hour countdown (`archiveAfter = completedAt + 48h`). Moving out of Done clears completion and archival timestamps.
- **48-Hour Auto-Archiving:** Completed tasks remain visible in active views for a 48-hour review window. A background sweep processor running on startup and every 5 minutes sets `archivedAt = now` on tasks where `archiveAfter <= now`.
- **Restoration & Reopening:** Authorized Leads and Managers can restore an archived task to active views with a fresh 48-hour review window. Reopening a task returns it to active incomplete state.
- **Due:** open task whose `dueAt` is in the past (server UTC). Not a manual flag.

## Communication & Direct Messages

- **Global Chat:** Ephemeral Socket.IO broadcasting backed by PostgreSQL persistence.
- **1:1 Direct Messages:** Deterministic `directKey` prevents duplicate conversations. Conversations appear in DM listings only after an initial message has been sent, preventing empty ghost conversations.
- **Delete for Me:** `clearedAt` on `ConversationParticipant` allows a user to remove a conversation from their list without affecting the counterparty's message history.
- **Room Authorization:** Socket.IO room joins enforce strict participant authorization, rejecting non-participants with `FORBIDDEN`.
- **Mentions & Comments:** Mentions trigger records and notifications. Task comments are a dedicated discussion thread.

## AI (SimuAI)

OpsNinja includes **SimuAI** as an assistance and synthesis layer:
- **Identity:** SimuAI operates strictly under the authorization of the viewing user. It never mutates tasks directly; operational users remain accountable.
- **On-Demand Briefing:** Generates role-tailored operational briefings on the `Summary` dashboard with markdown formatting, tables, checklists, and overdue warnings.
- **TaskDetail Assist:** Provides on-demand **Summary**, **Next Actions** (actionable checklists), and **Catch-Up** (comment activity digest) with one-click **Copy to clipboard** and **Insert into comment** capabilities.
- **Provider Abstraction:** Supports **Groq** (`openai/gpt-oss-20b` default via OpenAI-compatible chat completions), **Google Gemini** (`gemini-3.8-flash`), and offline zero-key **Mock Engine** fallback with 30 req/min rate limit protection.
- RAG / Knowledge Base is **future**.

## Stack

React 18 + TypeScript + Vite 5 + Tailwind CSS 4 · Express 4 + TypeScript · PostgreSQL + Prisma 5 · Socket.IO 4 · Argon2id (`hash-wasm`) · SimuAI provider abstraction (Groq / Gemini / Mock).

## Implemented

- Identity & Auth: Session cookies, pure Argon2id WASM, Cloudflare Turnstile, two-step EmailJS OTP verification, mandatory Admin approval gate.
- Task Management: Role-based creation and assignment, fine-grained visibility (`GLOBAL|TEAM|DIRECT`), kanban board with fractional ranking, 48-hour automated archiving with background sweep and restoration.
- Communication: Global chat, 1:1 DMs with deterministic keys, participant checks, user-scoped deletion (`clearedAt`), mentions, task comments.
- Operations Tools: Operations Calendar (day/week/month deadline view), Video Meetings hub (`meet.jit.si`).
- Auditing & Logs: Role-based separation between Task Activity Logs (regular users) and System Audit Logs (administrators with task content redaction).
- Admin Platform: User onboarding, approval gate management, account deactivation, platform metrics.
- SimuAI Intelligence: Multi-provider briefings, task summaries, next action recommendations, and catch-up digests.

## Future (deferred)

Mobile app, multi-tenancy, billing, customer-facing portals, SMS dispatch, group channel hierarchy, reactions, presence indicators, workflow builder, Elasticsearch/Redis unless needed, autonomous mutative agents, RAG until core is stable.

## Success

A reviewer can log in, get a role-correct UI, chat globally and in DMs, create a task with explicit visibility vs assignment, and see history. API rejects unauthorized access including Admin on `/api/tasks`. AI is optional.
