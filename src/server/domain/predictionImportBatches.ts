import { randomUUID } from "crypto";
import JSZip from "jszip";
import {
  CoordinateSpace,
  PredictionImportBatchItemStatus,
  PredictionImportBatchSourceKind,
  PredictionImportBatchStatus,
  PredictionTargetType,
  Prisma,
  PrismaClient,
  type AnnotationProjectRole,
} from "@prisma/client";

import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  importPredictionMaskForUser,
  predictionImportErrorResponse,
} from "@/server/domain/predictionImport";
import { getRuntimeConfig } from "@/server/runtime/config";
import { deleteObjectBestEffort, getObjectBytes, putObject } from "@/server/storage/s3";
import { normalizeChecksum, normalizeContentType, sha256Checksum } from "@/server/uploads/integrity";
import { validateUploadSize } from "@/server/uploads/validation";

type BatchDb = PrismaClient;

export const PREDICTION_BATCH_MANIFEST_VERSION = "sapen-annotate-prediction-batch-import-v1";

const MANAGE_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA"]);
const READ_ROLES = new Set<AnnotationProjectRole>(["OWNER", "QA"]);
const SUPPORTED_TARGET_TYPES = new Set<PredictionTargetType>([
  PredictionTargetType.SEMANTIC_MASK,
  PredictionTargetType.SLICE_SUPPORT_MASK,
]);
const RETRYABLE_ERROR_CODES = new Set([
  "BATCH_STAGING_READ_FAILED",
  "OBJECT_WRITE_FAILED",
  "OBJECT_STAT_FAILED",
]);
const TERMINAL_BATCH_STATUSES = new Set<PredictionImportBatchStatus>([
  PredictionImportBatchStatus.COMPLETED,
  PredictionImportBatchStatus.COMPLETED_WITH_ERRORS,
  PredictionImportBatchStatus.FAILED,
  PredictionImportBatchStatus.CANCELLED,
]);

const BATCH_SELECT = {
  id: true,
  projectId: true,
  predictionRunId: true,
  createdById: true,
  status: true,
  manifestVersion: true,
  sourceKind: true,
  sourceFilename: true,
  sourceChecksum: true,
  totalItems: true,
  pendingItems: true,
  processingItems: true,
  succeededItems: true,
  failedItems: true,
  skippedItems: true,
  retryPendingItems: true,
  startedAt: true,
  completedAt: true,
  metadataJson: true,
  errorSummaryJson: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, email: true, name: true } },
  predictionRun: {
    select: {
      id: true,
      status: true,
      inferenceRunId: true,
      generatedAt: true,
      modelRun: {
        select: {
          id: true,
          modelFamily: true,
          modelName: true,
          modelVersion: true,
          taskType: true,
        },
      },
    },
  },
} satisfies Prisma.PredictionImportBatchJobSelect;

const ITEM_SELECT = {
  id: true,
  batchJobId: true,
  clientItemId: true,
  imageId: true,
  targetType: true,
  status: true,
  attemptCount: true,
  maxAttempts: true,
  nextRetryAt: true,
  sourcePath: true,
  sourceFilename: true,
  expectedChecksum: true,
  expectedWidth: true,
  expectedHeight: true,
  contentType: true,
  format: true,
  coordinateSpace: true,
  confidenceScore: true,
  uncertaintyScore: true,
  perClassScoresJson: true,
  outputStatsJson: true,
  predictionArtifactVersionId: true,
  predictionProvenanceId: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
  image: { select: { id: true, filename: true, width: true, height: true, checksum: true } },
} satisfies Prisma.PredictionImportBatchItemSelect;

const PROCESS_ITEM_SELECT = {
  id: true,
  batchJobId: true,
  imageId: true,
  targetType: true,
  status: true,
  attemptCount: true,
  maxAttempts: true,
  stagingKey: true,
  expectedChecksum: true,
  expectedWidth: true,
  expectedHeight: true,
  contentType: true,
  format: true,
  coordinateSpace: true,
  confidenceScore: true,
  uncertaintyScore: true,
  perClassScoresJson: true,
  outputStatsJson: true,
} satisfies Prisma.PredictionImportBatchItemSelect;

type SelectedBatch = Prisma.PredictionImportBatchJobGetPayload<{ select: typeof BATCH_SELECT }>;
type SelectedItem = Prisma.PredictionImportBatchItemGetPayload<{ select: typeof ITEM_SELECT }>;
type ProcessItem = Prisma.PredictionImportBatchItemGetPayload<{ select: typeof PROCESS_ITEM_SELECT }>;

type ManifestItem = {
  clientItemId: string | null;
  imageId: string;
  targetType: PredictionTargetType;
  fileName: string;
  checksum: string;
  width: number;
  height: number;
  contentType: string;
  format: string;
  coordinateSpace: CoordinateSpace;
  confidenceScore: number | null;
  uncertaintyScore: number | null;
  perClassScores?: Prisma.InputJsonValue;
  outputStats?: Prisma.InputJsonValue;
};

type StagedItem = ManifestItem & {
  id: string;
  stagingKey: string;
  sourceFilename: string;
};

export class PredictionImportBatchError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
  ) {
    super(message);
  }
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: unknown, code: string) {
  const text = cleanText(value);
  if (!text) throw new PredictionImportBatchError(code);
  return text;
}

function parsePositiveInteger(value: unknown, code: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PredictionImportBatchError(code);
  }
  return parsed;
}

function parseOptionalScore(value: unknown, code: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new PredictionImportBatchError(code);
  }
  return parsed;
}

function parseOptionalJson(value: unknown) {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function parseLimit(value: unknown) {
  const fallback = getRuntimeConfig().uploads.predictionBatchProcessLimit;
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PredictionImportBatchError("BATCH_PROCESS_LIMIT_INVALID");
  }
  return Math.min(parsed, fallback);
}

function assertZipUploadSize(bytes: Uint8Array) {
  const validation = validateUploadSize(bytes.byteLength, "predictionBatch");
  if (!validation.ok) {
    throw new PredictionImportBatchError(validation.error, validation.status);
  }
}

function assertMaskStagingSize(bytes: Uint8Array) {
  const validation = validateUploadSize(bytes.byteLength, "mask");
  if (!validation.ok) {
    throw new PredictionImportBatchError(validation.error, validation.status);
  }
}

function parseTargetType(value: unknown) {
  const targetType = requiredText(value, "BATCH_ITEM_TARGET_TYPE_REQUIRED");
  if (!Object.values(PredictionTargetType).includes(targetType as PredictionTargetType)) {
    throw new PredictionImportBatchError("BATCH_ITEM_TARGET_TYPE_INVALID");
  }
  const parsed = targetType as PredictionTargetType;
  if (!SUPPORTED_TARGET_TYPES.has(parsed)) {
    throw new PredictionImportBatchError("BATCH_ITEM_TARGET_UNSUPPORTED");
  }
  return parsed;
}

function parseCoordinateSpace(value: unknown) {
  const coordinateSpace = cleanText(value) ?? CoordinateSpace.IMAGE_PIXEL;
  if (coordinateSpace !== CoordinateSpace.IMAGE_PIXEL) {
    throw new PredictionImportBatchError("BATCH_ITEM_COORDINATE_SPACE_UNSUPPORTED");
  }
  return CoordinateSpace.IMAGE_PIXEL;
}

function parseManifestChecksum(value: unknown) {
  const checksum = normalizeChecksum(requiredText(value, "BATCH_ITEM_CHECKSUM_REQUIRED"));
  if (!checksum) throw new PredictionImportBatchError("BATCH_ITEM_CHECKSUM_INVALID");
  return checksum;
}

function assertSafeZipPath(value: string) {
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new PredictionImportBatchError("BATCH_ITEM_FILE_PATH_INVALID");
  }
}

function basename(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function parseManifestItem(item: unknown, index: number): ManifestItem {
  const body = item && typeof item === "object" ? item as Record<string, unknown> : {};
  const fileName = requiredText(body.fileName, "BATCH_ITEM_FILE_REQUIRED");
  assertSafeZipPath(fileName);

  return {
    clientItemId: cleanText(body.clientItemId) ?? `item-${index + 1}`,
    imageId: requiredText(body.imageId, "BATCH_ITEM_IMAGE_REQUIRED"),
    targetType: parseTargetType(body.targetType),
    fileName,
    checksum: parseManifestChecksum(body.checksum),
    width: parsePositiveInteger(body.width, "BATCH_ITEM_WIDTH_REQUIRED"),
    height: parsePositiveInteger(body.height, "BATCH_ITEM_HEIGHT_REQUIRED"),
    contentType: normalizeContentType(cleanText(body.contentType) ?? "application/octet-stream"),
    format: cleanText(body.format) ?? "u8raw-v1",
    coordinateSpace: parseCoordinateSpace(body.coordinateSpace),
    confidenceScore: parseOptionalScore(body.confidenceScore, "CONFIDENCE_OUT_OF_RANGE"),
    uncertaintyScore: parseOptionalScore(body.uncertaintyScore, "UNCERTAINTY_OUT_OF_RANGE"),
    perClassScores: parseOptionalJson(body.perClassScores),
    outputStats: parseOptionalJson(body.outputStats),
  };
}

function parseManifest(raw: unknown, predictionRunId: string) {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  if (body.manifestVersion !== PREDICTION_BATCH_MANIFEST_VERSION) {
    throw new PredictionImportBatchError("BATCH_MANIFEST_VERSION_UNSUPPORTED");
  }
  const manifestPredictionRunId = cleanText(body.predictionRunId);
  if (manifestPredictionRunId && manifestPredictionRunId !== predictionRunId) {
    throw new PredictionImportBatchError("BATCH_PREDICTION_RUN_MISMATCH");
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new PredictionImportBatchError("BATCH_ITEMS_REQUIRED");
  }
  const maxItems = getRuntimeConfig().uploads.predictionBatchMaxItems;
  if (body.items.length > maxItems) {
    throw new PredictionImportBatchError("BATCH_TOO_MANY_ITEMS", 413);
  }

  const items = body.items.map(parseManifestItem);
  const clientItemIds = items.map((item) => item.clientItemId).filter((id): id is string => Boolean(id));
  if (new Set(clientItemIds).size !== clientItemIds.length) {
    throw new PredictionImportBatchError("BATCH_ITEM_CLIENT_ID_DUPLICATE");
  }
  return { items };
}

function serializeBatch(batch: SelectedBatch) {
  return batch;
}

function serializeItem(item: SelectedItem) {
  return item;
}

async function requireBatchMembership(
  db: BatchDb,
  params: { projectId: string; userId: string; roles: Set<AnnotationProjectRole> },
) {
  const membership = await db.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: params.userId } },
    select: { role: true },
  });
  if (!membership || !params.roles.has(membership.role)) {
    throw new PredictionImportBatchError("FORBIDDEN", 403);
  }
  return membership;
}

async function getPredictionRunForBatch(db: BatchDb, predictionRunId: string) {
  const predictionRun = await db.predictionRun.findUnique({
    where: { id: predictionRunId },
    select: { id: true, projectId: true },
  });
  if (!predictionRun) throw new PredictionImportBatchError("PREDICTION_RUN_NOT_FOUND", 404);
  return predictionRun;
}

async function assertManifestImagesBelongToProject(db: BatchDb, projectId: string, items: ManifestItem[]) {
  const imageIds = [...new Set(items.map((item) => item.imageId))];
  const images = await db.imageAsset.findMany({
    where: { id: { in: imageIds }, projectId },
    select: { id: true },
  });
  const found = new Set(images.map((image) => image.id));
  const missing = imageIds.find((id) => !found.has(id));
  if (missing) throw new PredictionImportBatchError("BATCH_ITEM_IMAGE_NOT_FOUND", 404);
}

async function loadZipManifest(zipBytes: Uint8Array) {
  const zip = await JSZip.loadAsync(zipBytes).catch(() => null);
  if (!zip) throw new PredictionImportBatchError("BATCH_ZIP_INVALID");

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new PredictionImportBatchError("BATCH_MANIFEST_MISSING");

  const manifestText = await manifestFile.async("string").catch(() => null);
  if (!manifestText) throw new PredictionImportBatchError("BATCH_MANIFEST_UNREADABLE");

  const manifest = JSON.parse(manifestText) as unknown;
  return { zip, manifest };
}

async function stageZipItems(params: {
  zip: JSZip;
  batchId: string;
  projectId: string;
  items: ManifestItem[];
}) {
  const staged: StagedItem[] = [];
  for (const item of params.items) {
    const zipFile = params.zip.file(item.fileName);
    if (!zipFile) throw new PredictionImportBatchError("BATCH_ITEM_FILE_MISSING");

    const bytes = await zipFile.async("uint8array").catch(() => null);
    if (!bytes) throw new PredictionImportBatchError("BATCH_ITEM_FILE_UNREADABLE");
    assertMaskStagingSize(bytes);

    const id = randomUUID();
    const stagingKey = `projects/${params.projectId}/prediction-import-batches/${params.batchId}/${id}.msk`;
    await putObject(stagingKey, bytes, "application/octet-stream");
    staged.push({
      ...item,
      id,
      stagingKey,
      sourceFilename: basename(item.fileName),
    });
  }
  return staged;
}

async function cleanupStagedItems(items: StagedItem[]) {
  await Promise.all(items.map((item) => deleteObjectBestEffort(item.stagingKey)));
}

function emptyCounts() {
  return {
    pendingItems: 0,
    processingItems: 0,
    succeededItems: 0,
    failedItems: 0,
    skippedItems: 0,
    retryPendingItems: 0,
  };
}

function terminalBatchStatus(status: PredictionImportBatchStatus) {
  return TERMINAL_BATCH_STATUSES.has(status);
}

function computeBatchStatus(params: {
  totalItems: number;
  counts: ReturnType<typeof emptyCounts>;
  startedAt: Date | null;
}) {
  const { totalItems, counts, startedAt } = params;
  const active = counts.pendingItems + counts.processingItems + counts.retryPendingItems;
  const terminal = counts.succeededItems + counts.failedItems + counts.skippedItems;

  if (totalItems === 0) return PredictionImportBatchStatus.FAILED;
  if (counts.succeededItems === totalItems) return PredictionImportBatchStatus.COMPLETED;
  if (terminal === totalItems && counts.succeededItems > 0) {
    return PredictionImportBatchStatus.COMPLETED_WITH_ERRORS;
  }
  if (terminal === totalItems) return PredictionImportBatchStatus.FAILED;
  if (active > 0 && startedAt) return PredictionImportBatchStatus.PROCESSING;
  return PredictionImportBatchStatus.PENDING;
}

async function refreshBatchSummary(batchId: string, db: BatchDb) {
  const batch = await db.predictionImportBatchJob.findUnique({
    where: { id: batchId },
    select: { id: true, totalItems: true, startedAt: true, completedAt: true, status: true },
  });
  if (!batch) throw new PredictionImportBatchError("BATCH_NOT_FOUND", 404);
  if (batch.status === PredictionImportBatchStatus.CANCELLED) {
    return getPredictionImportBatchById(batchId, db);
  }

  const groups = await db.predictionImportBatchItem.groupBy({
    by: ["status"],
    where: { batchJobId: batchId },
    _count: { _all: true },
  });
  const counts = emptyCounts();
  for (const group of groups) {
    if (group.status === PredictionImportBatchItemStatus.PENDING) counts.pendingItems = group._count._all;
    if (group.status === PredictionImportBatchItemStatus.PROCESSING) counts.processingItems = group._count._all;
    if (group.status === PredictionImportBatchItemStatus.SUCCEEDED) counts.succeededItems = group._count._all;
    if (group.status === PredictionImportBatchItemStatus.FAILED) counts.failedItems = group._count._all;
    if (group.status === PredictionImportBatchItemStatus.SKIPPED) counts.skippedItems = group._count._all;
    if (group.status === PredictionImportBatchItemStatus.RETRY_PENDING) counts.retryPendingItems = group._count._all;
  }

  const errorItems = await db.predictionImportBatchItem.findMany({
    where: {
      batchJobId: batchId,
      status: {
        in: [
          PredictionImportBatchItemStatus.FAILED,
          PredictionImportBatchItemStatus.RETRY_PENDING,
        ],
      },
      errorCode: { not: null },
    },
    select: { errorCode: true },
  });
  const errorCounts = errorItems.reduce<Record<string, number>>((acc, item) => {
    const code = item.errorCode ?? "UNKNOWN";
    acc[code] = (acc[code] ?? 0) + 1;
    return acc;
  }, {});

  const status = computeBatchStatus({
    totalItems: batch.totalItems,
    counts,
    startedAt: batch.startedAt,
  });
  const isTerminal = terminalBatchStatus(status);
  await db.predictionImportBatchJob.update({
    where: { id: batchId },
    data: {
      ...counts,
      status,
      completedAt: isTerminal ? batch.completedAt ?? new Date() : null,
      errorSummaryJson: Object.keys(errorCounts).length > 0 ? { errorCounts } : Prisma.JsonNull,
    },
  });

  return getPredictionImportBatchById(batchId, db);
}

async function getPredictionImportBatchById(batchId: string, db: BatchDb) {
  const batch = await db.predictionImportBatchJob.findUnique({
    where: { id: batchId },
    select: BATCH_SELECT,
  });
  if (!batch) throw new PredictionImportBatchError("BATCH_NOT_FOUND", 404);
  return serializeBatch(batch);
}

export async function createPredictionImportBatchFromZipForUser(params: {
  predictionRunId: string;
  userId: string;
  zipBytes: Uint8Array;
  sourceFilename?: string | null;
  contentType?: string | null;
}, db: BatchDb = prisma) {
  assertZipUploadSize(params.zipBytes);

  const predictionRun = await getPredictionRunForBatch(db, params.predictionRunId);
  await requireBatchMembership(db, {
    projectId: predictionRun.projectId,
    userId: params.userId,
    roles: MANAGE_ROLES,
  });

  let parsed;
  try {
    parsed = await loadZipManifest(params.zipBytes);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PredictionImportBatchError("BATCH_MANIFEST_INVALID_JSON");
    }
    throw error;
  }
  const manifest = parseManifest(parsed.manifest, params.predictionRunId);
  await assertManifestImagesBelongToProject(db, predictionRun.projectId, manifest.items);

  const batchId = randomUUID();
  const staged = await stageZipItems({
    zip: parsed.zip,
    batchId,
    projectId: predictionRun.projectId,
    items: manifest.items,
  });

  try {
    await db.$transaction(async (tx) => {
      await tx.predictionImportBatchJob.create({
        data: {
          id: batchId,
          projectId: predictionRun.projectId,
          predictionRunId: predictionRun.id,
          createdById: params.userId,
          status: PredictionImportBatchStatus.PENDING,
          manifestVersion: PREDICTION_BATCH_MANIFEST_VERSION,
          sourceKind: PredictionImportBatchSourceKind.ZIP_UPLOAD,
          sourceFilename: cleanText(params.sourceFilename),
          sourceChecksum: sha256Checksum(params.zipBytes),
          totalItems: staged.length,
          pendingItems: staged.length,
          metadataJson: {
            sourceContentType: normalizeContentType(params.contentType),
            itemCount: staged.length,
          },
        },
      });

      await tx.predictionImportBatchItem.createMany({
        data: staged.map((item) => ({
          id: item.id,
          batchJobId: batchId,
          clientItemId: item.clientItemId,
          imageId: item.imageId,
          targetType: item.targetType,
          status: PredictionImportBatchItemStatus.PENDING,
          maxAttempts: getRuntimeConfig().uploads.predictionBatchItemMaxAttempts,
          sourcePath: item.fileName,
          sourceFilename: item.sourceFilename,
          stagingKey: item.stagingKey,
          expectedChecksum: item.checksum,
          expectedWidth: item.width,
          expectedHeight: item.height,
          contentType: item.contentType,
          format: item.format,
          coordinateSpace: item.coordinateSpace,
          confidenceScore: item.confidenceScore,
          uncertaintyScore: item.uncertaintyScore,
          perClassScoresJson: item.perClassScores,
          outputStatsJson: item.outputStats,
        })),
      });
    });
  } catch (error) {
    await cleanupStagedItems(staged);
    throw error;
  }

  await recordAuditEvent({
    action: "PREDICTION_IMPORT_BATCH_CREATED",
    entity: "PredictionImportBatchJob",
    entityId: batchId,
    actorId: params.userId,
    details: {
      projectId: predictionRun.projectId,
      predictionRunId: predictionRun.id,
      sourceKind: PredictionImportBatchSourceKind.ZIP_UPLOAD,
      itemCount: staged.length,
    },
  });

  return getPredictionImportBatchById(batchId, db);
}

export async function listProjectPredictionImportBatchesForUser(params: {
  projectId: string;
  userId: string;
  limit?: unknown;
}, db: BatchDb = prisma) {
  await requireBatchMembership(db, {
    projectId: params.projectId,
    userId: params.userId,
    roles: READ_ROLES,
  });
  const limit = Math.min(parseLimit(params.limit), 50);
  const batches = await db.predictionImportBatchJob.findMany({
    where: { projectId: params.projectId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: BATCH_SELECT,
  });
  return batches.map(serializeBatch);
}

export async function getPredictionImportBatchForUser(params: {
  batchId: string;
  userId: string;
}, db: BatchDb = prisma) {
  const batch = await getPredictionImportBatchById(params.batchId, db);
  await requireBatchMembership(db, {
    projectId: batch.projectId,
    userId: params.userId,
    roles: READ_ROLES,
  });
  return batch;
}

export async function listPredictionImportBatchItemsForUser(params: {
  batchId: string;
  userId: string;
}, db: BatchDb = prisma) {
  const batch = await getPredictionImportBatchById(params.batchId, db);
  await requireBatchMembership(db, {
    projectId: batch.projectId,
    userId: params.userId,
    roles: READ_ROLES,
  });
  const items = await db.predictionImportBatchItem.findMany({
    where: { batchJobId: params.batchId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: ITEM_SELECT,
  });
  return items.map(serializeItem);
}

async function claimItems(params: { batchId: string; limit: number }, db: BatchDb) {
  const now = new Date();
  const candidates = await db.predictionImportBatchItem.findMany({
    where: {
      batchJobId: params.batchId,
      OR: [
        { status: PredictionImportBatchItemStatus.PENDING },
        {
          status: PredictionImportBatchItemStatus.RETRY_PENDING,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: params.limit,
    select: { id: true, status: true },
  });

  const claimedIds: string[] = [];
  for (const candidate of candidates) {
    const result = await db.predictionImportBatchItem.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: {
        status: PredictionImportBatchItemStatus.PROCESSING,
        attemptCount: { increment: 1 },
        startedAt: now,
        completedAt: null,
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
    if (result.count === 1) claimedIds.push(candidate.id);
  }

  if (claimedIds.length === 0) return [];
  return db.predictionImportBatchItem.findMany({
    where: { id: { in: claimedIds } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: PROCESS_ITEM_SELECT,
  });
}

function processError(error: unknown) {
  if (error instanceof PredictionImportBatchError) {
    return { code: error.code, status: error.status };
  }
  const payload = predictionImportErrorResponse(error);
  if (payload.error !== "PREDICTION_IMPORT_FAILED") {
    return { code: payload.error, status: payload.status };
  }
  return { code: "PREDICTION_IMPORT_FAILED", status: payload.status };
}

function shouldRetryItem(item: ProcessItem, code: string) {
  return RETRYABLE_ERROR_CODES.has(code) && item.attemptCount < item.maxAttempts;
}

async function processItem(params: {
  batch: SelectedBatch;
  item: ProcessItem;
  userId: string;
}, db: BatchDb) {
  try {
    const bytes = await getObjectBytes(params.item.stagingKey).catch(() => {
      throw new PredictionImportBatchError("BATCH_STAGING_READ_FAILED", 500);
    });
    const result = await importPredictionMaskForUser(
      {
        predictionRunId: params.batch.predictionRunId,
        userId: params.userId,
        imageId: params.item.imageId,
        targetType: params.item.targetType,
        bytes,
        width: params.item.expectedWidth,
        height: params.item.expectedHeight,
        contentType: params.item.contentType,
        format: params.item.format,
        coordinateSpace: params.item.coordinateSpace,
        expectedChecksum: params.item.expectedChecksum,
        confidenceScore: params.item.confidenceScore,
        uncertaintyScore: params.item.uncertaintyScore,
        perClassScores: params.item.perClassScoresJson as Prisma.InputJsonValue | undefined,
        outputStats: params.item.outputStatsJson as Prisma.InputJsonValue | undefined,
      },
      db,
    );

    await db.predictionImportBatchItem.update({
      where: { id: params.item.id },
      data: {
        status: PredictionImportBatchItemStatus.SUCCEEDED,
        predictionArtifactVersionId: result.artifactVersionId,
        predictionProvenanceId: result.predictionProvenanceId,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
      },
    });
    return { status: PredictionImportBatchItemStatus.SUCCEEDED, code: null };
  } catch (error) {
    const payload = processError(error);
    const retry = shouldRetryItem(params.item, payload.code);
    await db.predictionImportBatchItem.update({
      where: { id: params.item.id },
      data: {
        status: retry
          ? PredictionImportBatchItemStatus.RETRY_PENDING
          : PredictionImportBatchItemStatus.FAILED,
        nextRetryAt: retry ? new Date(Date.now() + 60_000) : null,
        errorCode: payload.code,
        errorMessage: payload.code,
        completedAt: retry ? null : new Date(),
      },
    });
    return {
      status: retry
        ? PredictionImportBatchItemStatus.RETRY_PENDING
        : PredictionImportBatchItemStatus.FAILED,
      code: payload.code,
    };
  }
}

export async function processPredictionImportBatchForUser(params: {
  batchId: string;
  userId: string;
  input?: unknown;
}, db: BatchDb = prisma) {
  const input = params.input && typeof params.input === "object" ? params.input as Record<string, unknown> : {};
  const limit = parseLimit(input.limit);
  const batch = await getPredictionImportBatchById(params.batchId, db);
  await requireBatchMembership(db, {
    projectId: batch.projectId,
    userId: params.userId,
    roles: MANAGE_ROLES,
  });
  if (batch.status === PredictionImportBatchStatus.CANCELLED) {
    throw new PredictionImportBatchError("BATCH_CANCELLED", 409);
  }

  await db.predictionImportBatchJob.update({
    where: { id: params.batchId },
    data: {
      status: PredictionImportBatchStatus.PROCESSING,
      startedAt: batch.startedAt ?? new Date(),
      completedAt: null,
    },
  });

  const claimed = await claimItems({ batchId: params.batchId, limit }, db);
  const outcomes = [];
  for (const item of claimed) {
    outcomes.push(await processItem({ batch, item, userId: params.userId }, db));
  }
  const refreshed = await refreshBatchSummary(params.batchId, db);

  await recordAuditEvent({
    action: "PREDICTION_IMPORT_BATCH_PROCESSED",
    entity: "PredictionImportBatchJob",
    entityId: params.batchId,
    actorId: params.userId,
    details: {
      projectId: batch.projectId,
      predictionRunId: batch.predictionRunId,
      requestedLimit: limit,
      processedCount: claimed.length,
      succeededCount: outcomes.filter((outcome) => outcome.status === PredictionImportBatchItemStatus.SUCCEEDED).length,
      failedCount: outcomes.filter((outcome) => outcome.status === PredictionImportBatchItemStatus.FAILED).length,
      retryPendingCount: outcomes.filter((outcome) => outcome.status === PredictionImportBatchItemStatus.RETRY_PENDING).length,
    },
  });

  return {
    batch: refreshed,
    processedCount: claimed.length,
    succeededCount: outcomes.filter((outcome) => outcome.status === PredictionImportBatchItemStatus.SUCCEEDED).length,
    failedCount: outcomes.filter((outcome) => outcome.status === PredictionImportBatchItemStatus.FAILED).length,
    retryPendingCount: outcomes.filter((outcome) => outcome.status === PredictionImportBatchItemStatus.RETRY_PENDING).length,
  };
}

function parseRetryItemIds(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (body.itemIds === undefined || body.itemIds === null) return undefined;
  if (!Array.isArray(body.itemIds)) throw new PredictionImportBatchError("BATCH_RETRY_ITEM_IDS_INVALID");
  const ids = body.itemIds.map((item) => cleanText(item)).filter((item): item is string => Boolean(item));
  if (ids.length !== body.itemIds.length) {
    throw new PredictionImportBatchError("BATCH_RETRY_ITEM_IDS_INVALID");
  }
  return ids;
}

export async function retryPredictionImportBatchForUser(params: {
  batchId: string;
  userId: string;
  input?: unknown;
}, db: BatchDb = prisma) {
  const batch = await getPredictionImportBatchById(params.batchId, db);
  await requireBatchMembership(db, {
    projectId: batch.projectId,
    userId: params.userId,
    roles: MANAGE_ROLES,
  });
  const itemIds = parseRetryItemIds(params.input);
  const result = await db.predictionImportBatchItem.updateMany({
    where: {
      batchJobId: params.batchId,
      status: {
        in: [
          PredictionImportBatchItemStatus.FAILED,
          PredictionImportBatchItemStatus.RETRY_PENDING,
        ],
      },
      ...(itemIds ? { id: { in: itemIds } } : {}),
    },
    data: {
      status: PredictionImportBatchItemStatus.PENDING,
      attemptCount: 0,
      nextRetryAt: null,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
  const refreshed = await refreshBatchSummary(params.batchId, db);

  await recordAuditEvent({
    action: "PREDICTION_IMPORT_BATCH_RETRY_REQUESTED",
    entity: "PredictionImportBatchJob",
    entityId: params.batchId,
    actorId: params.userId,
    details: {
      projectId: batch.projectId,
      predictionRunId: batch.predictionRunId,
      resetCount: result.count,
      itemIds: itemIds ?? null,
    },
  });

  return { batch: refreshed, resetCount: result.count };
}

export function predictionImportBatchErrorResponse(error: unknown): { error: string; status: number } {
  if (error instanceof PredictionImportBatchError) {
    return { error: error.code, status: error.status };
  }
  return { error: "PREDICTION_IMPORT_BATCH_FAILED", status: 500 };
}
