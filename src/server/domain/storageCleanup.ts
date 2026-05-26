import {
  ExportStatus,
  PredictionImportBatchItemStatus,
  PredictionImportBatchStatus,
  PrismaClient,
} from "@prisma/client";

import { canViewAudit } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { AUDIT_ACTOR_LABELS, recordAuditEvent, withAuditActorContext } from "@/server/domain/audit";
import { getRuntimeConfig } from "@/server/runtime/config";
import { deleteObject, getObjectBytes, listObjectsByPrefix, statObject } from "@/server/storage/s3";
import { normalizeChecksum, sha256Checksum } from "@/server/uploads/integrity";

type CleanupDb = PrismaClient;

export type StorageCleanupCategory = "all" | "batch-staging" | "upload-orphans";
export type CleanupObjectCategory =
  | "BATCH_SOURCE_ZIP"
  | "BATCH_STAGED_ITEM"
  | "ABANDONED_PRESIGNED_UPLOAD"
  | "ORPHAN_DERIVED_CROP_OBJECT"
  | "ORPHAN_CROP_SUPPORT_MASK_OBJECT"
  | "ORPHAN_CROP_SEMANTIC_MASK_OBJECT"
  | "UNKNOWN_STAGING_OBJECT";
export type CleanupResultStatus = "WOULD_DELETE" | "DELETED" | "SKIPPED" | "FAILED";

const TERMINAL_BATCH_STATUSES = [
  PredictionImportBatchStatus.COMPLETED,
  PredictionImportBatchStatus.COMPLETED_WITH_ERRORS,
  PredictionImportBatchStatus.FAILED,
  PredictionImportBatchStatus.CANCELLED,
] as const;

const TERMINAL_ITEM_STATUSES = [
  PredictionImportBatchItemStatus.SUCCEEDED,
  PredictionImportBatchItemStatus.FAILED,
  PredictionImportBatchItemStatus.SKIPPED,
] as const;

const ACTIVE_ITEM_STATUSES = [
  PredictionImportBatchItemStatus.PENDING,
  PredictionImportBatchItemStatus.PROCESSING,
  PredictionImportBatchItemStatus.RETRY_PENDING,
] as const;

function isTerminalBatchStatus(status: PredictionImportBatchStatus) {
  return (TERMINAL_BATCH_STATUSES as readonly PredictionImportBatchStatus[]).includes(status);
}

export class StorageCleanupError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
  ) {
    super(message);
  }
}

export type StorageCleanupOptions = {
  execute: boolean;
  category: StorageCleanupCategory;
  projectId?: string;
  batchId?: string;
  limit: number;
  deepChecksum: boolean;
  deepChecksumMaxObjects: number;
  deepChecksumMaxBytes: number;
  completedRetentionDays: number;
  failedRetentionDays: number;
  presignedRetentionHours: number;
  now: Date;
};

export type StorageCleanupResult = {
  key: string;
  category: CleanupObjectCategory;
  status: CleanupResultStatus;
  reason: string;
  size: number | null;
  ageSeconds: number | null;
  batchId: string | null;
  itemId: string | null;
  projectId: string | null;
};

export type StorageConsistencySeverity = "INFO" | "WARNING" | "HARD_DRIFT";
export type StorageConsistencyFinding = {
  code: string;
  severity: StorageConsistencySeverity;
  entity: string;
  entityId: string | null;
  key: string | null;
  projectId: string | null;
  expectedSize?: number | null;
  actualSize?: number | null;
  expectedChecksum?: string | null;
  actualChecksum?: string | null;
  status?: string | null;
  ageSeconds?: number | null;
};

export type StorageConsistencyReport = {
  hardDriftCount: number;
  warningCount: number;
  infoCount: number;
  findingCount: number;
  scannedStorageObjectCount: number;
  scannedStorageBytes: number;
  scannedProtectedReferenceCount: number;
  deepChecksumEnabled: boolean;
  deepChecksumObjectCount: number;
  deepChecksumBytes: number;
  missingReferencedObjectCount: number;
  sizeMismatchCount: number;
  checksumMissingCount: number;
  checksumMismatchCount: number;
  orphanExportObjectCount: number;
  stalePendingExportJobCount: number;
  expiredProcessingExportJobCount: number;
  findings: StorageConsistencyFinding[];
};

type CleanupCandidate = Omit<StorageCleanupResult, "status"> & {
  status: "WOULD_DELETE" | "SKIPPED";
};

type ListedObject = Awaited<ReturnType<typeof listObjectsByPrefix>>[number];

type ProtectedStorageReference = {
  entity: string;
  entityId: string;
  key: string;
  projectId: string | null;
  expectedSize: number | null;
  expectedChecksum: string | null;
  deepChecksumEligible: boolean;
};

const DEFAULT_DEEP_CHECKSUM_MAX_OBJECTS = 100;
const DEFAULT_DEEP_CHECKSUM_MAX_BYTES = 512 * 1024 * 1024;

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInteger(value: unknown, fallback: number, code: string) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new StorageCleanupError(code);
  return parsed;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") throw new StorageCleanupError("CLEANUP_FLAG_INVALID");
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  throw new StorageCleanupError("CLEANUP_FLAG_INVALID");
}

function parseCategory(value: unknown): StorageCleanupCategory {
  const category = cleanText(value) ?? "all";
  if (category === "all" || category === "batch-staging" || category === "upload-orphans") {
    return category;
  }
  throw new StorageCleanupError("CLEANUP_CATEGORY_INVALID");
}

export function retentionCutoff(now: Date, amount: number, unit: "days" | "hours") {
  const multiplier = unit === "days" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  return new Date(now.getTime() - amount * multiplier);
}

export function ageSeconds(now: Date, value: Date | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1000));
}

export function classifyStorageCleanupKey(key: string): {
  category: CleanupObjectCategory;
  projectId: string;
  batchId?: string;
} | null {
  const imageMatch = key.match(/^projects\/([^/]+)\/images\/[^/]+$/);
  if (imageMatch?.[1]) {
    return { category: "ABANDONED_PRESIGNED_UPLOAD", projectId: imageMatch[1] };
  }

  const maskMatch = key.match(/^projects\/([^/]+)\/masks\/[^/]+\/[^/]+\.msk$/);
  if (maskMatch?.[1]) {
    return { category: "ABANDONED_PRESIGNED_UPLOAD", projectId: maskMatch[1] };
  }

  const derivedCropMatch = key.match(/^projects\/([^/]+)\/derived-crops\/[^/]+\/[^/]+\/[^/]+\.png$/);
  if (derivedCropMatch?.[1]) {
    return { category: "ORPHAN_DERIVED_CROP_OBJECT", projectId: derivedCropMatch[1] };
  }

  const cropSupportMaskMatch = key.match(
    /^projects\/([^/]+)\/crop-support-masks\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.msk$/,
  );
  if (cropSupportMaskMatch?.[1]) {
    return { category: "ORPHAN_CROP_SUPPORT_MASK_OBJECT", projectId: cropSupportMaskMatch[1] };
  }

  const cropSemanticMaskMatch = key.match(
    /^projects\/([^/]+)\/crop-semantic-masks\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.msk$/,
  );
  if (cropSemanticMaskMatch?.[1]) {
    return { category: "ORPHAN_CROP_SEMANTIC_MASK_OBJECT", projectId: cropSemanticMaskMatch[1] };
  }

  const batchMatch = key.match(/^projects\/([^/]+)\/prediction-import-batches\/([^/]+)\/[^/]+$/);
  if (batchMatch?.[1] && batchMatch[2]) {
    return {
      category: key.toLowerCase().endsWith(".zip") ? "BATCH_SOURCE_ZIP" : "UNKNOWN_STAGING_OBJECT",
      projectId: batchMatch[1],
      batchId: batchMatch[2],
    };
  }

  return null;
}

export function classifyExportPackageKey(key: string): {
  projectId: string;
  exportId: string;
  family: "training" | "prediction-analysis";
  file: "manifest" | "package";
} | null {
  const trainingMatch = key.match(/^projects\/([^/]+)\/exports\/([^/]+)\/(manifest\.json|package\.zip)$/);
  if (trainingMatch?.[1] && trainingMatch[2] && trainingMatch[3]) {
    return {
      projectId: trainingMatch[1],
      exportId: trainingMatch[2],
      family: "training",
      file: trainingMatch[3] === "manifest.json" ? "manifest" : "package",
    };
  }

  const predictionAnalysisMatch = key.match(
    /^projects\/([^/]+)\/prediction-analysis-exports\/([^/]+)\/(manifest\.json|package\.zip)$/,
  );
  if (predictionAnalysisMatch?.[1] && predictionAnalysisMatch[2] && predictionAnalysisMatch[3]) {
    return {
      projectId: predictionAnalysisMatch[1],
      exportId: predictionAnalysisMatch[2],
      family: "prediction-analysis",
      file: predictionAnalysisMatch[3] === "manifest.json" ? "manifest" : "package",
    };
  }

  return null;
}

export function normalizeStorageCleanupOptions(input: unknown): StorageCleanupOptions {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const config = getRuntimeConfig().storageCleanup;
  const limit = Math.min(
    parsePositiveInteger(body.limit, config.maxDeletePerRun, "CLEANUP_LIMIT_INVALID"),
    config.maxDeletePerRun,
  );
  const dryRun = parseBoolean(body.dryRun, false);
  const execute = dryRun ? false : parseBoolean(body.execute, false);
  const nowInput = body.now instanceof Date
    ? body.now
    : typeof body.now === "string"
      ? new Date(body.now)
      : new Date();
  if (Number.isNaN(nowInput.getTime())) throw new StorageCleanupError("CLEANUP_NOW_INVALID");
  const projectId = cleanText(body.projectId) ?? undefined;
  const deepChecksum = parseBoolean(body.deepChecksum, false);
  const deepChecksumMaxObjects = parsePositiveInteger(
    body.deepChecksumMaxObjects,
    DEFAULT_DEEP_CHECKSUM_MAX_OBJECTS,
    "DEEP_CHECKSUM_LIMIT_INVALID",
  );
  const deepChecksumMaxBytes = parsePositiveInteger(
    body.deepChecksumMaxBytes,
    DEFAULT_DEEP_CHECKSUM_MAX_BYTES,
    "DEEP_CHECKSUM_LIMIT_INVALID",
  );
  if (deepChecksum && !projectId) {
    throw new StorageCleanupError("DEEP_CHECKSUM_PROJECT_REQUIRED");
  }

  return {
    execute,
    category: parseCategory(body.category),
    projectId,
    batchId: cleanText(body.batchId) ?? undefined,
    limit,
    deepChecksum,
    deepChecksumMaxObjects,
    deepChecksumMaxBytes,
    completedRetentionDays: parsePositiveInteger(
      body.completedRetentionDays,
      config.batchStagingCompletedRetentionDays,
      "CLEANUP_COMPLETED_RETENTION_INVALID",
    ),
    failedRetentionDays: parsePositiveInteger(
      body.failedRetentionDays,
      config.batchStagingFailedRetentionDays,
      "CLEANUP_FAILED_RETENTION_INVALID",
    ),
    presignedRetentionHours: parsePositiveInteger(
      body.presignedRetentionHours,
      config.presignedUploadStagingRetentionHours,
      "CLEANUP_PRESIGNED_RETENTION_INVALID",
    ),
    now: nowInput,
  };
}

function batchRetentionCutoff(options: StorageCleanupOptions, status: PredictionImportBatchStatus) {
  const days = status === PredictionImportBatchStatus.COMPLETED
    ? options.completedRetentionDays
    : options.failedRetentionDays;
  return retentionCutoff(options.now, days, "days");
}

function resultFromCandidate(candidate: CleanupCandidate): StorageCleanupResult {
  return { ...candidate };
}

async function collectBatchStagingCandidates(
  db: CleanupDb,
  options: StorageCleanupOptions,
): Promise<CleanupCandidate[]> {
  if (options.category === "upload-orphans") return [];

  const candidates: CleanupCandidate[] = [];
  const terminalItems = await db.predictionImportBatchItem.findMany({
    where: {
      stagingPurgedAt: null,
      ...(options.batchId ? { batchJobId: options.batchId } : {}),
      status: { in: [...TERMINAL_ITEM_STATUSES] },
      batchJob: {
        status: { in: [...TERMINAL_BATCH_STATUSES] },
        ...(options.projectId ? { projectId: options.projectId } : {}),
      },
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: Math.max(100, options.limit * 5),
    select: {
      id: true,
      batchJobId: true,
      stagingKey: true,
      status: true,
      completedAt: true,
      updatedAt: true,
      predictionArtifactVersionId: true,
      predictionProvenanceId: true,
      batchJob: {
        select: {
          id: true,
          projectId: true,
          status: true,
          completedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  for (const item of terminalItems) {
    if (
      item.status === PredictionImportBatchItemStatus.SUCCEEDED &&
      (!item.predictionArtifactVersionId || !item.predictionProvenanceId)
    ) {
      candidates.push({
        key: item.stagingKey,
        category: "BATCH_STAGED_ITEM",
        status: "SKIPPED",
        reason: "BATCH_SUCCEEDED_LINK_MISSING",
        size: null,
        ageSeconds: ageSeconds(options.now, item.completedAt ?? item.updatedAt),
        batchId: item.batchJobId,
        itemId: item.id,
        projectId: item.batchJob.projectId,
      });
      continue;
    }

    const referenceDate = item.batchJob.completedAt ?? item.completedAt ?? item.batchJob.updatedAt;
    const cutoff = batchRetentionCutoff(options, item.batchJob.status);
    if (referenceDate.getTime() > cutoff.getTime()) {
      continue;
    }

    candidates.push({
      key: item.stagingKey,
      category: "BATCH_STAGED_ITEM",
      status: "WOULD_DELETE",
      reason: item.batchJob.status === PredictionImportBatchStatus.COMPLETED
        ? "BATCH_COMPLETED_RETENTION_EXPIRED"
        : "BATCH_FAILED_RETENTION_EXPIRED",
      size: null,
      ageSeconds: ageSeconds(options.now, referenceDate),
      batchId: item.batchJobId,
      itemId: item.id,
      projectId: item.batchJob.projectId,
    });
  }

  if (options.batchId) {
    const activeItems = await db.predictionImportBatchItem.findMany({
      where: {
        batchJobId: options.batchId,
        ...(options.projectId ? { batchJob: { projectId: options.projectId } } : {}),
        stagingPurgedAt: null,
        status: { in: [...ACTIVE_ITEM_STATUSES] },
      },
      take: Math.max(10, options.limit),
      select: {
        id: true,
        batchJobId: true,
        stagingKey: true,
        updatedAt: true,
        batchJob: { select: { projectId: true } },
      },
    });
    for (const item of activeItems) {
      candidates.push({
        key: item.stagingKey,
        category: "BATCH_STAGED_ITEM",
        status: "SKIPPED",
        reason: "BATCH_ITEM_ACTIVE_OR_RETRYABLE",
        size: null,
        ageSeconds: ageSeconds(options.now, item.updatedAt),
        batchId: item.batchJobId,
        itemId: item.id,
        projectId: item.batchJob.projectId,
      });
    }
  }

  return candidates;
}

async function protectedKeys(db: CleanupDb, keys: string[]) {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return new Map<string, string>();

  const [images, artifacts, crops, importItems] = await Promise.all([
    db.imageAsset.findMany({
      where: { storageKey: { in: uniqueKeys } },
      select: { storageKey: true },
    }),
    db.annotationArtifactVersion.findMany({
      where: { storageKey: { in: uniqueKeys } },
      select: { storageKey: true },
    }),
    db.derivedSliceCrop.findMany({
      where: { storageKey: { in: uniqueKeys } },
      select: { storageKey: true },
    }),
    db.predictionImportBatchItem.findMany({
      where: { stagingKey: { in: uniqueKeys } },
      select: { stagingKey: true },
    }),
  ]);

  const protectedBy = new Map<string, string>();
  for (const image of images) protectedBy.set(image.storageKey, "IMAGE_ASSET_REFERENCE");
  for (const artifact of artifacts) protectedBy.set(artifact.storageKey, "ARTIFACT_VERSION_REFERENCE");
  for (const crop of crops) protectedBy.set(crop.storageKey, "DERIVED_SLICE_CROP_REFERENCE");
  for (const item of importItems) protectedBy.set(item.stagingKey, "BATCH_STAGING_DB_REFERENCE");
  return protectedBy;
}

async function knownBatchStatuses(db: CleanupDb, batchIds: string[]) {
  const uniqueIds = [...new Set(batchIds)];
  if (uniqueIds.length === 0) return new Map<string, {
    projectId: string;
    status: PredictionImportBatchStatus;
    completedAt: Date | null;
    updatedAt: Date;
  }>();

  const batches = await db.predictionImportBatchJob.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, projectId: true, status: true, completedAt: true, updatedAt: true },
  });
  return new Map(batches.map((batch) => [batch.id, batch]));
}

function shouldConsiderObject(object: ListedObject, options: StorageCleanupOptions) {
  if (!object.lastModified) return false;
  return object.lastModified.getTime() <= retentionCutoff(
    options.now,
    options.presignedRetentionHours,
    "hours",
  ).getTime();
}

function isBatchTemporaryObject(category: CleanupObjectCategory) {
  return category === "BATCH_SOURCE_ZIP" || category === "UNKNOWN_STAGING_OBJECT";
}

function isUploadOrphanObject(category: CleanupObjectCategory) {
  return category === "ABANDONED_PRESIGNED_UPLOAD" ||
    category === "ORPHAN_DERIVED_CROP_OBJECT" ||
    category === "ORPHAN_CROP_SUPPORT_MASK_OBJECT" ||
    category === "ORPHAN_CROP_SEMANTIC_MASK_OBJECT";
}

function orphanCleanupReason(category: CleanupObjectCategory) {
  if (category === "ORPHAN_DERIVED_CROP_OBJECT") return "DERIVED_CROP_OBJECT_ORPHAN_RETENTION_EXPIRED";
  if (category === "ORPHAN_CROP_SUPPORT_MASK_OBJECT") return "CROP_SUPPORT_MASK_OBJECT_ORPHAN_RETENTION_EXPIRED";
  if (category === "ORPHAN_CROP_SEMANTIC_MASK_OBJECT") return "CROP_SEMANTIC_MASK_OBJECT_ORPHAN_RETENTION_EXPIRED";
  return "PRESIGNED_UPLOAD_ORPHAN_RETENTION_EXPIRED";
}

async function collectObjectStorageCandidates(
  db: CleanupDb,
  options: StorageCleanupOptions,
): Promise<CleanupCandidate[]> {
  if (options.category === "batch-staging") return [];

  const listingPrefix = options.projectId ? `projects/${options.projectId}/` : "projects/";
  const objects = await listObjectsByPrefix(listingPrefix, Math.max(1000, options.limit * 20));
  const classified = objects
    .map((object) => ({ object, classification: classifyStorageCleanupKey(object.key) }))
    .filter((entry): entry is { object: ListedObject; classification: NonNullable<ReturnType<typeof classifyStorageCleanupKey>> } =>
      Boolean(entry.classification),
    )
    .filter((entry) => {
      if (options.batchId && entry.classification.batchId !== options.batchId) return false;
      if (options.projectId && entry.classification.projectId !== options.projectId) return false;
      if (options.category === "upload-orphans") {
        return isUploadOrphanObject(entry.classification.category);
      }
      if (isBatchTemporaryObject(entry.classification.category)) return true;
      return options.category !== "batch-staging";
    });

  const protections = await protectedKeys(db, classified.map((entry) => entry.object.key));
  const batchStatus = await knownBatchStatuses(
    db,
    classified
      .map((entry) => entry.classification.batchId)
      .filter((id): id is string => Boolean(id)),
  );

  const candidates: CleanupCandidate[] = [];
  for (const entry of classified) {
    const { object, classification } = entry;
    if (isUploadOrphanObject(classification.category) && !shouldConsiderObject(object, options)) {
      continue;
    }

    const protectedReason = protections.get(object.key);
    if (protectedReason) {
      if (protectedReason === "BATCH_STAGING_DB_REFERENCE") continue;
      candidates.push({
        key: object.key,
        category: classification.category,
        status: "SKIPPED",
        reason: protectedReason,
        size: object.size,
        ageSeconds: ageSeconds(options.now, object.lastModified),
        batchId: classification.batchId ?? null,
        itemId: null,
        projectId: classification.projectId,
      });
      continue;
    }

    if (isBatchTemporaryObject(classification.category)) {
      const batch = classification.batchId ? batchStatus.get(classification.batchId) : null;
      if (batch && !isTerminalBatchStatus(batch.status)) {
        candidates.push({
          key: object.key,
          category: classification.category,
          status: "SKIPPED",
          reason: "BATCH_NOT_TERMINAL",
          size: object.size,
          ageSeconds: ageSeconds(options.now, object.lastModified),
          batchId: classification.batchId ?? null,
          itemId: null,
          projectId: classification.projectId,
        });
        continue;
      }
      const cutoff = batch
        ? batchRetentionCutoff(options, batch.status)
        : retentionCutoff(options.now, options.failedRetentionDays, "days");
      const referenceDate = batch?.completedAt ?? batch?.updatedAt ?? object.lastModified;
      if (!referenceDate || referenceDate.getTime() > cutoff.getTime()) continue;
    }

    candidates.push({
      key: object.key,
      category: classification.category,
      status: "WOULD_DELETE",
      reason: isBatchTemporaryObject(classification.category)
        ? classification.category === "BATCH_SOURCE_ZIP"
          ? "BATCH_SOURCE_ZIP_RETENTION_EXPIRED"
          : "UNKNOWN_STAGING_RETENTION_EXPIRED"
        : orphanCleanupReason(classification.category),
      size: object.size,
      ageSeconds: ageSeconds(options.now, object.lastModified),
      batchId: classification.batchId ?? null,
      itemId: null,
      projectId: classification.projectId,
    });
  }

  return candidates;
}

function dateBefore(now: Date, seconds: number) {
  return new Date(now.getTime() - seconds * 1000);
}

function summarizeBytes(results: StorageCleanupResult[], status: CleanupResultStatus) {
  return results
    .filter((result) => result.status === status)
    .reduce((total, result) => total + (result.size ?? 0), 0);
}

function summarizeByCategory(results: StorageCleanupResult[]) {
  const byCategory: Partial<Record<CleanupObjectCategory, {
    totalResults: number;
    wouldDeleteCount: number;
    deletedCount: number;
    skippedCount: number;
    failedCount: number;
    knownBytes: number;
  }>> = {};

  for (const result of results) {
    const category = byCategory[result.category] ?? {
      totalResults: 0,
      wouldDeleteCount: 0,
      deletedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      knownBytes: 0,
    };
    category.totalResults += 1;
    category.knownBytes += result.size ?? 0;
    if (result.status === "WOULD_DELETE") category.wouldDeleteCount += 1;
    if (result.status === "DELETED") category.deletedCount += 1;
    if (result.status === "SKIPPED") category.skippedCount += 1;
    if (result.status === "FAILED") category.failedCount += 1;
    byCategory[result.category] = category;
  }

  return byCategory;
}

function finding(params: StorageConsistencyFinding): StorageConsistencyFinding {
  return params;
}

async function checkReference(
  reference: ProtectedStorageReference,
  options: StorageCleanupOptions,
): Promise<StorageConsistencyFinding[]> {
  try {
    const stat = await statObject(reference.key);
    if (
      reference.expectedSize !== null &&
      stat.contentLength !== null &&
      stat.contentLength !== reference.expectedSize
    ) {
      return [finding({
        code: "REFERENCED_OBJECT_SIZE_MISMATCH",
        severity: "HARD_DRIFT",
        entity: reference.entity,
        entityId: reference.entityId,
        key: reference.key,
        projectId: reference.projectId,
        expectedSize: reference.expectedSize,
        actualSize: stat.contentLength,
      })];
    }
    if (!options.deepChecksum || !reference.deepChecksumEligible) return [];

    const normalizedExpectedChecksum = normalizeChecksum(reference.expectedChecksum);
    if (!normalizedExpectedChecksum) {
      return [finding({
        code: "REFERENCED_OBJECT_CHECKSUM_MISSING",
        severity: "WARNING",
        entity: reference.entity,
        entityId: reference.entityId,
        key: reference.key,
        projectId: reference.projectId,
        expectedSize: reference.expectedSize,
      })];
    }

    try {
      const actualChecksum = sha256Checksum(await getObjectBytes(reference.key));
      if (actualChecksum !== normalizedExpectedChecksum) {
        return [finding({
          code: "REFERENCED_OBJECT_CHECKSUM_MISMATCH",
          severity: "HARD_DRIFT",
          entity: reference.entity,
          entityId: reference.entityId,
          key: reference.key,
          projectId: reference.projectId,
          expectedChecksum: normalizedExpectedChecksum,
          actualChecksum,
        })];
      }
    } catch {
      return [finding({
        code: "REFERENCED_OBJECT_READ_FAILED",
        severity: "HARD_DRIFT",
        entity: reference.entity,
        entityId: reference.entityId,
        key: reference.key,
        projectId: reference.projectId,
        expectedChecksum: normalizedExpectedChecksum,
      })];
    }
    return [];
  } catch {
    return [finding({
      code: "MISSING_REFERENCED_OBJECT",
      severity: "HARD_DRIFT",
      entity: reference.entity,
      entityId: reference.entityId,
      key: reference.key,
      projectId: reference.projectId,
      expectedSize: reference.expectedSize,
      expectedChecksum: normalizeChecksum(reference.expectedChecksum),
    })];
  }
}

async function collectProtectedReferences(
  db: CleanupDb,
  options: StorageCleanupOptions,
): Promise<ProtectedStorageReference[]> {
  const [images, artifacts, crops, importItems] = await Promise.all([
    db.imageAsset.findMany({
      where: options.projectId ? { projectId: options.projectId } : {},
      select: { id: true, projectId: true, storageKey: true, size: true, checksum: true },
    }),
    db.annotationArtifactVersion.findMany({
      where: options.projectId ? { artifact: { projectId: options.projectId } } : {},
      select: {
        id: true,
        storageKey: true,
        size: true,
        checksum: true,
        artifact: { select: { projectId: true } },
      },
    }),
    db.derivedSliceCrop.findMany({
      where: options.projectId ? { projectId: options.projectId } : {},
      select: { id: true, projectId: true, storageKey: true, byteSize: true, checksum: true },
    }),
    db.predictionImportBatchItem.findMany({
      where: {
        stagingPurgedAt: null,
        status: { in: [...ACTIVE_ITEM_STATUSES] },
        ...(options.batchId ? { batchJobId: options.batchId } : {}),
        ...(options.projectId ? { batchJob: { projectId: options.projectId } } : {}),
      },
      select: {
        id: true,
        stagingKey: true,
        batchJob: { select: { projectId: true } },
      },
    }),
  ]);

  return [
    ...images.map((image) => ({
      entity: "ImageAsset",
      entityId: image.id,
      key: image.storageKey,
      projectId: image.projectId,
      expectedSize: image.size,
      expectedChecksum: image.checksum,
      deepChecksumEligible: true,
    })),
    ...artifacts.map((artifact) => ({
      entity: "AnnotationArtifactVersion",
      entityId: artifact.id,
      key: artifact.storageKey,
      projectId: artifact.artifact.projectId,
      expectedSize: artifact.size,
      expectedChecksum: artifact.checksum,
      deepChecksumEligible: true,
    })),
    ...crops.map((crop) => ({
      entity: "DerivedSliceCrop",
      entityId: crop.id,
      key: crop.storageKey,
      projectId: crop.projectId,
      expectedSize: crop.byteSize,
      expectedChecksum: crop.checksum,
      deepChecksumEligible: true,
    })),
    ...importItems.map((item) => ({
      entity: "PredictionImportBatchItem",
      entityId: item.id,
      key: item.stagingKey,
      projectId: item.batchJob.projectId,
      expectedSize: null,
      expectedChecksum: null,
      deepChecksumEligible: false,
    })),
  ];
}

function enforceDeepChecksumLimits(references: ProtectedStorageReference[], options: StorageCleanupOptions) {
  if (!options.deepChecksum) return { objectCount: 0, expectedBytes: 0 };

  const eligibleReferences = references.filter((reference) => reference.deepChecksumEligible);
  const expectedBytes = eligibleReferences.reduce((total, reference) => total + (reference.expectedSize ?? 0), 0);
  if (
    eligibleReferences.length > options.deepChecksumMaxObjects ||
    expectedBytes > options.deepChecksumMaxBytes
  ) {
    throw new StorageCleanupError("DEEP_CHECKSUM_LIMIT_EXCEEDED");
  }
  return { objectCount: eligibleReferences.length, expectedBytes };
}

async function assertDeepChecksumLimitsBeforeMutation(db: CleanupDb, options: StorageCleanupOptions) {
  if (!options.deepChecksum) return;
  enforceDeepChecksumLimits(await collectProtectedReferences(db, options), options);
}

async function checkExportObject(params: {
  batch: {
    id: string;
    projectId: string;
    status: ExportStatus;
    manifestStorageKey: string | null;
    manifestChecksum: string | null;
    packageStorageKey: string | null;
    packageChecksum: string | null;
    packageSize: number | null;
  };
  file: "manifest" | "package";
}) {
  const key = params.file === "manifest"
    ? params.batch.manifestStorageKey
    : params.batch.packageStorageKey;
  const expectedChecksum = params.file === "manifest"
    ? params.batch.manifestChecksum
    : params.batch.packageChecksum;
  const expectedSize = params.file === "package" ? params.batch.packageSize : null;
  const entity = "ExportBatch";
  const codePrefix = params.file === "manifest" ? "EXPORT_MANIFEST" : "EXPORT_PACKAGE";

  if (!key) {
    return [finding({
      code: `${codePrefix}_KEY_MISSING`,
      severity: "HARD_DRIFT",
      entity,
      entityId: params.batch.id,
      key: null,
      projectId: params.batch.projectId,
      status: params.batch.status,
      expectedSize,
      expectedChecksum: normalizeChecksum(expectedChecksum),
    })];
  }

  const findings: StorageConsistencyFinding[] = [];
  try {
    const stat = await statObject(key);
    if (expectedSize !== null && stat.contentLength !== null && stat.contentLength !== expectedSize) {
      findings.push(finding({
        code: `${codePrefix}_SIZE_MISMATCH`,
        severity: "HARD_DRIFT",
        entity,
        entityId: params.batch.id,
        key,
        projectId: params.batch.projectId,
        expectedSize,
        actualSize: stat.contentLength,
        status: params.batch.status,
      }));
    }
  } catch {
    return [finding({
      code: `${codePrefix}_MISSING`,
      severity: "HARD_DRIFT",
      entity,
      entityId: params.batch.id,
      key,
      projectId: params.batch.projectId,
      expectedSize,
      expectedChecksum: normalizeChecksum(expectedChecksum),
      status: params.batch.status,
    })];
  }

  const normalizedExpectedChecksum = normalizeChecksum(expectedChecksum);
  if (normalizedExpectedChecksum) {
    try {
      const actualChecksum = sha256Checksum(await getObjectBytes(key));
      if (actualChecksum !== normalizedExpectedChecksum) {
        findings.push(finding({
          code: `${codePrefix}_CHECKSUM_MISMATCH`,
          severity: "HARD_DRIFT",
          entity,
          entityId: params.batch.id,
          key,
          projectId: params.batch.projectId,
          expectedChecksum: normalizedExpectedChecksum,
          actualChecksum,
          status: params.batch.status,
        }));
      }
    } catch {
      findings.push(finding({
        code: `${codePrefix}_READ_FAILED`,
        severity: "HARD_DRIFT",
        entity,
        entityId: params.batch.id,
        key,
        projectId: params.batch.projectId,
        expectedChecksum: normalizedExpectedChecksum,
        status: params.batch.status,
      }));
    }
  }

  return findings;
}

async function collectExportConsistencyFindings(params: {
  db: CleanupDb;
  options: StorageCleanupOptions;
  storageObjects: ListedObject[];
}) {
  const exportConfig = getRuntimeConfig().exportJobs;
  const exportJobStaleSeconds = Math.max(
    exportConfig.leaseSeconds,
    exportConfig.workerIntervalSeconds * 2,
  );
  const now = params.options.now;
  const [completedExports, pendingExports, processingExports] = await Promise.all([
    params.db.exportBatch.findMany({
      where: {
        status: ExportStatus.COMPLETED,
        ...(params.options.projectId ? { projectId: params.options.projectId } : {}),
      },
      select: {
        id: true,
        projectId: true,
        status: true,
        manifestStorageKey: true,
        manifestChecksum: true,
        packageStorageKey: true,
        packageChecksum: true,
        packageSize: true,
      },
    }),
    params.db.exportBatch.findMany({
      where: {
        status: ExportStatus.PENDING,
        createdAt: { lte: dateBefore(now, exportJobStaleSeconds) },
        ...(params.options.projectId ? { projectId: params.options.projectId } : {}),
      },
      select: { id: true, projectId: true, status: true, createdAt: true },
    }),
    params.db.exportBatch.findMany({
      where: {
        status: ExportStatus.PROCESSING,
        OR: [{ leaseExpiresAt: { lte: now } }, { leaseExpiresAt: null }],
        ...(params.options.projectId ? { projectId: params.options.projectId } : {}),
      },
      select: { id: true, projectId: true, status: true, leaseExpiresAt: true, processingStartedAt: true },
    }),
  ]);

  const findings: StorageConsistencyFinding[] = [];
  for (const batch of completedExports) {
    findings.push(...await checkExportObject({ batch, file: "manifest" }));
    findings.push(...await checkExportObject({ batch, file: "package" }));
  }

  for (const batch of pendingExports) {
    findings.push(finding({
      code: "STALE_PENDING_EXPORT_JOB",
      severity: "WARNING",
      entity: "ExportBatch",
      entityId: batch.id,
      key: null,
      projectId: batch.projectId,
      status: batch.status,
      ageSeconds: ageSeconds(now, batch.createdAt),
    }));
  }

  for (const batch of processingExports) {
    findings.push(finding({
      code: "EXPIRED_PROCESSING_EXPORT_JOB",
      severity: "WARNING",
      entity: "ExportBatch",
      entityId: batch.id,
      key: null,
      projectId: batch.projectId,
      status: batch.status,
      ageSeconds: ageSeconds(now, batch.leaseExpiresAt ?? batch.processingStartedAt),
    }));
  }

  const exportObjects = params.storageObjects
    .map((object) => ({ object, classification: classifyExportPackageKey(object.key) }))
    .filter((entry): entry is { object: ListedObject; classification: NonNullable<ReturnType<typeof classifyExportPackageKey>> } =>
      Boolean(entry.classification),
    )
    .filter((entry) => !params.options.projectId || entry.classification.projectId === params.options.projectId);
  const exportIds = [...new Set(exportObjects.map((entry) => entry.classification.exportId))];
  const knownExports = exportIds.length
    ? await params.db.exportBatch.findMany({
        where: { id: { in: exportIds } },
        select: {
          id: true,
          manifestStorageKey: true,
          packageStorageKey: true,
        },
      })
    : [];
  const knownById = new Map(knownExports.map((batch) => [batch.id, batch]));
  for (const entry of exportObjects) {
    const batch = knownById.get(entry.classification.exportId);
    const referenced =
      batch?.manifestStorageKey === entry.object.key ||
      batch?.packageStorageKey === entry.object.key;
    if (referenced) continue;
    findings.push(finding({
      code: batch ? "UNREFERENCED_EXPORT_PACKAGE_OBJECT" : "ORPHAN_EXPORT_PACKAGE_OBJECT",
      severity: "WARNING",
      entity: "StorageObject",
      entityId: entry.classification.exportId,
      key: entry.object.key,
      projectId: entry.classification.projectId,
      actualSize: entry.object.size,
      ageSeconds: ageSeconds(now, entry.object.lastModified),
    }));
  }

  return findings;
}

async function collectConsistencyReport(
  db: CleanupDb,
  options: StorageCleanupOptions,
): Promise<StorageConsistencyReport> {
  const storageObjects = await listObjectsByPrefix("projects/", Math.max(1000, options.limit * 20));
  const filteredStorageObjects = options.projectId
    ? storageObjects.filter((object) => object.key.startsWith(`projects/${options.projectId}/`))
    : storageObjects;
  const references = await collectProtectedReferences(db, options);
  const deepChecksumSummary = enforceDeepChecksumLimits(references, options);
  const referenceFindings = (await Promise.all(
    references.map((reference) => checkReference(reference, options)),
  )).flat();
  const exportFindings = await collectExportConsistencyFindings({
    db,
    options,
    storageObjects: filteredStorageObjects,
  });
  const findings = [...referenceFindings, ...exportFindings];

  return {
    hardDriftCount: findings.filter((entry) => entry.severity === "HARD_DRIFT").length,
    warningCount: findings.filter((entry) => entry.severity === "WARNING").length,
    infoCount: findings.filter((entry) => entry.severity === "INFO").length,
    findingCount: findings.length,
    scannedStorageObjectCount: filteredStorageObjects.length,
    scannedStorageBytes: filteredStorageObjects.reduce((total, object) => total + (object.size ?? 0), 0),
    scannedProtectedReferenceCount: references.length,
    deepChecksumEnabled: options.deepChecksum,
    deepChecksumObjectCount: deepChecksumSummary.objectCount,
    deepChecksumBytes: deepChecksumSummary.expectedBytes,
    missingReferencedObjectCount: findings.filter((entry) =>
      entry.code === "MISSING_REFERENCED_OBJECT" ||
      entry.code === "EXPORT_MANIFEST_MISSING" ||
      entry.code === "EXPORT_PACKAGE_MISSING" ||
      entry.code === "EXPORT_MANIFEST_KEY_MISSING" ||
      entry.code === "EXPORT_PACKAGE_KEY_MISSING",
    ).length,
    sizeMismatchCount: findings.filter((entry) => entry.code.endsWith("_SIZE_MISMATCH")).length,
    checksumMissingCount: findings.filter((entry) => entry.code.endsWith("_CHECKSUM_MISSING")).length,
    checksumMismatchCount: findings.filter((entry) => entry.code.endsWith("_CHECKSUM_MISMATCH")).length,
    orphanExportObjectCount: findings.filter((entry) =>
      entry.code === "ORPHAN_EXPORT_PACKAGE_OBJECT" ||
      entry.code === "UNREFERENCED_EXPORT_PACKAGE_OBJECT",
    ).length,
    stalePendingExportJobCount: findings.filter((entry) => entry.code === "STALE_PENDING_EXPORT_JOB").length,
    expiredProcessingExportJobCount: findings.filter((entry) => entry.code === "EXPIRED_PROCESSING_EXPORT_JOB").length,
    findings,
  };
}

function summarize(results: StorageCleanupResult[], execute: boolean) {
  return {
    mode: execute ? "execute" : "dry-run",
    totalResults: results.length,
    wouldDeleteCount: results.filter((result) => result.status === "WOULD_DELETE").length,
    deletedCount: results.filter((result) => result.status === "DELETED").length,
    skippedCount: results.filter((result) => result.status === "SKIPPED").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
    knownBytes: results.reduce((total, result) => total + (result.size ?? 0), 0),
    wouldDeleteBytes: summarizeBytes(results, "WOULD_DELETE"),
    deletedBytes: summarizeBytes(results, "DELETED"),
    skippedBytes: summarizeBytes(results, "SKIPPED"),
    failedBytes: summarizeBytes(results, "FAILED"),
    byCategory: summarizeByCategory(results),
  };
}

async function applyCleanup(
  db: CleanupDb,
  candidates: CleanupCandidate[],
  options: StorageCleanupOptions,
) {
  const results: StorageCleanupResult[] = [];
  let deletedCount = 0;

  for (const candidate of candidates) {
    if (candidate.status === "SKIPPED") {
      results.push(resultFromCandidate(candidate));
      continue;
    }
    if (!options.execute) {
      results.push(resultFromCandidate(candidate));
      continue;
    }
    if (deletedCount >= options.limit) {
      results.push({ ...candidate, status: "SKIPPED", reason: "DELETE_LIMIT_REACHED" });
      continue;
    }

    try {
      await deleteObject(candidate.key);
      deletedCount += 1;
      if (candidate.category === "BATCH_STAGED_ITEM" && candidate.itemId) {
        await db.predictionImportBatchItem.update({
          where: { id: candidate.itemId },
          data: {
            stagingPurgedAt: options.now,
            stagingPurgeReason: candidate.reason,
          },
        });
      }
      results.push({ ...candidate, status: "DELETED" });
    } catch {
      results.push({
        ...candidate,
        status: "FAILED",
        reason: "CLEANUP_OBJECT_DELETE_FAILED",
      });
    }
  }

  return results;
}

async function recordCleanupAudit(params: {
  actorId: string;
  options: StorageCleanupOptions;
  results: StorageCleanupResult[];
}, db: CleanupDb) {
  const summary = summarize(params.results, params.options.execute);
  await recordAuditEvent({
    action: params.options.execute ? "STORAGE_CLEANUP_EXECUTED" : "STORAGE_CLEANUP_DRY_RUN",
    entity: "StorageCleanup",
    actorId: params.actorId,
    details: withAuditActorContext(
      {
        ...summary,
        category: params.options.category,
        projectId: params.options.projectId ?? null,
        batchId: params.options.batchId ?? null,
        limit: params.options.limit,
        deepChecksum: params.options.deepChecksum,
        deepChecksumMaxObjects: params.options.deepChecksumMaxObjects,
        deepChecksumMaxBytes: params.options.deepChecksumMaxBytes,
      },
      {
        triggeredBy: { type: "OPERATOR", userId: params.actorId },
        performedBy: { type: "OPERATOR", label: AUDIT_ACTOR_LABELS.storageCleanup },
      },
    ),
  }, db);

  if (!params.options.execute) return;
  for (const result of params.results) {
    const action = result.status === "DELETED"
      ? "STORAGE_CLEANUP_OBJECT_DELETED"
      : result.status === "FAILED"
        ? "STORAGE_CLEANUP_OBJECT_DELETE_FAILED"
        : "STORAGE_CLEANUP_OBJECT_SKIPPED";
    await recordAuditEvent({
      action,
      entity: "StorageObject",
      entityId: result.key,
      actorId: params.actorId,
      details: withAuditActorContext(
        {
          category: result.category,
          reason: result.reason,
          batchId: result.batchId,
          itemId: result.itemId,
          projectId: result.projectId,
        },
        {
          triggeredBy: { type: "OPERATOR", userId: params.actorId },
          performedBy: { type: "OPERATOR", label: AUDIT_ACTOR_LABELS.storageCleanup },
        },
      ),
    }, db);
  }
}

async function requireCleanupAdmin(db: CleanupDb, userId: string) {
  const roles = await db.userGlobalRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  });
  if (!canViewAudit(roles.map((entry) => entry.role.name))) {
    throw new StorageCleanupError("CLEANUP_FORBIDDEN", 403);
  }
}

export async function runStorageCleanup(params: {
  actorId: string;
  input?: unknown;
}, db: CleanupDb = prisma) {
  await requireCleanupAdmin(db, params.actorId);
  const options = normalizeStorageCleanupOptions(params.input);
  await assertDeepChecksumLimitsBeforeMutation(db, options);
  const [batchCandidates, storageCandidates] = await Promise.all([
    collectBatchStagingCandidates(db, options),
    collectObjectStorageCandidates(db, options),
  ]);
  const deduped = new Map<string, CleanupCandidate>();
  for (const candidate of [...batchCandidates, ...storageCandidates]) {
    const key = `${candidate.key}:${candidate.itemId ?? ""}:${candidate.reason}`;
    if (!deduped.has(key)) deduped.set(key, candidate);
  }

  const results = await applyCleanup(db, [...deduped.values()], options);
  const consistency = await collectConsistencyReport(db, options);
  await recordCleanupAudit({ actorId: params.actorId, options, results }, db);
  return {
    options: {
      execute: options.execute,
      category: options.category,
      projectId: options.projectId ?? null,
      batchId: options.batchId ?? null,
      limit: options.limit,
      deepChecksum: options.deepChecksum,
      deepChecksumMaxObjects: options.deepChecksumMaxObjects,
      deepChecksumMaxBytes: options.deepChecksumMaxBytes,
      completedRetentionDays: options.completedRetentionDays,
      failedRetentionDays: options.failedRetentionDays,
      presignedRetentionHours: options.presignedRetentionHours,
    },
    summary: summarize(results, options.execute),
    consistency,
    results,
  };
}

export function storageCleanupErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof StorageCleanupError) return { error: error.code, status: error.status };
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return { error: "UNAUTHORIZED", status: 401 };
  }
  return { error: "STORAGE_CLEANUP_FAILED", status: 500 };
}
