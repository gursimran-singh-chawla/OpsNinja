# OpsNinja / OpsPilot

Portfolio-grade AI-powered operations case management platform (in development).

## Prerequisites

- Node.js 22+
- npm 10+

## Setup

```bash
npm ci
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Create demo case** to exercise the cases API.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

## API

- `GET /api/health` — service health
- `GET /api/cases` — list in-memory demo cases
- `POST /api/cases` — create a case (`{ "title": "...", "priority": "medium" }`)

## Environment variables

Copy `.env.example` to `.env.local` when adding secrets (AI providers, database, etc.). The current scaffold runs without required secrets.
