# OpsNinja — Database

**Engine:** PostgreSQL. **ORM:** Prisma. UUID primary keys.

## Design principles

- Creator, visiblity, and assignee are different fields.
- Associates may have `reportsToId = null` (free agent).
- Tasks are never hard-deleted (`finishedAt` / `archivedAt`).
- Chat and audit are separate tables.
- Access grants live in `TaskAccess` where explicit membership is required.
- **Due** is not stored as a flag; it is `dueAt < now()` on open tasks.

## Core entities

### User
Identity, `role` (`admin|lead|manager|associate`), `reportsToId` nullable, `passwordHash`, `deactivatedAt`.

### Session
`id`, `userId`, `expiresAt`. Cookie holds session id.

### Task
`title`, `description`, `category` (`TaskCategory`), `workKind` (`task|escalation|backlog|report`), `metadata` JSON nullable, `priority` (`low|normal|high|urgent`), `dueAt` nullable deadline, `createdById`, `visibilityType` (`GLOBAL|TEAM|DIRECT`), `visibilityManagerId` nullable, `assigneeId` nullable, `assignedById` nullable, `boardColumn` (`TODO|IN_PROGRESS|IN_REVIEW|DONE`), `boardRank` (lexicographic order in the column), `finishedAt`, `archivedAt`, timestamps. `redFlag` remains in the table unused by v2 UI.

### TaskAccess
Explicit grants: `taskId`, `userId`, `accessType`, `grantedById`, `createdAt`. Used for DIRECT (and extra viewers).

### Comment / Mention
Task thread. Mentions stored at write time. Comments use `taskId`.

### Conversation / ConversationParticipant / Message
`Conversation.type`: `GLOBAL` | `DM`.

### Notification
Recipient, type (`mention`, `task_assigned`, `task_shared`, `task_routed_to_manager`, `task_overdue`, `task_updated`), `taskId`, `readAt`.

### AuditEvent
Append-only (`task.created`, `task.assigned`, `task.visibility_changed`, `user.onboarded`, …). `entityType` `task` | `user`.

### FeatureFlag
Boolean toggles for operational features.

## Indexes

- User: unique email, `reportsToId`, `role`
- Task: `assigneeId`, `createdById`, `visibilityType`, `visibilityManagerId`, `workKind`, `archivedAt`, `dueAt`, `(boardColumn, boardRank)`
- TaskAccess: `(taskId, userId)` unique
- Comment: `(taskId, createdAt)`
- Message: `(conversationId, createdAt)`
- Notification: `(recipientId, readAt, createdAt)`
- AuditEvent: `(entityType, entityId, createdAt)`

## Migrations

- `20241002120000_init`
- `20261003170000_case_priority_deadline`
- `20261004180000_task_board` — `BoardColumn`, `boardRank`
