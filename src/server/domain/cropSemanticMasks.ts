import {
  AnnotationArtifactKind,
  CropSemanticMode,
  Prisma,
  type AnnotationProjectRole,
} from "@prisma/client";

import { canAnnotate } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import {
  cropReviewActionsForVersion,
  resolveCropWorkflowReadiness,
  sanitizeCropWorkflowCandidate,
} from "@/server/domain/cropReadiness";
import { getObjectBytes } from "@/server/storage/s3";
import {
  getProjectLabelSchemaVersionId,
  SliceWorkflowError,
} from "@/server/domain/slices";
import {
  deriveSliceClassificationForSemanticMaskVersionForUser,
  getLatestSliceClassificationForSliceInstance,
  recordSliceClassificationDerivationFailure,
  sliceClassificationDerivationErrorCode,
} from "@/server/domain/sliceClassifications";
import { CROP_SUPPORT_MASK_SCOPE_PREFIX } from "./cropSupportMasks";

type CropSemanticDb = typeof prisma;

const SEMANTIC_LABEL_STABLE_IDS = [
  "background",
  "sapwood",
  "heartwood",
  "copper",
  "unknown",
] as const;

export const CROP_SEMANTIC_MASK_SCOPE_PREFIX = "crop-semantic:";

export class CropSemanticMaskWorkflowError extends Error {
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

export function cropSemanticMaskScopeKey(cropId: string, semanticMode: CropSemanticMode) {
  return `${CROP_SEMANTIC_MASK_SCOPE_PREFIX}${cropId}:${semanticMode}`;
}

export function parseCropSemanticMode(value: unknown): CropSemanticMode {
  if (value === CropSemanticMode.SAP_HEARTWOOD) return CropSemanticMode.SAP_HEARTWOOD;
  if (value === CropSemanticMode.COPPER) return CropSemanticMode.COPPER;
  throw new CropSemanticMaskWorkflowError("SEMANTIC_MODE_INVALID");
}

export function validateCropSemanticMaskDimensions(params: {
  width: number;
  height: number;
  size: number;
  cropWidth: number;
  cropHeight: number;
}) {
  if (!Number.isInteger(params.width) || params.width <= 0) {
    throw new CropSemanticMaskWorkflowError("WIDTH_REQUIRED");
  }
  if (!Number.isInteger(params.height) || params.height <= 0) {
    throw new CropSemanticMaskWorkflowError("HEIGHT_REQUIRED");
  }
  if (!Number.isInteger(params.size) || params.size <= 0) {
    throw new CropSemanticMaskWorkflowError("SIZE_REQUIRED");
  }
  if (params.size !== params.width * params.height) {
    throw new CropSemanticMaskWorkflowError("MASK_SIZE_MISMATCH");
  }
  if (params.width !== params.cropWidth || params.height !== params.cropHeight) {
    throw new CropSemanticMaskWorkflowError("MASK_DIMENSIONS_MISMATCH");
  }
}

export function validateSemanticMaskAgainstSupport(params: {
  semanticBytes: Uint8Array;
  supportBytes: Uint8Array;
  allowedValues: ReadonlySet<number>;
}) {
  if (params.semanticBytes.byteLength !== params.supportBytes.byteLength) {
    throw new CropSemanticMaskWorkflowError("SUPPORT_MASK_LINEAGE_MISMATCH");
  }

  for (let index = 0; index < params.semanticBytes.byteLength; index += 1) {
    const semanticValue = params.semanticBytes[index];
    if (!params.allowedValues.has(semanticValue)) {
      throw new CropSemanticMaskWorkflowError("SEMANTIC_MASK_VALUES_INVALID");
    }
    if (params.supportBytes[index] === 0 && semanticValue !== 0) {
      throw new CropSemanticMaskWorkflowError("SEMANTIC_OUTSIDE_SUPPORT");
    }
  }
}

function semanticReadiness(
  supportMask: SerializedSupportMask | null,
  masks: Record<CropSemanticMode, SerializedSemanticMask | null>,
) {
  if (!supportMask) {
    return {
      status: "SUPPORT_REQUIRED",
      label: "Support required",
      supportMaskVersionId: null,
      canSaveDraft: false,
    };
  }

  return {
    status: "DRAFT_READY",
    label: `Constrained by ${supportMask.reviewState.toLowerCase()} support v${supportMask.version}`,
    supportMaskVersionId: supportMask.id,
    canSaveDraft: true,
    latestSemanticVersions: {
      SAP_HEARTWOOD: masks.SAP_HEARTWOOD?.version ?? null,
      COPPER: masks.COPPER?.version ?? null,
    },
  };
}

function serializeCrop(crop: CropRecord) {
  return {
    id: crop.id,
    projectId: crop.projectId,
    sourceImageId: crop.sourceImageId,
    sourceImageChecksum: crop.sourceImageChecksum,
    sourceImageWidth: crop.sourceImageWidth,
    sourceImageHeight: crop.sourceImageHeight,
    sliceInstanceId: crop.sliceInstanceId,
    bboxVersionId: crop.bboxVersionId,
    version: crop.version,
    sourceX: crop.sourceX,
    sourceY: crop.sourceY,
    sourceWidth: crop.sourceWidth,
    sourceHeight: crop.sourceHeight,
    cropX: crop.cropX,
    cropY: crop.cropY,
    cropWidth: crop.cropWidth,
    cropHeight: crop.cropHeight,
    paddingRequestedPx: crop.paddingRequestedPx,
    paddingAppliedLeftPx: crop.paddingAppliedLeftPx,
    paddingAppliedTopPx: crop.paddingAppliedTopPx,
    paddingAppliedRightPx: crop.paddingAppliedRightPx,
    paddingAppliedBottomPx: crop.paddingAppliedBottomPx,
    paddingClipped: crop.paddingClipped,
    coordinateSpace: crop.coordinateSpace,
    transformToSource: crop.transformToSourceJson,
    checksum: crop.checksum,
    contentType: crop.contentType,
    byteSize: crop.byteSize,
    format: crop.format,
    createdAt: crop.createdAt,
    createdBy: crop.createdBy,
    assetUrl: `/api/slice-crops/${crop.id}/asset`,
  };
}

function serializeSupportMask(
  version: SupportMaskVersionRecord,
  sourceImageId: string,
  role?: AnnotationProjectRole,
) {
  return {
    id: version.id,
    version: version.version,
    size: version.size,
    checksum: version.checksum,
    contentType: version.contentType,
    width: version.width,
    height: version.height,
    format: version.format,
    reviewState: version.reviewState,
    coordinateSpace: version.coordinateSpace,
    derivedCropId: version.derivedCropId,
    sliceInstanceId: version.sliceInstanceId,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    reviewActions: cropReviewActionsForVersion(version, role),
    url: `/api/images/${sourceImageId}/mask/versions/${version.id}/asset`,
  };
}

function serializeSemanticMask(
  version: CropSemanticMaskVersionRecord,
  sourceImageId: string,
  role?: AnnotationProjectRole,
) {
  return {
    id: version.id,
    version: version.version,
    size: version.size,
    checksum: version.checksum,
    contentType: version.contentType,
    width: version.width,
    height: version.height,
    format: version.format,
    reviewState: version.reviewState,
    coordinateSpace: version.coordinateSpace,
    derivedCropId: version.derivedCropId,
    sliceInstanceId: version.sliceInstanceId,
    supportMaskVersionId: version.supportMaskVersionId,
    semanticMode: version.cropSemanticMode,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    reviewActions: cropReviewActionsForVersion(version, role),
    url: `/api/images/${sourceImageId}/mask/versions/${version.id}/asset`,
  };
}

const cropSemanticSelect = {
  id: true,
  projectId: true,
  sourceImageId: true,
  sourceImageChecksum: true,
  sourceImageWidth: true,
  sourceImageHeight: true,
  sliceInstanceId: true,
  bboxVersionId: true,
  version: true,
  sourceX: true,
  sourceY: true,
  sourceWidth: true,
  sourceHeight: true,
  cropX: true,
  cropY: true,
  cropWidth: true,
  cropHeight: true,
  paddingRequestedPx: true,
  paddingAppliedLeftPx: true,
  paddingAppliedTopPx: true,
  paddingAppliedRightPx: true,
  paddingAppliedBottomPx: true,
  paddingClipped: true,
  coordinateSpace: true,
  transformToSourceJson: true,
  checksum: true,
  contentType: true,
  byteSize: true,
  format: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
  sourceImage: { select: { id: true, projectId: true } },
  sliceInstance: { select: { id: true, projectId: true, imageId: true } },
} satisfies Prisma.DerivedSliceCropSelect;

const supportMaskVersionSelect = {
  id: true,
  version: true,
  storageKey: true,
  size: true,
  checksum: true,
  contentType: true,
  width: true,
  height: true,
  format: true,
  reviewState: true,
  coordinateSpace: true,
  derivedCropId: true,
  sliceInstanceId: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
  artifact: {
    select: {
      imageId: true,
      projectId: true,
      kind: true,
      scopeKey: true,
    },
  },
} satisfies Prisma.AnnotationArtifactVersionSelect;

const semanticMaskVersionSelect = {
  id: true,
  version: true,
  size: true,
  checksum: true,
  contentType: true,
  width: true,
  height: true,
  format: true,
  reviewState: true,
  coordinateSpace: true,
  derivedCropId: true,
  sliceInstanceId: true,
  supportMaskVersionId: true,
  cropSemanticMode: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.AnnotationArtifactVersionSelect;

type CropRecord = Prisma.DerivedSliceCropGetPayload<{ select: typeof cropSemanticSelect }>;
type SupportMaskVersionRecord = Prisma.AnnotationArtifactVersionGetPayload<{
  select: typeof supportMaskVersionSelect;
}>;
type CropSemanticMaskVersionRecord = Prisma.AnnotationArtifactVersionGetPayload<{
  select: typeof semanticMaskVersionSelect;
}>;
type SerializedSupportMask = ReturnType<typeof serializeSupportMask>;
type SerializedSemanticMask = ReturnType<typeof serializeSemanticMask>;
type SemanticLabelRecord = {
  stableId: string;
  byteValue: number | null;
  displayName: string;
  colorToken: string | null;
  isTrainable: boolean;
};

async function getCropWithMembership(db: CropSemanticDb, cropId: string, userId: string) {
  const crop = await db.derivedSliceCrop.findUnique({
    where: { id: cropId },
    select: cropSemanticSelect,
  });
  if (!crop) throw new CropSemanticMaskWorkflowError("CROP_NOT_FOUND");
  if (crop.coordinateSpace !== "CROP_PIXEL") {
    throw new CropSemanticMaskWorkflowError("CROP_COORDINATE_SPACE_INVALID");
  }
  if (
    crop.sourceImage.projectId !== crop.projectId ||
    crop.sliceInstance.projectId !== crop.projectId ||
    crop.sliceInstance.imageId !== crop.sourceImageId
  ) {
    throw new CropSemanticMaskWorkflowError("CROP_LINEAGE_INVALID");
  }

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: crop.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new CropSemanticMaskWorkflowError("FORBIDDEN");

  return { crop, membership };
}

function requireSemanticLabel<T extends { byteValue: number | null }>(
  labels: Map<string, T>,
  stableId: string,
) {
  const label = labels.get(stableId);
  if (!label || label.byteValue === null) {
    throw new CropSemanticMaskWorkflowError("SEMANTIC_LABELS_MISSING");
  }
  return label as T & { byteValue: number };
}

function serializeLabel(label: SemanticLabelRecord & { byteValue: number }) {
  return {
    stableId: label.stableId,
    value: label.byteValue,
    name: label.displayName,
    colorToken: label.colorToken,
    isTrainable: label.isTrainable,
  };
}

async function semanticLabelsForProject(db: CropSemanticDb, projectId: string) {
  let labelSchemaVersionId: string;
  try {
    labelSchemaVersionId = await getProjectLabelSchemaVersionId(db, projectId);
  } catch (error) {
    if (error instanceof SliceWorkflowError) {
      throw new CropSemanticMaskWorkflowError(error.code);
    }
    throw error;
  }

  const definitions = await db.labelDefinition.findMany({
    where: {
      schemaVersionId: labelSchemaVersionId,
      applicability: "SEMANTIC_MASK",
      stableId: { in: [...SEMANTIC_LABEL_STABLE_IDS] },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      stableId: true,
      byteValue: true,
      displayName: true,
      colorToken: true,
      isTrainable: true,
    },
  });
  const byStableId = new Map(definitions.map((definition) => [definition.stableId, definition]));
  const background = requireSemanticLabel(byStableId, "background");
  const sapwood = requireSemanticLabel(byStableId, "sapwood");
  const heartwood = requireSemanticLabel(byStableId, "heartwood");
  const copper = requireSemanticLabel(byStableId, "copper");
  const unknown = byStableId.get("unknown");
  const unknownWithValue =
    unknown && unknown.byteValue !== null ? (unknown as SemanticLabelRecord & { byteValue: number }) : null;

  const sapHeartwoodLabels = [
    background,
    sapwood,
    heartwood,
    ...(unknownWithValue ? [unknownWithValue] : []),
  ].map(serializeLabel);
  const copperLabels = [
    background,
    copper,
    ...(unknownWithValue ? [unknownWithValue] : []),
  ].map(serializeLabel);

  return {
    labelSchemaVersionId,
    modes: {
      SAP_HEARTWOOD: {
        labels: sapHeartwoodLabels,
        allowedValues: sapHeartwoodLabels.map((label) => label.value),
        backgroundValue: background.byteValue,
        primaryValues: {
          sapwood: sapwood.byteValue,
          heartwood: heartwood.byteValue,
          unknown: unknownWithValue?.byteValue ?? null,
        },
      },
      COPPER: {
        labels: copperLabels,
        allowedValues: copperLabels.map((label) => label.value),
        backgroundValue: background.byteValue,
        primaryValues: {
          copper: copper.byteValue,
          implicitNegative: background.byteValue,
          unknown: unknownWithValue?.byteValue ?? null,
        },
      },
    },
  };
}

async function getLatestCropSupportMaskVersion(
  db: CropSemanticDb,
  crop: { id: string; sourceImageId: string; sliceInstanceId: string },
) {
  const artifact = await db.annotationArtifact.findUnique({
    where: {
      imageId_kind_scopeKey: {
        imageId: crop.sourceImageId,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
        scopeKey: `${CROP_SUPPORT_MASK_SCOPE_PREFIX}${crop.id}`,
      },
    },
    select: { id: true },
  });
  if (!artifact) return null;

  return db.annotationArtifactVersion.findFirst({
    where: {
      artifactId: artifact.id,
      derivedCropId: crop.id,
      sliceInstanceId: crop.sliceInstanceId,
    },
    orderBy: { version: "desc" },
    select: supportMaskVersionSelect,
  });
}

function assertSupportLineage(crop: CropRecord, support: SupportMaskVersionRecord) {
  if (
    support.artifact.kind !== AnnotationArtifactKind.SLICE_SUPPORT_MASK ||
    support.artifact.imageId !== crop.sourceImageId ||
    support.artifact.projectId !== crop.projectId ||
    support.artifact.scopeKey !== `${CROP_SUPPORT_MASK_SCOPE_PREFIX}${crop.id}` ||
    support.coordinateSpace !== "CROP_PIXEL" ||
    support.derivedCropId !== crop.id ||
    support.sliceInstanceId !== crop.sliceInstanceId ||
    support.width !== crop.cropWidth ||
    support.height !== crop.cropHeight
  ) {
    throw new CropSemanticMaskWorkflowError("SUPPORT_MASK_LINEAGE_MISMATCH");
  }
}

async function requireCurrentSupportMaskVersion(params: {
  db: CropSemanticDb;
  crop: CropRecord;
  supportMaskVersionId?: string | null;
}) {
  const latest = await getLatestCropSupportMaskVersion(params.db, params.crop);
  if (!latest) throw new CropSemanticMaskWorkflowError("SUPPORT_MASK_REQUIRED");
  assertSupportLineage(params.crop, latest);

  if (params.supportMaskVersionId && params.supportMaskVersionId !== latest.id) {
    throw new CropSemanticMaskWorkflowError("SUPPORT_MASK_LINEAGE_MISMATCH");
  }
  if (!params.supportMaskVersionId) {
    throw new CropSemanticMaskWorkflowError("SUPPORT_MASK_REQUIRED");
  }
  return latest;
}

async function getLatestCropSemanticMaskVersion(
  db: CropSemanticDb,
  crop: { id: string; sourceImageId: string; sliceInstanceId: string },
  semanticMode: CropSemanticMode,
) {
  const artifact = await db.annotationArtifact.findUnique({
    where: {
      imageId_kind_scopeKey: {
        imageId: crop.sourceImageId,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
        scopeKey: cropSemanticMaskScopeKey(crop.id, semanticMode),
      },
    },
    select: { id: true },
  });
  if (!artifact) return null;

  return db.annotationArtifactVersion.findFirst({
    where: {
      artifactId: artifact.id,
      derivedCropId: crop.id,
      sliceInstanceId: crop.sliceInstanceId,
      cropSemanticMode: semanticMode,
    },
    orderBy: { version: "desc" },
    select: semanticMaskVersionSelect,
  });
}

function cropSemanticCoordinateTransform(
  crop: CropRecord,
  supportMaskVersionId: string,
  semanticMode: CropSemanticMode,
) {
  return {
    version: "crop-semantic-transform-ref-v1",
    derivedCropId: crop.id,
    derivedCropVersion: crop.version,
    supportMaskVersionId,
    semanticMode,
    cropTransformVersion:
      typeof crop.transformToSourceJson === "object" &&
      crop.transformToSourceJson !== null &&
      !Array.isArray(crop.transformToSourceJson) &&
      "version" in crop.transformToSourceJson
        ? crop.transformToSourceJson.version
        : null,
    sourceCoordinateSpace: "SOURCE_IMAGE_PIXEL",
    cropCoordinateSpace: "CROP_PIXEL",
    sourceOrigin: { x: crop.sourceX, y: crop.sourceY },
    formula: "sourceX = cropX + sourceOrigin.x; sourceY = cropY + sourceOrigin.y",
  } satisfies Prisma.JsonObject;
}

export async function loadCropSemanticMaskStateForUser(params: {
  cropId: string;
  userId: string;
}, db: CropSemanticDb = prisma) {
  const { crop, membership } = await getCropWithMembership(db, params.cropId, params.userId);
  const semanticLabels = await semanticLabelsForProject(db, crop.projectId);
  const latestSupportMask = await getLatestCropSupportMaskVersion(db, crop);
  if (latestSupportMask) assertSupportLineage(crop, latestSupportMask);

  const latestMasks = {
    SAP_HEARTWOOD: await getLatestCropSemanticMaskVersion(
      db,
      crop,
      CropSemanticMode.SAP_HEARTWOOD,
    ),
    COPPER: await getLatestCropSemanticMaskVersion(db, crop, CropSemanticMode.COPPER),
  };
  const serializedSupportMask = latestSupportMask
    ? serializeSupportMask(latestSupportMask, crop.sourceImageId, membership.role)
    : null;
  const serializedMasks = {
    SAP_HEARTWOOD: latestMasks.SAP_HEARTWOOD
      ? serializeSemanticMask(latestMasks.SAP_HEARTWOOD, crop.sourceImageId, membership.role)
      : null,
    COPPER: latestMasks.COPPER
      ? serializeSemanticMask(latestMasks.COPPER, crop.sourceImageId, membership.role)
      : null,
  };
  const latestClassification = await getLatestSliceClassificationForSliceInstance(db, crop.sliceInstanceId);
  const cropReadiness = await resolveCropWorkflowReadiness({
    projectId: crop.projectId,
    imageId: crop.sourceImageId,
    sliceInstanceId: crop.sliceInstanceId,
    role: membership.role,
  }, db);
  const readinessCandidate =
    cropReadiness.candidates.find((candidate) => candidate.crop.id === crop.id) ?? null;

  return {
    crop: serializeCrop(crop),
    myRole: membership.role,
    canEdit: canEdit(membership.role),
    labelSchemaVersionId: semanticLabels.labelSchemaVersionId,
    semanticLabels: semanticLabels.modes,
    supportRequired: !serializedSupportMask,
    currentSupportMask: serializedSupportMask,
    latestSemanticMasks: serializedMasks,
    semanticReadiness: semanticReadiness(serializedSupportMask, serializedMasks),
    latestClassification,
    cropReadiness: readinessCandidate ? sanitizeCropWorkflowCandidate(readinessCandidate) : null,
  };
}

export async function createCropSemanticMaskVersionForUser(params: {
  cropId: string;
  userId: string;
  supportMaskVersionId: string;
  semanticMode: CropSemanticMode | string;
  storageKey: string;
  contentType?: string | null;
  size: number;
  checksum?: string | null;
  width: number;
  height: number;
  format?: string | null;
  semanticBytes: Uint8Array;
}, db: CropSemanticDb = prisma) {
  const semanticMode = parseCropSemanticMode(params.semanticMode);
  const { crop, membership } = await getCropWithMembership(db, params.cropId, params.userId);
  if (!canEdit(membership.role)) throw new CropSemanticMaskWorkflowError("FORBIDDEN");

  validateCropSemanticMaskDimensions({
    width: params.width,
    height: params.height,
    size: params.size,
    cropWidth: crop.cropWidth,
    cropHeight: crop.cropHeight,
  });
  if (params.semanticBytes.byteLength !== params.size) {
    throw new CropSemanticMaskWorkflowError("MASK_SIZE_MISMATCH");
  }

  const semanticLabels = await semanticLabelsForProject(db, crop.projectId);
  const supportMaskVersion = await requireCurrentSupportMaskVersion({
    db,
    crop,
    supportMaskVersionId: params.supportMaskVersionId,
  });
  const supportBytes = await getObjectBytes(supportMaskVersion.storageKey);
  validateSemanticMaskAgainstSupport({
    semanticBytes: params.semanticBytes,
    supportBytes,
    allowedValues: new Set(semanticLabels.modes[semanticMode].allowedValues),
  });

  const scopeKey = cropSemanticMaskScopeKey(crop.id, semanticMode);

  let semanticMaskVersionId: string | null = null;

  await db.$transaction(async (tx) => {
    const artifact = await tx.annotationArtifact.upsert({
      where: {
        imageId_kind_scopeKey: {
          imageId: crop.sourceImageId,
          kind: AnnotationArtifactKind.SEMANTIC_MASK,
          scopeKey,
        },
      },
      update: {},
      create: {
        projectId: crop.projectId,
        imageId: crop.sourceImageId,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
        scopeKey,
        createdById: params.userId,
      },
      select: { id: true },
    });

    const last = await tx.annotationArtifactVersion.findFirst({
      where: { artifactId: artifact.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const semanticVersion = await tx.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: (last?.version ?? 0) + 1,
        storageKey: params.storageKey,
        contentType: params.contentType ?? "application/octet-stream",
        size: params.size,
        checksum: params.checksum ?? null,
        width: params.width,
        height: params.height,
        coordinateSpace: "CROP_PIXEL",
        coordinateTransform: cropSemanticCoordinateTransform(crop, supportMaskVersion.id, semanticMode),
        format: params.format?.trim() || "u8raw-v1",
        labelSchemaVersionId: semanticLabels.labelSchemaVersionId,
        derivedCropId: crop.id,
        sliceInstanceId: crop.sliceInstanceId,
        supportMaskVersionId: supportMaskVersion.id,
        cropSemanticMode: semanticMode,
        createdById: params.userId,
      },
      select: { id: true },
    });
    semanticMaskVersionId = semanticVersion.id;
  });

  let classificationDerivation:
    | Awaited<ReturnType<typeof deriveSliceClassificationForSemanticMaskVersionForUser>>
    | { ok: false; semanticMaskVersionId: string | null; error: string }
    | null = null;
  if (semanticMaskVersionId) {
    try {
      classificationDerivation = await deriveSliceClassificationForSemanticMaskVersionForUser(
        {
          semanticMaskVersionId,
          userId: params.userId,
          semanticBytes: params.semanticBytes,
        },
        db,
      );
    } catch (error) {
      const errorCode = sliceClassificationDerivationErrorCode(error);
      classificationDerivation = {
        ok: false,
        semanticMaskVersionId,
        error: errorCode,
      };
      await recordSliceClassificationDerivationFailure(
        {
          userId: params.userId,
          projectId: crop.projectId,
          imageId: crop.sourceImageId,
          sliceInstanceId: crop.sliceInstanceId,
          semanticMaskVersionId,
          supportMaskVersionId: supportMaskVersion.id,
          derivedCropId: crop.id,
          error: errorCode,
        },
        db,
      ).catch(() => undefined);
    }
  }

  return {
    ...(await loadCropSemanticMaskStateForUser(params, db)),
    classificationDerivation,
  };
}

export function cropSemanticMaskErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof CropSemanticMaskWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "CROP_NOT_FOUND"
          ? 404
          : error.code === "SUPPORT_MASK_REQUIRED" ||
              error.code.endsWith("_LINEAGE_MISMATCH") ||
              error.code === "CROP_LINEAGE_INVALID" ||
              error.code === "CROP_COORDINATE_SPACE_INVALID"
            ? 409
            : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "CROP_SEMANTIC_MASK_DB_ERROR", status: 500 };
  }

  return { error: "CROP_SEMANTIC_MASK_FAILED", status: 500 };
}
