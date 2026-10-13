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

## ADR-021 Identity Verification & Mandatory Admin Approval Gate

Self-service registration requires Cloudflare Turnstile captcha validation and pure Argon2id hashing via WASM. Two-step verification dispatches a 6-digit numeric OTP via EmailJS REST API, storing only SHA-256 hashes with a 10-minute TTL and 5-attempt rate limit. Once verified, accounts enter a mandatory Administrative Approval Gate (`approvedAt != null`) before login sessions are permitted. Unapproved accounts return HTTP 403 `account_pending_approval`. Status: current.

## ADR-022 Direct Message Lifecycle & User-Scoped Clear

1:1 Direct Messages utilize deterministic pairing keys (`directKey: minId:maxId`) to prevent duplicate conversations. DMs appear only when an established conversation exists, preventing empty ghost chats. Users may delete/clear a DM from their view (`clearedAt` on `ConversationParticipant`) without affecting the counterparty's message history. Socket.IO room joins enforce strict participant authorization, rejecting non-participants with `FORBIDDEN`. Status: current.

## ADR-023 Role-Based Activity Logs & Audit Separation

Operational users access only Task Activity Logs (`task.created`, `task.assigned`, `task.completed`) strictly scoped to tasks they are authorized to view. Administrative platform operators inspect System & Account Logs (`user.*` and platform maintenance events) with all task title and description content strictly redacted. Status: current.

## ADR-024 48-Hour Automated Task Archiving

Completed tasks (`finishedAt`, `completedAt`) remain in active views during a 48-hour operational review window (`archiveAfter = completedAt + 48h`). A lightweight non-blocking background sweep worker runs on server startup and every 5 minutes to mark overdue completed tasks as `archivedAt = now`. Archived tasks are excluded from live boards, calendars, and summary metrics. Authorized Leads and Managers can restore tasks, which grants a fresh 48-hour review window. Reopening a task resets all completion and archival timestamps. Status: current.

## ADR-025 SimuAI Multi-Provider Architecture

SimuAI implements a unified `AiProvider` interface supporting Groq (`openai/gpt-oss-20b` default via OpenAI-compatible Chat Completions API), Google Gemini (`gemini-3.8-flash`), and an offline zero-key Mock provider fallback. SimuAI assists non-destructively (briefings, summaries, checklists, digests) and never mutates tasks. AI endpoints enforce a 30 req/min rate limit and handle provider failures gracefully. Status: current.
