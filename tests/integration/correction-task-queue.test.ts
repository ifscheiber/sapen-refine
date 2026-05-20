import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  ArtifactProvenance,
  PrismaClient,
} from "@prisma/client";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let predictions: typeof import("@/server/domain/predictionProvenance");
let correctionTasks: typeof import("@/server/domain/correctionTasks");

describe("active-learning correction task queue", () => {
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
    predictions = await import("@/server/domain/predictionProvenance");
    correctionTasks = await import("@/server/domain/correctionTasks");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, owner, qa, labeler, viewer, outsider] = await Promise.all([
      prisma.user.create({
        data: { email: `correction-admin-${suffix}@test.local`, name: "Correction Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `correction-owner-${suffix}@test.local`, name: "Correction Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `correction-qa-${suffix}@test.local`, name: "Correction QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `correction-labeler-${suffix}@test.local`, name: "Correction Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `correction-viewer-${suffix}@test.local`, name: "Correction Viewer" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `correction-outsider-${suffix}@test.local`, name: "Correction Outsider" },
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
        name: `Correction Task Queue Test ${suffix}`,
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
          modelFamily: `correction-task-${suffix}`,
          modelName: "queue-fixture",
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
    if (projectId) {
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (modelRunId) {
      await prisma.modelRun.delete({ where: { id: modelRunId } }).catch(() => undefined);
    }
    await Promise.all(
      [adminId, ownerId, qaId, labelerId, viewerId, outsiderId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function createPredictionRun(name: string, userId = ownerId) {
    return predictions.createPredictionRunForUser(
      {
        projectId,
        userId,
        input: {
          modelRunId,
          inferenceRunId: `correction-${suffix}-${name}`,
          status: "COMPLETED",
          inputImageCount: 3,
          outputPredictionCount: 3,
        },
      },
      prisma,
    );
  }

  async function createImage(name: string) {
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/correction-tasks/${suffix}/${name}.png`,
        filename: `${name}.png`,
        contentType: "image/png",
        size: 256,
        checksum: `sha256:${suffix}-${name}`,
        width: 16,
        height: 8,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    return image.id;
  }

  async function createPredictionVersion(imageId: string, name: string) {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: AnnotationArtifactKind.PREDICTION_MASK,
        scopeKey: `prediction-${name}`,
        createdById: ownerId,
      },
      select: { id: true },
    });

    return prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        provenance: ArtifactProvenance.MODEL_PREDICTION,
        reviewState: "DRAFT",
        storageKey: `tests/correction-tasks/${suffix}/${name}.u8raw`,
        contentType: "application/octet-stream",
        size: 128,
        checksum: `sha256:${suffix}-${name}`,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: ownerId,
      },
      select: { id: true },
    });
  }

  async function createProvenance(params: {
    predictionRunId: string;
    name: string;
    confidenceScore?: number;
    uncertaintyScore?: number;
    targetType?: string;
    predictedClass?: string;
    withArtifact?: boolean;
  }) {
    const imageId = await createImage(params.name);
    const version = params.withArtifact === false
      ? null
      : await createPredictionVersion(imageId, params.name);

    return predictions.createPredictionArtifactProvenance(
      {
        input: {
          predictionRunId: params.predictionRunId,
          imageId,
          artifactVersionId: version?.id,
          targetType: params.targetType ?? "SEMANTIC_MASK",
          predictedClass: params.predictedClass,
          confidenceScore: params.confidenceScore,
          uncertaintyScore: params.uncertaintyScore,
          modelOutputChecksum: `sha256:prediction-${suffix}-${params.name}`,
        },
      },
      prisma,
    );
  }

  it("creates idempotent correction tasks from prediction provenance and does not expose storage keys", async () => {
    const predictionRun = await createPredictionRun("idempotent");
    const highUncertainty = await createProvenance({
      predictionRunId: predictionRun.id,
      name: "high-uncertainty",
      confidenceScore: 0.7,
      uncertaintyScore: 0.9,
    });
    const lowConfidence = await createProvenance({
      predictionRunId: predictionRun.id,
      name: "low-confidence",
      confidenceScore: 0.2,
      uncertaintyScore: 0.1,
    });
    const classification = await createProvenance({
      predictionRunId: predictionRun.id,
      name: "classification",
      targetType: "SLICE_CLASSIFICATION",
      predictedClass: "COPPER_SLICE",
      confidenceScore: 0.81,
      withArtifact: false,
    });

    const created = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: ownerId },
      prisma,
    );

    expect(created.createdCount).toBe(3);
    expect(created.skippedExistingCount).toBe(0);
    expect(created.tasks.map((task) => task.predictionProvenanceId)).toEqual([
      highUncertainty.id,
      lowConfidence.id,
      classification.id,
    ]);
    expect(created.tasks.map((task) => task.taskReason)).toEqual([
      "HIGH_UNCERTAINTY",
      "LOW_CONFIDENCE",
      "MISSING_GROUND_TRUTH",
    ]);
    expect(created.tasks[0].sourceArtifactVersionId).toBe(highUncertainty.artifactVersionId);
    expect(created.tasks[2].sourceArtifactVersionId).toBeNull();
    expect(created.tasks[0].editorHref).toContain(`/tasks/${created.tasks[0].id}/correct`);
    expect(JSON.stringify(created)).not.toContain("storageKey");
    expect(JSON.stringify(created)).not.toContain(`tests/correction-tasks/${suffix}`);

    const repeated = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: ownerId },
      prisma,
    );
    expect(repeated.createdCount).toBe(0);
    expect(repeated.skippedExistingCount).toBe(3);

    const taskCount = await prisma.annotationTask.count({
      where: {
        predictionRunId: predictionRun.id,
        type: "MODEL_PREDICTION_CORRECTION",
      },
    });
    expect(taskCount).toBe(3);
  });

  it("lists active tasks in deterministic active-learning order", async () => {
    const predictionRun = await createPredictionRun("ordering");
    await createProvenance({
      predictionRunId: predictionRun.id,
      name: "ordering-high-uncertainty",
      confidenceScore: 0.8,
      uncertaintyScore: 0.6,
    });
    await createProvenance({
      predictionRunId: predictionRun.id,
      name: "ordering-low-confidence",
      confidenceScore: 0.1,
      uncertaintyScore: 0.2,
    });
    await createProvenance({
      predictionRunId: predictionRun.id,
      name: "ordering-missing-ground-truth",
      confidenceScore: 0.9,
      uncertaintyScore: 0.1,
    });

    const created = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      {
        predictionRunId: predictionRun.id,
        userId: ownerId,
        input: { reason: "MANUAL_PRIORITY", defaultPriority: 75 },
      },
      prisma,
    );
    await prisma.annotationTask.update({
      where: { id: created.tasks[0].id },
      data: { uncertaintyScore: 0.4, confidenceScore: 0.2 },
    });
    await prisma.annotationTask.update({
      where: { id: created.tasks[1].id },
      data: { uncertaintyScore: 0.8, confidenceScore: 0.9 },
    });
    await prisma.annotationTask.update({
      where: { id: created.tasks[2].id },
      data: { uncertaintyScore: 0.8, confidenceScore: 0.3 },
    });

    const listed = await correctionTasks.listProjectCorrectionTasksForUser(
      { projectId, userId: viewerId, predictionRunId: predictionRun.id },
      prisma,
    );

    expect(listed.tasks.map((task) => task.uncertaintyScore)).toEqual([0.8, 0.8, 0.4]);
    expect(listed.tasks.map((task) => task.confidenceScore)).toEqual([0.3, 0.9, 0.2]);
  });

  it("enforces creation, read, and mutation roles", async () => {
    const predictionRun = await createPredictionRun("roles", qaId);
    await createProvenance({
      predictionRunId: predictionRun.id,
      name: "roles-one",
      confidenceScore: 0.4,
      uncertaintyScore: 0.7,
    });

    await expect(
      correctionTasks.createCorrectionTasksForPredictionRunForUser(
        { predictionRunId: predictionRun.id, userId: labelerId },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      correctionTasks.createCorrectionTasksForPredictionRunForUser(
        { predictionRunId: predictionRun.id, userId: viewerId },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: qaId },
      prisma,
    );
    const taskId = created.tasks[0].id;

    const read = await correctionTasks.getCorrectionTaskForUser({ taskId, userId: viewerId }, prisma);
    expect(read.id).toBe(taskId);

    await expect(
      correctionTasks.listProjectCorrectionTasksForUser({ projectId, userId: outsiderId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      correctionTasks.updateCorrectionTaskForUser(
        { taskId, userId: viewerId, input: { action: "assign_to_me" } },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const claimed = await correctionTasks.updateCorrectionTaskForUser(
      { taskId, userId: labelerId, input: { action: "assign_to_me" } },
      prisma,
    );
    expect(claimed.assigneeId).toBe(labelerId);

    const started = await correctionTasks.updateCorrectionTaskForUser(
      { taskId, userId: labelerId, input: { action: "start" } },
      prisma,
    );
    expect(started.status).toBe("IN_PROGRESS");

    const prioritized = await correctionTasks.updateCorrectionTaskForUser(
      { taskId, userId: ownerId, input: { action: "set_priority", priority: 99 } },
      prisma,
    );
    expect(prioritized.priority).toBe(99);

    const dismissed = await correctionTasks.updateCorrectionTaskForUser(
      { taskId, userId: labelerId, input: { action: "dismiss" } },
      prisma,
    );
    expect(dismissed.status).toBe("CANCELLED");

    const active = await correctionTasks.listProjectCorrectionTasksForUser(
      { projectId, userId: ownerId, predictionRunId: predictionRun.id },
      prisma,
    );
    expect(active.tasks).toHaveLength(0);
  });
});
