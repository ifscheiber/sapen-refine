import { randomUUID } from "node:crypto";

import { Prisma, type AnnotationProjectRole } from "@prisma/client";
import sharp from "sharp";

import { canAnnotate } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  derivedSliceCropVersionFamilyKey,
  isVersionAllocationError,
  withVersionAllocationLock,
} from "@/server/domain/versionAllocation";
import { getRuntimeConfig } from "@/server/runtime/config";
import {
  deleteObjectBestEffort,
  getObjectBytes,
  putObject,
  verifyStoredObject,
} from "@/server/storage/s3";
import {
  normalizeContentType,
  sha256Checksum,
  type SupportedImageContentType,
} from "@/server/uploads/integrity";

type SliceCropDb = typeof prisma;

export const SLICE_CROP_ALLOWED_PADDING_PX = [0, 16, 32, 64] as const;
const SLICE_CROP_CONTENT_TYPE = "image/png";
const SLICE_CROP_FORMAT = "png";

type ImageBounds = {
  width: number | null;
  height: number | null;
};

type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class SliceCropWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

function canGenerateCrop(role: AnnotationProjectRole) {
  return canAnnotate(role);
}

function assertImageDimensions(image: ImageBounds): asserts image is { width: number; height: number } {
  if (
    typeof image.width !== "number" ||
    typeof image.height !== "number" ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    throw new SliceCropWorkflowError("IMAGE_DIMENSIONS_REQUIRED");
  }
}

export function parseSliceCropPadding(value: unknown, fallback = getRuntimeConfig().cropWorkflow.defaultPaddingPx) {
  const padding = value === undefined || value === null ? fallback : value;
  if (
    typeof padding !== "number" ||
    !Number.isInteger(padding) ||
    !SLICE_CROP_ALLOWED_PADDING_PX.includes(padding as (typeof SLICE_CROP_ALLOWED_PADDING_PX)[number])
  ) {
    throw new SliceCropWorkflowError("CROP_PADDING_INVALID");
  }
  return padding;
}

export function calculateSliceCropGeometry(params: {
  bbox: SourceRect;
  image: { width: number; height: number };
  paddingRequestedPx: number;
}) {
  const { bbox, image, paddingRequestedPx } = params;

  if (
    bbox.x < 0 ||
    bbox.y < 0 ||
    bbox.width <= 0 ||
    bbox.height <= 0 ||
    bbox.x + bbox.width > image.width ||
    bbox.y + bbox.height > image.height
  ) {
    throw new SliceCropWorkflowError("BBOX_OUT_OF_BOUNDS");
  }

  const paddingAppliedLeftPx = Math.min(paddingRequestedPx, bbox.x);
  const paddingAppliedTopPx = Math.min(paddingRequestedPx, bbox.y);
  const paddingAppliedRightPx = Math.min(paddingRequestedPx, image.width - (bbox.x + bbox.width));
  const paddingAppliedBottomPx = Math.min(paddingRequestedPx, image.height - (bbox.y + bbox.height));

  const sourceX = bbox.x - paddingAppliedLeftPx;
  const sourceY = bbox.y - paddingAppliedTopPx;
  const sourceWidth = bbox.width + paddingAppliedLeftPx + paddingAppliedRightPx;
  const sourceHeight = bbox.height + paddingAppliedTopPx + paddingAppliedBottomPx;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new SliceCropWorkflowError("CROP_RECT_INVALID");
  }

  const paddingClipped =
    paddingAppliedLeftPx !== paddingRequestedPx ||
    paddingAppliedTopPx !== paddingRequestedPx ||
    paddingAppliedRightPx !== paddingRequestedPx ||
    paddingAppliedBottomPx !== paddingRequestedPx;

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    cropX: 0,
    cropY: 0,
    cropWidth: sourceWidth,
    cropHeight: sourceHeight,
    paddingAppliedLeftPx,
    paddingAppliedTopPx,
    paddingAppliedRightPx,
    paddingAppliedBottomPx,
    paddingClipped,
    transformToSourceJson: {
      version: "integer-translation-v1",
      sourceCoordinateSpace: "SOURCE_IMAGE_PIXEL",
      cropCoordinateSpace: "CROP_PIXEL",
      sourceOrigin: { x: sourceX, y: sourceY },
      formula: "sourceX = cropX + sourceOrigin.x; sourceY = cropY + sourceOrigin.y",
    },
  };
}

function serializeCrop(crop: {
  id: string;
  sourceImageId: string;
  sourceImageChecksum: string | null;
  sourceImageWidth: number;
  sourceImageHeight: number;
  sliceInstanceId: string;
  bboxVersionId: string;
  version: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  paddingRequestedPx: number;
  paddingAppliedLeftPx: number;
  paddingAppliedTopPx: number;
  paddingAppliedRightPx: number;
  paddingAppliedBottomPx: number;
  paddingClipped: boolean;
  coordinateSpace: string;
  transformToSourceJson: Prisma.JsonValue;
  checksum: string | null;
  contentType: string | null;
  byteSize: number;
  format: string;
  createdAt: Date;
  createdBy: { id: string; email: string; name: string | null } | null;
}) {
  return {
    id: crop.id,
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

const cropSelect = {
  id: true,
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
} satisfies Prisma.DerivedSliceCropSelect;

async function getImageMembership(db: SliceCropDb, imageId: string, userId: string) {
  const image = await db.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) throw new SliceCropWorkflowError("IMAGE_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceCropWorkflowError("FORBIDDEN");

  return { image, membership };
}

async function getCropWithMembership(db: SliceCropDb, cropId: string, userId: string) {
  const crop = await db.derivedSliceCrop.findUnique({
    where: { id: cropId },
    select: {
      ...cropSelect,
      projectId: true,
      storageKey: true,
    },
  });
  if (!crop) throw new SliceCropWorkflowError("CROP_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: crop.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceCropWorkflowError("FORBIDDEN");

  return { crop, membership };
}

async function getBBoxForCropGeneration(db: SliceCropDb, bboxVersionId: string, userId: string) {
  const bbox = await db.sliceBoundingBoxVersion.findUnique({
    where: { id: bboxVersionId },
    select: {
      id: true,
      projectId: true,
      imageId: true,
      sliceInstanceId: true,
      version: true,
      status: true,
      x: true,
      y: true,
      width: true,
      height: true,
      coordinateSpace: true,
      image: {
        select: {
          id: true,
          projectId: true,
          storageKey: true,
          checksum: true,
          contentType: true,
          width: true,
          height: true,
        },
      },
    },
  });
  if (!bbox) throw new SliceCropWorkflowError("BBOX_NOT_FOUND");

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: bbox.projectId, userId } },
    select: { role: true },
  });
  if (!membership) throw new SliceCropWorkflowError("FORBIDDEN");

  return { bbox, membership };
}

async function assertCurrentActiveBBox(
  db: SliceCropDb,
  bbox: { id: string; sliceInstanceId: string; status: string },
) {
  if (bbox.status !== "ACTIVE") throw new SliceCropWorkflowError("BBOX_DELETED");

  const latest = await db.sliceBoundingBoxVersion.findFirst({
    where: { sliceInstanceId: bbox.sliceInstanceId },
    orderBy: { version: "desc" },
    select: { id: true, status: true },
  });

  if (!latest || latest.id !== bbox.id || latest.status !== "ACTIVE") {
    throw new SliceCropWorkflowError("BBOX_VERSION_STALE");
  }
}

function assertSupportedCropSourceImage(contentType: string | null | undefined): SupportedImageContentType {
  const normalized = normalizeContentType(contentType);
  if (normalized !== "image/png" && normalized !== "image/jpeg") {
    throw new SliceCropWorkflowError("CROP_SOURCE_IMAGE_UNSUPPORTED");
  }
  return normalized;
}

export async function listSliceCropsForImageForUser(params: {
  imageId: string;
  userId: string;
}, db: SliceCropDb = prisma) {
  const { image, membership } = await getImageMembership(db, params.imageId, params.userId);
  const crops = await db.derivedSliceCrop.findMany({
    where: { sourceImageId: image.id },
    orderBy: [{ sliceInstanceId: "asc" }, { version: "desc" }],
    select: cropSelect,
  });

  return {
    image,
    myRole: membership.role,
    canEdit: canGenerateCrop(membership.role),
    crops: crops.map(serializeCrop),
  };
}

export async function getSliceCropForUser(params: {
  cropId: string;
  userId: string;
}, db: SliceCropDb = prisma) {
  const { crop } = await getCropWithMembership(db, params.cropId, params.userId);
  return serializeCrop(crop);
}

export async function readSliceCropAssetForUser(params: {
  cropId: string;
  userId: string;
}, db: SliceCropDb = prisma) {
  const { crop } = await getCropWithMembership(db, params.cropId, params.userId);
  const bytes = await getObjectBytes(crop.storageKey);
  return {
    crop: serializeCrop(crop),
    bytes,
    contentType: crop.contentType ?? SLICE_CROP_CONTENT_TYPE,
  };
}

async function getExistingCurrentCropForBBox(db: SliceCropDb, bboxVersionId: string) {
  return db.derivedSliceCrop.findFirst({
    where: { bboxVersionId },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    select: cropSelect,
  });
}

export async function ensureCurrentCropForSliceBBox(params: {
  bboxVersionId: string;
  userId: string;
  paddingRequestedPx?: unknown;
}, db: SliceCropDb = prisma) {
  const { bbox, membership } = await getBBoxForCropGeneration(db, params.bboxVersionId, params.userId);
  if (!canGenerateCrop(membership.role)) throw new SliceCropWorkflowError("FORBIDDEN");
  await assertCurrentActiveBBox(db, bbox);

  const existing = await getExistingCurrentCropForBBox(db, bbox.id);
  if (existing) {
    return { crop: serializeCrop(existing), generated: false };
  }

  return {
    crop: await generateCropForSliceBBox(params, db),
    generated: true,
  };
}

async function getCurrentActiveBBoxesForImage(db: SliceCropDb, imageId: string) {
  const versions = await db.sliceBoundingBoxVersion.findMany({
    where: { imageId },
    orderBy: [{ sliceInstanceId: "asc" }, { version: "desc" }],
    select: { id: true, sliceInstanceId: true, status: true },
  });

  const current = new Map<string, { id: string; sliceInstanceId: string; status: string }>();
  for (const version of versions) {
    if (!current.has(version.sliceInstanceId)) current.set(version.sliceInstanceId, version);
  }
  return Array.from(current.values()).filter((version) => version.status === "ACTIVE");
}

export async function ensureCurrentCropsForImageForUser(params: {
  imageId: string;
  userId: string;
  sliceInstanceId?: string | null;
  paddingRequestedPx?: unknown;
}, db: SliceCropDb = prisma) {
  const { image, membership } = await getImageMembership(db, params.imageId, params.userId);
  if (!canGenerateCrop(membership.role)) throw new SliceCropWorkflowError("FORBIDDEN");

  const currentBBoxes = (await getCurrentActiveBBoxesForImage(db, image.id)).filter(
    (bbox) => !params.sliceInstanceId || bbox.sliceInstanceId === params.sliceInstanceId,
  );
  const results = [];
  for (const bbox of currentBBoxes) {
    results.push(
      await ensureCurrentCropForSliceBBox(
        {
          bboxVersionId: bbox.id,
          userId: params.userId,
          paddingRequestedPx: params.paddingRequestedPx,
        },
        db,
      ),
    );
  }

  return {
    image,
    myRole: membership.role,
    canEdit: canGenerateCrop(membership.role),
    crops: results.map((result) => result.crop),
    generatedCount: results.filter((result) => result.generated).length,
    existingCount: results.filter((result) => !result.generated).length,
  };
}

export async function generateCropForSliceBBox(params: {
  bboxVersionId: string;
  userId: string;
  paddingRequestedPx?: unknown;
}, db: SliceCropDb = prisma) {
  const paddingRequestedPx = parseSliceCropPadding(params.paddingRequestedPx);
  const { bbox, membership } = await getBBoxForCropGeneration(db, params.bboxVersionId, params.userId);
  if (!canGenerateCrop(membership.role)) throw new SliceCropWorkflowError("FORBIDDEN");
  await assertCurrentActiveBBox(db, bbox);
  const sourceImage = bbox.image;
  assertImageDimensions(sourceImage);
  assertSupportedCropSourceImage(sourceImage.contentType);

  const geometry = calculateSliceCropGeometry({
    bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
    image: { width: sourceImage.width, height: sourceImage.height },
    paddingRequestedPx,
  });

  const sourceBytes = await getObjectBytes(sourceImage.storageKey);
  let cropPng: Buffer;
  try {
    const output = await sharp(Buffer.from(sourceBytes))
      .extract({
        left: geometry.sourceX,
        top: geometry.sourceY,
        width: geometry.sourceWidth,
        height: geometry.sourceHeight,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    cropPng = output.data;
  } catch (error) {
    throw new SliceCropWorkflowError("CROP_IMAGE_GENERATION_FAILED", String(error));
  }

  const checksum = sha256Checksum(cropPng);
  const storageKey = `projects/${bbox.projectId}/derived-crops/${bbox.imageId}/${bbox.sliceInstanceId}/${randomUUID()}.png`;
  let objectWritten = false;

  try {
    await putObject(storageKey, cropPng, SLICE_CROP_CONTENT_TYPE);
    objectWritten = true;
    await verifyStoredObject({
      key: storageKey,
      size: cropPng.byteLength,
      contentType: SLICE_CROP_CONTENT_TYPE,
    });

    const created = await db.$transaction((tx) =>
      withVersionAllocationLock(
        tx,
        derivedSliceCropVersionFamilyKey(bbox.sliceInstanceId),
        async () => {
          const latest = await tx.derivedSliceCrop.findFirst({
            where: { sliceInstanceId: bbox.sliceInstanceId },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const nextVersion = (latest?.version ?? 0) + 1;

          const crop = await tx.derivedSliceCrop.create({
            data: {
              projectId: bbox.projectId,
              sourceImageId: bbox.imageId,
              sourceImageChecksum: sourceImage.checksum,
              sourceImageWidth: sourceImage.width,
              sourceImageHeight: sourceImage.height,
              sliceInstanceId: bbox.sliceInstanceId,
              bboxVersionId: bbox.id,
              version: nextVersion,
              sourceX: geometry.sourceX,
              sourceY: geometry.sourceY,
              sourceWidth: geometry.sourceWidth,
              sourceHeight: geometry.sourceHeight,
              cropX: geometry.cropX,
              cropY: geometry.cropY,
              cropWidth: geometry.cropWidth,
              cropHeight: geometry.cropHeight,
              paddingRequestedPx,
              paddingAppliedLeftPx: geometry.paddingAppliedLeftPx,
              paddingAppliedTopPx: geometry.paddingAppliedTopPx,
              paddingAppliedRightPx: geometry.paddingAppliedRightPx,
              paddingAppliedBottomPx: geometry.paddingAppliedBottomPx,
              paddingClipped: geometry.paddingClipped,
              coordinateSpace: "CROP_PIXEL",
              transformToSourceJson: geometry.transformToSourceJson,
              storageKey,
              checksum,
              contentType: SLICE_CROP_CONTENT_TYPE,
              byteSize: cropPng.byteLength,
              format: SLICE_CROP_FORMAT,
              metadataJson: {
                sourceContentType: sourceImage.contentType,
                generatedFromBBoxVersion: bbox.version,
              },
              createdById: params.userId,
            },
            select: { id: true },
          });
          const selected = await tx.derivedSliceCrop.findUniqueOrThrow({
            where: { id: crop.id },
            select: cropSelect,
          });

          await recordAuditEvent(
            {
              action: "SLICE_CROP_GENERATED",
              entity: "DerivedSliceCrop",
              entityId: crop.id,
              actorId: params.userId,
              details: {
                projectId: bbox.projectId,
                imageId: bbox.imageId,
                sliceInstanceId: bbox.sliceInstanceId,
                bboxVersionId: bbox.id,
                cropVersion: selected.version,
                paddingRequestedPx,
                paddingClipped: selected.paddingClipped,
                sourceRect: {
                  x: selected.sourceX,
                  y: selected.sourceY,
                  width: selected.sourceWidth,
                  height: selected.sourceHeight,
                },
                cropDimensions: { width: selected.cropWidth, height: selected.cropHeight },
                checksum,
              },
            },
            tx,
          );

          return selected;
        },
      ),
    );

    return serializeCrop(created);
  } catch (error) {
    if (objectWritten) await deleteObjectBestEffort(storageKey);
    if (error instanceof SliceCropWorkflowError) throw error;
    throw error;
  }
}

export function sliceCropErrorResponse(error: unknown): { error: string; status: number } {
  if (isVersionAllocationError(error)) {
    return { error: error.code, status: error.status };
  }

  if (error instanceof SliceCropWorkflowError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code.endsWith("_NOT_FOUND") || error.code === "BBOX_NOT_FOUND"
          ? 404
          : error.code === "BBOX_VERSION_STALE" || error.code === "BBOX_DELETED"
            ? 409
            : error.code === "CROP_IMAGE_GENERATION_FAILED"
              ? 500
              : 400;
    return { error: error.code, status };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { error: "SLICE_CROP_DB_ERROR", status: 500 };
  }

  return { error: "SLICE_CROP_FAILED", status: 500 };
}
