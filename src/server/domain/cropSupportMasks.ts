import {
  AnnotationArtifactKind,
  Prisma,
  type AnnotationProjectRole,
} from "@prisma/client";

import { canAnnotate } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import {
  assertCropSupportFamilySaveAllowed,
  cropAnnotationFamilyErrorResponse,
  cropAnnotationFamilyLockKey,
  resolveCropAnnotationFamilyState,
} from "@/server/domain/cropAnnotationFamilies";
import {
  cropReviewActionsForVersion,
  resolveCropWorkflowReadiness,
  sanitizeCropWorkflowCandidate,
} from "@/server/domain/cropReadiness";
import {
  buildCropMaskStatsMetadata,
  cropMaskStatsJson,
} from "@/server/domain/maskStats";
import {
  getProjectLabelSchemaVersionId,
  getSupportLabelValues,
  SliceWorkflowError,
} from "@/server/domain/slices";
import {
  annotationArtifactVersionFamilyKey,
  isVersionAllocationError,
  withVersionAllocationLock,
} from "@/server/domain/versionAllocation";
import { getObjectBytes } from "@/server/storage/s3";

type CropSupportDb = typeof prisma;

export const CROP_SUPPORT_MASK_SCOPE_PREFIX = "crop-support:";

export class CropSupportMaskWorkflowError extends Error {
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

export function cropSupportMaskScopeKey(cropId: string) {
  return `${CROP_SUPPORT_MASK_SCOPE_PREFIX}${cropId}`;
}

export function cropPixelToSourcePixel(
  crop: { sourceX: number; sourceY: number },
  point: { x: number; y: number },
) {
  return {
    x: point.x + crop.sourceX,
    y: point.y + crop.sourceY,
  };
}

export function validateCropSupportMaskDimensions(params: {
  width: number;
  height: number;
  size: number;
  cropWidth: number;
  cropHeight: number;
}) {
  if (!Number.isInteger(params.width) || params.width <= 0) {
    throw new CropSupportMaskWorkflowError("WIDTH_REQUIRED");
  }
  if (!Number.isInteger(params.height) || params.height <= 0) {
    throw new CropSupportMaskWorkflowError("HEIGHT_REQUIRED");
  }
  if (!Number.isInteger(params.size) || params.size <= 0) {
    throw new CropSupportMaskWorkflowError("SIZE_REQUIRED");
  }
  if (params.size !== params.width * params.height) {
    throw new CropSupportMaskWorkflowError("MASK_SIZE_MISMATCH");
  }
  if (params.width !== params.cropWidth || params.height !== params.cropHeight) {
    throw new CropSupportMaskWorkflowError("MASK_DIMENSIONS_MISMATCH");
  }
}

function supportReadiness(
  latestSupportMask: { reviewState: string; version: number } | null,
) {
  if (!latestSupportMask) {
    return {
      status: "MISSING",
      label: "Support missing",
      semanticCropAnnotation: "SUPPORT_REQUIRED",
      exportReady: false,
    };
  }

  return {
    status: latestSupportMask.reviewState,
    label: `${latestSupportMask.reviewState.toLowerCase()} support v${latestSupportMask.version}`,
    semanticCropAnnotation: "SUPPORT_READY",
    exportReady: latestSupportMask.reviewState === "APPROVED",
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
  version: CropSupportMaskVersionRecord,
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

const cropSupportSelect = {
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
} satisfies Prisma.AnnotationArtifactVersionSelect;

type CropRecord = Prisma.DerivedSliceCropGetPayload<{ select: typeof cropSupportSelect }>;
type CropSupportMaskVersionRecord = Prisma.AnnotationArtifactVersionGetPayload<{
  select: typeof supportMaskVersionSelect;
}>;

async function getCropWithMembership(db: CropSupportDb, cropId: string, userId: string) {
  const crop = await db.derivedSliceCrop.findUnique({
    where: { id: cropId },
    select: cropSupportSelect,
  });
  if (!crop) throw new CropSupportMaskWorkflowError("CROP_NOT_FOUND");
  if (crop.coordinateSpace !== "CROP_PIXEL") {
    throw new CropSupportMaskWorkflowError("CROP_COORDINATE_SPACE_INVALID");
  }
  if (
    crop.sourceImage.projectId !== crop.projectId ||
    crop.sliceInstance.projectId !== crop.projectId ||
    crop.sliceInstance.imageId !== crop.sourceImageId
  ) {
    throw new CropSupportMaskWorkflowError("CROP_LINEAGE_INVALID");
  }

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: crop.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new CropSupportMaskWorkflowError("FORBIDDEN");

  return { crop, membership };
}

async function supportLabelsForProject(db: CropSupportDb, projectId: string) {
  try {
    const labelSchemaVersionId = await getProjectLabelSchemaVersionId(db, projectId);
    const supportLabels = await getSupportLabelValues(db, labelSchemaVersionId);
    return { labelSchemaVersionId, supportLabels };
  } catch (error) {
    if (error instanceof SliceWorkflowError) {
      throw new CropSupportMaskWorkflowError(error.code);
    }
    throw error;
  }
}

async function getLatestCropSupportMaskVersion(
  db: CropSupportDb,
  crop: { id: string; sourceImageId: string; sliceInstanceId: string },
) {
  const artifact = await db.annotationArtifact.findUnique({
    where: {
      imageId_kind_scopeKey: {
        imageId: crop.sourceImageId,
        kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
        scopeKey: cropSupportMaskScopeKey(crop.id),
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

function cropSupportCoordinateTransform(crop: CropRecord) {
  return {
    version: "crop-support-transform-ref-v1",
    derivedCropId: crop.id,
    derivedCropVersion: crop.version,
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

export async function loadCropSupportMaskStateForUser(params: {
  cropId: string;
  userId: string;
}, db: CropSupportDb = prisma) {
  const { crop, membership } = await getCropWithMembership(db, params.cropId, params.userId);
  const { labelSchemaVersionId, supportLabels } = await supportLabelsForProject(db, crop.projectId);
  const latestSupportMask = await getLatestCropSupportMaskVersion(db, crop);
  const annotationFamily = await resolveCropAnnotationFamilyState({ db, crop });
  const serializedLatest = latestSupportMask
    ? serializeSupportMask(latestSupportMask, crop.sourceImageId, membership.role)
    : null;
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
    labelSchemaVersionId,
    supportLabels,
    exists: Boolean(serializedLatest),
    latestSupportMask: serializedLatest,
    annotationFamily,
    supportReadiness: supportReadiness(serializedLatest),
    cropReadiness: readinessCandidate ? sanitizeCropWorkflowCandidate(readinessCandidate) : null,
  };
}

export async function createCropSupportMaskVersionForUser(params: {
  cropId: string;
  userId: string;
  storageKey: string;
  contentType?: string | null;
  size: number;
  checksum?: string | null;
  width: number;
  height: number;
  format?: string | null;
  supportBytes?: Uint8Array;
}, db: CropSupportDb = prisma) {
  const { crop, membership } = await getCropWithMembership(db, params.cropId, params.userId);
  if (!canEdit(membership.role)) throw new CropSupportMaskWorkflowError("FORBIDDEN");

  validateCropSupportMaskDimensions({
    width: params.width,
    height: params.height,
    size: params.size,
    cropWidth: crop.cropWidth,
    cropHeight: crop.cropHeight,
  });

  const { labelSchemaVersionId, supportLabels } = await supportLabelsForProject(db, crop.projectId);
  const scopeKey = cropSupportMaskScopeKey(crop.id);
  const supportBytes = params.supportBytes ?? await getObjectBytes(params.storageKey);
  const maskStats = buildCropMaskStatsMetadata({
    kind: "crop-support-mask",
    bytes: supportBytes,
    width: params.width,
    height: params.height,
    checksum: params.checksum,
    foregroundValues: new Set([supportLabels.sliceSupport]),
    unknownValue: null,
  });

  await db.$transaction((tx) =>
    withVersionAllocationLock(
      tx,
      cropAnnotationFamilyLockKey(crop.id),
      async () => {
        await assertCropSupportFamilySaveAllowed({
          db: tx,
          crop,
          supportBytes,
        });

        await withVersionAllocationLock(
          tx,
          annotationArtifactVersionFamilyKey({
            imageId: crop.sourceImageId,
            kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
            scopeKey,
          }),
          async () => {
            const artifact = await tx.annotationArtifact.upsert({
              where: {
                imageId_kind_scopeKey: {
                  imageId: crop.sourceImageId,
                  kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
                  scopeKey,
                },
              },
              update: {},
              create: {
                projectId: crop.projectId,
                imageId: crop.sourceImageId,
                kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
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

            const version = await tx.annotationArtifactVersion.create({
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
                coordinateTransform: cropSupportCoordinateTransform(crop),
                format: params.format?.trim() || "u8raw-v1",
                labelSchemaVersionId,
                derivedCropId: crop.id,
                sliceInstanceId: crop.sliceInstanceId,
                metadataJson: cropMaskStatsJson(maskStats),
                createdById: params.userId,
              },
              select: { id: true },
            });

            await tx.sliceInstance.update({
              where: { id: crop.sliceInstanceId },
              data: { supportArtifactVersionId: version.id },
            });
          },
        );
      },
    ),
  );

  return loadCropSupportMaskStateForUser(params, db);
}

export function cropSupportMaskErrorResponse(error: unknown): { error: string; status: number } {
  if (isVersionAllocationError(error)) {
    return { error: error.code, status: error.status };
  }

  const annotationFamilyPayload = cropAnnotationFamilyErrorResponse(error);
  if (annotationFamilyPayload) return annotationFamilyPayload;

  if (error instanceof CropSupportMaskWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "CROP_NOT_FOUND"
          ? 404
          : error.code === "CROP_LINEAGE_INVALID"
            ? 409
            : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "CROP_SUPPORT_MASK_DB_ERROR", status: 500 };
  }

  return { error: "CROP_SUPPORT_MASK_FAILED", status: 500 };
}
