const secretValuePattern = /(password|secret|token|authorization|cookie|signed-url|presign|signature)=/i;
const truthyPattern = /^(1|true|yes|on)$/i;

function isTruthy(value) {
  return typeof value === "string" && truthyPattern.test(value.trim());
}

function normalizeActorText(field, value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_EMPTY`);
  }
  if (secretValuePattern.test(trimmed)) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_SECRET_LIKE`);
  }
  return trimmed;
}

function normalizeActorPrincipal(field, principal) {
  const allowedTypes = new Set(["USER", "OPERATOR", "SYSTEM", "WORKER", "EXTERNAL_SYSTEM"]);
  if (!allowedTypes.has(principal.type)) {
    throw new Error(`AUDIT_ACTOR_CONTEXT_${field.toUpperCase()}_TYPE_INVALID`);
  }

  const normalized = { type: principal.type };
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

export function auditActorContext(input) {
  return {
    triggeredBy: normalizeActorPrincipal("triggeredBy", input.triggeredBy),
    performedBy: normalizeActorPrincipal("performedBy", input.performedBy),
  };
}

export function withAuditActorContext(details, input) {
  if (details !== undefined && (typeof details !== "object" || Array.isArray(details) || details === null)) {
    throw new Error("AUDIT_ACTOR_CONTEXT_DETAILS_OBJECT_REQUIRED");
  }

  return {
    ...(details ?? {}),
    actorContext: auditActorContext(input),
  };
}

export function resolveOperatorActorContext({
  cliOperatorEmail,
  allowLocalSystemActor = false,
  scriptLabel,
  localSystemLabel = "system:local-bootstrap",
  env = process.env,
} = {}) {
  const operatorLabel = normalizeActorText("operatorEmail", cliOperatorEmail ?? env.SAPEN_OPERATOR_EMAIL);
  const requireOperatorAttribution =
    env.NODE_ENV === "production" || isTruthy(env.SAPEN_REQUIRE_OPERATOR_ATTRIBUTION);
  const localFallbackAllowed = allowLocalSystemActor || isTruthy(env.SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR);

  const performedBy = {
    type: "SYSTEM",
    label: normalizeActorText("scriptLabel", scriptLabel),
  };

  if (operatorLabel) {
    return auditActorContext({
      triggeredBy: { type: "OPERATOR", label: operatorLabel },
      performedBy,
    });
  }

  if (localFallbackAllowed && !requireOperatorAttribution) {
    return auditActorContext({
      triggeredBy: { type: "SYSTEM", label: localSystemLabel },
      performedBy,
    });
  }

  throw new Error(
    "Operator attribution is required. Set SAPEN_OPERATOR_EMAIL or pass --operator-email. " +
      "For local development only, pass --allow-local-system-actor or set SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR=true.",
  );
}
