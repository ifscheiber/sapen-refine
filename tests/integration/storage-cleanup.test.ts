import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import JSZip from "jszip";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { AnnotationArtifactKind, PrismaClient } from "@prisma/client";

import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let provenance: typeof import("@/server/domain/predictionProvenance");
let batches: typeof import("@/server/domain/predictionImportBatches");
let cleanup: typeof import("@/server/domain/storageCleanup");
let storage: typeof import("@/server/storage/s3");

const PREDICTION_BATCH_MANIFEST_VERSION = "sapen-annotate-prediction-batch-import-v1";

describe("storage cleanup workflow", () => {
  let adminId: string;
  let ownerId: string;
  let projectId: string;
  let modelRunId: string;
  let predictionRunId: string;
  let labelSchemaVersionId: string;
  let suffix: string;
  const objectKeys = new Set<string>();

  beforeAll(async () => {
    provenance = await import("@/server/domain/predictionProvenance");
    batches = await import("@/server/domain/predictionImportBatches");
    cleanup = await import("@/server/domain/storageCleanup");
    storage = await import("@/server/storage/s3");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, owner] = await Promise.all([
      prisma.user.create({
        data: { email: `storage-cleanup-admin-${suffix}@test.local`, name: "Storage Cleanup Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `storage-cleanup-owner-${suffix}@test.local`, name: "Storage Cleanup Owner" },
        select: { id: true },
      }),
    ]);
    adminId = admin.id;
    ownerId = owner.id;

    const adminRole = await prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN" },
      select: { id: true },
    });
    await prisma.userGlobalRole.create({ data: { userId: adminId, roleId: adminRole.id } });

    const project = await prisma.annotationProject.create({
      data: {
        name: `Storage Cleanup Test ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: { create: [{ userId: ownerId, role: "OWNER" }] },
      },
      select: { id: true },
    });
    projectId = project.id;

    const modelRun = await provenance.createModelRunForUser(
      {
        userId: adminId,
        input: {
          modelFamily: `storage-cleanup-${suffix}`,
          modelName: "cleanup-fixture",
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
          inferenceRunId: `cleanup-${suffix}`,
          status: "COMPLETED",
          inputImageCount: 1,
          outputPredictionCount: 0,
        },
      },
      prisma,
    );
    predictionRunId = predictionRun.id;
  });

  afterAll(async () => {
    await Promise.all([...objectKeys].map((key) => storage.deleteObjectBestEffort(key)));
    if (projectId) await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    if (modelRunId) await prisma.modelRun.delete({ where: { id: modelRunId } }).catch(() => undefined);
    await Promise.all(
      [adminId, ownerId]
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
        storageKey: `tests/storage-cleanup/${suffix}/${name}.png`,
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
    imageId: string;
    clientItemId: string;
    fileName: string;
    bytes: Uint8Array;
    checksum?: string;
  }) {
    const zip = new JSZip();
    zip.file(
      "manifest.json",
      JSON.stringify({
        manifestVersion: PREDICTION_BATCH_MANIFEST_VERSION,
        predictionRunId,
        items: [{
          clientItemId: params.clientItemId,
          imageId: params.imageId,
          targetType: "SEMANTIC_MASK",
          fileName: params.fileName,
          checksum: params.checksum ?? sha256Checksum(params.bytes),
          width: 2,
          height: 2,
          contentType: "application/octet-stream",
        }],
      }),
    );
    zip.file(params.fileName, params.bytes);
    return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
  }

  it("dry-runs and executes terminal batch staging cleanup without deleting imported prediction artifacts", async () => {
    const imageId = await createImage("terminal-batch");
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const zipBytes = await createZip({
      imageId,
      clientItemId: "terminal-batch",
      fileName: "predictions/terminal-batch.u8raw",
      bytes,
    });
    const batch = await batches.createPredictionImportBatchFromZipForUser(
      { predictionRunId, userId: ownerId, zipBytes, sourceFilename: "terminal-batch.zip" },
      prisma,
    );
    const stagedItem = await prisma.predictionImportBatchItem.findFirstOrThrow({
      where: { batchJobId: batch.id },
      select: { id: true, stagingKey: true },
    });
    objectKeys.add(stagedItem.stagingKey);
    await storage.statObject(stagedItem.stagingKey);

    await batches.processPredictionImportBatchForUser(
      { batchId: batch.id, userId: ownerId, input: { limit: 10 } },
      prisma,
    );
    const item = await prisma.predictionImportBatchItem.findUniqueOrThrow({
      where: { id: stagedItem.id },
      select: {
        predictionArtifactVersion: { select: { storageKey: true } },
      },
    });
    const predictionKey = item.predictionArtifactVersion?.storageKey;
    if (!predictionKey) throw new Error("Expected imported prediction artifact");
    objectKeys.add(predictionKey);
    await storage.statObject(predictionKey);

    const now = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const dryRun = await cleanup.runStorageCleanup(
      {
        actorId: adminId,
        input: { category: "batch-staging", batchId: batch.id, projectId, now: now.toISOString() },
      },
      prisma,
    );
    expect(dryRun.summary).toMatchObject({ mode: "dry-run", wouldDeleteCount: 1, deletedCount: 0 });
    expect(dryRun.results).toContainEqual(expect.objectContaining({
      key: stagedItem.stagingKey,
      status: "WOULD_DELETE",
    }));
    await storage.statObject(stagedItem.stagingKey);

    const executed = await cleanup.runStorageCleanup(
      {
        actorId: adminId,
        input: {
          execute: true,
          category: "batch-staging",
          batchId: batch.id,
          projectId,
          now: now.toISOString(),
        },
      },
      prisma,
    );
    expect(executed.summary).toMatchObject({ mode: "execute", deletedCount: 1, failedCount: 0 });
    await expect(storage.statObject(stagedItem.stagingKey)).rejects.toThrow();
    await storage.statObject(predictionKey);

    const purged = await prisma.predictionImportBatchItem.findUniqueOrThrow({
      where: { id: stagedItem.id },
      select: { stagingPurgedAt: true, stagingPurgeReason: true },
    });
    expect(purged.stagingPurgedAt).toBeTruthy();
    expect(purged.stagingPurgeReason).toBe("BATCH_COMPLETED_RETENTION_EXPIRED");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "STORAGE_CLEANUP_OBJECT_DELETED", entityId: stagedItem.stagingKey },
      select: { id: true },
    });
    expect(audit).toBeTruthy();
  });

  it("requires a global admin actor", async () => {
    await expect(cleanup.runStorageCleanup(
      { actorId: ownerId, input: { category: "all", projectId } },
      prisma,
    )).rejects.toMatchObject({ code: "CLEANUP_FORBIDDEN" });
  });

  it("does not clean active or retryable batch staging", async () => {
    const imageId = await createImage("active-batch");
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const zipBytes = await createZip({
      imageId,
      clientItemId: "active-batch",
      fileName: "predictions/active-batch.u8raw",
      bytes,
    });
    const batch = await batches.createPredictionImportBatchFromZipForUser(
      { predictionRunId, userId: ownerId, zipBytes, sourceFilename: "active-batch.zip" },
      prisma,
    );
    const item = await prisma.predictionImportBatchItem.findFirstOrThrow({
      where: { batchJobId: batch.id },
      select: { stagingKey: true },
    });
    objectKeys.add(item.stagingKey);
    const sourceZipKey = `projects/${projectId}/prediction-import-batches/${batch.id}/source.zip`;
    await storage.putObject(sourceZipKey, new Uint8Array([0, 1, 2, 3]), "application/zip");
    objectKeys.add(sourceZipKey);

    const result = await cleanup.runStorageCleanup(
      {
        actorId: adminId,
        input: {
          execute: true,
          category: "all",
          batchId: batch.id,
          projectId,
          now: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      prisma,
    );
    expect(result.results).toContainEqual(expect.objectContaining({
      key: item.stagingKey,
      status: "SKIPPED",
      reason: "BATCH_ITEM_ACTIVE_OR_RETRYABLE",
    }));
    expect(result.results).toContainEqual(expect.objectContaining({
      key: sourceZipKey,
      status: "SKIPPED",
      reason: "BATCH_NOT_TERMINAL",
    }));
    await storage.statObject(item.stagingKey);
    await storage.statObject(sourceZipKey);
  });

  it("does not reset failed batch items after their staging source is purged", async () => {
    const imageId = await createImage("failed-purged");
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const zipBytes = await createZip({
      imageId,
      clientItemId: "failed-purged",
      fileName: "predictions/failed-purged.u8raw",
      bytes,
      checksum: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
    const batch = await batches.createPredictionImportBatchFromZipForUser(
      { predictionRunId, userId: ownerId, zipBytes, sourceFilename: "failed-purged.zip" },
      prisma,
    );
    await batches.processPredictionImportBatchForUser(
      { batchId: batch.id, userId: ownerId, input: { limit: 10 } },
      prisma,
    );
    const item = await prisma.predictionImportBatchItem.findFirstOrThrow({
      where: { batchJobId: batch.id },
      select: { id: true, stagingKey: true, status: true },
    });
    expect(item.status).toBe("FAILED");
    objectKeys.add(item.stagingKey);

    const result = await cleanup.runStorageCleanup(
      {
        actorId: adminId,
        input: {
          execute: true,
          category: "batch-staging",
          batchId: batch.id,
          projectId,
          now: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      prisma,
    );
    expect(result.summary.deletedCount).toBe(1);
    const retry = await batches.retryPredictionImportBatchForUser(
      { batchId: batch.id, userId: ownerId },
      prisma,
    );
    expect(retry.resetCount).toBe(0);
  });

  it("deletes only unreferenced presigned upload orphans", async () => {
    const rawKey = `projects/${projectId}/images/protected-${suffix}.png`;
    const orphanKey = `projects/${projectId}/images/orphan-${suffix}.png`;
    const secondOrphanKey = `projects/${projectId}/images/orphan-2-${suffix}.png`;
    const artifactKey = `projects/${projectId}/masks/protected-image/protected-${suffix}.msk`;
    const exportKey = `projects/${projectId}/exports/protected-${suffix}/package.zip`;
    for (const key of [rawKey, orphanKey, secondOrphanKey, artifactKey, exportKey]) {
      await storage.putObject(key, new Uint8Array([0, 1, 2, 3]), "application/octet-stream");
      objectKeys.add(key);
    }

    const rawImage = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: rawKey,
        filename: "protected.png",
        contentType: "image/png",
        size: 4,
        checksum: `sha256:protected-${suffix}`,
        width: 2,
        height: 2,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId: rawImage.id,
        kind: AnnotationArtifactKind.SEMANTIC_MASK,
        scopeKey: "cleanup-protected",
        createdById: ownerId,
      },
      select: { id: true },
    });
    await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        storageKey: artifactKey,
        contentType: "application/octet-stream",
        size: 4,
        checksum: `sha256:artifact-${suffix}`,
        width: 2,
        height: 2,
        labelSchemaVersionId,
        createdById: ownerId,
      },
    });

    const result = await cleanup.runStorageCleanup(
      {
        actorId: adminId,
        input: {
          execute: true,
          category: "upload-orphans",
          projectId,
          limit: 1,
          now: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
      },
      prisma,
    );
    expect(result.summary.deletedCount).toBe(1);
    const orphanResults = result.results.filter((entry) =>
      entry.key === orphanKey || entry.key === secondOrphanKey,
    );
    expect(orphanResults.map((entry) => entry.status).sort()).toEqual(["DELETED", "SKIPPED"]);
    expect(orphanResults.find((entry) => entry.status === "SKIPPED")).toMatchObject({
      reason: "DELETE_LIMIT_REACHED",
    });
    expect(result.results).toContainEqual(expect.objectContaining({
      key: rawKey,
      status: "SKIPPED",
      reason: "IMAGE_ASSET_REFERENCE",
    }));
    expect(result.results).toContainEqual(expect.objectContaining({
      key: artifactKey,
      status: "SKIPPED",
      reason: "ARTIFACT_VERSION_REFERENCE",
    }));
    const deletedOrphan = orphanResults.find((entry) => entry.status === "DELETED")?.key;
    const skippedOrphan = orphanResults.find((entry) => entry.status === "SKIPPED")?.key;
    if (!deletedOrphan || !skippedOrphan) throw new Error("Expected one deleted and one skipped orphan");
    await expect(storage.statObject(deletedOrphan)).rejects.toThrow();
    await storage.statObject(skippedOrphan);
    await storage.statObject(rawKey);
    await storage.statObject(artifactKey);
    await storage.statObject(exportKey);
  });
});
