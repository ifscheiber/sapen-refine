import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  PrismaClient,
  type ArtifactReviewState,
} from "@prisma/client";
import type JSZipConstructor from "jszip";

import { Labels } from "@/mask/labels";
import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

type ApiExportTarget = import("@/server/domain/exports").ApiExportTarget;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let exportsDomain: typeof import("@/server/domain/exports");
let exportJobs: typeof import("@/server/domain/exportJobs");
let storage: typeof import("@/server/storage/s3");
let JSZip: typeof JSZipConstructor;

function minimalPng(name: string) {
  const bytes = new Uint8Array(24 + name.length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[19] = 4;
  bytes[23] = 4;
  bytes.set(new TextEncoder().encode(name), 24);
  return bytes;
}

describe("training export workflow", () => {
  let ownerId: string;
  let labelerId: string;
  let viewerId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    exportsDomain = await import("@/server/domain/exports");
    exportJobs = await import("@/server/domain/exportJobs");
    storage = await import("@/server/storage/s3");
    JSZip = (await import("jszip")).default;

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [owner, labeler, viewer] = await Promise.all([
      prisma.user.create({
        data: { email: `export-owner-${suffix}@test.local`, name: "Export Owner" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `export-labeler-${suffix}@test.local`, name: "Export Labeler" },
        select: { id: true },
      }),
      prisma.user.create({
        data: { email: `export-viewer-${suffix}@test.local`, name: "Export Viewer" },
        select: { id: true },
      }),
    ]);
    ownerId = owner.id;
    labelerId = labeler.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Export Test ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: {
          create: [
            { userId: ownerId, role: "OWNER" },
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
    if (storage && suffix) {
      const prefixes = [
        `tests/export/${suffix}/`,
        ...(projectId ? [`projects/${projectId}/exports/`] : []),
      ];
      for (const prefix of prefixes) {
        const objects = await storage.listObjectsByPrefix(prefix, 1000).catch(() => []);
        await Promise.all(objects.map((object) => storage.deleteObjectBestEffort(object.key)));
      }
    }
    if (projectId) {
      await prisma.exportBatch.deleteMany({ where: { projectId } }).catch(() => undefined);
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    await Promise.all(
      [ownerId, labelerId, viewerId]
        .filter(Boolean)
        .map((id) => prisma.user.delete({ where: { id } }).catch(() => undefined)),
    );
    await prisma.$disconnect();
    await pool.end();
  });

  async function createImage(name: string, withMetadata = true) {
    const imageBytes = minimalPng(name);
    const storageKey = `tests/export/${suffix}/${name}.png`;
    await storage.putObject(storageKey, imageBytes, "image/png");

    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey,
        filename: `${name}.png`,
        contentType: "image/png",
        size: imageBytes.byteLength,
        checksum: sha256Checksum(imageBytes),
        width: 4,
        height: 4,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
        ...(withMetadata
          ? {
              acquisitionMetadata: {
                create: {
                  cameraDevice: "Test camera",
                  lightingSetup: "Test light",
                },
              },
              sampleMetadata: {
                create: {
                  tNumber: `T-${name}`,
                  specimenIdentifier: `Specimen ${name}`,
                  sliceIndex: 1,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    return image.id;
  }

  async function createArtifactVersion(params: {
    imageId: string;
    kind: AnnotationArtifactKind;
    reviewState?: ArtifactReviewState;
    name: string;
  }) {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId: params.imageId,
        kind: params.kind,
        scopeKey: "default",
        createdById: labelerId,
      },
      select: { id: true },
    });

    const bytes = new Uint8Array(16).fill(params.kind === "SLICE_SUPPORT_MASK" ? 10 : 3);
    const storageKey = `tests/export/${suffix}/${params.name}.u8raw`;
    await storage.putObject(storageKey, bytes, "application/octet-stream");

    const version = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        reviewState: params.reviewState ?? "APPROVED",
        storageKey,
        contentType: "application/octet-stream",
        size: bytes.byteLength,
        checksum: sha256Checksum(bytes),
        width: 4,
        height: 4,
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });

    if ((params.reviewState ?? "APPROVED") === "APPROVED") {
      await prisma.reviewDecision.create({
        data: {
          projectId,
          artifactVersionId: version.id,
          fromState: "SUBMITTED",
          toState: "APPROVED",
          reviewedById: ownerId,
          comments: "Approved for export test",
        },
      });
    }

    return version.id;
  }

  async function createClassificationVersion(params: {
    imageId: string;
    reviewState?: ArtifactReviewState;
    name: string;
  }) {
    const slice = await prisma.sliceInstance.create({
      data: { projectId, imageId: params.imageId, createdById: labelerId },
      select: { id: true },
    });
    const classification = await prisma.sliceClassificationVersion.create({
      data: {
        projectId,
        imageId: params.imageId,
        sliceInstanceId: slice.id,
        version: 1,
        class: "COPPER_SLICE",
        reviewState: params.reviewState ?? "APPROVED",
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });

    if ((params.reviewState ?? "APPROVED") === "APPROVED") {
      await prisma.reviewDecision.create({
        data: {
          projectId,
          sliceClassificationVersionId: classification.id,
          fromState: "SUBMITTED",
          toState: "APPROVED",
          reviewedById: ownerId,
          comments: `Approved ${params.name}`,
        },
      });
    }

    return classification.id;
  }

  async function createCropFixture(name: string) {
    const imageId = await createImage(`crop-${name}`);
    const slice = await prisma.sliceInstance.create({
      data: { projectId, imageId, createdById: labelerId },
      select: { id: true },
    });
    const bbox = await prisma.sliceBoundingBoxVersion.create({
      data: {
        projectId,
        imageId,
        sliceInstanceId: slice.id,
        version: 1,
        status: "ACTIVE",
        x: 0,
        y: 0,
        width: 4,
        height: 4,
        coordinateSpace: "SOURCE_IMAGE_PIXEL",
        createdById: labelerId,
      },
      select: { id: true },
    });
    const cropBytes = minimalPng(`derived-crop-${name}`);
    const cropStorageKey = `tests/export/${suffix}/derived-crop-${name}.png`;
    await storage.putObject(cropStorageKey, cropBytes, "image/png");
    const crop = await prisma.derivedSliceCrop.create({
      data: {
        projectId,
        sourceImageId: imageId,
        sourceImageChecksum: sha256Checksum(minimalPng(`crop-${name}`)),
        sourceImageWidth: 4,
        sourceImageHeight: 4,
        sliceInstanceId: slice.id,
        bboxVersionId: bbox.id,
        version: 1,
        sourceX: 0,
        sourceY: 0,
        sourceWidth: 4,
        sourceHeight: 4,
        cropX: 0,
        cropY: 0,
        cropWidth: 4,
        cropHeight: 4,
        paddingRequestedPx: 32,
        paddingAppliedLeftPx: 0,
        paddingAppliedTopPx: 0,
        paddingAppliedRightPx: 0,
        paddingAppliedBottomPx: 0,
        paddingClipped: true,
        coordinateSpace: "CROP_PIXEL",
        transformToSourceJson: {
          version: "integer-translation-v1",
          sourceOrigin: { x: 0, y: 0 },
          cropCoordinateSpace: "CROP_PIXEL",
          sourceCoordinateSpace: "SOURCE_IMAGE_PIXEL",
        },
        storageKey: cropStorageKey,
        checksum: sha256Checksum(cropBytes),
        contentType: "image/png",
        byteSize: cropBytes.byteLength,
        format: "png",
        createdById: labelerId,
      },
      select: {
        id: true,
        sourceImageId: true,
        sliceInstanceId: true,
        cropWidth: true,
        cropHeight: true,
      },
    });

    return { imageId, sliceInstanceId: slice.id, bboxVersionId: bbox.id, crop };
  }

  async function createCropArtifactVersion(params: {
    crop: Awaited<ReturnType<typeof createCropFixture>>["crop"];
    kind: AnnotationArtifactKind;
    name: string;
    reviewState?: ArtifactReviewState;
    supportMaskVersionId?: string;
    semanticMode?: "SAP_HEARTWOOD" | "COPPER";
  }) {
    const scopeKey =
      params.kind === AnnotationArtifactKind.SLICE_SUPPORT_MASK
        ? `crop-support:${params.crop.id}`
        : `crop-semantic:${params.crop.id}:${params.semanticMode ?? "COPPER"}`;
    const artifact = await prisma.annotationArtifact.upsert({
      where: {
        imageId_kind_scopeKey: {
          imageId: params.crop.sourceImageId,
          kind: params.kind,
          scopeKey,
        },
      },
      update: {},
      create: {
        projectId,
        imageId: params.crop.sourceImageId,
        kind: params.kind,
        scopeKey,
        createdById: labelerId,
      },
      select: { id: true },
    });
    const latest = await prisma.annotationArtifactVersion.aggregate({
      where: { artifactId: artifact.id },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;
    const semanticValue =
      params.semanticMode === "SAP_HEARTWOOD" ? Labels.SAPWOOD : Labels.COPPER;
    const bytes = new Uint8Array(params.crop.cropWidth * params.crop.cropHeight).fill(
      params.kind === AnnotationArtifactKind.SLICE_SUPPORT_MASK ? Labels.SLICE_SUPPORT : semanticValue,
    );
    const storageKey = `tests/export/${suffix}/${params.crop.id}-${params.name}.u8raw`;
    await storage.putObject(storageKey, bytes, "application/octet-stream");

    const artifactVersion = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version,
        reviewState: params.reviewState ?? "APPROVED",
        storageKey,
        contentType: "application/octet-stream",
        size: bytes.byteLength,
        checksum: sha256Checksum(bytes),
        width: params.crop.cropWidth,
        height: params.crop.cropHeight,
        coordinateSpace: "CROP_PIXEL",
        coordinateTransform: {
          derivedCropId: params.crop.id,
          cropCoordinateSpace: "CROP_PIXEL",
          sourceCoordinateSpace: "SOURCE_IMAGE_PIXEL",
        },
        labelSchemaVersionId,
        derivedCropId: params.crop.id,
        sliceInstanceId: params.crop.sliceInstanceId,
        supportMaskVersionId: params.supportMaskVersionId,
        cropSemanticMode:
          params.kind === AnnotationArtifactKind.SEMANTIC_MASK ? params.semanticMode ?? "COPPER" : undefined,
        createdById: labelerId,
      },
      select: { id: true },
    });

    if ((params.reviewState ?? "APPROVED") === "APPROVED") {
      await prisma.reviewDecision.create({
        data: {
          projectId,
          artifactVersionId: artifactVersion.id,
          fromState: "SUBMITTED",
          toState: "APPROVED",
          reviewedById: ownerId,
          comments: `Approved crop artifact ${params.name}`,
        },
      });
    }

    return artifactVersion.id;
  }

  async function createCropClassificationVersion(params: {
    crop: Awaited<ReturnType<typeof createCropFixture>>["crop"];
    semanticMaskVersionId: string;
    supportMaskVersionId?: string | null;
    class?: "SAP_HEARTWOOD_SLICE" | "COPPER_SLICE";
    reviewState?: ArtifactReviewState;
    name: string;
  }) {
    const latest = await prisma.sliceClassificationVersion.aggregate({
      where: { sliceInstanceId: params.crop.sliceInstanceId },
      _max: { version: true },
    });
    const classification = await prisma.sliceClassificationVersion.create({
      data: {
        projectId,
        imageId: params.crop.sourceImageId,
        sliceInstanceId: params.crop.sliceInstanceId,
        version: (latest._max.version ?? 0) + 1,
        class: params.class ?? "COPPER_SLICE",
        reviewState: params.reviewState ?? "APPROVED",
        source: "AUTO_FROM_SEMANTIC_MASK",
        derivationReason:
          params.class === "SAP_HEARTWOOD_SLICE" ? "SAP_HEARTWOOD_PIXELS_PRESENT" : "COPPER_PIXELS_PRESENT",
        derivedFromSemanticMaskVersionId: params.semanticMaskVersionId,
        derivedFromSupportMaskVersionId: params.supportMaskVersionId,
        derivedFromCropId: params.crop.id,
        labelSchemaVersionId,
        createdById: labelerId,
      },
      select: { id: true },
    });

    if ((params.reviewState ?? "APPROVED") === "APPROVED") {
      await prisma.reviewDecision.create({
        data: {
          projectId,
          sliceClassificationVersionId: classification.id,
          fromState: "SUBMITTED",
          toState: "APPROVED",
          reviewedById: ownerId,
          comments: `Approved crop classification ${params.name}`,
        },
      });
    }

    return classification.id;
  }

  async function createManualCropClassificationVersion(params: {
    crop: Awaited<ReturnType<typeof createCropFixture>>["crop"];
    name: string;
    reviewState?: ArtifactReviewState;
    createdAt?: Date;
  }) {
    const latest = await prisma.sliceClassificationVersion.aggregate({
      where: { sliceInstanceId: params.crop.sliceInstanceId },
      _max: { version: true },
    });
    const classification = await prisma.sliceClassificationVersion.create({
      data: {
        projectId,
        imageId: params.crop.sourceImageId,
        sliceInstanceId: params.crop.sliceInstanceId,
        version: (latest._max.version ?? 0) + 1,
        class: "COPPER_SLICE",
        reviewState: params.reviewState ?? "APPROVED",
        source: "MANUAL",
        labelSchemaVersionId,
        createdById: labelerId,
        ...(params.createdAt ? { createdAt: params.createdAt } : {}),
      },
      select: { id: true },
    });

    if ((params.reviewState ?? "APPROVED") === "APPROVED") {
      await prisma.reviewDecision.create({
        data: {
          projectId,
          sliceClassificationVersionId: classification.id,
          fromState: "SUBMITTED",
          toState: "APPROVED",
          reviewedById: ownerId,
          comments: `Approved manual crop classification ${params.name}`,
        },
      });
    }

    return classification.id;
  }

  it("creates a combined export with exact approved version references and package files", async () => {
    const imageId = await createImage("complete");
    const semanticVersionId = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      name: "complete-semantic",
    });
    const supportVersionId = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "complete-support",
    });
    const classificationVersionId = await createClassificationVersion({
      imageId,
      name: "complete-classification",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    expect(readiness.summary.approvedSemanticMasks).toBeGreaterThanOrEqual(1);
    expect(readiness.summary.approvedSupportMasks).toBeGreaterThanOrEqual(1);
    expect(readiness.summary.approvedClassifications).toBeGreaterThanOrEqual(1);

    await expect(
      exportsDomain.resolveProjectExportReadiness({ projectId, userId: labelerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      exportsDomain.resolveProjectExportReadiness({ projectId, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const exportBatch = await createProcessedTrainingExport(["combined"]);
    expect(exportBatch.downloads?.manifest).toContain(`/api/exports/${exportBatch.id}/download`);
    expect(JSON.stringify(exportBatch)).not.toContain("tests/export/");

    const persistedItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id },
      select: {
        role: true,
        imageId: true,
        artifactVersionId: true,
        sliceClassificationVersionId: true,
        predictionProvenanceId: true,
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
          predictionProvenanceId: null,
          derivedCropId: null,
        }),
        expect.objectContaining({
          role: "semantic-mask",
          artifactVersionId: semanticVersionId,
          sliceClassificationVersionId: null,
          predictionProvenanceId: null,
          derivedCropId: null,
        }),
        expect.objectContaining({
          role: "support-mask",
          artifactVersionId: supportVersionId,
          sliceClassificationVersionId: null,
          predictionProvenanceId: null,
          derivedCropId: null,
        }),
        expect.objectContaining({
          role: "slice-classification",
          artifactVersionId: null,
          sliceClassificationVersionId: classificationVersionId,
          predictionProvenanceId: null,
          derivedCropId: null,
        }),
      ]),
    );

    const manifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const item = manifest.items.find((entry: { image: { id: string } }) => entry.image.id === imageId);
    expect(item.semanticMask.artifactVersionId).toBe(semanticVersionId);
    expect(item.supportMask.artifactVersionId).toBe(supportVersionId);
    expect(item.classification.classificationVersionId).toBe(classificationVersionId);
    expect(item.semanticMask.path).toBe(`masks/semantic/${imageId}.u8raw`);
    expect(item.supportMask.path).toBe(`masks/support/${imageId}.u8raw`);
    expect(JSON.stringify(manifest)).not.toContain("tests/export/");

    const packageFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "package" },
      prisma,
    );
    const zip = await JSZip.loadAsync(packageFile.bytes);
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file(`images/${imageId}.png`)).toBeTruthy();
    expect(zip.file(`masks/semantic/${imageId}.u8raw`)).toBeTruthy();
    expect(zip.file(`masks/support/${imageId}.u8raw`)).toBeTruthy();

    const auditActions = await prisma.auditLog.findMany({
      where: { entity: "ExportBatch", entityId: exportBatch.id },
      select: { action: true },
    });
    expect(auditActions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["EXPORT_CREATED", "EXPORT_DOWNLOADED"]),
    );
  });

  it("claims a queued training export once across concurrent processor passes", async () => {
    const imageId = await createImage("concurrent-claim");
    await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      name: "concurrent-claim-semantic",
    });

    const queued = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["semantic_segmentation"] },
      prisma,
    );
    expect(queued.status).toBe("PENDING");

    const [first, second] = await Promise.all([
      exportJobs.processDueExportJobsForUser({
        userId: ownerId,
        input: { maxJobs: 1, processorRunId: `claim-a-${queued.id}` },
      }),
      exportJobs.processDueExportJobsForUser({
        userId: ownerId,
        input: { maxJobs: 1, processorRunId: `claim-b-${queued.id}` },
      }),
    ]);

    expect(first.completedCount + second.completedCount).toBe(1);
    const completed = await exportsDomain.getTrainingExportForUser(
      { exportId: queued.id, userId: ownerId },
      prisma,
    );
    expect(completed.status).toBe("COMPLETED");
    const createdAuditCount = await prisma.auditLog.count({
      where: { entity: "ExportBatch", entityId: queued.id, action: "EXPORT_CREATED" },
    });
    expect(createdAuditCount).toBe(1);
  });

  it("creates a crop training export with crop lineage, transform metadata, and package files", async () => {
    const { crop, bboxVersionId } = await createCropFixture("ready");
    const supportVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "ready-support",
    });
    const semanticVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      supportMaskVersionId: supportVersionId,
      semanticMode: "COPPER",
      name: "ready-semantic",
    });
    const classificationVersionId = await createCropClassificationVersion({
      crop,
      semanticMaskVersionId: semanticVersionId,
      supportMaskVersionId: supportVersionId,
      name: "ready-classification",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const cropCandidate = readiness.cropCandidates.find((candidate) => candidate.crop.id === crop.id);
    expect(cropCandidate).toMatchObject({
      readinessStatus: "READY",
      readinessReasons: [],
    });

    const exportBatch = await createProcessedTrainingExport(["crop_training"]);
    expect(exportBatch.target).toBe("CROP_TRAINING");
    expect(JSON.stringify(exportBatch)).not.toContain("tests/export/");

    const persistedItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id, derivedCropId: crop.id },
      select: {
        role: true,
        imageId: true,
        artifactVersionId: true,
        sliceClassificationVersionId: true,
        predictionProvenanceId: true,
        derivedCropId: true,
      },
    });
    expect(persistedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "original-image",
          artifactVersionId: null,
          sliceClassificationVersionId: null,
          predictionProvenanceId: null,
          derivedCropId: crop.id,
        }),
        expect.objectContaining({
          role: "derived-crop",
          artifactVersionId: null,
          sliceClassificationVersionId: null,
          predictionProvenanceId: null,
          derivedCropId: crop.id,
        }),
        expect.objectContaining({
          role: "crop-support-mask",
          artifactVersionId: supportVersionId,
          sliceClassificationVersionId: null,
          predictionProvenanceId: null,
          derivedCropId: crop.id,
        }),
        expect.objectContaining({
          role: "crop-semantic-mask",
          artifactVersionId: semanticVersionId,
          sliceClassificationVersionId: null,
          predictionProvenanceId: null,
          derivedCropId: crop.id,
        }),
        expect.objectContaining({
          role: "crop-slice-classification",
          artifactVersionId: null,
          sliceClassificationVersionId: classificationVersionId,
          predictionProvenanceId: null,
          derivedCropId: crop.id,
        }),
      ]),
    );

    const manifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    expect(manifest.manifestVersion).toBe("sapen-annotate-crop-training-export-v1");
    expect(manifest.selection).toMatchObject({
      targets: ["crop_training"],
      cropCoordinateSpace: "CROP_PIXEL",
      originalCoordinateMasks: false,
    });
    const item = manifest.cropItems.find(
      (entry: { derivedCrop: { id: string } }) => entry.derivedCrop.id === crop.id,
    );
    expect(item).toMatchObject({
      sliceInstanceId: crop.sliceInstanceId,
      sliceBoundingBox: { bboxVersionId },
      readinessStatus: "READY",
      readinessReasons: [],
      derivedCrop: {
        id: crop.id,
        path: `crops/${crop.id}.png`,
        coordinateSpace: "CROP_PIXEL",
        padding: { requestedPx: 32, clipped: true },
        transformToSource: {
          version: "integer-translation-v1",
          sourceOrigin: { x: 0, y: 0 },
        },
      },
      supportMask: {
        artifactVersionId: supportVersionId,
        path: `masks/support-crop/${crop.sliceInstanceId}_${supportVersionId}.u8raw`,
        coordinateSpace: "CROP_PIXEL",
        derivedCropId: crop.id,
        sliceInstanceId: crop.sliceInstanceId,
        reviewState: "APPROVED",
      },
      supportGeometry: {
        source: "EXPLICIT_SUPPORT_MASK",
        supportMaskVersionId: supportVersionId,
        semanticMaskVersionId: null,
      },
      semanticMask: {
        artifactVersionId: semanticVersionId,
        path: `masks/semantic-crop/${crop.sliceInstanceId}_${semanticVersionId}.u8raw`,
        coordinateSpace: "CROP_PIXEL",
        derivedCropId: crop.id,
        sliceInstanceId: crop.sliceInstanceId,
        supportMaskVersionId: supportVersionId,
        cropSemanticMode: "COPPER",
        reviewState: "APPROVED",
      },
      classification: {
        classificationVersionId,
        source: "AUTO_FROM_SEMANTIC_MASK",
        derivationReason: "COPPER_PIXELS_PRESENT",
        derivedFromSemanticMaskVersionId: semanticVersionId,
        derivedFromSupportMaskVersionId: supportVersionId,
        derivedFromCropId: crop.id,
        reviewState: "APPROVED",
      },
    });
    expect(JSON.stringify(manifest)).not.toContain("tests/export/");
    expect(JSON.stringify(manifest)).not.toContain("storageKey");

    const packageFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "package" },
      prisma,
    );
    const zip = await JSZip.loadAsync(packageFile.bytes);
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file(item.originalImage.path)).toBeTruthy();
    expect(zip.file(item.derivedCrop.path)).toBeTruthy();
    expect(zip.file(item.supportMask.path)).toBeTruthy();
    expect(zip.file(item.semanticMask.path)).toBeTruthy();
  });

  it("exports supportless Sap/Heartwood crops with semantic foreground support geometry", async () => {
    const { crop } = await createCropFixture("supportless-sap");
    const semanticVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      semanticMode: "SAP_HEARTWOOD",
      name: "supportless-sap-semantic",
    });
    const classificationVersionId = await createCropClassificationVersion({
      crop,
      semanticMaskVersionId: semanticVersionId,
      supportMaskVersionId: null,
      class: "SAP_HEARTWOOD_SLICE",
      name: "supportless-sap-classification",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const cropCandidate = readiness.cropCandidates.find((candidate) => candidate.crop.id === crop.id);
    expect(cropCandidate).toMatchObject({
      readinessStatus: "READY",
      readinessReasons: [],
      supportMask: null,
      supportGeometrySource: "SEMANTIC_FOREGROUND",
    });

    const exportBatch = await createProcessedTrainingExport(["crop_training"]);
    const manifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const item = manifest.cropItems.find(
      (entry: { derivedCrop: { id: string } }) => entry.derivedCrop.id === crop.id,
    );
    expect(item).toMatchObject({
      supportGeometry: {
        source: "SEMANTIC_FOREGROUND",
        supportMaskVersionId: null,
        semanticMaskVersionId: semanticVersionId,
      },
      supportMask: null,
      semanticMask: {
        artifactVersionId: semanticVersionId,
        supportMaskVersionId: null,
        cropSemanticMode: "SAP_HEARTWOOD",
      },
      classification: {
        classificationVersionId,
        derivedFromSemanticMaskVersionId: semanticVersionId,
        derivedFromSupportMaskVersionId: null,
        derivedFromCropId: crop.id,
      },
    });

    const persistedItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id, derivedCropId: crop.id },
      select: { role: true },
    });
    expect(persistedItems.map((entry) => entry.role)).not.toContain("crop-support-mask");

    const packageFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "package" },
      prisma,
    );
    const zip = await JSZip.loadAsync(packageFile.bytes);
    expect(zip.file(item.semanticMask.path)).toBeTruthy();
  });

  it("marks incomplete and unapproved crop candidates as non-ground-truth skips", async () => {
    const incomplete = await createCropFixture("missing-components");
    const draft = await createCropFixture("draft-components");
    const draftSupportId = await createCropArtifactVersion({
      crop: draft.crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      reviewState: "DRAFT",
      name: "draft-support",
    });
    const draftSemanticId = await createCropArtifactVersion({
      crop: draft.crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      reviewState: "SUBMITTED",
      supportMaskVersionId: draftSupportId,
      semanticMode: "COPPER",
      name: "draft-semantic",
    });
    await createCropClassificationVersion({
      crop: draft.crop,
      semanticMaskVersionId: draftSemanticId,
      supportMaskVersionId: draftSupportId,
      reviewState: "DRAFT",
      name: "draft-classification",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const incompleteCandidate = readiness.cropCandidates.find(
      (candidate) => candidate.crop.id === incomplete.crop.id,
    );
    expect(incompleteCandidate).toMatchObject({
      readinessStatus: "NOT_READY",
      readinessReasons: expect.arrayContaining([
        "MISSING_SEMANTIC_MASK",
        "MISSING_CLASSIFICATION",
      ]),
    });
    const draftCandidate = readiness.cropCandidates.find((candidate) => candidate.crop.id === draft.crop.id);
    expect(draftCandidate).toMatchObject({
      readinessStatus: "PARTIAL",
      readinessReasons: expect.arrayContaining([
        "SUPPORT_NOT_APPROVED",
        "SEMANTIC_NOT_APPROVED",
        "AUTO_CLASSIFICATION_NEEDS_REVIEW",
      ]),
    });

    const exportBatch = await createProcessedTrainingExport(["crop_training"]);
    const manifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const skippedIds = manifest.skippedCropItems.map((entry: { derivedCropId: string }) => entry.derivedCropId);
    expect(skippedIds).toContain(incomplete.crop.id);
    expect(skippedIds).toContain(draft.crop.id);
    expect(manifest.cropItems.map((entry: { derivedCrop: { id: string } }) => entry.derivedCrop.id)).not.toContain(
      draft.crop.id,
    );
  });

  it("marks crop candidates with selected-version lineage mismatches as review-required", async () => {
    const { crop } = await createCropFixture("lineage-mismatch");
    const originalSupportId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "lineage-support-v1",
    });
    const semanticVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      supportMaskVersionId: originalSupportId,
      semanticMode: "COPPER",
      name: "lineage-semantic",
    });
    await createCropClassificationVersion({
      crop,
      semanticMaskVersionId: semanticVersionId,
      supportMaskVersionId: originalSupportId,
      name: "lineage-classification",
    });
    await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "lineage-support-v2",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    const cropCandidate = readiness.cropCandidates.find((candidate) => candidate.crop.id === crop.id);
    expect(cropCandidate).toMatchObject({
      readinessStatus: "REVIEW_REQUIRED",
      readinessReasons: expect.arrayContaining([
        "SUPPORT_SEMANTIC_MISMATCH",
        "CLASSIFICATION_SEMANTIC_MISMATCH",
      ]),
    });

    const exportBatch = await createProcessedTrainingExport(["crop_training"]);
    const manifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    expect(manifest.skippedCropItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          derivedCropId: crop.id,
          readinessStatus: "REVIEW_REQUIRED",
          readinessReasons: expect.arrayContaining([
            "SUPPORT_SEMANTIC_MISMATCH",
            "CLASSIFICATION_SEMANTIC_MISMATCH",
          ]),
        }),
      ]),
    );
  });

  it("accepts current approved manual crop classifications and rejects stale manual classifications", async () => {
    const current = await createCropFixture("manual-current");
    const currentSupportId = await createCropArtifactVersion({
      crop: current.crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "manual-current-support",
    });
    await createCropArtifactVersion({
      crop: current.crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      supportMaskVersionId: currentSupportId,
      semanticMode: "COPPER",
      name: "manual-current-semantic",
    });
    const currentManualId = await createManualCropClassificationVersion({
      crop: current.crop,
      name: "manual-current",
      createdAt: new Date(Date.now() + 1_000),
    });

    const stale = await createCropFixture("manual-stale");
    const staleManualId = await createManualCropClassificationVersion({
      crop: stale.crop,
      name: "manual-stale",
      createdAt: new Date(Date.now() - 60_000),
    });
    const staleSupportId = await createCropArtifactVersion({
      crop: stale.crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "manual-stale-support",
    });
    await createCropArtifactVersion({
      crop: stale.crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      supportMaskVersionId: staleSupportId,
      semanticMode: "COPPER",
      name: "manual-stale-semantic",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    expect(readiness.cropCandidates.find((candidate) => candidate.crop.id === current.crop.id)).toMatchObject({
      classification: { id: currentManualId, source: "MANUAL" },
      readinessStatus: "READY",
      readinessReasons: [],
    });
    expect(readiness.cropCandidates.find((candidate) => candidate.crop.id === stale.crop.id)).toMatchObject({
      classification: { id: staleManualId, source: "MANUAL" },
      readinessStatus: "REVIEW_REQUIRED",
      readinessReasons: expect.arrayContaining(["CLASSIFICATION_STALE"]),
    });
  });

  async function processQueuedTrainingExport(exportId: string) {
    await exportJobs.processDueExportJobsForUser({
      userId: ownerId,
      input: { maxJobs: 10, processorRunId: `test-${exportId}` },
    });
    return exportsDomain.getTrainingExportForUser({ exportId, userId: ownerId }, prisma);
  }

  async function createProcessedTrainingExport(targets: ApiExportTarget[]) {
    const queued = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets },
      prisma,
    );
    expect(queued.status).toBe("PENDING");
    const completed = await processQueuedTrainingExport(queued.id);
    expect(completed.status).toBe("COMPLETED");
    return completed;
  }

  it("marks crop candidates with crop-coordinate mismatches as review-required", async () => {
    const { crop } = await createCropFixture("coordinate-mismatch");
    const supportVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "coordinate-support",
    });
    await prisma.annotationArtifactVersion.update({
      where: { id: supportVersionId },
      data: { coordinateSpace: "IMAGE_PIXEL" },
    });
    const semanticVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      supportMaskVersionId: supportVersionId,
      semanticMode: "COPPER",
      name: "coordinate-semantic",
    });
    await createCropClassificationVersion({
      crop,
      semanticMaskVersionId: semanticVersionId,
      supportMaskVersionId: supportVersionId,
      name: "coordinate-classification",
    });

    const readiness = await exportsDomain.resolveProjectExportReadiness(
      { projectId, userId: ownerId },
      prisma,
    );
    expect(readiness.cropCandidates.find((candidate) => candidate.crop.id === crop.id)).toMatchObject({
      readinessStatus: "REVIEW_REQUIRED",
      readinessReasons: expect.arrayContaining(["COORDINATE_SPACE_MISMATCH"]),
    });
  });

  it("rejects mixed crop and full-image export target selection", () => {
    expect(() =>
      exportsDomain.parseExportTargets(["crop_training", "semantic_segmentation"]),
    ).toThrowError(expect.objectContaining({ code: "EXPORT_TARGET_COMBINATION_INVALID" }));
  });

  it("does not use copper semantic masks as support geometry", async () => {
    const imageId = await createImage("semantic-only");
    const semanticVersionId = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      name: "semantic-only-copper",
    });

    const exportBatch = await createProcessedTrainingExport(["support_segmentation"]);
    const supportItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id, role: "support-mask" },
      select: { artifactVersionId: true },
    });
    expect(supportItems.map((item) => item.artifactVersionId)).not.toContain(semanticVersionId);

    const manifestFile = await exportsDomain.readTrainingExportFileForUser(
      { exportId: exportBatch.id, userId: ownerId, file: "manifest" },
      prisma,
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
    const skipped = manifest.skippedImages.find((entry: { imageId: string }) => entry.imageId === imageId);
    expect(skipped?.warnings).toContain("NO_REQUESTED_APPROVED_DATA");
  });

  it("excludes non-approved versions and blocks non-owner export access", async () => {
    const imageId = await createImage("drafts", false);
    const draftSemanticId = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      reviewState: "DRAFT",
      name: "draft-semantic",
    });
    await createClassificationVersion({
      imageId,
      reviewState: "SUBMITTED",
      name: "submitted-classification",
    });

    await expect(
      exportsDomain.createTrainingExportForUser(
        { projectId, userId: viewerId, targets: ["combined"] },
        prisma,
      ),
    ).rejects.toBeInstanceOf(exportsDomain.TrainingExportError);

    const exportBatch = await createProcessedTrainingExport(["semantic_segmentation"]);
    const exportItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id },
      select: { artifactVersionId: true },
    });
    expect(exportItems.map((item) => item.artifactVersionId)).not.toContain(draftSemanticId);

    await expect(
      exportsDomain.readTrainingExportFileForUser(
        { exportId: exportBatch.id, userId: viewerId, file: "manifest" },
        prisma,
      ),
    ).rejects.toBeInstanceOf(exportsDomain.TrainingExportError);
  });

  it("fails export when selected approved artifact object bytes do not match persisted checksum", async () => {
    const imageId = await createImage("corrupted-artifact-bytes");
    const semanticVersionId = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      name: "corrupted-artifact-semantic",
    });
    const artifactVersion = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: semanticVersionId },
      select: { storageKey: true, checksum: true, size: true },
    });
    await storage.putObject(
      artifactVersion.storageKey,
      new Uint8Array([0xff, 0x00, 0xff]),
      "application/octet-stream",
    );

    const queued = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["semantic_segmentation"] },
      prisma,
    );
    const failed = await processQueuedTrainingExport(queued.id);
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("EXPORT_OBJECT_INTEGRITY_MISMATCH");

    const failedBatch = await prisma.exportBatch.findFirst({
      where: { projectId, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { warnings: true, errorCode: true },
    });
    expect(failedBatch?.errorCode).toBe("EXPORT_OBJECT_INTEGRITY_MISMATCH");
    expect(failedBatch?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EXPORT_OBJECT_INTEGRITY_MISMATCH",
        }),
      ]),
    );
  });

  it("fails crop training export when derived crop object bytes do not match persisted checksum", async () => {
    const { crop } = await createCropFixture("corrupted-crop-bytes");
    const supportVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SLICE_SUPPORT_MASK,
      name: "corrupted-crop-support",
    });
    const semanticVersionId = await createCropArtifactVersion({
      crop,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      supportMaskVersionId: supportVersionId,
      semanticMode: "COPPER",
      name: "corrupted-crop-semantic",
    });
    await createCropClassificationVersion({
      crop,
      semanticMaskVersionId: semanticVersionId,
      supportMaskVersionId: supportVersionId,
      name: "corrupted-crop-classification",
    });
    const cropRecord = await prisma.derivedSliceCrop.findUniqueOrThrow({
      where: { id: crop.id },
      select: { storageKey: true, checksum: true, byteSize: true },
    });
    await storage.putObject(cropRecord.storageKey, new Uint8Array([0x01, 0x02]), "image/png");

    const queued = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["crop_training"] },
      prisma,
    );
    const failed = await processQueuedTrainingExport(queued.id);
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("EXPORT_OBJECT_INTEGRITY_MISMATCH");
  });

  it("fails export when selected approved artifacts are missing integrity metadata", async () => {
    const imageId = await createImage("missing-integrity");
    await prisma.imageAsset.update({
      where: { id: imageId },
      data: { checksum: null },
    });
    await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      name: "missing-integrity-semantic",
    });

    await expect(
      exportsDomain.createTrainingExportForUser(
        { projectId, userId: ownerId, targets: ["semantic_segmentation"] },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "EXPORT_INTEGRITY_METADATA_MISSING" });
  });
});
