# OpsNinja — System Architecture & Agent Instructions

## Product

OpsNinja is Harborlane Retail’s internal operations platform.

It is a unified, real-time workspace to communicate about operational issues, turn them into accountable **tasks**, enforce fine-grained visibility, assign responsibility, escalate, resolve, track deadlines, and maintain full audit history.

**Canonical Name:** OpsNinja. Domain and user-facing terminology is strictly **task** (not case or ticket).

---

## Locked Product Rules

- **Four Roles:** `Admin`, `Lead`, `Manager`, `Associate`.
- **Three-Way Separation:** `Creator`, `Visibility`, and `Assignee` are separate concepts. Never collapse them into one field.
- **Visibility Types:** `GLOBAL` | `TEAM` | `DIRECT`.
- **Free Agents:** Associates may be free agents (`reportsToId` is null). This is a reporting attribute, not a fifth role.
- **Task Creation:** Lead, Manager, and Associate may create tasks across all work kinds (`task`, `escalation`, `backlog`, `report`).
- **Admin Isolation:** Admin represents platform infrastructure and identity authority, not a task superuser. **Admin sees no task content** (no exceptions). Task content is redacted in audit logs for Admin.
- **Assignment Boundaries:**
  - Managers cannot assign another Manager’s direct reports.
  - Free agents may be assigned by authorized Managers or Leads.
  - Associates cannot assign others. They may **self-assign** an unassigned visible task or leave it unassigned.
- **Organizational Visibility:** Leads possess organization-wide operational visibility across all tasks.
- **Lifecycle & Retention:** Active → Complete (`finishedAt`, `completedAt`) → Archived (`archivedAt`). Tasks completed for more than 48 hours are automatically archived (`archiveAfter = completedAt + 48h`) by a lightweight background sweep worker. Tasks are never hard-deleted. Restoring an archived task grants a fresh 48-hour review window. Reopening resets all completion and archival timestamps.
- **Computed Deadlines:** **Due** is computed dynamically (`finishedAt == null && dueAt < now`). It is not a manual status flag.
- **Database Truth:** PostgreSQL is the single source of truth. WebSockets (Socket.IO) are strictly ephemeral event relays.
- **Non-Destructive AI:** AI assists with operational briefings, summaries, next action recommendations, and catch-up digests. AI never mutates tasks. The platform remains fully operational if AI is offline.
- **Tenancy:** Single tenant. Private repository.

---

## Identity, Authentication & Security Rules

1. **Passwords:** Pure Argon2id hashing via `hash-wasm` (WASM; no native Windows toolchain required).
2. **Bot Protection:** Cloudflare Turnstile verification on signup and login (bypassed safely in dev/test when key is omitted).
3. **Two-Step Email Verification:**
   - 6-digit numeric OTP generated via crypto.
   - Only SHA-256 OTP hashes stored in the database.
   - Sent via EmailJS REST API client with timeout protection.
   - Enforces a 10-minute TTL, 5-attempt rate limit, and 60-second resend cooldown timer.
   - Incomplete signup records are automatically deleted if email delivery fails.
4. **Mandatory Admin Approval Gate:**
   - New accounts require administrative approval (`approvedAt != null`) before login is permitted.
   - Unapproved users receive HTTP 403 `account_pending_approval`.
   - Socket.IO handshake enforces strict parity with HTTP session middleware; unapproved accounts are rejected.
5. **Session Management:**
   - Cryptographically random 32-byte session tokens stored in the `Session` table.
   - HTTP-only session cookies (`opsninja.sid`) with symmetrical `cookieOpts()` on login and logout.
   - Production defaults to `SameSite=None; Secure=true` for cross-origin SPA/API deployments.

---

## Collaboration & Operational Features

- **Realtime Chat & DMs:** Global operations conversation + 1:1 Direct Messages (DMs). Deterministic DM pairing via `directKey`, user-scoped conversation deletion (`clearedAt` on `ConversationParticipant`), participant checks preventing empty ghost conversations, and Socket.IO room authorization on join.
- **Operations Calendar:** Day, Week, and Month views displaying task deadlines (`dueAt`). Overdue tasks are highlighted. Admin access is strictly guarded.
- **Video Meetings:** Meetings hub with Jitsi Meet integration (`meet.jit.si`) for rapid operational syncs with status lifecycles.
- **Role-Based Activity & System Audit Logs:**
  - Regular users see only **Task Activity Logs** (`task.created`, `task.assigned`, `task.completed`) strictly scoped to visible tasks.
  - Platform administrators review **System & Account Logs** (`user.*` lifecycle and platform maintenance events) with task content redacted.
- **SimuAI Intelligence:**
  - Provider abstraction (`AiProvider`) supporting **Groq** (`openai/gpt-oss-20b` default via OpenAI-compatible REST completions), **Gemini** (`gemini-3.8-flash`), and offline **Mock** fallback.
  - Operational briefings rendered via `react-markdown` and `remark-gfm` supporting tables, checklists, and operational metrics.
  - Request rate limiting (`aiLimiter`: 30 req/min) and graceful degradation on provider errors or rate limits (HTTP 429).

---

## Technical Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 4, React Router 6, Socket.IO Client 4, React Markdown 10 |
| **Backend** | Node.js (>=20), Express 4, TypeScript, Zod, Argon2id (`hash-wasm`), Socket.IO 4, Helmet, Express-Rate-Limit |
| **Database & ORM** | PostgreSQL, Prisma 5 (migrations strictly tracked) |
| **Integrations** | Groq Chat Completions API, Google Gemini API, EmailJS REST API, Cloudflare Turnstile |

---

## Project Structure

```
OpsNinja/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema & indexes
│   │   ├── migrations/         # Tracked SQL migrations (9 applied)
│   │   └── seed.ts             # Deterministic mock operations seed
│   └── src/
│       ├── config/env.ts       # Validated Zod environment configuration
│       ├── middleware/         # Session auth, role checks, error handler
│       ├── modules/
│       │   ├── identity/       # Auth, OTP, EmailJS, Turnstile, Users
│       │   ├── tasks/          # Policy, RBAC, fractional rank, task service, 48h auto-archive
│       │   ├── communication/  # Chat service, DM lifecycle, clearedAt, Socket.IO
│       │   ├── platform/       # Admin metrics, user management, audit logs, log service
│       │   └── ai/             # AiProvider, Groq, Gemini, Mock providers
│       ├── app.ts              # Express application setup
│       └── server.ts           # HTTP & Socket.IO server entrypoint, archive worker lifecycle
├── frontend/
│   └── src/
│       ├── api.ts              # API client with VITE_API_BASE_URL & ApiError
│       ├── auth.tsx             # Auth context, user state, approval feedback
│       ├── components/         # MarkdownRenderer, TurnstileWidget, modals
│       ├── pages/              # Summary, Tasks (List/Board), People, Admin, Chat, Calendar, Meetings, Logs
│       └── Shell.tsx           # Responsive layout & role-aware navigation
├── docs/                       # Architecture, Database, Decisions, Guides
└── package.json                # Monorepo workspaces manifest
```

---

## Engineering & Quality Guidelines

1. **Backend Authorization:** Authorize every operation on the backend. Frontend UI hiding is UX only.
2. **Zero Client Trust:** Never trust client `role`, `userId`, or visibility assertions.
3. **Secret Hygiene:** Secrets live exclusively in environment variables. Never commit `.env` or `.env.*`.
4. **Input Validation:** Validate all incoming payloads with Zod schemas. Return consistent error responses (`{ error: { code, message } }`).
5. **No Native Toolchains:** Avoid dependencies requiring `node-gyp` or C++ build tools on Windows.
6. **Database Integrity:** Foreign keys, cascades, and constraints must be declared in Prisma schema and migrations.
7. **Verification First:** Never claim code works without running verification tests.

---

## Verification Commands

Execute read-only verification before pushing changes:

```bash
# Run all backend tests (169 tests across 9 test suites)
npm test

# Verify backend TypeScript compilation
npm run typecheck --workspace=backend

# Verify frontend production bundle build
npm run build --workspace=frontend
```

---

## Communication with the Developer

- Keep chat replies concise and evidence-based.
- Do not ask for permission on file layout, naming, or minor copy.
- Stop only for credentials, paid services, destructive data loss, or irreconcilable product conflicts.
- After each major milestone report only: **Completed** / **Verification** / **Known Issues** / **Next Milestone**.
