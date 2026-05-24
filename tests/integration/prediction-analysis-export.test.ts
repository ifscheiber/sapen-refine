import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  ArtifactProvenance,
  PrismaClient,
} from "@prisma/client";
import type JSZipConstructor from "jszip";

import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let exportsDomain: typeof import("@/server/domain/exports");
let exportJobs: typeof import("@/server/domain/exportJobs");
let predictionAnalysis: typeof import("@/server/domain/predictionAnalysisExports");
let predictionImport: typeof import("@/server/domain/predictionImport");
let predictions: typeof import("@/server/domain/predictionProvenance");
let correctionTasks: typeof import("@/server/domain/correctionTasks");
let storage: typeof import("@/server/storage/s3");
let JSZip: typeof JSZipConstructor;

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

describe("prediction analysis export workflow", () => {
  let adminId: string;
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let viewerId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let modelRunId: string;
  let suffix: string;

  beforeAll(async () => {
    exportsDomain = await import("@/server/domain/exports");
    exportJobs = await import("@/server/domain/exportJobs");
    predictionAnalysis = await import("@/server/domain/predictionAnalysisExports");
    predictionImport = await import("@/server/domain/predictionImport");
    predictions = await import("@/server/domain/predictionProvenance");
    correctionTasks = await import("@/server/domain/correctionTasks");
    storage = await import("@/server/storage/s3");
    JSZip = (await import("jszip")).default;

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, owner, qa, labeler, viewer] = await Promise.all([
      prisma.user.create({
        data: { email: `prediction-analysis-admin-${suffix}@test.local`, name: "Prediction Analysis Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-analysis-owner-${suffix}@test.local`, name: "Prediction Analysis Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-analysis-qa-${suffix}@test.local`, name: "Prediction Analysis QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-analysis-labeler-${suffix}@test.local`, name: "Prediction Analysis Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-analysis-viewer-${suffix}@test.local`, name: "Prediction Analysis Viewer" },
        select: { id: true },
      }),
    ]);
    adminId = admin.id;
    ownerId = owner.id;
    qaId = qa.id;
    labelerId = labeler.id;
    viewerId = viewer.id;

    const adminRole = await prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN" },
      select: { id: true },
    });
    await prisma.userGlobalRole.create({ data: { userId: adminId, roleId: adminRole.id } });

    const project = await prisma.annotationProject.create({
      data: {
        name: `Prediction Analysis Test ${suffix}`,
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
          modelFamily: `prediction-analysis-${suffix}`,
          modelName: "analysis-fixture",
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
      [adminId, ownerId, qaId, labelerId, viewerId]
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
          inferenceRunId: `prediction-analysis-${suffix}-${name}`,
          status: "COMPLETED",
          inputImageCount: 1,
          outputPredictionCount: 1,
          aggregateConfidenceSummary: { mean: 0.82 },
          aggregateUncertaintySummary: { mean: 0.18 },
        },
      },
      prisma,
    );
  }

  async function createImage(name: string) {
    const imageBytes = minimalPng(name);
    const storageKey = `tests/prediction-analysis/${suffix}/${name}.png`;
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

  async function importSemanticPrediction(predictionRunId: string, imageId: string, name: string) {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    return predictionImport.importPredictionMaskForUser(
      {
        predictionRunId,
        userId: ownerId,
        imageId,
        targetType: "SEMANTIC_MASK",
        bytes,
        width: 2,
        height: 2,
        contentType: "application/octet-stream",
        expectedChecksum: sha256Checksum(bytes),
        confidenceScore: 0.82,
        uncertaintyScore: 0.18,
        perClassScores: { heartwood: 0.74, sapwood: 0.26 },
        outputStats: { pixels: bytes.byteLength, fixture: name },
      },
      prisma,
    );
  }

  async function importSupportPrediction(predictionRunId: string, imageId: string, name: string) {
    const bytes = new Uint8Array([0, 10, 10, 0]);
    return predictionImport.importPredictionMaskForUser(
      {
        predictionRunId,
        userId: ownerId,
        imageId,
        targetType: "SLICE_SUPPORT_MASK",
        bytes,
        width: 2,
        height: 2,
        contentType: "application/octet-stream",
        expectedChecksum: sha256Checksum(bytes),
        confidenceScore: 0.79,
        uncertaintyScore: 0.21,
        outputStats: { pixels: bytes.byteLength, fixture: name },
      },
      prisma,
    );
  }

  async function createHumanReference(params: {
    imageId: string;
    predictionArtifactVersionId: string;
    taskId: string;
    name: string;
    kind?: AnnotationArtifactKind;
    approvedBytes?: Uint8Array;
    correctionBytes?: Uint8Array;
  }) {
    const kind = params.kind ?? AnnotationArtifactKind.SEMANTIC_MASK;
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId: params.imageId,
        kind,
        scopeKey: "default",
        createdById: labelerId,
      },
      select: { id: true },
    });

    const approvedBytes = params.approvedBytes ?? new Uint8Array([0, 1, 1, 2]);
    const approvedStorageKey = `tests/prediction-analysis/${suffix}/${params.name}-approved.u8raw`;
    await storage.putObject(approvedStorageKey, approvedBytes, "application/octet-stream");
    const approved = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        reviewState: "APPROVED",
        provenance: ArtifactProvenance.HUMAN_ANNOTATION,
        storageKey: approvedStorageKey,
        contentType: "application/octet-stream",
        size: approvedBytes.byteLength,
        checksum: sha256Checksum(approvedBytes),
        width: 2,
        height: 2,
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });
    await prisma.reviewDecision.create({
      data: {
        projectId,
        artifactVersionId: approved.id,
        fromState: "SUBMITTED",
        toState: "APPROVED",
        reviewedById: ownerId,
        comments: "Approved human reference for prediction analysis export",
      },
    });

    const correctionBytes = params.correctionBytes ?? new Uint8Array([0, 2, 3, 1]);
    const correctionStorageKey = `tests/prediction-analysis/${suffix}/${params.name}-correction.u8raw`;
    await storage.putObject(correctionStorageKey, correctionBytes, "application/octet-stream");
    const correction = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 2,
        reviewState: "DRAFT",
        provenance: ArtifactProvenance.HUMAN_CORRECTION,
        storageKey: correctionStorageKey,
        contentType: "application/octet-stream",
        size: correctionBytes.byteLength,
        checksum: sha256Checksum(correctionBytes),
        width: 2,
        height: 2,
        labelSchemaVersionId,
        taskId: params.taskId,
        parentVersionId: params.predictionArtifactVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });

    return { approvedVersionId: approved.id, correctionVersionId: correction.id };
  }

  it("creates a QA prediction-analysis export with proposal manifest and separated package paths", async () => {
    const predictionRun = await createPredictionRun("semantic-export");
    const imageId = await createImage("semantic-export");
    const imported = await importSemanticPrediction(predictionRun.id, imageId, "semantic-export");
    const createdTasks = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: ownerId },
      prisma,
    );
    const task = createdTasks.tasks.find((item) => item.predictionProvenanceId === imported.predictionProvenanceId);
    if (!task) throw new Error("TASK_NOT_CREATED");
    const humanReference = await createHumanReference({
      imageId,
      predictionArtifactVersionId: imported.artifactVersionId,
      taskId: task.id,
      name: "semantic-export",
    });

    const readiness = await predictionAnalysis.resolveProjectPredictionAnalysisReadiness(
      {
        projectId,
        userId: qaId,
        input: { predictionRunId: predictionRun.id, targetTypes: ["SEMANTIC_MASK"] },
      },
      prisma,
    );
    expect(readiness.canExport).toBe(true);
    expect(readiness.summary.totalCandidates).toBe(1);
    expect(readiness.candidates[0]?.state).toBe("prediction_with_approved_human_reference");

    const exportBatch = await createProcessedPredictionAnalysisExport(
      { predictionRunId: predictionRun.id, targetTypes: ["SEMANTIC_MASK"], includeHumanReferences: true },
      qaId,
    );
    expect(exportBatch.target).toBe("PREDICTION_ANALYSIS");
    expect(exportBatch.downloads?.manifest).toBe(`/api/prediction-analysis-exports/${exportBatch.id}/download?file=manifest`);
    expect(JSON.stringify(exportBatch)).not.toContain("tests/prediction-analysis");

    const manifestFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: qaId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    expect(manifest.manifestVersion).toBe("sapen-annotate-prediction-analysis-export-v1");
    expect(manifest.warnings[0]).toContain("not a ground-truth training-label export");
    expect(JSON.stringify(manifest)).not.toContain("tests/prediction-analysis");
    expect(JSON.stringify(manifest)).not.toContain("s3://private-models");

    const item = manifest.items.find((entry: { image: { id: string } }) => entry.image.id === imageId);
    expect(item.prediction).toMatchObject({
      artifactRole: "model_prediction_proposal",
      groundTruth: false,
      predictionProvenanceId: imported.predictionProvenanceId,
      artifactVersionId: imported.artifactVersionId,
      targetType: "SEMANTIC_MASK",
      confidenceScore: 0.82,
      uncertaintyScore: 0.18,
    });
    expect(item.prediction.path).toBe(`predictions/semantic/${imageId}-${imported.predictionProvenanceId}.u8raw`);
    expect(item.humanCorrection.artifactVersionId).toBe(humanReference.correctionVersionId);
    expect(item.humanCorrection.path).toBe(`human-corrections/semantic/${imageId}-${humanReference.correctionVersionId}.u8raw`);
    expect(item.approvedGroundTruthReference.artifactVersionId).toBe(humanReference.approvedVersionId);
    expect(item.approvedGroundTruthReference.path).toBe(
      `ground-truth/semantic/${imageId}-${humanReference.approvedVersionId}.u8raw`,
    );
    expect(item.correctionTask.taskId).toBe(task.id);
    expect(item.qaMetrics).toMatchObject({
      computed: true,
      metricVersion: "sapen-annotate-prediction-qa-metrics-v1",
      comparison: "prediction_vs_approved_human_reference",
      targetType: "SEMANTIC_MASK",
      inputs: {
        predictionArtifactVersionId: imported.artifactVersionId,
        referenceArtifactVersionId: humanReference.approvedVersionId,
        predictionWidth: 2,
        predictionHeight: 2,
        referenceWidth: 2,
        referenceHeight: 2,
      },
      semantic: {
        pixelAccuracy: 0.5,
      },
    });
    expect(item.qaMetrics.semantic.macroIoU).toBeCloseTo(1 / 6);
    expect(item.qaMetrics.semantic.macroDice).toBeCloseTo(2 / 9);
    expect(item.qaMetrics.semantic.perLabel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stableId: "sapwood", intersection: 1, union: 2, iou: 0.5 }),
        expect.objectContaining({ stableId: "heartwood", intersection: 0, union: 2, iou: 0 }),
        expect.objectContaining({ stableId: "copper", intersection: 0, union: 1, iou: 0 }),
      ]),
    );
    expect(manifest.summary.qaMetrics).toMatchObject({
      metricVersion: "sapen-annotate-prediction-qa-metrics-v1",
      computedItemCount: 1,
      notComputedItemCount: 0,
    });

    const packageFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: qaId, file: "package" },
      prisma,
    );
    const zip = await JSZip.loadAsync(packageFile.bytes);
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file(`images/${imageId}.png`)).toBeTruthy();
    expect(zip.file(item.prediction.path)).toBeTruthy();
    expect(zip.file(item.humanCorrection.path)).toBeTruthy();
    expect(zip.file(item.approvedGroundTruthReference.path)).toBeTruthy();

    const persistedItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id },
      select: {
        role: true,
        imageId: true,
        predictionProvenanceId: true,
        artifactVersionId: true,
        sliceClassificationVersionId: true,
        derivedCropId: true,
      },
    });
    expect(persistedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "image",
          imageId,
          artifactVersionId: null,
          sliceClassificationVersionId: null,
          predictionProvenanceId: imported.predictionProvenanceId,
          derivedCropId: null,
        }),
        expect.objectContaining({
          role: "prediction-proposal",
          imageId,
          predictionProvenanceId: imported.predictionProvenanceId,
          artifactVersionId: imported.artifactVersionId,
          sliceClassificationVersionId: null,
          derivedCropId: null,
        }),
        expect.objectContaining({
          role: "human-correction-reference",
          imageId,
          predictionProvenanceId: imported.predictionProvenanceId,
          artifactVersionId: humanReference.correctionVersionId,
          sliceClassificationVersionId: null,
          derivedCropId: null,
        }),
        expect.objectContaining({
          role: "approved-ground-truth-reference",
          imageId,
          predictionProvenanceId: imported.predictionProvenanceId,
          artifactVersionId: humanReference.approvedVersionId,
          sliceClassificationVersionId: null,
          derivedCropId: null,
        }),
      ]),
    );
  });

  it("keeps prediction-analysis exports out of default training export routes and targets", async () => {
    const predictionRun = await createPredictionRun("separation");
    const imageId = await createImage("separation");
    const imported = await importSemanticPrediction(predictionRun.id, imageId, "separation");

    await expect(
      predictionAnalysis.createPredictionAnalysisExportForUser(
        {
          projectId,
          userId: labelerId,
          input: { predictionRunId: predictionRun.id, targetTypes: ["SEMANTIC_MASK"] },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const exportBatch = await createProcessedPredictionAnalysisExport(
      { predictionRunId: predictionRun.id, targetTypes: ["SEMANTIC_MASK"], includeHumanReferences: false },
    );
    await expect(
      predictionAnalysis.readPredictionAnalysisExportFileForUser(
        { exportId: exportBatch.id, userId: viewerId, file: "manifest" },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const analysisManifestFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const analysisManifest = JSON.parse(new TextDecoder().decode(analysisManifestFile.bytes));
    expect(analysisManifest.items[0].qaMetrics).toMatchObject({
      computed: false,
      reason: "NO_APPROVED_REFERENCE",
    });
    await expect(
      exportsDomain.getTrainingExportForUser({ exportId: exportBatch.id, userId: ownerId }, prisma),
    ).rejects.toMatchObject({ code: "EXPORT_NOT_FOUND" });
    expect(() => exportsDomain.parseExportTargets(["prediction_analysis"])).toThrow();

    const queuedTrainingExport = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["semantic_segmentation"] },
      prisma,
    );
    await exportJobs.processDueExportJobsForUser({
      userId: ownerId,
      input: { maxJobs: 10, processorRunId: `test-${queuedTrainingExport.id}` },
    });
    const trainingExport = await exportsDomain.getTrainingExportForUser(
      { exportId: queuedTrainingExport.id, userId: ownerId },
      prisma,
    );
    const trainingItems = await prisma.exportItem.findMany({
      where: { exportBatchId: trainingExport.id },
      select: { artifactVersionId: true, predictionProvenanceId: true },
    });
    expect(trainingItems.map((item) => item.artifactVersionId)).not.toContain(imported.artifactVersionId);
    expect(trainingItems.map((item) => item.predictionProvenanceId)).not.toContain(imported.predictionProvenanceId);
    const trainingManifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: trainingExport.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    expect(new TextDecoder().decode(trainingManifestFile.bytes)).not.toContain("qaMetrics");
  });

  it("computes support metrics from approved support artifacts only", async () => {
    const predictionRun = await createPredictionRun("support-export");
    const imageId = await createImage("support-export");
    const imported = await importSupportPrediction(predictionRun.id, imageId, "support-export");
    const createdTasks = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: ownerId },
      prisma,
    );
    const task = createdTasks.tasks.find((item) => item.predictionProvenanceId === imported.predictionProvenanceId);
    if (!task) throw new Error("SUPPORT_TASK_NOT_CREATED");
    const humanReference = await createHumanReference({
      imageId,
      predictionArtifactVersionId: imported.artifactVersionId,
      taskId: task.id,
      name: "support-export",
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      approvedBytes: new Uint8Array([0, 10, 0, 10]),
      correctionBytes: new Uint8Array([0, 10, 10, 10]),
    });

    const exportBatch = await createProcessedPredictionAnalysisExport(
      { predictionRunId: predictionRun.id, targetTypes: ["SLICE_SUPPORT_MASK"], includeHumanReferences: true },
      qaId,
    );
    const manifestFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: qaId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const item = manifest.items.find((entry: { image: { id: string } }) => entry.image.id === imageId);

    expect(item.approvedGroundTruthReference.artifactVersionId).toBe(humanReference.approvedVersionId);
    expect(item.qaMetrics).toMatchObject({
      computed: true,
      targetType: "SLICE_SUPPORT_MASK",
      support: {
        truePositivePixels: 1,
        trueNegativePixels: 1,
        falsePositivePixels: 1,
        falseNegativePixels: 1,
        intersection: 1,
        union: 3,
        predictionSupportPixels: 2,
        referenceSupportPixels: 2,
      },
    });
    expect(item.qaMetrics.support.iou).toBeCloseTo(1 / 3);
    expect(item.qaMetrics.support.dice).toBeCloseTo(0.5);
  });

  it("does not treat Copper semantic references as support geometry", async () => {
    const predictionRun = await createPredictionRun("support-copper-boundary");
    const imageId = await createImage("support-copper-boundary");
    const imported = await importSupportPrediction(predictionRun.id, imageId, "support-copper-boundary");
    const createdTasks = await correctionTasks.createCorrectionTasksForPredictionRunForUser(
      { predictionRunId: predictionRun.id, userId: ownerId },
      prisma,
    );
    const task = createdTasks.tasks.find((item) => item.predictionProvenanceId === imported.predictionProvenanceId);
    if (!task) throw new Error("SUPPORT_COPPER_TASK_NOT_CREATED");
    await createHumanReference({
      imageId,
      predictionArtifactVersionId: imported.artifactVersionId,
      taskId: task.id,
      name: "support-copper-boundary",
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      approvedBytes: new Uint8Array([0, 3, 3, 0]),
    });

    const exportBatch = await createProcessedPredictionAnalysisExport(
      { predictionRunId: predictionRun.id, targetTypes: ["SLICE_SUPPORT_MASK"], includeHumanReferences: true },
    );
    const manifestFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const item = manifest.items.find((entry: { image: { id: string } }) => entry.image.id === imageId);

    expect(item.approvedGroundTruthReference).toBeNull();
    expect(item.qaMetrics).toMatchObject({
      computed: false,
      reason: "NO_APPROVED_REFERENCE",
      targetType: "SLICE_SUPPORT_MASK",
    });
  });

  async function processQueuedPredictionAnalysisExport(exportId: string) {
    await exportJobs.processDueExportJobsForUser({
      userId: ownerId,
      input: { maxJobs: 10, processorRunId: `test-${exportId}` },
    });
    return predictionAnalysis.getPredictionAnalysisExportForUser({ exportId, userId: ownerId }, prisma);
  }

  async function createProcessedPredictionAnalysisExport(input?: unknown, userId = ownerId) {
    const queued = await predictionAnalysis.createPredictionAnalysisExportForUser(
      { projectId, userId, input },
      prisma,
    );
    expect(queued.status).toBe("PENDING");
    const completed = await processQueuedPredictionAnalysisExport(queued.id);
    expect(completed.status).toBe("COMPLETED");
    return predictionAnalysis.getPredictionAnalysisExportForUser({ exportId: queued.id, userId }, prisma);
  }

  it("exports slice-classification prediction proposals as manifest-only prediction items", async () => {
    const predictionRun = await createPredictionRun("classification");
    const imageId = await createImage("classification");
    const slice = await prisma.sliceInstance.create({
      data: { projectId, imageId, createdById: ownerId },
      select: { id: true },
    });
    const classification = await predictions.createPredictionArtifactProvenance(
      {
        input: {
          predictionRunId: predictionRun.id,
          imageId,
          sliceInstanceId: slice.id,
          targetType: "SLICE_CLASSIFICATION",
          predictedClass: "COPPER_SLICE",
          confidenceScore: 0.61,
          uncertaintyScore: 0.39,
          perClassScores: { COPPER_SLICE: 0.61, SAP_HEARTWOOD_SLICE: 0.39 },
          outputStats: { proposalOnly: true },
          modelOutputChecksum: `sha256:classification-${suffix}`,
        },
      },
      prisma,
    );

    const exportBatch = await createProcessedPredictionAnalysisExport(
      { predictionRunId: predictionRun.id, targetTypes: ["SLICE_CLASSIFICATION"] },
    );
    const manifestFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const item = manifest.items.find((entry: { prediction: { predictionProvenanceId: string } }) =>
      entry.prediction.predictionProvenanceId === classification.id
    );
    expect(item.prediction).toMatchObject({
      artifactRole: "model_prediction_proposal",
      groundTruth: false,
      targetType: "SLICE_CLASSIFICATION",
      predictedClass: "COPPER_SLICE",
      path: null,
      artifact: null,
    });
    expect(item.qaMetrics).toMatchObject({
      computed: false,
      reason: "CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED",
      targetType: "SLICE_CLASSIFICATION",
    });

    const packageFile = await predictionAnalysis.readPredictionAnalysisExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "package" },
      prisma,
    );
    const zip = await JSZip.loadAsync(packageFile.bytes);
    expect(zip.file(`images/${imageId}.png`)).toBeTruthy();
    expect(zip.file(`predictions/classification/${imageId}-${classification.id}.u8raw`)).toBeNull();
  });
});
