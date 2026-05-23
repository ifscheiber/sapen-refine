import {
  PredictionImportBatchItemStatus,
  PredictionImportBatchStatus,
  PrismaClient,
} from "@prisma/client";

import { canViewAudit } from "@/server/auth/policies";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { getRuntimeConfig } from "@/server/runtime/config";
import { deleteObject, listObjectsByPrefix } from "@/server/storage/s3";

type CleanupDb = PrismaClient;

export type StorageCleanupCategory = "all" | "batch-staging" | "upload-orphans";
export type CleanupObjectCategory =
  | "BATCH_SOURCE_ZIP"
  | "BATCH_STAGED_ITEM"
  | "ABANDONED_PRESIGNED_UPLOAD"
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
  ageSeconds: number | null;
  batchId: string | null;
  itemId: string | null;
  projectId: string | null;
};

type CleanupCandidate = Omit<StorageCleanupResult, "status"> & {
  status: "WOULD_DELETE" | "SKIPPED";
};

type ListedObject = Awaited<ReturnType<typeof listObjectsByPrefix>>[number];

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

  return {
    execute,
    category: parseCategory(body.category),
    projectId: cleanText(body.projectId) ?? undefined,
    batchId: cleanText(body.batchId) ?? undefined,
    limit,
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

async function collectObjectStorageCandidates(
  db: CleanupDb,
  options: StorageCleanupOptions,
): Promise<CleanupCandidate[]> {
  if (options.category === "batch-staging") return [];

  const objects = await listObjectsByPrefix("projects/", Math.max(1000, options.limit * 20));
  const classified = objects
    .map((object) => ({ object, classification: classifyStorageCleanupKey(object.key) }))
    .filter((entry): entry is { object: ListedObject; classification: NonNullable<ReturnType<typeof classifyStorageCleanupKey>> } =>
      Boolean(entry.classification),
    )
    .filter((entry) => {
      if (options.batchId && entry.classification.batchId !== options.batchId) return false;
      if (options.projectId && entry.classification.projectId !== options.projectId) return false;
      if (options.category === "upload-orphans") {
        return entry.classification.category === "ABANDONED_PRESIGNED_UPLOAD";
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
    if (classification.category === "ABANDONED_PRESIGNED_UPLOAD" && !shouldConsiderObject(object, options)) {
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
        : "PRESIGNED_UPLOAD_ORPHAN_RETENTION_EXPIRED",
      ageSeconds: ageSeconds(options.now, object.lastModified),
      batchId: classification.batchId ?? null,
      itemId: null,
      projectId: classification.projectId,
    });
  }

  return candidates;
}

function summarize(results: StorageCleanupResult[], execute: boolean) {
  return {
    mode: execute ? "execute" : "dry-run",
    totalResults: results.length,
    wouldDeleteCount: results.filter((result) => result.status === "WOULD_DELETE").length,
    deletedCount: results.filter((result) => result.status === "DELETED").length,
    skippedCount: results.filter((result) => result.status === "SKIPPED").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
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
    details: {
      ...summary,
      category: params.options.category,
      projectId: params.options.projectId ?? null,
      batchId: params.options.batchId ?? null,
      limit: params.options.limit,
    },
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
      details: {
        category: result.category,
        reason: result.reason,
        batchId: result.batchId,
        itemId: result.itemId,
        projectId: result.projectId,
      },
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
  await recordCleanupAudit({ actorId: params.actorId, options, results }, db);
  return {
    options: {
      execute: options.execute,
      category: options.category,
      projectId: options.projectId ?? null,
      batchId: options.batchId ?? null,
      limit: options.limit,
      completedRetentionDays: options.completedRetentionDays,
      failedRetentionDays: options.failedRetentionDays,
      presignedRetentionHours: options.presignedRetentionHours,
    },
    summary: summarize(results, options.execute),
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
