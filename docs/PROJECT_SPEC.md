# OpsNinja / OpsPilot — Project specification

**Purpose:** Permanent product context for future agents.

**How to read this file**

| Provenance | Meaning |
|---|---|
| **In git** | Tracked in this repository today |
| **Design (untracked)** | Written in [`.cursor/plans/opsninja_product_prd_9b154559.plan.md`](../.cursor/plans/opsninja_product_prd_9b154559.plan.md); **not** committed as of last inspect |
| **[TBD - requires confirmation]** | Not present in git or in that design document |

**Repository inspect (2026-10-02)**

- Git: yes. Tracked files: `Agents.md` only.
- Commits: `dbbc63f` empty `Agents.md`; `21d6444` AI development instructions.
- Untracked: `.cursor/` (PRD/plan).
- No `package.json`, no application source, no `.gitignore`, no CI config.
- Folder `docs/` did not contain these files before this write.

---

## Project overview

**In git (`Agents.md`):** The heading is “OpsNinja - AI Development Instructions.” The project paragraph names **OpsPilot**, a portfolio-grade AI-powered operations case management platform meant to show full-stack engineering skill. The goal is that the developer understands architecture, data flow, business logic, security, AI integration, testing, and deployment—not merely generated code.

**Design (untracked):** Product name **OpsNinja** for a fictional company **Harborlane Retail**. The case is the system of record: categorize, assign, discuss on the case, red-flag, finish, archive. Admin is platform-only; Lead / Manager / Associate own operational data.

**[TBD - requires confirmation]:** Canonical public name (OpsNinja vs OpsPilot) for README, packages, and deployment.

---

## Problem statement

**In git:** Not stated beyond “operations case management platform.”

**Design (untracked):** Harborlane’s operational problems live in email, spreadsheets, and chat. Nobody owns the issue; status and priority are informal; deadlines slip; similar incidents are not reused; hand-offs lose context. OpsNinja is the single memory of an operational problem until it is finished and archived.

---

## Target users

**In git:** Not listed.

**Design (untracked):** Internal Harborlane employees only.

| Role | Cares about |
|---|---|
| Admin (tech operator) | Accounts, roles, reporting lines, feature flags, usage analytics. Not the case queue. |
| Lead | Open cases, red-flag inbox, managers, archive integrity |
| Manager | Their associates’ queue, assignment, finishing team work |
| Associate | Solving assigned (and self-opened) cases |

**Out of MVP (design):** External customers, vendors, contractors without Harborlane accounts.

---

## User roles

**In git:** Not defined. Rules require protecting authenticated endpoints and enforcing authorization on the backend—no role names.

**Design (untracked):** Exactly four roles. Platform power (Admin) must not mix with operations data power (Lead → Manager → Associate).

- **Admin:** Add/deactivate people; assign Lead/Manager/Associate; set reporting lines; feature flags; usage **counts**; break-glass **read-only** with reason and log. Cannot finish/archive/comment/edit cases in normal use; cannot disable the audit log.
- **Lead:** All company cases; red-flag inbox; reassign across teams; all case verbs including archive/unarchive. Cannot create users or flip global feature flags.
- **Manager:** Own team only; assign their Associates; finish; archive finished team cases. Cannot run another Manager’s team.
- **Associate:** Own queue; add categorized cases; comment; @tag; red-flag; finish. Cannot assign others, archive, or see the company-wide queue.

**Locked in design:** Admin does not have day-to-day case oversight. v1 break-glass: explicit emergency **read** of a case, logged, no writes.

---

## Finalized features (design only; none implemented)

Present only in the untracked PRD:

- Add case with **category** (at least Normal, Escalation; also Inventory, Vendor, Customer, Other).
- Assign; **red-flag** (Lead inbox + Manager team view); **finish**; **archive** (not hard delete).
- Case discussion + **@mentions** + in-app “you were tagged.”
- Employee **profiles** / directory (light, not HR files).
- Search and filters; **history** of case changes and interactions.
- Four UI shells: Associate queue, Manager team, Lead command, Admin console.
- Admin: people, flags, usage counts, break-glass read-only.

**Not a v1 product:** Slack-like channels/DMs as the primary surface (discussion is on the case).

---

## MVP scope

**In git:** Not specified.

**Design (untracked) must-ship:**

- Auth + four roles + reporting lines
- Scoped queues
- Add / categorize / assign / red-flag / finish / archive
- Discussion + @mentions
- Lead and Manager dashboards
- Admin console as above
- Profiles, search, history
- Basic web UI per role
- AI add-on later in the same v1 **sequence**, scoped to visible cases (not load-bearing)

**MVP success (design):** Admin cannot quietly edit an archived incident; Lead sees every red flag; Manager only runs their funnel; Associate only works their cases.

**Explicitly out of MVP (design):** Slack clone, hard delete, editing audit logs, Jira boards/sprints, autonomous agents mutating cases, AI required to finish work, multi-tenancy, native mobile, billing, BPMN, IoT, Admin god mode, Admin analytics of case **content**, big-bang codegen.

---

## Future features

**In git:** Not listed.

**Design (untracked):** Channels/DMs linkable to a case; email notifications; dual-approval break-glass; SLA clocks; auto-escalate stale red flags; attachments; saved views; bulk assign/archive; customer/vendor portal; AI auto-categorize with human confirm; multi-tenant SaaS; full-text search engine; real-time presence.

---

## AI features

**In git:** AI integration is a required **learning** topic. No model, vendor, or feature list.

**Design (untracked):**

| Feature | Guardrail |
|---|---|
| Case summary | Grounded in this case only; labeled AI-generated |
| Next actions | Suggestions only; no auto status/finish |
| Knowledge-base search | Cite articles; if empty, say so |

AI is a plugin. Cases must work if the model is down. Admin may disable the AI **feature flag**. Do not send HR-private data that is not on the case or allowed KB.

**[TBD - requires confirmation]:** LLM vendor, model name, API contract, embeddings/vector store for RAG, knowledge-article schema in code.

---

## Technology stack

**In git (`Agents.md`):** TypeScript wherever possible; environment variables for configuration; no hardcoded secrets. No runtime, framework, or database named.

**Design (untracked, called “locked” there):** React (**Vite**) frontend; **Express** TypeScript API; **Postgres**; **Prisma** as v1 ORM default; optional outbound AI HTTP client. Fastify noted as a substitute that would not change modules.

**Not in repository:** `package.json`, lockfile, Docker, ORM schema, frontend app.

**[TBD - requires confirmation]:** Node.js version, package manager, Express vs Fastify in the first `package.json`, exact Prisma version, test runner, UI component library.

---

## External resources / services

**In git:** None named.

**Design (untracked):** External LLM for the AI plugin; Postgres as data store.

**[TBD - requires confirmation]:** Hosting (API, web, DB), LLM provider account, email/SMS (explicitly not MVP), object storage for attachments (future).

---

## Project constraints

**In git (`Agents.md`):**

- Simple, maintainable solutions; few unnecessary dependencies.
- Do not rewrite working code without a reason.
- Validate input; consistent API errors; services separate from routes.
- Authenticate protected endpoints; authorize on the backend.
- Tests for important business logic.
- Incremental changes; explain before/after major work; never claim unverified success.
- Optimize for learning and interview defense.
- Teaching loop on non-trivial features (concept, flow, alternatives, failures, security).

**Design (untracked):** Design → explain → implement **one** part → test → teach. Single tenant. No microservices/message bus in v1. Teaching loop to be copied into `Agents.md` + Cursor rule when implementation starts (todo still pending).

---

## Success criteria

**In git:** Developer can defend architecture, data flow, business logic, security, AI, testing, and deployment.

**Design (untracked):** MVP success as above; product usable without AI; official case data not writable by Admin except the logged read-only break-glass path.

**[TBD - requires confirmation]:** Quantitative SLAs, test coverage %, production URL, when the product is “demo ready.”
