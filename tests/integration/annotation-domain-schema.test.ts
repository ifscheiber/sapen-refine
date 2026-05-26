import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AnnotationArtifactKind,
  ExportTarget,
  PrismaClient,
} from "@prisma/client";

import {
  assertSupportArtifactKind,
  isSupportArtifactKind,
  isSupportLabelDefinition,
} from "@/server/domain/artifacts";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

describe("annotation domain schema baseline", () => {
  let userId: string;
  let projectId: string;
  let imageId: string;
  let labelSchemaVersionId: string;

  beforeAll(async () => {
    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: { email: `domain-${suffix}@test.local`, name: "Domain Test" },
      select: { id: true },
    });
    userId = user.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Domain Test ${suffix}`,
        labelSchemaVersionId,
        createdById: userId,
        members: { create: { userId, role: "OWNER" } },
      },
      select: { id: true },
    });
    projectId = project.id;

    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/domain/${suffix}.png`,
        filename: "domain.png",
        contentType: "image/png",
        size: 128,
        checksum: `sha256:${suffix}`,
        width: 16,
        height: 8,
        validationStatus: "VALIDATED",
        uploadedById: userId,
      },
      select: { id: true },
    });
    imageId = image.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.exportBatch.deleteMany({ where: { projectId } }).catch(() => undefined);
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("has an idempotent default label schema with stable machine labels", async () => {
    await prisma.labelDefinition.upsert({
      where: {
        schemaVersionId_stableId: {
          schemaVersionId: labelSchemaVersionId,
          stableId: "background",
        },
      },
      update: {},
      create: {
        schemaVersionId: labelSchemaVersionId,
        stableId: "background",
        byteValue: 0,
        displayName: "Background",
        semanticMeaning: "Background or non-annotated pixel in a semantic material mask.",
        applicability: "SEMANTIC_MASK",
        isTrainable: false,
      },
    });

    const labels = await prisma.labelDefinition.findMany({
      where: {
        schemaVersionId: labelSchemaVersionId,
        stableId: {
          in: [
            "background",
            "unknown",
            "sapwood",
            "heartwood",
            "copper",
            "slice_support",
            "review_required",
          ],
        },
      },
      select: { stableId: true },
    });

    expect(labels.map((label) => label.stableId).sort()).toEqual([
      "background",
      "copper",
      "heartwood",
      "review_required",
      "sapwood",
      "slice_support",
      "unknown",
    ]);

    const backgroundCount = await prisma.labelDefinition.count({
      where: { schemaVersionId: labelSchemaVersionId, stableId: "background" },
    });
    expect(backgroundCount).toBe(1);
  });

  it("stores each image asset under exactly one annotation project", async () => {
    const image = await prisma.imageAsset.findUniqueOrThrow({
      where: { id: imageId },
      select: { id: true, projectId: true, project: { select: { id: true } } },
    });

    expect(image.projectId).toBe(projectId);
    expect(image.project.id).toBe(projectId);
  });

  it("keeps semantic masks and support masks as distinct artifact families", async () => {
    const semantic = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: "SEMANTIC_MASK",
        scopeKey: "semantic",
        createdById: userId,
      },
    });

    const support = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: "SLICE_SUPPORT_MASK",
        scopeKey: "support",
        createdById: userId,
      },
    });

    expect(semantic.id).not.toBe(support.id);
    expect(isSupportArtifactKind(semantic.kind)).toBe(false);
    expect(isSupportArtifactKind(support.kind)).toBe(true);
  });

  it("does not treat the copper semantic label as slice support geometry", async () => {
    const copper = await prisma.labelDefinition.findFirstOrThrow({
      where: { schemaVersionId: labelSchemaVersionId, stableId: "copper" },
      select: { stableId: true, applicability: true, semanticMeaning: true },
    });

    expect(copper.applicability).toBe("SEMANTIC_MASK");
    expect(isSupportLabelDefinition(copper)).toBe(false);
    expect(() => assertSupportArtifactKind(AnnotationArtifactKind.SEMANTIC_MASK)).toThrow(
      "ARTIFACT_NOT_SUPPORT_GEOMETRY"
    );
  });

  it("stores artifact versions with actor attribution and label schema version", async () => {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: "SEMANTIC_MASK",
        scopeKey: "attributed",
        createdById: userId,
      },
    });

    const version = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        storageKey: `tests/domain/${artifact.id}.msk`,
        size: 128,
        width: 16,
        height: 8,
        format: "u8raw-v1",
        labelSchemaVersionId,
        createdById: userId,
      },
      select: {
        id: true,
        createdById: true,
        labelSchemaVersionId: true,
        reviewState: true,
      },
    });

    expect(version.createdById).toBe(userId);
    expect(version.labelSchemaVersionId).toBe(labelSchemaVersionId);
    expect(version.reviewState).toBe("DRAFT");
  });

  it("lets review/export records point to exact immutable artifact version ids", async () => {
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: "SEMANTIC_MASK",
        scopeKey: "approved-export",
        createdById: userId,
      },
    });

    const version = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        reviewState: "APPROVED",
        storageKey: `tests/domain/${artifact.id}-approved.msk`,
        size: 128,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: userId,
      },
    });

    const review = await prisma.reviewDecision.create({
      data: {
        projectId,
        artifactVersionId: version.id,
        fromState: "SUBMITTED",
        toState: "APPROVED",
        reviewedById: userId,
      },
    });

    const exportBatch = await prisma.exportBatch.create({
      data: {
        projectId,
        target: ExportTarget.SEMANTIC_SEGMENTATION,
        exportedById: userId,
        items: {
          create: {
            role: "semantic-mask",
            imageId,
            artifactVersionId: version.id,
          },
        },
      },
      include: { items: true },
    });

    expect(review.artifactVersionId).toBe(version.id);
    expect(exportBatch.items[0]?.artifactVersionId).toBe(version.id);
  });
});
