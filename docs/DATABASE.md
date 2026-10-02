# Database

**How to read this file:** Same provenance as [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

---

## Database technology

**Currently in the repository:** None. No Prisma/Drizzle schema, no SQL migrations, no Docker Compose, no connection string sample (and none should be committed with secrets).

**Design (untracked):** PostgreSQL as the source of truth. Prisma named as v1 ORM default.

**[TBD - requires confirmation]:** Postgres major version, managed vs local, connection pooling, Prisma vs another client in the first implementation commit.

---

## Collections / tables currently defined

**None.** There are no tables, collections, or ORM models in git or in any application folder.

The rest of this file is **proposed** in the untracked PRD, for future agents. It must not be treated as applied schema.

---

## Proposed tables (design, not created)

Source: [`.cursor/plans/opsninja_product_prd_9b154559.plan.md`](../.cursor/plans/opsninja_product_prd_9b154559.plan.md) data-model section.

### User

| Field | Notes in design |
|---|---|
| id | UUID |
| email | unique |
| name | |
| passwordHash | never plaintext |
| role | enum `admin \| lead \| manager \| associate` (one role) |
| reportsToId | nullable FK → User; Associate→Manager, Manager→Lead; Lead/Admin null |
| deactivatedAt | nullable; deactivate not delete |
| createdAt, updatedAt | |

### Session

| Field | Notes |
|---|---|
| id | session id in cookie |
| userId | FK → User |
| expiresAt, createdAt | |

### Case

| Field | Notes |
|---|---|
| id | UUID |
| title, description | |
| category | `normal \| escalation \| inventory \| vendor \| customer \| other` |
| createdById | reporter |
| assigneeId | nullable |
| assignedById | **recommended** nullable, not fully locked as required |
| redFlag | boolean, default false |
| finishedAt | nullable |
| archivedAt | nullable; live queue = `archivedAt IS NULL` |
| createdAt, updatedAt | |
| deadlineAt | optional later; not required to start |

### Comment

| Field | Notes |
|---|---|
| id, caseId, authorId, body, createdAt | append-only in v1 |

### Mention

| Field | Notes |
|---|---|
| id, commentId, mentionedUserId | written at comment create |

### Notification

| Field | Notes |
|---|---|
| id, recipientId | |
| type | `mention \| red_flag` |
| caseId, actorId | |
| readAt | nullable |
| createdAt | |

### AuditEvent

| Field | Notes |
|---|---|
| id | |
| actorId | nullable if system |
| action | e.g. `case.created`, `case.finished`, `break_glass.read` |
| entityType, entityId | |
| metadata | JSON old/new; no update/delete APIs |

### FeatureFlag

| Field | Notes |
|---|---|
| key | e.g. `ai`, `knowledge_base` |
| enabled | |
| updatedById, updatedAt | |

### BreakGlassSession

| Field | Notes |
|---|---|
| id, adminUserId | |
| reason | required text |
| startedAt, expiresAt | |
| endedAt | nullable |

### BreakGlassAccess

| Field | Notes |
|---|---|
| id, sessionId, caseId, accessedAt | every Admin case **read** in emergency mode |

### Explicitly later (design)

- KnowledgeArticle
- AiCallLog
- Attachments, watchers, custom fields, `organizationId`

**First implementation slice in the PRD:** `User` + `Session` only.

---

## Fields (implemented)

**None in repository.**

---

## Relationships (proposed)

- User `reportsTo` User (tree).
- User has many Sessions, created Cases, assigned Cases.
- Case has many Comments; Comment has many Mentions.
- Case/User participate in Notifications.
- User acts on AuditEvents.
- Admin User starts BreakGlassSession; session has many BreakGlassAccess rows to Cases.

Visibility of cases is **not** a column; it is a query (see query patterns).

---

## Indexes (proposed, not created)

- User: unique email; `reportsToId`; `role`; `deactivatedAt`.
- Case: `assigneeId`, `createdById`, `archivedAt`, `redFlag`, `category`.
- Notification: `(recipientId, readAt, createdAt)`.
- AuditEvent: `(entityType, entityId, createdAt)`.

---

## Validation rules

**In git:** Validate user input. No field lengths or enums in code.

**Design (untracked):**

- Role funnel (Associate must report to a Manager, etc.) is a **service** rule, not only a DB enum.
- `ON DELETE RESTRICT` on users referenced by cases.
- Never `DELETE` case rows; archive instead.
- Feature flags must not purge cases.
- Break-glass requires a reason; writes still forbidden.

**[TBD - requires confirmation]:** Max title/body/comment lengths, email format library, password policy.

---

## Important query patterns (proposed)

- Live queue: `archivedAt IS NULL`.
- Open: `finishedAt IS NULL AND archivedAt IS NULL`.
- Associate: `assigneeId = me OR (createdById = me AND assigneeId IS NULL)`.
- Manager: assignee reports to me, or reporter on team, or `assignedById = me`.
- Lead: all cases.
- Admin dashboard: `COUNT` by role and by case state — **not** selecting titles/bodies.
- Lead red-flag inbox: notifications `type = red_flag` for that Lead.
- Case timeline: audit for entity + comments (PRD recommends comments also emit audit events).

---

## Data lifecycle considerations

**Design (untracked):**

- Users: deactivate; reassign cases before deactivation if still assigned.
- Cases: finish then archive; unarchive/unfinish allowed as edge cases; no hard delete.
- Comments: append-only in v1.
- Audit and break-glass access: immutable.
- Admin disabling a feature hides UI/API capability; rows remain.

**[TBD - requires confirmation]:** Backup/restore, retention of sessions and notifications, timezone storage (PRD edge case says UTC).
