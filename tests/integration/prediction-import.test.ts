import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let provenance: typeof import("@/server/domain/predictionProvenance");
let predictionImport: typeof import("@/server/domain/predictionImport");
let exportsDomain: typeof import("@/server/domain/exports");
let review: typeof import("@/server/domain/review");

describe("prediction import workflow", () => {
  let adminId: string;
  let ownerId: string;
  let qaId: string;
  let labelerId: string;
  let viewerId: string;
  let outsiderId: string;
  let projectId: string;
  let otherProjectId: string;
  let labelSchemaVersionId: string;
  let modelRunId: string;
  let predictionRunId: string;
  let suffix: string;

  beforeAll(async () => {
    provenance = await import("@/server/domain/predictionProvenance");
    predictionImport = await import("@/server/domain/predictionImport");
    exportsDomain = await import("@/server/domain/exports");
    review = await import("@/server/domain/review");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin, owner, qa, labeler, viewer, outsider] = await Promise.all([
      prisma.user.create({
        data: { email: `prediction-import-admin-${suffix}@test.local`, name: "Import Admin" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-import-owner-${suffix}@test.local`, name: "Import Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-import-qa-${suffix}@test.local`, name: "Import QA" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-import-labeler-${suffix}@test.local`, name: "Import Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-import-viewer-${suffix}@test.local`, name: "Import Viewer" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `prediction-import-outsider-${suffix}@test.local`, name: "Import Outsider" },
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

    const [project, otherProject] = await Promise.all([
      prisma.annotationProject.create({
        data: {
          name: `Prediction Import Test ${suffix}`,
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
      }),
      prisma.annotationProject.create({
        data: {
          name: `Prediction Import Other ${suffix}`,
          labelSchemaVersionId,
          createdById: ownerId,
          members: { create: [{ userId: ownerId, role: "OWNER" }] },
        },
        select: { id: true },
      }),
    ]);
    projectId = project.id;
    otherProjectId = otherProject.id;

    const modelRun = await provenance.createModelRunForUser(
      {
        userId: adminId,
        input: {
          modelFamily: `prediction-import-${suffix}`,
          modelName: "import-fixture",
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
          inferenceRunId: `import-${suffix}`,
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
    await Promise.all(
      [projectId, otherProjectId]
        .filter(Boolean)
        .map((id) => prisma.annotationProject.delete({ where: { id } }).catch(() => undefined)),
    );
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

  async function createImage(name: string, selectedProjectId = projectId, width = 2, height = 2) {
    const image = await prisma.imageAsset.create({
      data: {
        projectId: selectedProjectId,
        storageKey: `tests/prediction-import/${suffix}/${name}.png`,
        filename: `${name}.png`,
        contentType: "image/png",
        size: 256,
        checksum: `sha256:${suffix}-${name}`,
        width,
        height,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    return image.id;
  }

  async function importMask(params: {
    imageId: string;
    userId?: string;
    targetType: string;
    bytes: Uint8Array;
    width?: number;
    height?: number;
    checksum?: string;
    contentType?: string | null;
    coordinateSpace?: string | null;
  }) {
    return predictionImport.importPredictionMaskForUser(
      {
        predictionRunId,
        userId: params.userId ?? ownerId,
        imageId: params.imageId,
        targetType: params.targetType,
        bytes: params.bytes,
        width: params.width ?? 2,
        height: params.height ?? 2,
        contentType: params.contentType === undefined ? "application/octet-stream" : params.contentType,
        expectedChecksum: params.checksum,
        coordinateSpace: params.coordinateSpace,
        confidenceScore: 0.82,
        uncertaintyScore: 0.18,
        perClassScores: { fixture: true },
        outputStats: { pixels: params.bytes.byteLength },
      },
      prisma,
    );
  }

  it("imports semantic prediction masks as private MODEL_PREDICTION artifacts", async () => {
    const imageId = await createImage("semantic-success");
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const checksum = sha256Checksum(bytes);

    const result = await importMask({
      imageId,
      targetType: "SEMANTIC_MASK",
      bytes,
      checksum,
    });

    expect(result).toMatchObject({
      predictionRunId,
      imageId,
      targetType: "SEMANTIC_MASK",
      checksum,
      width: 2,
      height: 2,
      reviewState: "DRAFT",
      provenance: "MODEL_PREDICTION",
      coordinateSpace: "IMAGE_PIXEL",
      format: "u8raw-v1",
    });
    expect("storageKey" in result).toBe(false);

    const version = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: result.artifactVersionId },
      select: {
        id: true,
        provenance: true,
        reviewState: true,
        checksum: true,
        storageKey: true,
        artifact: { select: { kind: true, scopeKey: true, imageId: true } },
        predictionProvenance: {
          select: {
            id: true,
            predictionRunId: true,
            imageId: true,
            targetType: true,
            confidenceScore: true,
            uncertaintyScore: true,
            modelOutputChecksum: true,
          },
        },
      },
    });

    expect(version.artifact.kind).toBe("PREDICTION_MASK");
    expect(version.artifact.scopeKey).toBe(`prediction:${predictionRunId}:SEMANTIC_MASK`);
    expect(version.provenance).toBe("MODEL_PREDICTION");
    expect(version.reviewState).toBe("DRAFT");
    expect(version.checksum).toBe(checksum);
    expect(version.storageKey).toContain(`/predictions/${predictionRunId}/${imageId}/`);
    expect(version.predictionProvenance).toMatchObject({
      id: result.predictionProvenanceId,
      predictionRunId,
      imageId,
      targetType: "SEMANTIC_MASK",
      confidenceScore: 0.82,
      uncertaintyScore: 0.18,
      modelOutputChecksum: checksum,
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "PREDICTION_IMPORT_CREATED",
        entityId: result.artifactVersionId,
      },
      select: { id: true },
    });
    expect(audit).not.toBeNull();
  });

  it("imports support prediction masks for QA and keeps them out of review/export ground truth", async () => {
    const imageId = await createImage("support-success");
    const bytes = new Uint8Array([0, 10, 10, 0]);
    const result = await importMask({
      imageId,
      userId: qaId,
      targetType: "SLICE_SUPPORT_MASK",
      bytes,
      checksum: sha256Checksum(bytes),
    });

    expect(result.targetType).toBe("SLICE_SUPPORT_MASK");
    expect(result.provenance).toBe("MODEL_PREDICTION");

    await expect(
      review.transitionArtifactVersionForUser(
        { versionId: result.artifactVersionId, userId: ownerId, action: "submit" },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "ARTIFACT_NOT_REVIEWABLE" });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const candidate = readiness.candidates.find((item) => item.image.id === imageId);
    expect(candidate?.supportMask).toBeNull();
    expect(candidate?.eligibleTargets).not.toContain("support_segmentation");
  });

  it("rejects unauthorized users", async () => {
    const imageId = await createImage("unauthorized");
    const bytes = new Uint8Array([0, 1, 2, 3]);

    await expect(
      importMask({ imageId, userId: labelerId, targetType: "SEMANTIC_MASK", bytes }),
    ).rejects.toMatchObject({ code: "PREDICTION_IMPORT_FORBIDDEN" });
    await expect(
      importMask({ imageId, userId: viewerId, targetType: "SEMANTIC_MASK", bytes }),
    ).rejects.toMatchObject({ code: "PREDICTION_IMPORT_FORBIDDEN" });
    await expect(
      importMask({ imageId, userId: outsiderId, targetType: "SEMANTIC_MASK", bytes }),
    ).rejects.toMatchObject({ code: "PREDICTION_IMPORT_FORBIDDEN" });
  });

  it("rejects image/project mismatches and unsupported targets", async () => {
    const otherImageId = await createImage("other-project", otherProjectId);
    const imageId = await createImage("unsupported-target");
    const bytes = new Uint8Array([0, 1, 2, 3]);

    await expect(
      importMask({ imageId: otherImageId, targetType: "SEMANTIC_MASK", bytes }),
    ).rejects.toMatchObject({ code: "IMAGE_PROJECT_MISMATCH" });

    await expect(
      importMask({ imageId, targetType: "SLICE_CLASSIFICATION", bytes }),
    ).rejects.toMatchObject({ code: "PREDICTION_TARGET_UNSUPPORTED" });
  });

  it("rejects checksum, dimension, content-type and coordinate-space failures", async () => {
    const imageId = await createImage("validation-failures");
    const bytes = new Uint8Array([0, 1, 2, 3]);

    await expect(
      importMask({
        imageId,
        targetType: "SEMANTIC_MASK",
        bytes,
        checksum: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).rejects.toMatchObject({ code: "CHECKSUM_MISMATCH" });

    await expect(
      importMask({ imageId, targetType: "SEMANTIC_MASK", bytes, width: 4, height: 4 }),
    ).rejects.toMatchObject({ code: "MASK_BYTE_LENGTH_MISMATCH" });

    await expect(
      importMask({
        imageId,
        targetType: "SEMANTIC_MASK",
        bytes,
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });

    await expect(
      importMask({
        imageId,
        targetType: "SEMANTIC_MASK",
        bytes,
        coordinateSpace: "TRANSFORMED",
      }),
    ).rejects.toMatchObject({ code: "COORDINATE_SPACE_UNSUPPORTED" });
  });

  it("validates target-specific mask values", async () => {
    const imageId = await createImage("value-validation");

    await expect(
      importMask({
        imageId,
        targetType: "SEMANTIC_MASK",
        bytes: new Uint8Array([0, 10, 0, 10]),
      }),
    ).rejects.toMatchObject({ code: "SEMANTIC_MASK_VALUES_INVALID" });

    await expect(
      importMask({
        imageId,
        targetType: "SLICE_SUPPORT_MASK",
        bytes: new Uint8Array([0, 3, 0, 3]),
      }),
    ).rejects.toMatchObject({ code: "SUPPORT_MASK_VALUES_INVALID" });
  });

  it("rejects invalid confidence and uncertainty scores", async () => {
    const imageId = await createImage("score-validation");
    const bytes = new Uint8Array([0, 1, 2, 3]);

    await expect(
      predictionImport.importPredictionMaskForUser(
        {
          predictionRunId,
          userId: ownerId,
          imageId,
          targetType: "SEMANTIC_MASK",
          bytes,
          width: 2,
          height: 2,
          contentType: "application/octet-stream",
          confidenceScore: 1.2,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "CONFIDENCE_OUT_OF_RANGE" });

    await expect(
      predictionImport.importPredictionMaskForUser(
        {
          predictionRunId,
          userId: ownerId,
          imageId,
          targetType: "SEMANTIC_MASK",
          bytes,
          width: 2,
          height: 2,
          contentType: "application/octet-stream",
          uncertaintyScore: -0.1,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "UNCERTAINTY_OUT_OF_RANGE" });
  });
});
