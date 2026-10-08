# OpsNinja — Decisions

Status: **Current** unless marked superseded or future.

## ADR-001 TypeScript

Use TypeScript. Reason: maintainability. Status: current.

## ADR-002 Modular monolith

One Express process, module folders, one Postgres. Not microservices. Status: current.

## ADR-003 Vite React + Express + Prisma + Postgres

Interview-familiar split; Prisma migrations. Fastify not selected. Status: current.

## ADR-004 Session cookies + Argon2id

HTTP-only session id cookie. Role from User. No localStorage JWT. Status: current.

## ADR-005 Platform vs operations power

Admin manages users/flags/metrics. Not silent task god-mode. Admin sees strictly no task content (no break-glass). Status: current.

## ADR-006 Explicit visibility (supersedes reporting-derived visibility)

Visibility is `GLOBAL|TEAM|DIRECT` plus `CaseAccess` / `visibilityManagerId`. Reporting still defines teams and free agents. Creator ≠ visibility ≠ assignee. Status: current. Older PRD “visibility is only a query on reportsTo” is **superseded**.

## ADR-007 Free-agent Associates

`reportsToId` nullable. Same Associate role. Status: current.

## ADR-008 Anyone can create cases

Creation is not Lead/Manager-only. Routing options are role-limited. Status: current.

## ADR-009 Archive not delete

`finishedAt` / `archivedAt`. Status: current.

## ADR-010 Communication is in v1 (supersedes “no Slack-like chat”)

Global chat + DMs + mentions + notifications + case linking. No channels/huddles. Socket.IO after persistence. Status: current.

## ADR-011 AI is a plugin

Summaries and suggestions only. Same authz as viewer. App works if LLM is down. RAG is later. Status: current.

## ADR-012 No Redis / Elasticsearch in v1

SQL + indexes + pagination. Pub/sub later if scaled. Status: current.

## ADR-013 Private GitHub

Keep private. No force-push. Status: current.

## ADR-014 Ship over teach-during-build

Master prompt supersedes teaching-first development. Status: current.

## ADR-015 Hosting

Prefer Vercel + Render + managed Postgres. Serving SPA from Express on Render is allowed if cookies/WebSockets are more reliable. Status: current design, not yet deployed.

## ADR-016 Tasks, not cases

The operational unit is a **Task**. API `/api/tasks`, Prisma `Task`. Status: current.

## ADR-017 Due is overdue deadline

**Due** means an open task whose `dueAt` is in the past. Manual red-flag UX is retired. Status: current.

## ADR-018 Admin never sees task content

Platform metrics are user/session/flag/audit **counts only**. Admin user onboard/offboard/role edits live on Platform. `/api/tasks` returns 403 for admin. Status: current.

## ADR-019 Associate self-assign only

Associates may set `assigneeId` to themselves on create or claim an unassigned visible task. They cannot assign others. Status: current.

## ADR-020 Board is a view, not a second workflow

The Board tab stores `boardColumn` (`TODO|IN_PROGRESS|IN_REVIEW|DONE`) and `boardRank` for layout. Done is kept in sync with `finishedAt`. Moving cards does not change creator, visibility, or assignee. Status: current.
