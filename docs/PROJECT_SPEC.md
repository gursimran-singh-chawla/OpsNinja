# OpsNinja — Product specification

**Status:** Current design. Implementation is in progress. See Implemented vs Future below.

Canonical name: **OpsNinja**. Historical name OpsPilot is obsolete.

Harborlane Retail is the fictional company.

## Overview

OpsNinja is an internal operations platform. People communicate about operational problems, turn them into accountable cases, control who can see each case, assign responsibility, escalate, resolve, and keep a full history.

Two surfaces:

- **Operations:** users, roles, cases, visibility, routing, assignment, escalation, resolution, history, dashboards, search
- **Communication:** global chat, DMs, mentions, notifications, persistent messages, links between chat and cases

AI is an assistance layer. It does not run the company.

Not in v1: Slack clone, Jira clone, HR system, social network, autonomous agents, multi-tenant SaaS.

## Problem

Operational issues at Harborlane scatter across email, spreadsheets, and chat. Ownership, visibility, and responsibility get mixed up. OpsNinja keeps **who created it**, **who can see it**, and **who owns the work** as three separate facts.

## Roles

| Role | Purpose |
|---|---|
| Admin | Users, roles, reporting lines, feature flags, usage aggregates. Not a case superuser. Optional logged read-only break-glass. |
| Lead | Organization-wide operational visibility, routing, dashboards, full case verbs. |
| Manager | Own team + free-agent Associates. Cannot assign another Manager’s Associates. |
| Associate | Do assigned work. May report to a Manager or be a free agent (`reportsToId` null). |

Anyone authenticated may **create** cases. Later permissions depend on role, visibility, assignment, and server policy.

## Case visibility

`GLOBAL` | `TEAM` | `DIRECT`

- **GLOBAL:** visible to operational workspace users (not Admin case queue by default).
- **TEAM:** selected Manager, that Manager’s Associates, Lead, creator as applicable.
- **DIRECT:** explicitly granted users + Lead org-wide visibility. Not an entire team.

Assignment (`assigneeId`) is independent of visibility.

## Case lifecycle

`OPEN` (neither timestamp) → `FINISHED` (`finishedAt`) → `ARCHIVED` (`archivedAt`). No hard delete.

Categories: `normal`, `escalation`, `inventory`, `vendor`, `customer`, `other`.

## Communication

One global conversation. One-to-one DMs. Mentions create records and notifications. Case comments are a separate thread. Chat can spawn a case with a source-message link.

## AI

Summary, suggested next actions, catch-up on cases the user can already view. Failures do not block cases or chat. RAG/knowledge base is **future** after core + case AI.

## Stack (current design)

React + TypeScript + Vite + Tailwind · Express + TypeScript · PostgreSQL + Prisma · Socket.IO · LLM API behind a provider interface.

## Implemented

Foundation work is recorded as it lands. At documentation rewrite time the git repo had instructions/docs only.

## Future (deferred)

Mobile app, multi-tenancy, billing, portals, email/SMS, voice/video, group channels, reactions, presence, workflow builder, Elasticsearch, Redis unless needed, autonomous agents, RAG until core is stable.

## Success

A reviewer can log in, get a role-correct UI, chat globally and in DMs, create a case with explicit visibility vs assignment, and see history. API rejects unauthorized access. AI is optional.
