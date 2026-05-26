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
let exportsDomain: typeof import("@/server/domain/exports");

describe("prediction provenance registry", () => {
  let adminId: string;
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let viewerId: string;
  let outsiderId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    predictions = await import("@/server/domain/predictionProvenance");
    exportsDomain = await import("@/server/domain/exports");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const [admin, owner, qa, labeler, viewer, outsider] = await Promise.all([
      prisma.user.create({
        data: { email: `prediction-admin-${suffix}@test.local`, name: "Prediction Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-owner-${suffix}@test.local`, name: "Prediction Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-qa-${suffix}@test.local`, name: "Prediction QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-labeler-${suffix}@test.local`, name: "Prediction Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-viewer-${suffix}@test.local`, name: "Prediction Viewer" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-outsider-${suffix}@test.local`, name: "Prediction Outsider" },
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
    await prisma.userGlobalRole.create({
      data: { userId: adminId, roleId: adminRole.id },
    });

    const project = await prisma.annotationProject.create({
      data: {
        name: `Prediction Provenance Test ${suffix}`,
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
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (suffix) {
      await prisma.modelRun.deleteMany({
        where: { modelFamily: `prediction-test-${suffix}` },
      });
    }
    await Promise.all(
      [adminId, ownerId, qaId, labelerId, viewerId, outsiderId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function createModelRun(name: string) {
    return predictions.createModelRunForUser(
      {
        userId: adminId,
        input: {
          modelFamily: `prediction-test-${suffix}`,
          modelName: name,
          modelVersion: "0.1.0",
          taskType: "SEMANTIC_SEGMENTATION",
          checkpointId: `checkpoint-${name}`,
          checkpointPath: `s3://internal-models/${suffix}/${name}.ckpt`,
          checkpointHash: `sha256:${suffix}-${name}`,
          trainingRunId: `training-${name}`,
          trainingDatasetRef: `export:${suffix}`,
          trainingCodeVersion: "trainer-0.1.0",
          trainingGitCommit: "abcdef123456",
          configHash: `sha256:config-${suffix}-${name}`,
          metadata: { fixture: true },
        },
      },
      prisma,
    );
  }

  async function createPredictionRun(
    modelRunId: string,
    inferenceRunId: string,
    userId = ownerId,
  ) {
    return predictions.createPredictionRunForUser(
      {
        projectId,
        userId,
        input: {
          modelRunId,
          inferenceRunId,
          sourceDatasetRef: `selection:${suffix}`,
          selectionCriteria: { imageIds: ["fixture"] },
          generatedAt: new Date().toISOString(),
          status: "COMPLETED",
          inputImageCount: 1,
          outputPredictionCount: 1,
          aggregateConfidenceSummary: { mean: 0.82 },
          aggregateUncertaintySummary: { p95: 0.21 },
          configHash: `sha256:inference-${suffix}-${inferenceRunId}`,
          warnings: ["fixture warning"],
          metadata: { batch: inferenceRunId },
        },
      },
      prisma,
    );
  }

  async function createImage(name: string) {
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/prediction/${suffix}/${name}.png`,
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

  async function createArtifactVersion(params: {
    imageId: string;
    kind: AnnotationArtifactKind;
    provenance: ArtifactProvenance;
    scopeKey: string;
  }) {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId: params.imageId,
        kind: params.kind,
        scopeKey: params.scopeKey,
        createdById: ownerId,
      },
      select: { id: true },
    });

    return prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        provenance: params.provenance,
        reviewState: "DRAFT",
        storageKey: `tests/prediction/${suffix}/${params.scopeKey}.u8raw`,
        contentType: "application/octet-stream",
        size: 128,
        checksum: `sha256:${suffix}-${params.scopeKey}`,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: ownerId,
      },
      select: { id: true },
    });
  }

  it("allows only admins to create and directly read model runs", async () => {
    const modelRun = await createModelRun("admin-only");
    expect(modelRun.modelFamily).toBe(`prediction-test-${suffix}`);
    expect(modelRun.taskType).toBe("SEMANTIC_SEGMENTATION");
    expect(modelRun.checkpointHash).toBe(`sha256:${suffix}-admin-only`);
    expect(modelRun.trainingDatasetRef).toBe(`export:${suffix}`);

    const read = await predictions.getModelRunForUser(
      { modelRunId: modelRun.id, userId: adminId },
      prisma,
    );
    expect(read.id).toBe(modelRun.id);

    await expect(
      predictions.createModelRunForUser(
        {
          userId: ownerId,
          input: {
            modelFamily: `prediction-test-${suffix}`,
            modelName: "blocked",
            taskType: "SEMANTIC_SEGMENTATION",
          },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      predictions.getModelRunForUser({ modelRunId: modelRun.id, userId: ownerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates project-scoped prediction runs and applies project read/write roles", async () => {
    const modelRun = await createModelRun("project-run");
    const ownerRun = await createPredictionRun(modelRun.id, `owner-${suffix}`);
    const qaRun = await createPredictionRun(modelRun.id, `qa-${suffix}`, qaId);

    expect(ownerRun.projectId).toBe(projectId);
    expect(ownerRun.modelRunId).toBe(modelRun.id);
    expect(ownerRun.inputImageCount).toBe(1);
    expect(ownerRun.outputPredictionCount).toBe(1);
    expect(ownerRun.modelRun.modelName).toBe("project-run");
    expect(ownerRun.modelRun.checkpointHash).toBe(`sha256:${suffix}-project-run`);

    await expect(
      predictions.createPredictionRunForUser(
        {
          projectId,
          userId: labelerId,
          input: { modelRunId: modelRun.id, inferenceRunId: `labeler-${suffix}` },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const listed = await predictions.listProjectPredictionRunsForUser(
      { projectId, userId: qaId },
      prisma,
    );
    expect(listed.map((run) => run.id)).toEqual(expect.arrayContaining([ownerRun.id, qaRun.id]));

    const read = await predictions.getPredictionRunForUser(
      { predictionRunId: ownerRun.id, userId: qaId },
      prisma,
    );
    expect(read.id).toBe(ownerRun.id);

    await expect(
      predictions.listProjectPredictionRunsForUser({ projectId, userId: labelerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      predictions.getPredictionRunForUser({ predictionRunId: ownerRun.id, userId: labelerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      predictions.listProjectPredictionRunsForUser({ projectId, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      predictions.getPredictionRunForUser({ predictionRunId: ownerRun.id, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      predictions.listProjectPredictionRunsForUser({ projectId, userId: outsiderId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      predictions.getPredictionRunForUser({ predictionRunId: ownerRun.id, userId: outsiderId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("maps duplicate external inference run ids to a stable conflict", async () => {
    const modelRun = await createModelRun("duplicate");
    await createPredictionRun(modelRun.id, `duplicate-${suffix}`);

    await expect(
      createPredictionRun(modelRun.id, `duplicate-${suffix}`),
    ).rejects.toMatchObject({ code: "DUPLICATE_INFERENCE_RUN" });
  });

  it("stores individual prediction provenance without making predictions export-ready", async () => {
    const modelRun = await createModelRun("semantic-provenance");
    const predictionRun = await createPredictionRun(modelRun.id, `semantic-${suffix}`);
    const imageId = await createImage("semantic-provenance");
    const predictionVersion = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.PREDICTION_MASK,
      provenance: ArtifactProvenance.MODEL_PREDICTION,
      scopeKey: "semantic-prediction",
    });

    const provenance = await predictions.createPredictionArtifactProvenance(
      {
        input: {
          predictionRunId: predictionRun.id,
          imageId,
          artifactVersionId: predictionVersion.id,
          targetType: "SEMANTIC_MASK",
          confidenceScore: 0.87,
          uncertaintyScore: 0.12,
          perClassScores: { heartwood: 0.74, sapwood: 0.26 },
          outputStats: { changedPixels: 42 },
          modelOutputChecksum: `sha256:prediction-${suffix}`,
        },
      },
      prisma,
    );

    expect(provenance.predictionRunId).toBe(predictionRun.id);
    expect(provenance.artifactVersionId).toBe(predictionVersion.id);
    expect(provenance.confidenceScore).toBe(0.87);
    expect(predictions.isPredictionProvenanceExportReady()).toBe(false);

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const candidate = readiness.candidates.find((item) => item.image.id === imageId);
    expect(candidate?.semanticMask).toBeNull();
    expect(candidate?.eligibleTargets).not.toContain("semantic_segmentation");
  });

  it("validates classification prediction proposals without creating human class versions", async () => {
    const modelRun = await createModelRun("classification-provenance");
    const predictionRun = await createPredictionRun(modelRun.id, `classification-${suffix}`);
    const imageId = await createImage("classification-provenance");
    const slice = await prisma.sliceInstance.create({
      data: { projectId, imageId, createdById: ownerId },
      select: { id: true },
    });

    await expect(
      predictions.createPredictionArtifactProvenance(
        {
          input: {
            predictionRunId: predictionRun.id,
            imageId,
            targetType: "SLICE_CLASSIFICATION",
          },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "PREDICTED_CLASS_REQUIRED" });

    await expect(
      predictions.createPredictionArtifactProvenance(
        {
          input: {
            predictionRunId: predictionRun.id,
            imageId,
            targetType: "SEMANTIC_MASK",
            predictedClass: "COPPER_SLICE",
          },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "PREDICTED_CLASS_TARGET_INVALID" });

    const provenance = await predictions.createPredictionArtifactProvenance(
      {
        input: {
          predictionRunId: predictionRun.id,
          imageId,
          sliceInstanceId: slice.id,
          targetType: "SLICE_CLASSIFICATION",
          predictedClass: "COPPER_SLICE",
          confidenceScore: 0.91,
        },
      },
      prisma,
    );
    expect(provenance.predictedClass).toBe("COPPER_SLICE");

    const classVersions = await prisma.sliceClassificationVersion.count({ where: { imageId } });
    expect(classVersions).toBe(0);
  });

  it("rejects invalid prediction references and out-of-range confidence scores", async () => {
    const modelRun = await createModelRun("invalid-reference");
    const predictionRun = await createPredictionRun(modelRun.id, `invalid-${suffix}`);
    const imageId = await createImage("invalid-reference");
    const humanVersion = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      provenance: ArtifactProvenance.HUMAN_ANNOTATION,
      scopeKey: "human-semantic",
    });

    await expect(
      predictions.createPredictionArtifactProvenance(
        {
          input: {
            predictionRunId: predictionRun.id,
            imageId,
            targetType: "SEMANTIC_MASK",
            confidenceScore: 1.01,
          },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "CONFIDENCE_OUT_OF_RANGE" });

    await expect(
      predictions.createPredictionArtifactProvenance(
        {
          input: {
            predictionRunId: predictionRun.id,
            imageId,
            artifactVersionId: humanVersion.id,
            targetType: "SEMANTIC_MASK",
            confidenceScore: 0.5,
          },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "ARTIFACT_NOT_PREDICTION" });
  });

  it("resolves correction tasks through prediction run and item provenance links", async () => {
    const modelRun = await createModelRun("task-linkage");
    const predictionRun = await createPredictionRun(modelRun.id, `task-${suffix}`);
    const imageId = await createImage("task-linkage");
    const provenance = await predictions.createPredictionArtifactProvenance(
      {
        input: {
          predictionRunId: predictionRun.id,
          imageId,
          targetType: "SEMANTIC_MASK",
          confidenceScore: 0.63,
          uncertaintyScore: 0.33,
        },
      },
      prisma,
    );

    const task = await prisma.annotationTask.create({
      data: {
        projectId,
        imageId,
        type: "MODEL_PREDICTION_CORRECTION",
        status: "OPEN",
        priority: 80,
        taskReason: "high_uncertainty",
        confidenceScore: 0.63,
        uncertaintyScore: 0.33,
        modelSource: "legacy-display-only",
        predictionRunId: predictionRun.id,
        predictionProvenanceId: provenance.id,
        createdById: ownerId,
        assigneeId: labelerId,
      },
      select: { id: true },
    });

    const resolved = await predictions.resolveTaskPredictionProvenance(
      { taskId: task.id },
      prisma,
    );
    expect(resolved.predictionRun?.id).toBe(predictionRun.id);
    expect(resolved.predictionProvenance?.id).toBe(provenance.id);
    expect(resolved.modelSource).toBe("legacy-display-only");
    expect(resolved.taskReason).toBe("high_uncertainty");
  });
});
