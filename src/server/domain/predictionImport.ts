import { randomUUID } from "crypto";
import {
  AnnotationArtifactKind,
  ArtifactProvenance,
  CoordinateSpace,
  PredictionTargetType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { canImportPrediction } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  deleteObjectBestEffort,
  putObject,
  verifyStoredObject,
} from "@/server/storage/s3";
import {
  normalizeContentType,
  UploadIntegrityError,
  validateMaskBytes,
  validateSupportMaskValues,
} from "@/server/uploads/integrity";
import { validateUploadSize } from "@/server/uploads/validation";

type PredictionImportDb = PrismaClient;

const MASK_TARGET_TYPES = new Set<PredictionTargetType>([
  PredictionTargetType.SEMANTIC_MASK,
  PredictionTargetType.SLICE_SUPPORT_MASK,
]);

export class PredictionImportError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
  ) {
    super(message);
  }
}

export type PredictionImportInput = {
  predictionRunId: string;
  userId: string;
  imageId: string;
  targetType: unknown;
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType?: string | null;
  format?: string | null;
  coordinateSpace?: string | null;
  expectedChecksum?: string | null;
  confidenceScore?: unknown;
  uncertaintyScore?: unknown;
  perClassScores?: Prisma.InputJsonValue;
  outputStats?: Prisma.InputJsonValue;
  sourceBatchItemId?: string | null;
};

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTargetType(value: unknown) {
  if (typeof value !== "string") {
    throw new PredictionImportError("PREDICTION_TARGET_UNSUPPORTED");
  }
  if (!Object.values(PredictionTargetType).includes(value as PredictionTargetType)) {
    throw new PredictionImportError("PREDICTION_TARGET_UNSUPPORTED");
  }
  const targetType = value as PredictionTargetType;
  if (!MASK_TARGET_TYPES.has(targetType)) {
    throw new PredictionImportError("PREDICTION_TARGET_UNSUPPORTED");
  }
  return targetType;
}

function parseOptionalScore(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new PredictionImportError(code);
  }
  return parsed;
}

function assertPredictionMaskContentType(value: string | null | undefined) {
  const contentType = normalizeContentType(value);
  if (contentType !== "application/octet-stream") {
    throw new UploadIntegrityError("UNSUPPORTED_CONTENT_TYPE", 415);
  }
  return contentType;
}

function parseCoordinateSpace(value: string | null | undefined) {
  const coordinateSpace = cleanText(value) ?? CoordinateSpace.IMAGE_PIXEL;
  if (coordinateSpace !== CoordinateSpace.IMAGE_PIXEL) {
    throw new PredictionImportError("COORDINATE_SPACE_UNSUPPORTED");
  }
  return CoordinateSpace.IMAGE_PIXEL;
}

async function getProjectLabelSchemaVersionId(db: PredictionImportDb, projectId: string) {
  const project = await db.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });
  if (project?.labelSchemaVersionId) return project.labelSchemaVersionId;

  const fallback = await db.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });
  if (!fallback) throw new PredictionImportError("DEFAULT_LABEL_SCHEMA_MISSING", 500);
  return fallback.id;
}

async function getSemanticMaskByteValues(db: PredictionImportDb, labelSchemaVersionId: string) {
  const labels = await db.labelDefinition.findMany({
    where: {
      schemaVersionId: labelSchemaVersionId,
      applicability: "SEMANTIC_MASK",
      byteValue: { not: null },
    },
    select: { byteValue: true },
  });

  return new Set(labels.map((label) => label.byteValue).filter((value): value is number => value !== null));
}

async function getSliceSupportByteValue(db: PredictionImportDb, labelSchemaVersionId: string) {
  const support = await db.labelDefinition.findUnique({
    where: {
      schemaVersionId_stableId: {
        schemaVersionId: labelSchemaVersionId,
        stableId: "slice_support",
      },
    },
    select: { byteValue: true, applicability: true },
  });

  if (!support || support.applicability !== "SUPPORT_MASK" || support.byteValue === null) {
    throw new PredictionImportError("SLICE_SUPPORT_LABEL_MISSING", 500);
  }
  return support.byteValue;
}

function validateSemanticMaskValues(bytes: Uint8Array, allowedValues: Set<number>) {
  if (allowedValues.size === 0) {
    throw new PredictionImportError("SEMANTIC_MASK_VALUES_INVALID");
  }
  for (const value of bytes) {
    if (!allowedValues.has(value)) {
      throw new PredictionImportError("SEMANTIC_MASK_VALUES_INVALID");
    }
  }
}

function predictionScopeKey(predictionRunId: string, targetType: PredictionTargetType) {
  return `prediction:${predictionRunId}:${targetType}`;
}

function importErrorCode(error: unknown) {
  if (error instanceof PredictionImportError) return error.code;
  if (error instanceof UploadIntegrityError) return error.code;
  if (error instanceof Error && error.message.startsWith("OBJECT_STAT")) return "OBJECT_STAT_FAILED";
  return "PREDICTION_IMPORT_FAILED";
}

async function findExistingBatchItemPredictionImport(
  db: PredictionImportDb,
  sourceBatchItemId: string | null | undefined,
) {
  if (!sourceBatchItemId) return null;
  const existing = await db.predictionArtifactProvenance.findUnique({
    where: { sourceBatchItemId },
    select: {
      id: true,
      predictionRunId: true,
      imageId: true,
      targetType: true,
      artifactVersion: {
        select: {
          id: true,
          version: true,
          reviewState: true,
          provenance: true,
          checksum: true,
          width: true,
          height: true,
          coordinateSpace: true,
          format: true,
          createdAt: true,
          artifact: { select: { id: true } },
        },
      },
    },
  });
  if (!existing?.artifactVersion) return null;

  return {
    predictionRunId: existing.predictionRunId,
    imageId: existing.imageId,
    artifactId: existing.artifactVersion.artifact.id,
    artifactVersionId: existing.artifactVersion.id,
    predictionProvenanceId: existing.id,
    targetType: existing.targetType,
    checksum: existing.artifactVersion.checksum,
    width: existing.artifactVersion.width,
    height: existing.artifactVersion.height,
    reviewState: existing.artifactVersion.reviewState,
    provenance: existing.artifactVersion.provenance,
    version: existing.artifactVersion.version,
    coordinateSpace: existing.artifactVersion.coordinateSpace,
    format: existing.artifactVersion.format,
    createdAt: existing.artifactVersion.createdAt,
  };
}

export async function importPredictionMaskForUser(
  input: PredictionImportInput,
  db: PredictionImportDb = prisma,
) {
  const targetType = parseTargetType(input.targetType);
  const sourceBatchItemId = cleanText(input.sourceBatchItemId);

  const predictionRun = await db.predictionRun.findUnique({
    where: { id: input.predictionRunId },
    select: { id: true, projectId: true },
  });
  if (!predictionRun) throw new PredictionImportError("PREDICTION_RUN_NOT_FOUND", 404);

  const image = await db.imageAsset.findUnique({
    where: { id: input.imageId },
    select: { id: true, projectId: true, width: true, height: true },
  });
  if (!image) throw new PredictionImportError("IMAGE_NOT_FOUND", 404);
  if (image.projectId !== predictionRun.projectId) {
    throw new PredictionImportError("IMAGE_PROJECT_MISMATCH", 400);
  }

  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: predictionRun.projectId, userId: input.userId } },
    select: { role: true },
  });
  if (!membership || !canImportPrediction(membership.role)) {
    throw new PredictionImportError("PREDICTION_IMPORT_FORBIDDEN", 403);
  }

  const existingBatchImport = await findExistingBatchItemPredictionImport(db, sourceBatchItemId);
  if (existingBatchImport) {
    if (
      existingBatchImport.predictionRunId !== predictionRun.id ||
      existingBatchImport.imageId !== image.id ||
      existingBatchImport.targetType !== targetType
    ) {
      throw new PredictionImportError("PREDICTION_IMPORT_SOURCE_MISMATCH", 409);
    }
    return existingBatchImport;
  }

  let storageKey: string | null = null;
  let objectWritten = false;
  let objectVerified = false;

  try {
    const sizeValidation = validateUploadSize(input.bytes.byteLength, "mask");
    if (!sizeValidation.ok) {
      throw new PredictionImportError(sizeValidation.error, sizeValidation.status);
    }

    const contentType = assertPredictionMaskContentType(input.contentType);
    const coordinateSpace = parseCoordinateSpace(input.coordinateSpace);
    const labelSchemaVersionId = await getProjectLabelSchemaVersionId(db, predictionRun.projectId);

    const integrity = validateMaskBytes({
      bytes: input.bytes,
      width: input.width,
      height: input.height,
      imageWidth: image.width,
      imageHeight: image.height,
      format: input.format,
      expectedChecksum: input.expectedChecksum,
    });

    if (targetType === PredictionTargetType.SEMANTIC_MASK) {
      const allowedValues = await getSemanticMaskByteValues(db, labelSchemaVersionId);
      validateSemanticMaskValues(input.bytes, allowedValues);
    } else {
      const supportByte = await getSliceSupportByteValue(db, labelSchemaVersionId);
      validateSupportMaskValues(input.bytes, supportByte);
    }

    const confidenceScore = parseOptionalScore(input.confidenceScore, "CONFIDENCE_OUT_OF_RANGE");
    const uncertaintyScore = parseOptionalScore(input.uncertaintyScore, "UNCERTAINTY_OUT_OF_RANGE");
    storageKey = `projects/${predictionRun.projectId}/predictions/${predictionRun.id}/${image.id}/${randomUUID()}.msk`;

    await putObject(storageKey, input.bytes, contentType);
    objectWritten = true;
    await verifyStoredObject({ key: storageKey, size: integrity.size, contentType });
    objectVerified = true;

    const result = await db.$transaction(async (tx) => {
      const artifact = await tx.annotationArtifact.upsert({
        where: {
          imageId_kind_scopeKey: {
            imageId: image.id,
            kind: AnnotationArtifactKind.PREDICTION_MASK,
            scopeKey: predictionScopeKey(predictionRun.id, targetType),
          },
        },
        update: {},
        create: {
          projectId: predictionRun.projectId,
          imageId: image.id,
          kind: AnnotationArtifactKind.PREDICTION_MASK,
          scopeKey: predictionScopeKey(predictionRun.id, targetType),
          createdById: input.userId,
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
          provenance: ArtifactProvenance.MODEL_PREDICTION,
          storageKey: storageKey!,
          contentType,
          size: integrity.size,
          checksum: integrity.checksum,
          width: integrity.width,
          height: integrity.height,
          coordinateSpace,
          format: integrity.format,
          labelSchemaVersionId,
          createdById: input.userId,
        },
        select: {
          id: true,
          version: true,
          reviewState: true,
          provenance: true,
          checksum: true,
          width: true,
          height: true,
          format: true,
          coordinateSpace: true,
          createdAt: true,
        },
      });

      const provenance = await tx.predictionArtifactProvenance.create({
        data: {
          predictionRunId: predictionRun.id,
          artifactVersionId: version.id,
          imageId: image.id,
          targetType,
          confidenceScore,
          uncertaintyScore,
          perClassScores: input.perClassScores,
          outputStats: input.outputStats,
          modelOutputChecksum: integrity.checksum,
          sourceBatchItemId,
        },
        select: { id: true },
      });

      return {
        predictionRunId: predictionRun.id,
        imageId: image.id,
        artifactId: artifact.id,
        artifactVersionId: version.id,
        predictionProvenanceId: provenance.id,
        targetType,
        checksum: version.checksum,
        width: version.width,
        height: version.height,
        reviewState: version.reviewState,
        provenance: version.provenance,
        version: version.version,
        coordinateSpace: version.coordinateSpace,
        format: version.format,
        createdAt: version.createdAt,
      };
    });

    await recordAuditEvent({
      action: "PREDICTION_IMPORT_CREATED",
      entity: "AnnotationArtifactVersion",
      entityId: result.artifactVersionId,
      actorId: input.userId,
      details: {
        projectId: predictionRun.projectId,
        predictionRunId: predictionRun.id,
        imageId: image.id,
        artifactId: result.artifactId,
        predictionProvenanceId: result.predictionProvenanceId,
        targetType,
        checksum: result.checksum,
        size: integrity.size,
        width: result.width,
        height: result.height,
      },
    });

    return result;
  } catch (error) {
    if (objectWritten && storageKey) await deleteObjectBestEffort(storageKey);
    await recordAuditEvent({
      action: "PREDICTION_IMPORT_FAILED",
      entity: "PredictionRun",
      entityId: predictionRun.id,
      actorId: input.userId,
      details: {
        projectId: predictionRun.projectId,
        imageId: image.id,
        targetType,
        error: importErrorCode(error),
      },
    });

    if (error instanceof PredictionImportError || error instanceof UploadIntegrityError) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith("OBJECT_STAT")) {
      throw new PredictionImportError("OBJECT_STAT_FAILED", 500);
    }
    if (objectVerified) throw new PredictionImportError("PREDICTION_IMPORT_FAILED", 500);
    if (objectWritten) throw new PredictionImportError("OBJECT_STAT_FAILED", 500);
    throw new PredictionImportError("OBJECT_WRITE_FAILED", 500);
  }
}

export function predictionImportErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof PredictionImportError) {
    return { error: error.code, status: error.status };
  }
  if (error instanceof UploadIntegrityError) {
    return { error: error.code, status: error.status };
  }
  return { error: "PREDICTION_IMPORT_FAILED", status: 500 };
}
