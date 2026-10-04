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
| Admin | User onboard/offboard, roles, reporting lines, feature flags, **system metrics with no task content**. Not a task superuser. Optional logged read-only break-glass. |
| Lead | Organization-wide operational visibility, routing, dashboards, full task verbs. |
| Manager | Own team + free-agent Associates. Cannot assign another Manager’s Associates. |
| Associate | Do assigned work. May **self-assign** unassigned visible tasks. May not assign others. May be a free agent (`reportsToId` null). |

Lead, Manager, and Associate may **create** every work kind. Post-create permissions depend on role, visibility, assignment, and server policy. Admin cannot create or view tasks.

## Navigation (v2)

- **Top:** Summary, List, Board, People (ops roles only)
- **Sidebar:** Chat, Notifications, Platform (admin)
- **Create** lives on Summary: dropdown Task / Escalation / Backlog / Report

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

## Task lifecycle

`OPEN` (neither timestamp) → **Complete** (`finishedAt`) → `ARCHIVED` (`archivedAt`). No hard delete.

**Board** is another view of the same tasks: columns To Do, In Progress, In Review, Done. Column + rank are stored (`boardColumn`, `boardRank`). Dragging to Done sets `finishedAt`; dragging out of Done clears it. Assignee and visibility stay independent.

**Due:** open task whose `dueAt` is in the past (server UTC). Not a manual flag.

## Communication

One global conversation. One-to-one DMs. Mentions create records and notifications. Task comments are a separate thread.

## AI

Summary, suggested next actions, catch-up on tasks the user can already view. Failures do not block tasks or chat. RAG is **future**.

## Stack

React + TypeScript + Vite + Tailwind · Express + TypeScript · PostgreSQL + Prisma · Socket.IO · LLM API behind a provider interface.

## Implemented

Auth (session cookies, Argon2id), roles, task CRUD with visibility/assignment policy, role-aware Summary, List, Board (kanban), Create dropdown, global chat + DMs, notifications, admin platform (metrics + user lifecycle).

## Future (deferred)

Mobile app, multi-tenancy, billing, portals, email/SMS, voice/video, group channels, reactions, presence, workflow builder, Elasticsearch, Redis unless needed, autonomous agents, RAG until core is stable.

## Success

A reviewer can log in, get a role-correct UI, chat globally and in DMs, create a task with explicit visibility vs assignment, and see history. API rejects unauthorized access including Admin on `/api/tasks`. AI is optional.
