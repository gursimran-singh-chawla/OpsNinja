# Architecture

**How to read this file:** Same provenance rules as [`PROJECT_SPEC.md`](./PROJECT_SPEC.md). There is **no running application** in git. Architecture below is either a rule in `Agents.md` or a **proposed** modular monolith in the untracked PRD.

---

## Current architecture decisions available in the repository

**In git (`Agents.md` only):**

- TypeScript preferred.
- Business logic in reusable **services**, not in controllers/routes.
- Consistent API responses and error handling (shape unspecified).
- Authenticated endpoints protected; **authorization on the backend**.
- Configuration via environment variables; no secrets in code.
- Input validation required.
- Tests for important business logic.

**Not in git:** Folder `frontend/` or `backend/`, HTTP server, database client, middleware files.

**Design (untracked):** Modular **monolith** — one API process, one Postgres, several modules. Not microservices. Not a single `server.ts` dump.

---

## Frontend architecture

**In git:** No frontend.

**Design (untracked):** `frontend/` — Vite + React + TypeScript. One app, **four shells** after `/me` returns role: Associate queue, Manager team, Lead command, Admin console. UI hiding is convenience only; API enforces access.

**[TBD - requires confirmation]:** Routing library, state library, CSS approach, auth cookie handling on the client, folder layout inside `frontend/`.

---

## Backend architecture

**In git:** No backend.

**Design (untracked):** `backend/` Express TypeScript. Three floors:

1. HTTP routes — parse request, call service, map errors. No business rules.
2. Services — product rules (scope, finish, archive, red-flag, break-glass).
3. Data access — Postgres via Prisma (v1 default in the PRD).

Example flows in the PRD: `POST /cases/:id/finish` (session cookie); red-flag writes notifications; Admin `GET /cases/:id` is 403 unless break-glass.

**[TBD - requires confirmation]:** Port, CORS origins, process manager, whether Fastify is used instead of Express in the first commit.

---

## Module structure

**In git:** None.

**Design (untracked) modules:**

| Module | Job |
|---|---|
| identity | Login, users, roles, reporting line |
| cases | Case lifecycle and scoped search |
| discussion | Comments, @mentions |
| notifications | Tagged + red-flag inbox |
| audit | Append-only history |
| platform | Feature flags, usage counts, break-glass sessions |
| ai | Optional LLM calls on already-visible data |

Proposed folders: `backend/src/modules/*` (routes + service + tests), `backend/src/middleware/` (session, error mapper).

**[TBD - requires confirmation]:** Shared kernel package vs folders-only; monorepo tool (none vs npm workspaces vs other).

---

## API architecture

**In git:** “Consistent API responses” — no OpenAPI, no routes.

**Design (untracked) examples only:** JSON HTTPS; `POST /cases/:id/finish`; `GET /cases/:id`; success example `{ ok: true, case }`; 401 missing session; 403 forbidden.

**[TBD - requires confirmation]:** Full route list, versioning (`/api/v1`), pagination, error JSON schema, idempotency.

---

## Authentication architecture

**In git:** Protect authenticated endpoints. No mechanism specified.

**Design (untracked):** HttpOnly Secure **session cookie**. Server-side session **or** signed token in the cookie. Not `localStorage` JWT. Cookie stores session id, not role. Role loaded from `User`.

**This repository contains no authentication code** (per current inspect and the instruction not to add any in this step).

**[TBD - requires confirmation]:** Session store (Postgres `Session` table vs Redis), cookie `SameSite`/`Secure` for local vs prod, password hashing algorithm, login rate limits, seed/bootstrap Admin.

---

## Authorization architecture

**In git:** Enforce authorization on the backend. Never implied to trust the client.

**Design (untracked):** Policy functions e.g. `canViewCase`, `canArchive`, `canBreakGlassRead`. Inputs: role + reporting line + case fields. Visibility:

- Associate: assigned to me, or created by me and still unassigned (as written in the PRD).
- Manager: team via `reportsTo` / assignedBy.
- Lead: all cases.
- Admin: none unless active break-glass session; **writes always rejected**.

**[TBD - requires confirmation]:** Exact `assignedById` usage; whether multiple Leads all see all company cases or only their subtree.

---

## AI architecture

**In git:** Topic to understand; no design.

**Design (untracked):** Outbound HTTP plugin. Failures must not block case CRUD. Feature flag can disable it. Rate-limit AI endpoints. Log calls at a high level without storing API keys. Ground summaries in the current case.

**[TBD - requires confirmation]:** Provider SDK vs raw HTTP, timeout/retry, prompt storage, streaming vs one-shot.

---

## RAG architecture

**In git:** Absent.

**Design (untracked):** Product intent only — knowledge-base Q&A with **citations** to article titles/ids; Lead owns playbook content; Admin may toggle the KB feature. `KnowledgeArticle` listed as **later**, not day-one schema.

**[TBD - requires confirmation]:** Chunking, embeddings model, vector database vs Postgres full-text, retrieval k, citation format, article CRUD API.

---

## Database access approach

**In git:** Unspecified.

**Design (untracked):** Postgres source of truth; Prisma ORM and migrations when the data-model **implementation** slice starts. Search = filtered SQL, not Elasticsearch.

See [`DATABASE.md`](./DATABASE.md).

---

## Error handling

**In git:** Use consistent API responses and error handling. No codes or payload documented.

**[TBD - requires confirmation]:** Error envelope (`{ error: { code, message } }` vs other), mapping of 400/401/403/404/409/429/500, whether Prisma errors leak.

---

## Logging

**In git:** Deployment chapter says explain how to troubleshoot **logs** when deployment work begins. No logger, format, or destination.

**Design (untracked):** Audit events are a **data** trail, not application logs. AI calls logged at high level.

**[TBD - requires confirmation]:** Library (pino/winston/console), request ids, log level via env, where logs go in production.

---

## Deployment architecture

**In git:** When deployment begins: explain architecture, commands, env vars, verification, common failures, logs. No host, Docker, or PaaS named.

**[TBD - requires confirmation]:** Where web, API, and Postgres run; TLS; backup; env var names.

---

## CI/CD

**In git:** No `.github/`, no pipelines.

**[TBD - requires confirmation]:** CI provider, required checks (lint, typecheck, test), deploy pipeline.
