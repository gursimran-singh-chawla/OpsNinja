import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
