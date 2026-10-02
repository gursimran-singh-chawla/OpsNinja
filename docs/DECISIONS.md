# Architecture decision records

**Rule:** Only decisions that appear in git (`Agents.md`) or in the untracked PRD [`.cursor/plans/opsninja_product_prd_9b154559.plan.md`](../.cursor/plans/opsninja_product_prd_9b154559.plan.md). Nothing invented. Status reflects **documentation vs implementation**.

No application code implements these yet.

---

## ADR-001 — TypeScript by default

- **Decision:** Use TypeScript wherever possible.
- **Reason:** Portfolio/interview-grade codebase; `Agents.md` development rule 1.
- **Alternatives:** JavaScript-only; mixed JS/TS.
- **Tradeoffs:** More setup and types vs safer refactors and clearer APIs.
- **Status:** Accepted in `Agents.md`. **Not implemented** (no `tsconfig` or source).
- **Source:** `Agents.md`

---

## ADR-002 — Secrets only in environment variables

- **Decision:** Never hardcode secrets or API keys; use environment variables.
- **Reason:** Security; `Agents.md` rules 5–6.
- **Alternatives:** Committed `.env` with secrets (rejected by the rule); secret manager (not specified).
- **Tradeoffs:** Local setup needs env files that must stay untracked.
- **Status:** Accepted in `Agents.md`. No `.env.example` in git.
- **Source:** `Agents.md`

---

## ADR-003 — Business logic in services, not routes

- **Decision:** Keep business logic separate from controllers/routes; write reusable services.
- **Reason:** Testability and interview-clear layering; `Agents.md` rules 9–10, 13.
- **Alternatives:** Fat routes; domain in the ORM layer only.
- **Tradeoffs:** More files vs testable rules without HTTP.
- **Status:** Accepted in `Agents.md`. No services exist yet.
- **Source:** `Agents.md`

---

## ADR-004 — Authorization enforced on the backend

- **Decision:** Protect authenticated endpoints; enforce authorization on the server; do not trust the client for access control.
- **Reason:** UI hiding is not security; `Agents.md` rules 11–12. PRD repeats: never trust client for role/assignee/status.
- **Alternatives:** Frontend-only role gates (rejected).
- **Tradeoffs:** Every route needs policy checks.
- **Status:** Accepted in docs. **No authz code.**
- **Source:** `Agents.md`; PRD security / architecture sections

---

## ADR-005 — Incremental, taught slices (not big-bang)

- **Decision:** Prefer incremental changes; explain approach before major work; after changes explain what/why/files/risks/how to test; never claim unverified success. Teaching mode on non-trivial features. PRD forbids dumping a finished app.
- **Reason:** Learning and interview defense; `Agents.md` rules 14–20 and Teaching Mode. PRD working agreement.
- **Alternatives:** Generate the full stack in one pass (explicitly rejected in the PRD).
- **Tradeoffs:** Slower calendar progress vs a codebase the author can defend.
- **Status:** Accepted in `Agents.md` + PRD. Cursor rule / `Agents.md` loop copy still **pending** in the PRD todo list.
- **Source:** `Agents.md`; PRD “How we work”

---

## ADR-006 — Modular monolith (one API, one database, many modules)

- **Decision:** Modular monolith, not microservices and not one unstructured server file.
- **Reason:** PRD: avoid extra networks/deploys; keep modules teachable. Search stays in Postgres (no Elasticsearch in v1). No message bus for red flags in v1.
- **Alternatives:** Microservices per module; serverless functions per route; modular monolith with a bus.
- **Tradeoffs:** Single deploy vs independent scaling; simpler ops vs less isolation.
- **Status:** Proposed in PRD (“locked” there). **No modules on disk.**
- **Source:** PRD architecture

---

## ADR-007 — Vite React + Express + Postgres (+ Prisma default)

- **Decision:** TypeScript React (Vite) talks to a TypeScript Express HTTP API; Postgres is source of truth; Prisma is the v1 ORM default. Optional AI HTTP client. Fastify is documented as a substitute that does not change modules.
- **Reason:** PRD: Vite keeps UI simple; Express is interview-familiar; Postgres fits relational users/cases/history. User selected this stack in the design conversation (recorded in the PRD).
- **Alternatives:** Next.js App Router (offered, not selected); Fastify instead of Express.
- **Tradeoffs:** Two processes vs one Next.js app; Prisma convenience vs SQL-in-your-face (Drizzle not chosen in the PRD).
- **Status:** Proposed / called locked in PRD. **No `package.json`.**
- **Source:** PRD architecture

---

## ADR-008 — Session cookie authentication (not localStorage JWT)

- **Decision:** Authenticate with HttpOnly Secure session cookie (server-side session or signed token in the cookie). Do not put JWTs in `localStorage`.
- **Reason:** PRD: XSS would steal a JS-readable token. Role is not stored as authority in the cookie.
- **Alternatives:** Bearer JWT in memory; localStorage JWT (rejected in PRD).
- **Tradeoffs:** CSRF considerations for cookies vs XSS risk of localStorage.
- **Status:** Proposed in PRD. **No authentication code** (and none added in this documentation step).
- **Source:** PRD architecture

---

## ADR-009 — Four roles with separation of duties

- **Decision:** Roles are Admin, Lead, Manager, Associate. Admin is platform (people, flags, usage counts). Ops data is Lead ⊃ Manager ⊃ Associate. Admin has no day-to-day case content access.
- **Reason:** PRD: a tech admin with god mode can rewrite official history. Funnel matches a company org chart.
- **Alternatives:** Earlier draft mixed Specialist/Lead/Manager (superseded in the PRD). Admin as superuser of all cases (rejected).
- **Tradeoffs:** Reporting-line data and scoped queries vs simpler “everyone sees everything.”
- **Status:** Proposed / locked in PRD. Not in `Agents.md` role list (Agents.md has no roles).
- **Source:** PRD user roles

---

## ADR-010 — Break-glass is read-only, logged, v1

- **Decision:** Admin may open a case only in explicit emergency mode with a reason, expiry, and access log visible to Lead. No comments, finish, archive, or edits. No queue browsing without that mode.
- **Reason:** PRD: incidents (locked Lead account) vs silent god mode. User selected v1 break-glass “open cases” in the design conversation; PRD interpreted that as **read-only**.
- **Alternatives:** Never allow Admin to see cases; dual-approval later (listed as future); write access in emergency (not in PRD).
- **Tradeoffs:** Operational recovery vs residual read of sensitive case text.
- **Status:** Proposed in PRD.
- **Source:** PRD roles + security

---

## ADR-011 — Archive instead of hard delete; finish is a timestamp

- **Decision:** Finish = `finishedAt`. Remove from live board = `archivedAt`. No hard delete of cases or history. User selected archive over hard delete.
- **Reason:** Auditability; PRD explicit avoid-list.
- **Alternatives:** Hard delete; Admin-only hard delete; separate Status enum plus timestamps (PRD chose timestamps).
- **Tradeoffs:** Storage growth vs honest history.
- **Status:** Proposed / locked in PRD.
- **Source:** PRD data model and product decisions

---

## ADR-012 — Discussion on the case, not a Slack clone in v1

- **Decision:** Comments + @mentions on the case; in-app tag notices. Channels/DMs are future modules.
- **Reason:** Keep talk on the system of record. User selected case-threaded discussion.
- **Alternatives:** Full Slack-like v1; DMs plus cases.
- **Tradeoffs:** Less chat product vs no second inbox.
- **Status:** Proposed / locked in PRD.
- **Source:** PRD feature layers

---

## ADR-013 — AI is a plugin, not the core product

- **Decision:** Summarize, next actions, KB search are optional. App works if the provider is down. No autonomous mutation of cases. Admin can disable the flag.
- **Reason:** PRD: judgment is human; hallucinations are costly.
- **Alternatives:** AI-required workflows; agents that close cases.
- **Tradeoffs:** Weaker “AI demo” vs a usable ops tool.
- **Status:** Proposed in PRD. `Agents.md` only requires understanding AI integration, not this split.
- **Source:** PRD AI section; `Agents.md` goal list

---

## ADR-014 — Single tenant; reporting line instead of Team table (v1)

- **Decision:** One fictional company, one tenant. Org tree is `User.reportsToId`. One role per user. UUIDs for ids.
- **Reason:** PRD assumptions and data-model rationale (Team table would duplicate the tree; sequential ids are guessable).
- **Alternatives:** Multi-tenant `organizationId`; Team entity; integer ids; multi-role users.
- **Tradeoffs:** Simpler schema vs later migration if Harborlane-like matrix orgs appear.
- **Status:** Proposed in PRD.
- **Source:** PRD assumptions + data model

---

## Decisions not recorded

The following were **asked for** in the documentation template but **do not exist** as decisions in the repo:

- Concrete error JSON schema
- Logger choice
- CI/CD vendor
- RAG vector store
- Exact LLM vendor
- Express vs Fastify as the first committed dependency (PRD prefers Express, allows Fastify)

Those remain **[TBD - requires confirmation]** until written and accepted.
