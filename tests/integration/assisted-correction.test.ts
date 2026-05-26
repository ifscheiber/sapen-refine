import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  ArtifactProvenance,
  PrismaClient,
  type PredictionTargetType,
  type SliceClass,
} from "@prisma/client";

import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let assisted: typeof import("@/server/domain/assistedCorrection");
let correctionTasks: typeof import("@/server/domain/correctionTasks");
let exportsDomain: typeof import("@/server/domain/exports");
let predictions: typeof import("@/server/domain/predictionProvenance");
let review: typeof import("@/server/domain/review");
let storage: typeof import("@/server/storage/s3");

function minimalPng(name: string) {
  const bytes = new Uint8Array(24 + name.length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[19] = 2;
  bytes[23] = 2;
  bytes.set(new TextEncoder().encode(name), 24);
  return bytes;
}

describe("assisted correction workflow", () => {
  let adminId: string;
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let viewerId: string;
  let outsiderId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let modelRunId: string;
  let suffix: string;

  beforeAll(async () => {
    assisted = await import("@/server/domain/assistedCorrection");
    correctionTasks = await import("@/server/domain/correctionTasks");
    exportsDomain = await import("@/server/domain/exports");
    predictions = await import("@/server/domain/predictionProvenance");
    review = await import("@/server/domain/review");
    storage = await import("@/server/storage/s3");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, owner, qa, labeler, viewer, outsider] = await Promise.all([
      prisma.user.create({
        data: { email: `assisted-admin-${suffix}@test.local`, name: "Assisted Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `assisted-owner-${suffix}@test.local`, name: "Assisted Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `assisted-qa-${suffix}@test.local`, name: "Assisted QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `assisted-labeler-${suffix}@test.local`, name: "Assisted Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `assisted-viewer-${suffix}@test.local`, name: "Assisted Viewer" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `assisted-outsider-${suffix}@test.local`, name: "Assisted Outsider" },
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
        name: `Assisted Correction Test ${suffix}`,
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

    const modelRun = await predictions.createModelRunForUser(
      {
        userId: adminId,
        input: {
          modelFamily: `assisted-correction-${suffix}`,
          modelName: "correction-fixture",
          modelVersion: "0.1.0",
          taskType: "SEMANTIC_SEGMENTATION",
          checkpointPath: `s3://private-models/${suffix}/checkpoint.ckpt`,
          checkpointHash: `sha256:checkpoint-${suffix}`,
          configHash: `sha256:config-${suffix}`,
        },
      },
      prisma,
    );
    modelRunId = modelRun.id;
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

  async function createPredictionRun(name: string) {
    return predictions.createPredictionRunForUser(
      {
        projectId,
        userId: ownerId,
        input: {
          modelRunId,
          inferenceRunId: `assisted-${suffix}-${name}`,
          status: "COMPLETED",
          inputImageCount: 1,
          outputPredictionCount: 1,
        },
      },
      prisma,
    );
  }

  async function createImage(name: string) {
    const imageBytes = minimalPng(name);
    const storageKey = `tests/assisted-correction/${suffix}/${name}.png`;
    await storage.putObject(storageKey, imageBytes, "image/png");
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey,
        filename: `${name}.png`,
        contentType: "image/png",
        size: imageBytes.byteLength,
        checksum: sha256Checksum(imageBytes),
        width: 2,
        height: 2,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
        acquisitionMetadata: { create: { cameraDevice: "fixture camera", lightingSetup: "fixture light" } },
        sampleMetadata: { create: { tNumber: `T-${name}`, specimenIdentifier: name, sliceIndex: 1 } },
      },
      select: { id: true },
    });
    return image.id;
  }

  async function createPredictionTask(params: {
    name: string;
    targetType: PredictionTargetType;
    bytes?: Uint8Array;
    predictedClass?: SliceClass;
    withArtifact?: boolean;
  }) {
    const predictionRun = await createPredictionRun(params.name);
    const imageId = await createImage(params.name);
    const bytes = params.bytes ?? new Uint8Array([0, 1, 2, 3]);
    let artifactVersionId: string | null = null;

    if (params.withArtifact !== false) {
      const storageKey = `tests/assisted-correction/${suffix}/${params.name}.u8raw`;
      await storage.putObject(storageKey, bytes, "application/octet-stream");
      const artifact = await prisma.annotationArtifact.create({
        data: {
          projectId,
          imageId,
          kind: AnnotationArtifactKind.PREDICTION_MASK,
          scopeKey: `prediction-${params.name}`,
          createdById: ownerId,
        },
        select: { id: true },
      });
      const version = await prisma.annotationArtifactVersion.create({
        data: {
          artifactId: artifact.id,
          version: 1,
          provenance: ArtifactProvenance.MODEL_PREDICTION,
          reviewState: "DRAFT",
          storageKey,
          contentType: "application/octet-stream",
          size: bytes.byteLength,
          checksum: sha256Checksum(bytes),
          width: 2,
          height: 2,
          labelSchemaVersionId,
          createdById: ownerId,
        },
        select: { id: true },
      });
      artifactVersionId = version.id;
    }

    const provenance = await predictions.createPredictionArtifactProvenance(
      {
        input: {
          predictionRunId: predictionRun.id,
          imageId,
          artifactVersionId,
          targetType: params.targetType,
          predictedClass: params.predictedClass,
          confidenceScore: 0.42,
          uncertaintyScore: 0.72,
          modelOutputChecksum: sha256Checksum(bytes),
        },
      },
      prisma,
    );

    const created = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: ownerId },
      prisma,
    );
    const task = created.tasks.find((item) => item.predictionProvenanceId === provenance.id);
    if (!task) throw new Error("TASK_NOT_CREATED");
    return { predictionRun, imageId, provenance, artifactVersionId, sourceBytes: bytes, taskId: task.id };
  }

  it("loads semantic correction context, saves a separate human correction, and preserves export boundaries", async () => {
    const fixture = await createPredictionTask({
      name: "semantic",
      targetType: "SEMANTIC_MASK",
      bytes: new Uint8Array([0, 1, 2, 3]),
    });

    await expect(
      assisted.loadCorrectionContextForUser({ taskId: fixture.taskId, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      assisted.loadCorrectionContextForUser({ taskId: fixture.taskId, userId: labelerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      assisted.loadCorrectionContextForUser({ taskId: fixture.taskId, userId: outsiderId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const context = await assisted.loadCorrectionContextForUser(
      { taskId: fixture.taskId, userId: qaId },
      prisma,
    );
    expect(context.mode).toBe("semantic");
    expect(context.targetType).toBe("SEMANTIC_MASK");
    expect(context.sourcePrediction.id).toBe(fixture.artifactVersionId);
    expect(context.predictionMaskUrl).toBe(`/api/correction-tasks/${fixture.taskId}/prediction-mask`);
    expect(JSON.stringify(context)).not.toContain("storageKey");
    expect(JSON.stringify(context)).not.toContain(`tests/assisted-correction/${suffix}`);

    const predictionBytes = await assisted.readPredictionMaskForCorrectionTask(
      { taskId: fixture.taskId, userId: qaId },
      prisma,
    );
    expect(Array.from(predictionBytes.bytes)).toEqual(Array.from(fixture.sourceBytes));

    const correctionBytes = new Uint8Array([0, 1, 3, 2]);
    const saved = await assisted.saveCorrectionForTaskForUser(
      {
        taskId: fixture.taskId,
        userId: qaId,
        bytes: correctionBytes,
        width: 2,
        height: 2,
        contentType: "application/octet-stream",
      },
      prisma,
    );
    expect(JSON.stringify(saved)).not.toContain("storageKey");
    expect(saved.artifactKind).toBe("SEMANTIC_MASK");
    expect(saved.version).toMatchObject({
      provenance: "HUMAN_CORRECTION",
      parentVersionId: fixture.artifactVersionId,
      taskId: fixture.taskId,
      reviewState: "DRAFT",
      checksum: sha256Checksum(correctionBytes),
    });
    expect(saved.task.status).toBe("IN_PROGRESS");
    expect(saved.task.assigneeId).toBe(qaId);

    const [sourceVersion, humanVersion] = await Promise.all([
      prisma.annotationArtifactVersion.findUniqueOrThrow({
        where: { id: fixture.artifactVersionId! },
        select: { provenance: true, checksum: true, reviewState: true, artifact: { select: { kind: true } } },
      }),
      prisma.annotationArtifactVersion.findUniqueOrThrow({
        where: { id: saved.version.id },
        select: {
          provenance: true,
          parentVersionId: true,
          taskId: true,
          reviewState: true,
          artifact: { select: { kind: true } },
        },
      }),
    ]);
    expect(sourceVersion).toMatchObject({
      provenance: "MODEL_PREDICTION",
      checksum: sha256Checksum(fixture.sourceBytes),
      reviewState: "DRAFT",
      artifact: { kind: "PREDICTION_MASK" },
    });
    expect(humanVersion).toMatchObject({
      provenance: "HUMAN_CORRECTION",
      parentVersionId: fixture.artifactVersionId,
      taskId: fixture.taskId,
      reviewState: "DRAFT",
      artifact: { kind: "SEMANTIC_MASK" },
    });

    await review.transitionArtifactVersionForUser(
      { versionId: saved.version.id, userId: qaId, action: "submit" },
      prisma,
    );
    const submittedTask = await prisma.annotationTask.findUniqueOrThrow({
      where: { id: fixture.taskId },
      select: { status: true },
    });
    expect(submittedTask.status).toBe("SUBMITTED");

    await review.transitionArtifactVersionForUser(
      { versionId: saved.version.id, userId: ownerId, action: "approve" },
      prisma,
    );
    const doneTask = await prisma.annotationTask.findUniqueOrThrow({
      where: { id: fixture.taskId },
      select: { status: true },
    });
    expect(doneTask.status).toBe("DONE");

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const candidate = readiness.candidates.find((item) => item.image.id === fixture.imageId);
    expect(candidate?.semanticMask?.id).toBe(saved.version.id);
    expect(candidate?.semanticMask?.id).not.toBe(fixture.artifactVersionId);
    expect(candidate?.eligibleTargets).toContain("semantic_segmentation");
  });

  it("saves support corrections as support artifacts and updates default slice support", async () => {
    const fixture = await createPredictionTask({
      name: "support",
      targetType: "SLICE_SUPPORT_MASK",
      bytes: new Uint8Array([0, 10, 10, 0]),
    });

    const context = await assisted.loadCorrectionContextForUser(
      { taskId: fixture.taskId, userId: qaId },
      prisma,
    );
    expect(context.mode).toBe("support");
    expect(context.humanArtifactKind).toBe("SLICE_SUPPORT_MASK");

    const correctionBytes = new Uint8Array([0, 10, 0, 10]);
    const saved = await assisted.saveCorrectionForTaskForUser(
      {
        taskId: fixture.taskId,
        userId: qaId,
        bytes: correctionBytes,
        width: 2,
        height: 2,
        contentType: "application/octet-stream",
      },
      prisma,
    );

    expect(saved.artifactKind).toBe("SLICE_SUPPORT_MASK");
    const version = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: saved.version.id },
      select: {
        provenance: true,
        parentVersionId: true,
        taskId: true,
        artifact: { select: { kind: true } },
      },
    });
    expect(version).toMatchObject({
      provenance: "HUMAN_CORRECTION",
      parentVersionId: fixture.artifactVersionId,
      taskId: fixture.taskId,
      artifact: { kind: "SLICE_SUPPORT_MASK" },
    });

    const slice = await prisma.sliceInstance.findFirstOrThrow({
      where: { projectId, imageId: fixture.imageId },
      select: { supportArtifactVersionId: true },
    });
    expect(slice.supportArtifactVersionId).toBe(saved.version.id);
  });

  it("keeps slice-classification prediction tasks out of the mask correction editor", async () => {
    const fixture = await createPredictionTask({
      name: "classification",
      targetType: "SLICE_CLASSIFICATION",
      predictedClass: "COPPER_SLICE",
      withArtifact: false,
    });

    await expect(
      assisted.loadCorrectionContextForUser({ taskId: fixture.taskId, userId: ownerId }, prisma),
    ).rejects.toMatchObject({ code: "CORRECTION_TARGET_UNSUPPORTED" });
  });
});
