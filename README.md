# OpsNinja

Internal operations platform for Harborlane Retail — one place to talk about operational problems, turn them into accountable tasks, control who can see them, assign ownership, and keep history.

**Canonical name:** OpsNinja. Domain object: **task**.

## Problem

Operational issues scatter across email, chat, and spreadsheets. Creator, audience, and owner get mixed together.

## Solution

OpsNinja keeps **who created it**, **who can see it**, and **who owns the work** as three separate facts:
- Explicit **visibility** (`GLOBAL` / `TEAM` / `DIRECT`) is independent of **assignment**.
- Free-agent Associates (`reportsToId: null`) can be assigned by authorized Managers/Leads or self-assign.
- Global chat and 1:1 DMs persist in PostgreSQL with live Socket.IO delivery.
- Admin manages users, roles, and platform metrics, with strictly no access to task content.
- AI assists (summaries, next actions); it never mutates tasks.

## Roles

| Role | Operational Scope |
|---|---|
| **Admin** | User onboarding/offboarding, roles, reporting lines, feature flags, system metrics. Sees no task content. |
| **Lead** | Organization-wide operational visibility, routing, dashboards, full task verbs. |
| **Manager** | Own team + free-agent Associates. Cannot assign another Manager's Associates. |
| **Associate** | Assigned work execution. May self-assign unassigned visible tasks. May be a free agent. |

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, Socket.IO
- **Database:** PostgreSQL, Prisma ORM
- **Security:** Argon2id (`hash-wasm`), HTTP-only session cookies, backend authorization

## Local Setup

### 1. Prerequisites
- Node.js >= 20
- PostgreSQL (running locally on port 5432 or via Docker)

### 2. Configure Environment
```bash
cp .env.example .env
cp .env.example backend/.env
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
- **On-Demand Briefing:** Generates an executive operational briefing on the `Summary` dashboard with role-specific task counts, overdue warnings, and recommendations.
- **TaskDetail Assist:** Generates task **Summaries**, actionable **Next Actions**, and **Catch-Up** digests with one-click **Copy** and **Insert into comment** capabilities.
- **Provider Support:** Runs on a smart, zero-key **Mock Engine** out of the box. To activate live Google Gemini generation, set `AI_PROVIDER="gemini"` and your free `AI_API_KEY` in `.env`. SimuAI automatically degrades gracefully to the mock engine if the external API is unreachable.

## Testing

```bash
npm test
```
Runs Vitest test suites covering task policy, board ranking, route authorization, chat privacy boundaries, and SimuAI engine/fallback.

## Architecture & Decisions

- [PROJECT_SPEC.md](docs/PROJECT_SPEC.md) — Product requirements and lifecycle rules.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System boundaries and component interactions.
- [DECISIONS.md](docs/DECISIONS.md) — Architecture Decision Records (ADRs).
