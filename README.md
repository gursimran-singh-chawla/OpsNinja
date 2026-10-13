# OpsNinja

Internal operations platform for IG Incorporation — one place to talk about operational problems, turn them into accountable tasks, control who can see them, assign ownership, and keep history.

**Canonical name:** OpsNinja. Domain object: **task**.

## Problem

Operational issues scatter across email, chat, and spreadsheets. Creator, audience, and owner get mixed together.

## Solution

OpsNinja keeps **who created it**, **who can see it**, and **who owns the work** as three separate facts:
- Explicit **visibility** (`GLOBAL` / `TEAM` / `DIRECT`) is independent of **assignment**.
- Free-agent Associates (`reportsToId: null`) can be assigned by authorized Managers/Leads or self-assign.
- Global chat and 1:1 DMs persist in PostgreSQL with live Socket.IO delivery, deterministic DM pairing (`directKey`), room authorization, and user-scoped conversation deletion (`clearedAt`).
- **48-Hour Auto-Archiving:** Completed tasks (`completedAt`) automatically archive after 48 hours via a background sweep worker to keep operational boards uncluttered while preserving complete audit history and allowing one-click restoration.
- **Role-Based Activity & System Logs:** Regular users view Task Activity Logs scoped strictly to visible tasks; platform administrators inspect System & Account Logs with task content redacted.
- Admin manages users, roles, and platform metrics, with strictly no access to task content.
- AI assists (briefings, summaries, next actions, catch-up digests); it never mutates tasks.

## Roles

| Role | Operational Scope |
|---|---|
| **Admin** | User onboarding/offboarding, approval gate, roles, reporting lines, feature flags, system metrics. Sees no task content. |
| **Lead** | Organization-wide operational visibility, routing, dashboards, full task verbs. |
| **Manager** | Own team + free-agent Associates. Cannot assign another Manager's Associates. |
| **Associate** | Assigned work execution. May self-assign unassigned visible tasks. May be a free agent. |

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, Socket.IO
- **Database:** PostgreSQL, Prisma ORM
- **Security:** Argon2id (`hash-wasm`), HTTP-only session cookies, backend authorization, SHA-256 hashed 6-digit email OTPs, Cloudflare Turnstile bot protection

## Authentication, Email Verification & Admin Approval Gate

- **Self-Service Registration:** Protected by Cloudflare Turnstile captcha. Newly registered accounts start unverified (`emailVerifiedAt = null`) and do **not** receive a session.
- **6-Digit OTP:** Cryptographically generated via `crypto.randomInt`, delivered via EmailJS REST API client with timeout protection, valid for 10 minutes. Only SHA-256 hashes are stored in PostgreSQL.
- **Brute-Force & Flood Safeguards:** Max 5 incorrect attempts before OTP invalidation; 60-second resend cooldown timer; rate-limited endpoints.
- **Mandatory Admin Approval Gate:** Following email verification, accounts require administrative approval (`approvedAt != null`) before login is permitted. Unapproved accounts receive HTTP 403 `account_pending_approval`.
- **Internal / Seeded Users:** Demo and Admin-provisioned accounts are verified and approved immediately upon creation.

## Local Setup

### 1. Prerequisites
- Node.js >= 20
- PostgreSQL (running locally on port 5432 or via Docker)

### 2. Configure Environment
```bash
cp .env.example .env
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Install & Initialize
```bash
npm install
npm run prisma:generate --workspace=backend
npm run db:migrate
npm run db:seed
```

### 4. Run Development Servers
```bash
# In separate terminals (or concurrently)
npm run dev:backend
npm run dev:frontend
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:4000`

### Demo Credentials

Password for all seeded accounts: `Harborlane!26`

| Role | Email |
|---|---|
| Lead | `sarah.okonkwo@harborlane.example` |
| Manager | `marcus.hale@harborlane.example` |
| Associate | `ravi.mehta@harborlane.example` |
| Free Agent (Associate) | `amira.hassan@harborlane.example` |
| Admin | `priya.nair@harborlane.example` |

## SimuAI (AI Assistance)

OpsNinja includes **SimuAI**, an internal AI operational copilot:
- **On-Demand Briefing:** Generates an executive operational briefing on the `Summary` dashboard with role-specific task counts, overdue warnings, and recommendations rendered with Markdown tables and checklists.
- **TaskDetail Assist:** Generates task **Summaries**, actionable **Next Actions**, and **Catch-Up** digests with one-click **Copy** and **Insert into comment** capabilities.
- **Provider Support:**
  - **Groq (Default):** Runs against Groq's official Chat Completions API with `openai/gpt-oss-20b` (`AI_PROVIDER="groq"`, `GROQ_API_KEY`).
  - **Google Gemini:** Runs against Gemini 3.8 Flash (`AI_PROVIDER="gemini"`, `AI_API_KEY`).
  - **Mock Engine:** Zero-key offline engine fallback for testing and development.
  - Rate-limited to 30 requests/minute with graceful error handling and degradation on provider timeouts or rate limits.

## Testing

```bash
npm test
```
Runs 169 tests across 9 test suites in Vitest covering:
- 48-hour automated task archiving, countdown lifecycle, sweep processing, and view filtering (`archive.test.ts`)
- Role-based Task Activity Logs and Admin System Audit Logs separation (`logs.test.ts`)
- Task policy, RBAC boundaries, and fractional board ranking (`policy.test.ts`, `boardRank.test.ts`)
- Socket.IO DM room authorization, clearedAt deletion, and privacy boundaries (`chat.test.ts`)
- Two-step EmailJS OTP verification, Cloudflare Turnstile bot verification, and Admin approval (`auth.verification.test.ts`, `email.service.test.ts`)
- SimuAI multi-provider engine, Groq/Gemini APIs, and offline fallback (`ai.test.ts`)
- Route-level role-based access control (`routes.authz.test.ts`)

## Architecture & Decisions

- [PROJECT_SPEC.md](docs/PROJECT_SPEC.md) — Product requirements and lifecycle rules.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System boundaries and component interactions.
- [DECISIONS.md](docs/DECISIONS.md) — Architecture Decision Records (ADRs).
