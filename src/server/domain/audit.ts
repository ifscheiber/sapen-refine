import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";

type AuditDb = PrismaClient | Prisma.TransactionClient;

export async function recordAuditEvent(params: {
  action: string;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  details?: Prisma.InputJsonValue;
}, db: AuditDb = prisma) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      details: params.details ?? undefined,
    },
  });
}
