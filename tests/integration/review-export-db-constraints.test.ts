import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  PrismaClient,
  type ArtifactProvenance,
  type ArtifactReviewState,
} from "@prisma/client";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let review: typeof import("@/server/domain/review");

describe("review/export database constraints", () => {
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let imageId: string;
  let sliceInstanceId: string;
  let artifactVersionId: string;
  let supportArtifactVersionId: string;
  let classificationVersionId: string;
  let predictionArtifactVersionId: string;
  let predictionProvenanceId: string;
  let classificationPredictionProvenanceId: string;
  let derivedCropId: string;
  let exportBatchId: string;
  let modelRunId: string;
  let suffix: string;
  let rawIdCounter = 0;

  beforeAll(async () => {
    review = await import("@/server/domain/review");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [owner, qa, labeler] = await Promise.all([
      prisma.user.create({
        data: { email: `rb109-owner-${suffix}@test.local`, name: "RB109 Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `rb109-qa-${suffix}@test.local`, name: "RB109 QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `rb109-labeler-${suffix}@test.local`, name: "RB109 Labeler" },
        select: { id: true },
      }),
    ]);
    ownerId = owner.id;
    qaId = qa.id;
    labelerId = labeler.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `RB109 Constraint Test ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: {
          create: [
            { userId: ownerId, role: "OWNER" },
            { userId: qaId, role: "QA" },
            { userId: labelerId, role: "LABELER" },
          ],
        },
      },
      select: { id: true },
    });
    projectId = project.id;

    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/rb109/${suffix}/source.png`,
        filename: "source.png",
        contentType: "image/png",
        size: 128,
        checksum: `sha256:rb109-image-${suffix}`,
        width: 16,
        height: 8,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    imageId = image.id;

    const slice = await prisma.sliceInstance.create({
      data: { projectId, imageId, createdById: labelerId },
      select: { id: true },
    });
    sliceInstanceId = slice.id;

    artifactVersionId = await createArtifactVersion("semantic", AnnotationArtifactKind.SEMANTIC_MASK);
    supportArtifactVersionId = await createArtifactVersion("support", AnnotationArtifactKind.SLICE_SUPPORT_MASK);
    predictionArtifactVersionId = await createArtifactVersion(
      "prediction",
      AnnotationArtifactKind.PREDICTION_MASK,
      "MODEL_PREDICTION",
    );
    classificationVersionId = await createClassificationVersion("classification");

    const bbox = await prisma.sliceBoundingBoxVersion.create({
      data: {
        projectId,
        imageId,
        sliceInstanceId,
        version: 1,
        x: 0,
        y: 0,
        width: 8,
        height: 8,
        coordinateSpace: "SOURCE_IMAGE_PIXEL",
        createdById: labelerId,
      },
      select: { id: true },
    });
    const crop = await prisma.derivedSliceCrop.create({
      data: {
        projectId,
        sourceImageId: imageId,
        sourceImageChecksum: `sha256:rb109-image-${suffix}`,
        sourceImageWidth: 16,
        sourceImageHeight: 8,
        sliceInstanceId,
        bboxVersionId: bbox.id,
        version: 1,
        sourceX: 0,
        sourceY: 0,
        sourceWidth: 8,
        sourceHeight: 8,
        cropWidth: 8,
        cropHeight: 8,
        paddingRequestedPx: 0,
        paddingAppliedLeftPx: 0,
        paddingAppliedTopPx: 0,
        paddingAppliedRightPx: 0,
        paddingAppliedBottomPx: 0,
        coordinateSpace: "CROP_PIXEL",
        transformToSourceJson: { scale: 1, translateX: 0, translateY: 0 },
        storageKey: `tests/rb109/${suffix}/crop.png`,
        checksum: `sha256:rb109-crop-${suffix}`,
        contentType: "image/png",
        byteSize: 128,
        createdById: labelerId,
      },
      select: { id: true },
    });
    derivedCropId = crop.id;

    const modelRun = await prisma.modelRun.create({
      data: {
        modelFamily: "rb109",
        modelName: `rb109-${suffix}`,
        taskType: "SEMANTIC_SEGMENTATION",
        createdById: ownerId,
      },
      select: { id: true },
    });
    modelRunId = modelRun.id;
    const predictionRun = await prisma.predictionRun.create({
      data: {
        modelRunId,
        projectId,
        status: "COMPLETED",
        generatedById: ownerId,
      },
      select: { id: true },
    });
    const prediction = await prisma.predictionArtifactProvenance.create({
      data: {
        predictionRunId: predictionRun.id,
        artifactVersionId: predictionArtifactVersionId,
        imageId,
        sliceInstanceId,
        targetType: "SEMANTIC_MASK",
        modelOutputChecksum: `sha256:rb109-prediction-${suffix}`,
      },
      select: { id: true },
    });
    predictionProvenanceId = prediction.id;
    const classificationPrediction = await prisma.predictionArtifactProvenance.create({
      data: {
        predictionRunId: predictionRun.id,
        imageId,
        sliceInstanceId,
        targetType: "SLICE_CLASSIFICATION",
        predictedClass: "COPPER_SLICE",
        modelOutputChecksum: `sha256:rb109-classification-prediction-${suffix}`,
      },
      select: { id: true },
    });
    classificationPredictionProvenanceId = classificationPrediction.id;

    const exportBatch = await prisma.exportBatch.create({
      data: {
        projectId,
        target: "COMBINED_MANIFEST",
        status: "CREATED",
        manifestFormatVersion: "rb109-test",
        exportedById: ownerId,
      },
      select: { id: true },
    });
    exportBatchId = exportBatch.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.exportItem.deleteMany({ where: { exportBatch: { projectId } } }).catch(() => undefined);
      await prisma.exportBatch.deleteMany({ where: { projectId } }).catch(() => undefined);
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (modelRunId) {
      await prisma.modelRun.delete({ where: { id: modelRunId } }).catch(() => undefined);
    }
    await Promise.all(
      [ownerId, qaId, labelerId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function createArtifactVersion(
    name: string,
    kind: AnnotationArtifactKind,
    provenance: ArtifactProvenance = "HUMAN_ANNOTATION",
    reviewState: ArtifactReviewState = "DRAFT",
  ) {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind,
        scopeKey: `rb109-${name}`,
        createdById: labelerId,
      },
      select: { id: true },
    });
    const version = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        provenance,
        reviewState,
        storageKey: `tests/rb109/${suffix}/${name}.u8raw`,
        size: 128,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });
    return version.id;
  }

  async function createClassificationVersion(name: string, reviewState: ArtifactReviewState = "DRAFT") {
    const version = await prisma.sliceClassificationVersion.create({
      data: {
        projectId,
        imageId,
        sliceInstanceId,
        version: 1,
        class: "COPPER_SLICE",
        reviewState,
        labelSchemaVersionId,
        createdById: labelerId,
        metadataJson: { name },
      },
      select: { id: true },
    });
    return version.id;
  }

  function rawId(prefix: string) {
    rawIdCounter += 1;
    return `rb109_${prefix}_${Date.now()}_${rawIdCounter}`;
  }

  async function expectCheckViolation(action: Promise<unknown>, constraintName: string) {
    await expect(action).rejects.toThrow(new RegExp(constraintName));
  }

  async function insertRawReviewDecision(params: {
    artifactVersionId?: string | null;
    sliceClassificationVersionId?: string | null;
  }) {
    return prisma.$executeRaw`
      INSERT INTO "ReviewDecision" (
        "id",
        "projectId",
        "artifactVersionId",
        "sliceClassificationVersionId",
        "toState",
        "reviewedById"
      )
      VALUES (
        ${rawId("review")},
        ${projectId},
        ${params.artifactVersionId ?? null},
        ${params.sliceClassificationVersionId ?? null},
        ${"APPROVED"}::"ArtifactReviewState",
        ${qaId}
      )
    `;
  }

  async function insertRawExportItem(params: {
    role: string;
    imageId?: string | null;
    artifactVersionId?: string | null;
    sliceClassificationVersionId?: string | null;
    predictionProvenanceId?: string | null;
    derivedCropId?: string | null;
  }) {
    return prisma.$executeRaw`
      INSERT INTO "ExportItem" (
        "id",
        "exportBatchId",
        "role",
        "imageId",
        "artifactVersionId",
        "sliceClassificationVersionId",
        "predictionProvenanceId",
        "derivedCropId"
      )
      VALUES (
        ${rawId("export")},
        ${exportBatchId},
        ${params.role},
        ${params.imageId ?? null},
        ${params.artifactVersionId ?? null},
        ${params.sliceClassificationVersionId ?? null},
        ${params.predictionProvenanceId ?? null},
        ${params.derivedCropId ?? null}
      )
    `;
  }

  it("rejects review decisions without exactly one target", async () => {
    await expectCheckViolation(
      insertRawReviewDecision({ artifactVersionId: null, sliceClassificationVersionId: null }),
      "ReviewDecision_exactly_one_target_chk",
    );

    await expectCheckViolation(
      insertRawReviewDecision({ artifactVersionId, sliceClassificationVersionId: classificationVersionId }),
      "ReviewDecision_exactly_one_target_chk",
    );
  });

  it("preserves valid artifact and classification review service writes", async () => {
    const artifactSubmit = await review.transitionArtifactVersionForUser(
      { versionId: artifactVersionId, userId: labelerId, action: "submit" },
      prisma,
    );
    expect(artifactSubmit.toState).toBe("SUBMITTED");
    const artifactDecision = await prisma.reviewDecision.findFirstOrThrow({
      where: { artifactVersionId },
      select: { artifactVersionId: true, sliceClassificationVersionId: true },
    });
    expect(artifactDecision).toEqual({
      artifactVersionId,
      sliceClassificationVersionId: null,
    });

    const classificationSubmit = await review.transitionSliceClassificationVersionForUser(
      { versionId: classificationVersionId, userId: labelerId, action: "submit" },
      prisma,
    );
    expect(classificationSubmit.toState).toBe("SUBMITTED");
    const classificationDecision = await prisma.reviewDecision.findFirstOrThrow({
      where: { sliceClassificationVersionId: classificationVersionId },
      select: { artifactVersionId: true, sliceClassificationVersionId: true },
    });
    expect(classificationDecision).toEqual({
      artifactVersionId: null,
      sliceClassificationVersionId: classificationVersionId,
    });
  });

  it("rejects constrained export item role/reference mismatches", async () => {
    await expectCheckViolation(
      insertRawExportItem({ role: "semantic-mask", imageId }),
      "ExportItem_full_image_artifact_reference_chk",
    );

    await expectCheckViolation(
      insertRawExportItem({ role: "crop-semantic-mask", imageId, artifactVersionId }),
      "ExportItem_crop_artifact_reference_chk",
    );

    await expectCheckViolation(
      insertRawExportItem({ role: "prediction-proposal", imageId, artifactVersionId }),
      "ExportItem_prediction_proposal_reference_chk",
    );

    await expectCheckViolation(
      insertRawExportItem({
        role: "approved-ground-truth-reference",
        imageId,
        artifactVersionId,
        sliceClassificationVersionId: classificationVersionId,
        predictionProvenanceId,
      }),
      "ExportItem_approved_ground_truth_reference_chk",
    );
  });

  it("accepts the current constrained export item role/reference matrix", async () => {
    const rows = await Promise.all([
      prisma.exportItem.create({ data: { exportBatchId, role: "image", imageId } }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "image", imageId, predictionProvenanceId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "semantic-mask", imageId, artifactVersionId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "support-mask", imageId, artifactVersionId: supportArtifactVersionId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "slice-classification", imageId, sliceClassificationVersionId: classificationVersionId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "original-image", imageId, derivedCropId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "derived-crop", imageId, derivedCropId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "crop-semantic-mask", imageId, artifactVersionId, derivedCropId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "crop-support-mask", imageId, artifactVersionId: supportArtifactVersionId, derivedCropId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "crop-slice-classification", imageId, sliceClassificationVersionId: classificationVersionId, derivedCropId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "prediction-proposal", imageId, artifactVersionId: predictionArtifactVersionId, predictionProvenanceId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "prediction-proposal", imageId, predictionProvenanceId: classificationPredictionProvenanceId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "human-correction-reference", imageId, artifactVersionId, predictionProvenanceId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "approved-ground-truth-reference", imageId, artifactVersionId, predictionProvenanceId },
      }),
      prisma.exportItem.create({
        data: { exportBatchId, role: "approved-ground-truth-reference", imageId, sliceClassificationVersionId: classificationVersionId, predictionProvenanceId },
      }),
    ]);

    expect(rows.map((row) => row.role)).toEqual(
      expect.arrayContaining([
        "image",
        "semantic-mask",
        "support-mask",
        "slice-classification",
        "original-image",
        "derived-crop",
        "crop-semantic-mask",
        "crop-support-mask",
        "crop-slice-classification",
        "prediction-proposal",
        "human-correction-reference",
        "approved-ground-truth-reference",
      ]),
    );
  });
});
