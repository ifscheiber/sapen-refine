import {
  AnnotationArtifactKind,
  CropSemanticMode,
  Prisma,
  PrismaClient,
  SliceClass,
  SliceClassificationDerivationReason,
  SliceClassificationSource,
  type AnnotationProjectRole,
} from "@prisma/client";

import { canAnnotate } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";

type SliceClassificationDb = PrismaClient;

const SLICE_CLASSES = new Set<string>(Object.values(SliceClass));
const CLASSIFYING_PIXEL_THRESHOLD = 1;
const SEMANTIC_LABEL_STABLE_IDS = [
  "background",
  "sapwood",
  "heartwood",
  "copper",
  "unknown",
] as const;

const sliceClassificationSelect = {
  id: true,
  version: true,
  class: true,
  reviewState: true,
  source: true,
  derivationReason: true,
  derivedFromSemanticMaskVersionId: true,
  derivedFromSupportMaskVersionId: true,
  derivedFromCropId: true,
  labelSchemaVersionId: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.SliceClassificationVersionSelect;

type SliceClassificationRecord = Prisma.SliceClassificationVersionGetPayload<{
  select: typeof sliceClassificationSelect;
}>;

type SemanticLabelValues = {
  background: number;
  sapwood: number;
  heartwood: number;
  copper: number;
  unknown: number | null;
};

export class SliceClassificationWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

function canEdit(role: AnnotationProjectRole) {
  return canAnnotate(role);
}

function isSliceClass(value: unknown): value is SliceClass {
  return typeof value === "string" && SLICE_CLASSES.has(value);
}

function requireLabelValue(
  labels: Map<string, { byteValue: number | null }>,
  stableId: keyof SemanticLabelValues,
) {
  const label = labels.get(stableId);
  if (!label || label.byteValue === null) {
    throw new SliceClassificationWorkflowError("SEMANTIC_LABELS_MISSING");
  }
  return label.byteValue;
}

async function getSemanticLabelValues(db: SliceClassificationDb, labelSchemaVersionId: string) {
  const definitions = await db.labelDefinition.findMany({
    where: {
      schemaVersionId: labelSchemaVersionId,
      applicability: "SEMANTIC_MASK",
      stableId: { in: [...SEMANTIC_LABEL_STABLE_IDS] },
    },
    select: { stableId: true, byteValue: true },
  });
  const byStableId = new Map(definitions.map((definition) => [definition.stableId, definition]));
  const unknown = byStableId.get("unknown");

  return {
    background: requireLabelValue(byStableId, "background"),
    sapwood: requireLabelValue(byStableId, "sapwood"),
    heartwood: requireLabelValue(byStableId, "heartwood"),
    copper: requireLabelValue(byStableId, "copper"),
    unknown: unknown?.byteValue ?? null,
  } satisfies SemanticLabelValues;
}

async function getLabelSchemaVersionId(db: SliceClassificationDb, projectId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });
  if (project?.labelSchemaVersionId) return project.labelSchemaVersionId;

  const fallback = await db.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });
  if (!fallback) throw new SliceClassificationWorkflowError("DEFAULT_LABEL_SCHEMA_MISSING");
  return fallback.id;
}

function serializeSliceClassification(version: SliceClassificationRecord) {
  return {
    id: version.id,
    version: version.version,
    class: version.class,
    reviewState: version.reviewState,
    source: version.source,
    derivationReason: version.derivationReason,
    derivedFromSemanticMaskVersionId: version.derivedFromSemanticMaskVersionId,
    derivedFromSupportMaskVersionId: version.derivedFromSupportMaskVersionId,
    derivedFromCropId: version.derivedFromCropId,
    labelSchemaVersionId: version.labelSchemaVersionId,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
  };
}

export type SerializedSliceClassification = ReturnType<typeof serializeSliceClassification>;

export async function getLatestSliceClassificationForSliceInstance(
  db: SliceClassificationDb,
  sliceInstanceId: string,
) {
  const latest = await db.sliceClassificationVersion.findFirst({
    where: { sliceInstanceId },
    orderBy: { version: "desc" },
    select: sliceClassificationSelect,
  });
  return latest ? serializeSliceClassification(latest) : null;
}

async function getSliceInstanceWithMembership(params: {
  db: SliceClassificationDb;
  sliceInstanceId: string;
  userId: string;
}) {
  const sliceInstance = await params.db.sliceInstance.findUnique({
    where: { id: params.sliceInstanceId },
    select: {
      id: true,
      projectId: true,
      imageId: true,
      image: { select: { id: true, projectId: true } },
    },
  });
  if (!sliceInstance) throw new SliceClassificationWorkflowError("SLICE_NOT_FOUND");
  if (sliceInstance.image.projectId !== sliceInstance.projectId) {
    throw new SliceClassificationWorkflowError("SLICE_LINEAGE_INVALID");
  }

  const membership = await params.db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: sliceInstance.projectId, userId: params.userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceClassificationWorkflowError("FORBIDDEN");

  return { sliceInstance, membership };
}

export async function loadSliceClassificationStateForUser(params: {
  sliceInstanceId: string;
  userId: string;
}, db: SliceClassificationDb = prisma) {
  const { sliceInstance, membership } = await getSliceInstanceWithMembership({
    db,
    sliceInstanceId: params.sliceInstanceId,
    userId: params.userId,
  });

  return {
    sliceInstance: {
      id: sliceInstance.id,
      projectId: sliceInstance.projectId,
      imageId: sliceInstance.imageId,
    },
    myRole: membership.role,
    canEdit: canEdit(membership.role),
    latestClassification: await getLatestSliceClassificationForSliceInstance(db, sliceInstance.id),
  };
}

export async function setSliceInstanceClassificationForUser(params: {
  sliceInstanceId: string;
  userId: string;
  class: unknown;
}, db: SliceClassificationDb = prisma) {
  if (!isSliceClass(params.class)) {
    throw new SliceClassificationWorkflowError("SLICE_CLASS_INVALID");
  }
  const sliceClass = params.class;

  const { sliceInstance, membership } = await getSliceInstanceWithMembership({
    db,
    sliceInstanceId: params.sliceInstanceId,
    userId: params.userId,
  });
  if (!canEdit(membership.role)) throw new SliceClassificationWorkflowError("FORBIDDEN");

  const labelSchemaVersionId = await getLabelSchemaVersionId(db, sliceInstance.projectId);
  const classification = await db.$transaction<SliceClassificationRecord>(async (tx) => {
    const last = await tx.sliceClassificationVersion.findFirst({
      where: { sliceInstanceId: sliceInstance.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return tx.sliceClassificationVersion.create({
      data: {
        projectId: sliceInstance.projectId,
        imageId: sliceInstance.imageId,
        sliceInstanceId: sliceInstance.id,
        version: (last?.version ?? 0) + 1,
        class: sliceClass,
        labelSchemaVersionId,
        source: SliceClassificationSource.MANUAL,
        createdById: params.userId,
      },
      select: sliceClassificationSelect,
    });
  });

  await recordAuditEvent(
    {
      action: "SLICE_CLASSIFICATION_COMMITTED",
      entity: "SliceClassificationVersion",
      entityId: classification.id,
      actorId: params.userId,
      details: {
        projectId: sliceInstance.projectId,
        imageId: sliceInstance.imageId,
        sliceInstanceId: sliceInstance.id,
        version: classification.version,
        class: classification.class,
        source: classification.source,
      },
    },
    db,
  );

  return loadSliceClassificationStateForUser(params, db);
}

export function deriveSliceClassificationFromSemanticMask(params: {
  semanticMode: CropSemanticMode | `${CropSemanticMode}`;
  semanticBytes: Uint8Array;
  labelValues: SemanticLabelValues;
  classifyingPixelThreshold?: number;
}) {
  const threshold = params.classifyingPixelThreshold ?? CLASSIFYING_PIXEL_THRESHOLD;
  if (!Number.isInteger(threshold) || threshold <= 0) {
    throw new SliceClassificationWorkflowError("CLASSIFICATION_THRESHOLD_INVALID");
  }

  const counts = {
    background: 0,
    sapwood: 0,
    heartwood: 0,
    copper: 0,
    unknown: 0,
    conflict: 0,
    total: params.semanticBytes.byteLength,
  };
  const unknownValue = params.labelValues.unknown;

  for (const value of params.semanticBytes) {
    if (value === params.labelValues.background) {
      counts.background += 1;
      continue;
    }
    if (unknownValue !== null && value === unknownValue) {
      counts.unknown += 1;
      continue;
    }
    if (value === params.labelValues.sapwood) {
      if (params.semanticMode === CropSemanticMode.SAP_HEARTWOOD) {
        counts.sapwood += 1;
      } else {
        counts.conflict += 1;
      }
      continue;
    }
    if (value === params.labelValues.heartwood) {
      if (params.semanticMode === CropSemanticMode.SAP_HEARTWOOD) {
        counts.heartwood += 1;
      } else {
        counts.conflict += 1;
      }
      continue;
    }
    if (value === params.labelValues.copper) {
      if (params.semanticMode === CropSemanticMode.COPPER) {
        counts.copper += 1;
      } else {
        counts.conflict += 1;
      }
      continue;
    }
    counts.conflict += 1;
  }

  if (counts.conflict > 0) {
    return {
      class: SliceClass.REVIEW_REQUIRED,
      reason: SliceClassificationDerivationReason.SEMANTIC_MODE_LABEL_CONFLICT,
      counts,
      classifyingPixelThreshold: threshold,
    };
  }

  if (params.semanticMode === CropSemanticMode.COPPER && counts.copper >= threshold) {
    return {
      class: SliceClass.COPPER_SLICE,
      reason: SliceClassificationDerivationReason.COPPER_PIXELS_PRESENT,
      counts,
      classifyingPixelThreshold: threshold,
    };
  }

  if (
    params.semanticMode === CropSemanticMode.SAP_HEARTWOOD &&
    counts.sapwood + counts.heartwood >= threshold
  ) {
    return {
      class: SliceClass.SAP_HEARTWOOD_SLICE,
      reason: SliceClassificationDerivationReason.SAP_HEARTWOOD_PIXELS_PRESENT,
      counts,
      classifyingPixelThreshold: threshold,
    };
  }

  if (counts.unknown > 0) {
    return {
      class: SliceClass.REVIEW_REQUIRED,
      reason: SliceClassificationDerivationReason.UNKNOWN_PIXELS_PRESENT,
      counts,
      classifyingPixelThreshold: threshold,
    };
  }

  return {
    class: SliceClass.UNKNOWN,
    reason: SliceClassificationDerivationReason.NO_CLASSIFYING_PIXELS,
    counts,
    classifyingPixelThreshold: threshold,
  };
}

export function sliceClassificationDerivationErrorCode(error: unknown) {
  if (error instanceof SliceClassificationWorkflowError) return error.code;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return "CLASSIFICATION_DERIVATION_DB_ERROR";
  return "CLASSIFICATION_DERIVATION_FAILED";
}

export async function deriveSliceClassificationForSemanticMaskVersionForUser(params: {
  semanticMaskVersionId: string;
  userId: string;
  semanticBytes: Uint8Array;
}, db: SliceClassificationDb = prisma) {
  const semanticVersion = await db.annotationArtifactVersion.findUnique({
    where: { id: params.semanticMaskVersionId },
    select: {
      id: true,
      size: true,
      width: true,
      height: true,
      coordinateSpace: true,
      labelSchemaVersionId: true,
      derivedCropId: true,
      sliceInstanceId: true,
      supportMaskVersionId: true,
      cropSemanticMode: true,
      artifact: {
        select: {
          id: true,
          projectId: true,
          imageId: true,
          kind: true,
        },
      },
    },
  });
  if (!semanticVersion) {
    throw new SliceClassificationWorkflowError("SEMANTIC_MASK_NOT_FOUND");
  }
  const derivedCropId = semanticVersion.derivedCropId;
  const sliceInstanceId = semanticVersion.sliceInstanceId;
  const supportMaskVersionId = semanticVersion.supportMaskVersionId;
  const cropSemanticMode = semanticVersion.cropSemanticMode;

  if (
    semanticVersion.artifact.kind !== AnnotationArtifactKind.SEMANTIC_MASK ||
    semanticVersion.coordinateSpace !== "CROP_PIXEL" ||
    !derivedCropId ||
    !sliceInstanceId ||
    !cropSemanticMode ||
    semanticVersion.size !== semanticVersion.width * semanticVersion.height
  ) {
    throw new SliceClassificationWorkflowError("SEMANTIC_MASK_LINEAGE_INVALID");
  }
  if (params.semanticBytes.byteLength !== semanticVersion.size) {
    throw new SliceClassificationWorkflowError("MASK_SIZE_MISMATCH");
  }

  const membership = await db.annotationProjectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: semanticVersion.artifact.projectId,
        userId: params.userId,
      },
    },
    select: { role: true },
  });
  if (!membership || !canEdit(membership.role)) {
    throw new SliceClassificationWorkflowError("FORBIDDEN");
  }

  const labelValues = await getSemanticLabelValues(db, semanticVersion.labelSchemaVersionId);
  const derivation = deriveSliceClassificationFromSemanticMask({
    semanticMode: cropSemanticMode,
    semanticBytes: params.semanticBytes,
    labelValues,
  });

  const classification = await db.$transaction<SliceClassificationRecord>(async (tx) => {
    const existing = await tx.sliceClassificationVersion.findUnique({
      where: { derivedFromSemanticMaskVersionId: semanticVersion.id },
      select: sliceClassificationSelect,
    });
    if (existing) return existing;

    const last = await tx.sliceClassificationVersion.findFirst({
      where: { sliceInstanceId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return tx.sliceClassificationVersion.create({
      data: {
        projectId: semanticVersion.artifact.projectId,
        imageId: semanticVersion.artifact.imageId,
        sliceInstanceId,
        version: (last?.version ?? 0) + 1,
        class: derivation.class,
        labelSchemaVersionId: semanticVersion.labelSchemaVersionId,
        reviewState: "DRAFT",
        source: SliceClassificationSource.AUTO_FROM_SEMANTIC_MASK,
        derivationReason: derivation.reason,
        derivedFromSemanticMaskVersionId: semanticVersion.id,
        derivedFromSupportMaskVersionId: supportMaskVersionId,
        derivedFromCropId: derivedCropId,
        metadataJson: {
          version: "semantic-mask-classification-v1",
          semanticMode: cropSemanticMode,
          classifyingPixelThreshold: derivation.classifyingPixelThreshold,
          counts: derivation.counts,
        },
        createdById: params.userId,
      },
      select: sliceClassificationSelect,
    });
  });

  await recordAuditEvent(
    {
      action: "SLICE_CLASSIFICATION_DERIVED_FROM_SEMANTIC_MASK",
      entity: "SliceClassificationVersion",
      entityId: classification.id,
      actorId: params.userId,
      details: {
        projectId: semanticVersion.artifact.projectId,
        imageId: semanticVersion.artifact.imageId,
        sliceInstanceId,
        version: classification.version,
        class: classification.class,
        source: classification.source,
        derivationReason: classification.derivationReason,
        semanticMaskVersionId: semanticVersion.id,
        supportMaskVersionId,
        derivedCropId,
      },
    },
    db,
  );

  return {
    ok: true as const,
    semanticMaskVersionId: semanticVersion.id,
    classification: serializeSliceClassification(classification),
    reason: derivation.reason,
    classifyingPixelThreshold: derivation.classifyingPixelThreshold,
  };
}

export async function recordSliceClassificationDerivationFailure(params: {
  userId: string;
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  semanticMaskVersionId: string;
  supportMaskVersionId: string | null;
  derivedCropId: string;
  error: string;
}, db: SliceClassificationDb = prisma) {
  await recordAuditEvent(
    {
      action: "SLICE_CLASSIFICATION_DERIVATION_FAILED",
      entity: "AnnotationArtifactVersion",
      entityId: params.semanticMaskVersionId,
      actorId: params.userId,
      details: {
        projectId: params.projectId,
        imageId: params.imageId,
        sliceInstanceId: params.sliceInstanceId,
        semanticMaskVersionId: params.semanticMaskVersionId,
        supportMaskVersionId: params.supportMaskVersionId,
        derivedCropId: params.derivedCropId,
        error: params.error,
      },
    },
    db,
  );
}

export function sliceClassificationErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof SliceClassificationWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "SLICE_NOT_FOUND"
          ? 404
          : error.code.endsWith("_LINEAGE_INVALID")
            ? 409
            : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "SLICE_CLASSIFICATION_DB_ERROR", status: 500 };
  }

  return { error: "SLICE_CLASSIFICATION_FAILED", status: 500 };
}
