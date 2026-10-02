# OpsNinja — Database

**Status:** Current design. Prisma schema is the source of implemented tables once migrations exist. Do not treat this file as applied until the matching migration is in git.

**Engine:** PostgreSQL. **ORM:** Prisma. UUID primary keys.

## Design principles

- Creator, visibility, and assignee are different fields.
- Associates may have `reportsToId = null` (free agent).
- Cases are never hard-deleted (`finishedAt` / `archivedAt`).
- Chat and audit are separate tables.
- Access grants live in `CaseAccess` where explicit membership is required.

## Core entities (current design)

### User
Identity, `role` (`admin|lead|manager|associate`), `reportsToId` nullable, `passwordHash`, `deactivatedAt`.

### Session
`id`, `userId`, `expiresAt`. Cookie holds session id.

### Case
`title`, `description`, `category`, `createdById`, `visibilityType` (`GLOBAL|TEAM|DIRECT`), `visibilityManagerId` nullable, `assigneeId` nullable, `assignedById` nullable, `redFlag`, `finishedAt`, `archivedAt`, timestamps.

### CaseAccess
Explicit grants: `caseId`, `userId`, `accessType`, `grantedById`, `createdAt`. Used for DIRECT (and extra viewers).

### Comment / Mention
Case thread. Mentions stored at write time.

### Conversation / ConversationParticipant / Message
`Conversation.type`: `GLOBAL` | `DM`. Messages persist; optional `deletedAt` for sender hide later. Indexes on `(conversationId, createdAt)` for cursor pagination.

### Notification
Recipient, type, source ids, `readAt`.

### AuditEvent
Append-only actions (`case.created`, `case.assigned`, `case.visibility_changed`, …).

### FeatureFlag
Key + enabled.

### BreakGlassSession / BreakGlassAccess
Reason, expiry, per-case read log.

## Indexes (design)

- User: unique email, `reportsToId`, `role`
- Case: `assigneeId`, `createdById`, `visibilityType`, `visibilityManagerId`, `redFlag`, `archivedAt`
- CaseAccess: `(caseId, userId)` unique
- Message: `(conversationId, createdAt)`
- Notification: `(recipientId, readAt, createdAt)`
- AuditEvent: `(entityType, entityId, createdAt)`

- **Implemented:** Prisma schema + SQL migration `20241002120000_init` (not yet applied locally; Docker was unavailable on the author machine).

## Future tables

KnowledgeArticle, AiCallLog, Attachment.
