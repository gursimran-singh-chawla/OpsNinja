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

Admin manages users/flags/metrics. Not silent case god-mode. Break-glass: reason, expiry, logged, read-only. Status: current.

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
