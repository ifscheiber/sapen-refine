import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";

type AuditDb = PrismaClient | Prisma.TransactionClient;

export const AUDIT_ACTOR_TYPES = [
  "USER",
  "OPERATOR",
  "SYSTEM",
  "WORKER",
  "EXTERNAL_SYSTEM",
] as const;

export type AuditActorType = typeof AUDIT_ACTOR_TYPES[number];

export const AUDIT_ACTOR_LABELS = {
  exportWorker: "export-worker",
  predictionImportWorker: "prediction-import-worker",
  storageCleanup: "storage-cleanup",
} as const;

export type AuditActorContextPrincipal = {
  type: AuditActorType;
  userId?: string | null;
  label?: string | null;
  processorId?: string | null;
  processorRunId?: string | null;
  externalSystem?: string | null;
  externalRequestId?: string | null;
};

export type AuditActorContextInput = {
  triggeredBy: AuditActorContextPrincipal;
  performedBy: AuditActorContextPrincipal;
};

const secretValuePattern = /(password|secret|token|authorization|cookie|signed-url|presign|signature)=/i;

function normalizeActorText(field: string, value: string | null | undefined) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_EMPTY`);
  }
  if (secretValuePattern.test(trimmed)) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_SECRET_LIKE`);
  }
  return trimmed;
}

function normalizeActorPrincipal(
  field: "triggeredBy" | "performedBy",
  principal: AuditActorContextPrincipal,
): Prisma.InputJsonObject {
  if (!AUDIT_ACTOR_TYPES.includes(principal.type)) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_TYPE_INVALID`);
  }

  const normalized: Record<string, string> = { type: principal.type };
  const userId = normalizeActorText("userId", principal.userId);
  const label = normalizeActorText("label", principal.label);
  const processorId = normalizeActorText("processorId", principal.processorId);
  const processorRunId = normalizeActorText("processorRunId", principal.processorRunId);
  const externalSystem = normalizeActorText("externalSystem", principal.externalSystem);
  const externalRequestId = normalizeActorText("externalRequestId", principal.externalRequestId);

  if (principal.type === "USER" && !userId) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_USER_ID_REQUIRED`);
  }
  if (["SYSTEM", "WORKER"].includes(principal.type) && !label) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_LABEL_REQUIRED`);
  }
  if (principal.type === "EXTERNAL_SYSTEM" && !externalSystem && !label) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_EXTERNAL_SYSTEM_REQUIRED`);
  }
  if (principal.type === "OPERATOR" && !userId && !label) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_OPERATOR_REF_REQUIRED`);
  }

  if (userId) normalized.userId = userId;
  if (label) normalized.label = label;
  if (processorId) normalized.processorId = processorId;
  if (processorRunId) normalized.processorRunId = processorRunId;
  if (externalSystem) normalized.externalSystem = externalSystem;
  if (externalRequestId) normalized.externalRequestId = externalRequestId;

  return normalized;
}

export function auditActorContext(input: AuditActorContextInput): Prisma.InputJsonObject {
  return {
    triggeredBy: normalizeActorPrincipal("triggeredBy", input.triggeredBy),
    performedBy: normalizeActorPrincipal("performedBy", input.performedBy),
  };
}

function isJsonObject(value: Prisma.InputJsonValue | undefined): value is Prisma.InputJsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function withAuditActorContext(
  details: Prisma.InputJsonValue | undefined,
  input: AuditActorContextInput,
): Prisma.InputJsonObject {
  if (details !== undefined && !isJsonObject(details)) {
    throw new Error("AUDIT_ACTOR_CONTEXT_DETAILS_OBJECT_REQUIRED");
  }
  return {
    ...(details ?? {}),
    actorContext: auditActorContext(input),
  };
}

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
