# OpsNinja

Internal operations platform for Harborlane Retail — one place to talk about operational problems, turn them into accountable cases, control who can see them, assign ownership, and keep history.

**Live demo:** not deployed yet (first production gate pending Render/Vercel credentials).

## Problem

Issues scatter across email, chat, and spreadsheets. Creator, audience, and owner get mixed together.

## Solution

Explicit **visibility** (`GLOBAL` / `TEAM` / `DIRECT`) is separate from **assignment**. Global chat and DMs persist in Postgres. AI may summarize cases later; it never mutates records.

## Roles

Admin (platform) · Lead (org operations) · Manager (team + free agents) · Associate (work; may have no manager).

## Stack

React + Vite + Tailwind · Express + TypeScript · PostgreSQL + Prisma · Socket.IO

## Local setup

```bash
docker compose up -d
cp .env.example .env
cp .env.example backend/.env
npm install
cd backend && npx prisma migrate dev --name init && npx prisma db seed && cd ..
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173

Demo password for all seed users: `Harborlane!26`

| Role | Email |
|---|---|
| Lead | sarah.okonkwo@harborlane.example |
| Manager | marcus.hale@harborlane.example |
| Associate | ravi.mehta@harborlane.example |
| Free agent | amira.hassan@harborlane.example |
| Admin | priya.nair@harborlane.example |

## Testing

`npm test` — case visibility/assignment policy.

## Security

Argon2id passwords, HTTP-only sessions, backend authorization, no case god-mode for Admin.

## Roadmap

Break-glass UI, production deploy, AI summaries, RAG.
