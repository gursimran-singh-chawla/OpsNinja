# OpsNinja — Database

**Engine:** PostgreSQL. **ORM:** Prisma. UUID primary keys. Single source of truth.

## Design Principles

- **Three-Way Separation:** Creator, visibility, and assignee are distinct, independent fields.
- **Reporting Lines:** Associates may have `reportsToId = null` (free agent).
- **Non-Destructive Retention:** Tasks are never hard-deleted (`finishedAt`, `completedAt`, `archiveAfter`, `archivedAt`).
- **48-Hour Auto-Archiving:** Completed tasks compute `archiveAfter = completedAt + 48 hours`. A periodic sweep archives tasks when `archiveAfter <= now`.
- **Chat & Audit Segregation:** Chat messages and immutable audit logs reside in dedicated tables.
- **Explicit Access Grants:** `TaskAccess` stores direct permissions where fine-grained membership is required.
- **Dynamic Due Status:** **Due** is not stored as a flag; it is evaluated dynamically as `finishedAt == null && dueAt < now()`.

## Core Entities

### User
- `id` (UUID, primary key)
- `email` (unique), `name`, `passwordHash` (Argon2id)
- `role` (`admin | lead | manager | associate`)
- `reportsToId` (nullable, self-relation `ReportsTo`)
- `deactivatedAt` (nullable)
- `emailVerifiedAt` (nullable timestamp)
- `approvedAt` (nullable timestamp for administrative approval gate)
- `emailVerificationCodeHash` (SHA-256 hashed 6-digit OTP)
- `emailVerificationExpiresAt` (OTP expiration timestamp)
- `emailVerificationAttempts` (brute-force attempt counter)
- `emailVerificationSentAt` (cooldown timer tracking)

### Session
- `id` (UUID, cryptographically random 32-byte session token)
- `userId` (foreign key to `User`)
- `expiresAt`, `createdAt`

### Task
- `id` (UUID, primary key)
- `title`, `description`
- `category` (`TaskCategory`: `normal | escalation | inventory | vendor | customer | other`)
- `workKind` (`WorkKind`: `task | escalation | backlog | report`)
- `metadata` (JSON, nullable)
- `priority` (`TaskPriority`: `low | normal | high | urgent`)
- `dueAt` (nullable deadline timestamp)
- `createdById` (foreign key to `User`)
- `visibilityType` (`VisibilityType`: `GLOBAL | TEAM | DIRECT`)
- `visibilityManagerId` (nullable, foreign key to `User`)
- `assigneeId` (nullable, foreign key to `User`)
- `assignedById` (nullable, foreign key to `User`)
- `boardColumn` (`BoardColumn`: `TODO | IN_PROGRESS | IN_REVIEW | DONE`)
- `boardRank` (lexicographic rank string for column ordering)
- `finishedAt` (nullable completion timestamp)
- `completedAt` (nullable completion timestamp synced with `finishedAt`)
- `archiveAfter` (nullable timestamp indicating when task becomes eligible for auto-archiving)
- `archivedAt` (nullable archival timestamp)
- `sourceMessageId` (nullable UUID linking task creation to a chat message)
- `createdAt`, `updatedAt`

### TaskAccess
Explicit grants for DIRECT visibility and shared viewer access:
- `id`, `taskId`, `userId`, `accessType` (`VIEW | ASSIGNEE`), `grantedById`, `createdAt`
- Unique constraint: `@@unique([taskId, userId])`

### Comment & Mention
- `Comment`: `id`, `taskId`, `authorId`, `body`, `createdAt`
- `Mention`: `id`, `commentId`, `mentionedUserId`, `createdAt`

### Conversation & ConversationParticipant
- `Conversation`:
  - `id` (UUID)
  - `type` (`GLOBAL | DM`)
  - `title` (nullable)
  - `createdById` (nullable)
  - `directKey` (nullable unique string `min(userId1, userId2):max(userId1, userId2)` for deterministic DM deduplication)
  - `createdAt`, `updatedAt`
- `ConversationParticipant`:
  - `id`, `conversationId`, `userId`
  - `joinedAt`
  - `clearedAt` (nullable timestamp indicating when the user cleared/deleted the conversation from their view)
  - Unique constraint: `@@unique([conversationId, userId])`

### Message
- `id`, `conversationId`, `senderId`, `body`, `createdAt`

### Notification
- `id`, `recipientId`, `actorId` (nullable)
- `type` (`mention | task_assigned | task_shared | task_routed_to_manager | task_overdue | task_updated`)
- `taskId` (nullable), `readAt` (nullable), `createdAt`

### AuditEvent
- `id`, `actorId` (nullable, null represents system/automated events)
- `action` (string, e.g. `task.created`, `task.assigned`, `task.completed`, `task.archived`, `user.created`, `user.approved`, `user.deactivated`)
- `entityType` (`task | user | platform`)
- `entityId` (UUID)
- `metadata` (JSON, nullable; sanitized to exclude secrets and tokens)
- `createdAt`

### FeatureFlag
- `id`, `key` (unique string), `enabled` (boolean), `description`, `updatedAt`

## Indexes

- **User:** `email` (unique), `[reportsToId]`, `[role]`
- **Session:** `[userId]`, `[expiresAt]`
- **Task:** `[assigneeId]`, `[createdById]`, `[visibilityType]`, `[visibilityManagerId]`, `[workKind]`, `[priority]`, `[dueAt]`, `[archivedAt]`, `[archiveAfter]`, `[boardColumn, boardRank]`
- **TaskAccess:** `[taskId, userId]` (unique), `[userId]`
- **Comment:** `[taskId]`, `[authorId]`
- **Conversation:** `directKey` (unique)
- **ConversationParticipant:** `[conversationId, userId]` (unique), `[userId]`
- **Message:** `[conversationId]`, `[senderId]`
- **Notification:** `[recipientId]`
- **AuditEvent:** `[actorId]`, `[entityType, entityId]`

## Tracked Database Migrations

The database schema is managed strictly through tracked Prisma SQL migrations:

1. `20241002120000_init` — Initial baseline schema.
2. `20261003170000_case_priority_deadline` — Priorities, deadlines, and intake classifications.
3. `20261004100000_task_domain_v2` — Canonical migration from cases to tasks.
4. `20261004180000_task_board` — `BoardColumn` and fractional `boardRank`.
5. `20261008140000_remove_break_glass` — Hardening: complete removal of administrative break-glass task access.
6. `20261008210000_email_verification` — Two-step OTP verification fields and attempt tracking.
7. `20261012170000_admin_approval` — Mandatory administrative approval gate (`approvedAt`).
8. `20261013150000_dm_lifecycle_and_cleared_at` — Deterministic `directKey` on conversations and `clearedAt` on participants.
9. `20261013180000_task_auto_archive_48h` — `completedAt`, `archiveAfter` (48h countdown), and historical backfill.
