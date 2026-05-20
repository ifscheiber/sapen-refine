import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import JSZip from "jszip";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let provenance: typeof import("@/server/domain/predictionProvenance");
let batches: typeof import("@/server/domain/predictionImportBatches");
let exportsDomain: typeof import("@/server/domain/exports");

const PREDICTION_BATCH_MANIFEST_VERSION = "sapen-annotate-prediction-batch-import-v1";

describe("prediction import batch workflow", () => {
  let adminId: string;
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let viewerId: string;
  let outsiderId: string;
  let projectId: string;
  let modelRunId: string;
  let predictionRunId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    provenance = await import("@/server/domain/predictionProvenance");
    batches = await import("@/server/domain/predictionImportBatches");
    exportsDomain = await import("@/server/domain/exports");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, owner, qa, labeler, viewer, outsider] = await Promise.all([
      prisma.user.create({
        data: { email: `prediction-batch-admin-${suffix}@test.local`, name: "Batch Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-batch-owner-${suffix}@test.local`, name: "Batch Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-batch-qa-${suffix}@test.local`, name: "Batch QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-batch-labeler-${suffix}@test.local`, name: "Batch Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-batch-viewer-${suffix}@test.local`, name: "Batch Viewer" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-batch-outsider-${suffix}@test.local`, name: "Batch Outsider" },
        select: { id: true },
      }),
    ]);

    adminId = admin.id;
    ownerId = owner.id;
    qaId = qa.id;
    labelerId = labeler.id;
    viewerId = viewer.id;
    outsiderId = outsider.id;

    const adminRole = await prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN" },
      select: { id: true },
    });
    await prisma.userGlobalRole.create({ data: { userId: adminId, roleId: adminRole.id } });

    const project = await prisma.annotationProject.create({
      data: {
        name: `Prediction Batch Test ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: {
          create: [
            { userId: ownerId, role: "OWNER" },
            { userId: qaId, role: "QA" },
            { userId: labelerId, role: "LABELER" },
            { userId: viewerId, role: "VIEWER" },
          ],
        },
      },
      select: { id: true },
    });
    projectId = project.id;

    const modelRun = await provenance.createModelRunForUser(
      {
        userId: adminId,
        input: {
          modelFamily: `prediction-batch-${suffix}`,
          modelName: "batch-fixture",
          modelVersion: "0.1.0",
          taskType: "SEMANTIC_SEGMENTATION",
          checkpointHash: `sha256:checkpoint-${suffix}`,
          configHash: `sha256:config-${suffix}`,
        },
      },
      prisma,
    );
    modelRunId = modelRun.id;

    const predictionRun = await provenance.createPredictionRunForUser(
      {
        projectId,
        userId: ownerId,
        input: {
          modelRunId,
          inferenceRunId: `batch-${suffix}`,
          status: "COMPLETED",
          inputImageCount: 2,
          outputPredictionCount: 0,
        },
      },
      prisma,
    );
    predictionRunId = predictionRun.id;
  });

  afterAll(async () => {
    if (projectId) await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    if (modelRunId) await prisma.modelRun.delete({ where: { id: modelRunId } }).catch(() => undefined);
    await Promise.all(
      [adminId, ownerId, qaId, labelerId, viewerId, outsiderId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function createImage(name: string) {
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/prediction-batches/${suffix}/${name}.png`,
        filename: `${name}.png`,
        contentType: "image/png",
        size: 256,
        checksum: `sha256:${suffix}-${name}`,
        width: 2,
        height: 2,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    return image.id;
  }

  async function createZip(params: {
    predictionRunId?: string;
    items: Array<{
      clientItemId: string;
      imageId: string;
      targetType?: string;
      fileName: string;
      bytes: Uint8Array;
      checksum?: string;
    }>;
  }) {
    const zip = new JSZip();
    zip.file(
      "manifest.json",
      JSON.stringify({
        manifestVersion: PREDICTION_BATCH_MANIFEST_VERSION,
        predictionRunId: params.predictionRunId ?? predictionRunId,
        items: params.items.map((item) => ({
          clientItemId: item.clientItemId,
          imageId: item.imageId,
          targetType: item.targetType ?? "SEMANTIC_MASK",
          fileName: item.fileName,
          checksum: item.checksum ?? sha256Checksum(item.bytes),
          width: 2,
          height: 2,
          contentType: "application/octet-stream",
          confidenceScore: 0.7,
          uncertaintyScore: 0.3,
          perClassScores: { fixture: item.clientItemId },
          outputStats: { pixels: item.bytes.byteLength },
        })),
      }),
    );
    for (const item of params.items) {
      zip.file(item.fileName, item.bytes);
    }
    return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
  }

  it("creates, processes, summarizes and safely reprocesses a partial-failure ZIP batch", async () => {
    const successImageId = await createImage("batch-success");
    const failedImageId = await createImage("batch-failed");
    const successBytes = new Uint8Array([0, 1, 2, 3]);
    const failedBytes = new Uint8Array([0, 1, 2, 3]);
    const zipBytes = await createZip({
      items: [
        {
          clientItemId: "success-semantic",
          imageId: successImageId,
          fileName: "predictions/success.u8raw",
          bytes: successBytes,
        },
        {
          clientItemId: "failed-checksum",
          imageId: failedImageId,
          fileName: "predictions/failed.u8raw",
          bytes: failedBytes,
          checksum: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
      ],
    });

    const batch = await batches.createPredictionImportBatchFromZipForUser(
      {
        predictionRunId,
        userId: ownerId,
        zipBytes,
        sourceFilename: "predictions.zip",
        contentType: "application/zip",
      },
      prisma,
    );

    expect(batch).toMatchObject({
      predictionRunId,
      projectId,
      status: "PENDING",
      totalItems: 2,
      pendingItems: 2,
      sourceFilename: "predictions.zip",
    });
    expect("stagingKey" in batch).toBe(false);

    const rawItem = await prisma.predictionImportBatchItem.findFirstOrThrow({
      where: { batchJobId: batch.id },
      select: { stagingKey: true },
    });
    expect(rawItem.stagingKey).toContain(`/prediction-import-batches/${batch.id}/`);

    const createdItems = await batches.listPredictionImportBatchItemsForUser(
      { batchId: batch.id, userId: ownerId },
      prisma,
    );
    expect(createdItems).toHaveLength(2);
    expect(createdItems.some((item) => "stagingKey" in item)).toBe(false);

    const processed = await batches.processPredictionImportBatchForUser(
      { batchId: batch.id, userId: ownerId, input: { limit: 10 } },
      prisma,
    );
    expect(processed).toMatchObject({
      processedCount: 2,
      succeededCount: 1,
      failedCount: 1,
      retryPendingCount: 0,
    });
    expect(processed.batch).toMatchObject({
      status: "COMPLETED_WITH_ERRORS",
      succeededItems: 1,
      failedItems: 1,
      pendingItems: 0,
    });

    const items = await batches.listPredictionImportBatchItemsForUser(
      { batchId: batch.id, userId: qaId },
      prisma,
    );
    const succeeded = items.find((item) => item.status === "SUCCEEDED");
    const failed = items.find((item) => item.status === "FAILED");
    expect(succeeded?.predictionArtifactVersionId).toBeTruthy();
    expect(succeeded?.predictionProvenanceId).toBeTruthy();
    expect(failed).toMatchObject({ errorCode: "CHECKSUM_MISMATCH" });
    if (!succeeded?.predictionArtifactVersionId) {
      throw new Error("Expected succeeded batch item to link an artifact version");
    }

    const version = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: succeeded.predictionArtifactVersionId },
      select: { provenance: true, reviewState: true, artifact: { select: { kind: true } } },
    });
    expect(version).toMatchObject({
      provenance: "MODEL_PREDICTION",
      reviewState: "DRAFT",
      artifact: { kind: "PREDICTION_MASK" },
    });

    const beforeRepeatCount = await prisma.predictionArtifactProvenance.count({
      where: { predictionRunId },
    });
    const repeated = await batches.processPredictionImportBatchForUser(
      { batchId: batch.id, userId: ownerId, input: { limit: 10 } },
      prisma,
    );
    const afterRepeatCount = await prisma.predictionArtifactProvenance.count({
      where: { predictionRunId },
    });
    expect(repeated.processedCount).toBe(0);
    expect(afterRepeatCount).toBe(beforeRepeatCount);

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const candidate = readiness.candidates.find((item) => item.image.id === successImageId);
    expect(candidate?.semanticMask).toBeNull();
    expect(candidate?.eligibleTargets).not.toContain("semantic_segmentation");
  });

  it("resets failed items for manual retry without resetting successful items", async () => {
    const successImageId = await createImage("retry-success");
    const failedImageId = await createImage("retry-failed");
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const zipBytes = await createZip({
      items: [
        {
          clientItemId: "retry-success",
          imageId: successImageId,
          fileName: "predictions/retry-success.u8raw",
          bytes,
        },
        {
          clientItemId: "retry-failed",
          imageId: failedImageId,
          fileName: "predictions/retry-failed.u8raw",
          bytes,
          checksum: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
      ],
    });
    const batch = await batches.createPredictionImportBatchFromZipForUser(
      { predictionRunId, userId: qaId, zipBytes, sourceFilename: "retry.zip" },
      prisma,
    );

    await batches.processPredictionImportBatchForUser(
      { batchId: batch.id, userId: qaId, input: { limit: 10 } },
      prisma,
    );
    const retry = await batches.retryPredictionImportBatchForUser(
      { batchId: batch.id, userId: ownerId },
      prisma,
    );
    expect(retry.resetCount).toBe(1);
    expect(retry.batch).toMatchObject({
      status: "PROCESSING",
      pendingItems: 1,
      succeededItems: 1,
      failedItems: 0,
    });

    const items = await batches.listPredictionImportBatchItemsForUser(
      { batchId: batch.id, userId: ownerId },
      prisma,
    );
    expect(items.filter((item) => item.status === "PENDING")).toHaveLength(1);
    expect(items.filter((item) => item.status === "SUCCEEDED")).toHaveLength(1);
  });

  it("enforces project roles for batch create, inspect, process and retry", async () => {
    const imageId = await createImage("roles");
    const zipBytes = await createZip({
      items: [
        {
          clientItemId: "roles",
          imageId,
          fileName: "predictions/roles.u8raw",
          bytes: new Uint8Array([0, 1, 2, 3]),
        },
      ],
    });

    await expect(
      batches.createPredictionImportBatchFromZipForUser(
        { predictionRunId, userId: labelerId, zipBytes },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const batch = await batches.createPredictionImportBatchFromZipForUser(
      { predictionRunId, userId: ownerId, zipBytes },
      prisma,
    );

    await expect(
      batches.listProjectPredictionImportBatchesForUser({ projectId, userId: labelerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      batches.getPredictionImportBatchForUser({ batchId: batch.id, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      batches.processPredictionImportBatchForUser({ batchId: batch.id, userId: outsiderId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      batches.retryPredictionImportBatchForUser({ batchId: batch.id, userId: labelerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unsupported manifest target types before staging", async () => {
    const imageId = await createImage("unsupported");
    const zipBytes = await createZip({
      items: [
        {
          clientItemId: "classification",
          imageId,
          targetType: "SLICE_CLASSIFICATION",
          fileName: "predictions/classification.u8raw",
          bytes: new Uint8Array([0, 1, 2, 3]),
        },
      ],
    });

    await expect(
      batches.createPredictionImportBatchFromZipForUser(
        { predictionRunId, userId: ownerId, zipBytes },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "BATCH_ITEM_TARGET_UNSUPPORTED" });
  });
});
