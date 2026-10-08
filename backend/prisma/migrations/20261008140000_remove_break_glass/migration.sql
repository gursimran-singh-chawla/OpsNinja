-- DropForeignKey
ALTER TABLE "BreakGlassAccess" DROP CONSTRAINT "BreakGlassAccess_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "BreakGlassSession" DROP CONSTRAINT "BreakGlassSession_adminUserId_fkey";

-- DropTable
DROP TABLE "BreakGlassAccess";

-- DropTable
DROP TABLE "BreakGlassSession";
