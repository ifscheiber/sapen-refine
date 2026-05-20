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
import { sha256Checksum } from "@/server/uploads/integrity";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let exportsDomain: typeof import("@/server/domain/exports");
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
    if (projectId) {
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

    const exportBatch = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["combined"] },
      prisma,
    );
    expect(exportBatch.status).toBe("COMPLETED");
    expect(exportBatch.downloads?.manifest).toContain(`/api/exports/${exportBatch.id}/download`);
    expect(JSON.stringify(exportBatch)).not.toContain("tests/export/");

    const persistedItems = await prisma.exportItem.findMany({
      where: { exportBatchId: exportBatch.id },
      select: {
        role: true,
        imageId: true,
        artifactVersionId: true,
        sliceClassificationVersionId: true,
      },
    });
    expect(persistedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "image", imageId }),
        expect.objectContaining({ role: "semantic-mask", artifactVersionId: semanticVersionId }),
        expect.objectContaining({ role: "support-mask", artifactVersionId: supportVersionId }),
        expect.objectContaining({
          role: "slice-classification",
          sliceClassificationVersionId: classificationVersionId,
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

  it("does not use copper semantic masks as support geometry", async () => {
    const imageId = await createImage("semantic-only");
    const semanticVersionId = await createArtifactVersion({
      imageId,
      kind: AnnotationArtifactKind.SEMANTIC_MASK,
      name: "semantic-only-copper",
    });

    const exportBatch = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["support_segmentation"] },
      prisma,
    );
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

    const exportBatch = await exportsDomain.createTrainingExportForUser(
      { projectId, userId: ownerId, targets: ["semantic_segmentation"] },
      prisma,
    );
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
