# OpsNinja — Agent Instructions

## Product

OpsNinja is Harborlane Retail’s internal operations platform.

It is one place to communicate about operational problems, turn them into accountable **tasks**, control who can see them, assign responsibility, escalate, resolve, and keep history.

**Canonical name:** OpsNinja. Ignore any historical “OpsPilot” wording. User-facing and domain language is **task**, not case.

## Objective

Build and ship a polished, deployable, presentable product.

Prioritize execution and verification. Keep chat replies concise.

Do not optimize for teaching during implementation. Interview walkthroughs happen after the product works.

## Locked product rules

- Four roles: Admin, Lead, Manager, Associate.
- Creator, visibility, and assignee are three different concepts. Never collapse them into one field.
- Visibility types: `GLOBAL` | `TEAM` | `DIRECT`.
- Associates may be free agents (`reportsToId` null). Not a fifth role.
- Lead, Manager, and Associate may create tasks (all work kinds). Post-create permissions depend on role, visibility, assignment, and policy.
- Admin is platform power, not a task superuser. Admin sees **no task content** (no exceptions).
- Manager cannot assign another Manager’s Associates. Free agents may be assigned by authorized Managers/Leads.
- Associates cannot assign others. They may **self-assign** an unassigned visible task or remain unassigned.
- Lead has organization-wide operational visibility.
- Complete = `finishedAt`. Archive = `archivedAt`. No hard delete of tasks.
- **Due** is computed: open task with `dueAt` in the past. Not a manual flag.
- Chat is required: global conversation + 1:1 DMs + mentions + notifications. Not channels/huddles/voice.
- Database is source of truth. WebSockets deliver live events only.
- AI assists (summary, next actions, catch-up). AI never mutates tasks. Product works if AI is down.
- RAG/knowledge base is after core product + task AI.
- Single tenant. Private GitHub repo stays private.

## Engineering rules

1. TypeScript everywhere practical.
2. Modular monolith: thin controllers, services hold rules, data access separate.
3. Authorize on the backend. Frontend hiding is UX only.
4. Never trust client `role`, `userId`, or visibility authority.
5. Secrets only in environment variables. Never commit `.env`.
Passwords: Argon2id via hash-wasm (WASM; no native Windows toolchain required).
6. Validate input. Consistent API errors. Do not leak stacks or SQL.
7. Prefer Argon2id, HTTP-only session cookies, session id not role.
8. PostgreSQL + Prisma. No Elasticsearch. No Redis unless scaling requires it.
9. Test high-risk authz, visibility, assignment, chat privacy, AI failure.
10. Incremental milestones, meaningful commits, no force-push, no history rewrite.
11. Do not claim something works unless verified.
12. Do not rebuild working modules. Do not add impressive unused infrastructure.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: Node.js, Express, TypeScript
- DB: PostgreSQL, Prisma
- Realtime: Socket.IO
- AI: provider abstraction over an external LLM API

## Implementation order

Foundation → Postgres/Prisma → auth → policy → tasks → visibility → assignment → lifecycle → audit → dashboards → search → global chat → DMs → mentions/notifications → chat/task linking → people/admin → deploy → AI → RAG if stable → polish → security → CI → README.

## Communication with the developer

Do not ask for permission on naming, file layout, or copy.

Stop only for credentials, paid services, destructive data loss, or irreconcilable product conflicts.

After each major milestone report only: Completed / Verification / Known issues / Next milestone.
