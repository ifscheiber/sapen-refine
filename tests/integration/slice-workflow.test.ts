import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type {
  assertSupportArtifactVersionForImage as AssertSupportArtifactVersionForImage,
  createSupportMaskVersionForUser as CreateSupportMaskVersionForUser,
  ensureDefaultSliceInstanceForUser as EnsureDefaultSliceInstanceForUser,
  setSliceClassificationForUser as SetSliceClassificationForUser,
} from "@/server/domain/slices";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let ensureDefaultSliceInstanceForUser: typeof EnsureDefaultSliceInstanceForUser;
let createSupportMaskVersionForUser: typeof CreateSupportMaskVersionForUser;
let setSliceClassificationForUser: typeof SetSliceClassificationForUser;
let assertSupportArtifactVersionForImage: typeof AssertSupportArtifactVersionForImage;

describe("slice support workflow", () => {
  let ownerId: string;
  let viewerId: string;
  let projectId: string;
  let imageId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    ({
      assertSupportArtifactVersionForImage,
      createSupportMaskVersionForUser,
      ensureDefaultSliceInstanceForUser,
      setSliceClassificationForUser,
    } = await import("@/server/domain/slices"));

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `slice-owner-${suffix}@test.local`, name: "Slice Owner" },
      select: { id: true },
    });
    const viewer = await prisma.user.create({
      data: { email: `slice-viewer-${suffix}@test.local`, name: "Slice Viewer" },
      select: { id: true },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Slice Test ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: {
          create: [
            { userId: ownerId, role: "OWNER" },
            { userId: viewerId, role: "VIEWER" },
          ],
        },
      },
      select: { id: true },
    });
    projectId = project.id;

    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/slice/${suffix}.png`,
        filename: "slice.png",
        contentType: "image/png",
        size: 128,
        checksum: `sha256:${suffix}`,
        width: 16,
        height: 8,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    imageId = image.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    if (ownerId) {
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    }
    if (viewerId) {
      await prisma.user.delete({ where: { id: viewerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("creates and reads a default slice instance for an editable project member", async () => {
    const state = await ensureDefaultSliceInstanceForUser({ imageId, userId: ownerId }, prisma);

    expect(state.sliceInstance?.id).toBeTruthy();
    expect(state.sliceInstance?.supportArtifactVersionId).toBeNull();
    expect(state.canEdit).toBe(true);
    expect(state.supportLabels).toEqual({ background: 0, sliceSupport: 10 });
  });

  it("commits support masks as SLICE_SUPPORT_MASK artifact versions and links the slice", async () => {
    const semantic = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: "SEMANTIC_MASK",
        scopeKey: "semantic-test",
        createdById: ownerId,
      },
    });

    await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: semantic.id,
        version: 1,
        storageKey: `tests/slice/${suffix}-semantic.msk`,
        size: 128,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: ownerId,
      },
    });

    const state = await createSupportMaskVersionForUser(
      {
        imageId,
        userId: ownerId,
        storageKey: `tests/slice/${suffix}-support.msk`,
        contentType: "application/octet-stream",
        size: 128,
        checksum: "sha256:support",
        width: 16,
        height: 8,
        format: "u8raw-v1",
      },
      prisma,
    );

    expect(state.latestSupportMask?.version).toBe(1);
    expect(state.latestSupportMask?.createdBy?.id).toBe(ownerId);
    expect(state.sliceInstance?.supportArtifactVersionId).toBe(state.latestSupportMask?.id);

    const supportVersion = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: state.latestSupportMask?.id },
      select: {
        labelSchemaVersionId: true,
        createdById: true,
        width: true,
        height: true,
        artifact: { select: { kind: true, scopeKey: true } },
      },
    });

    expect(supportVersion.artifact.kind).toBe("SLICE_SUPPORT_MASK");
    expect(supportVersion.artifact.scopeKey).toBe("default");
    expect(supportVersion.createdById).toBe(ownerId);
    expect(supportVersion.labelSchemaVersionId).toBe(labelSchemaVersionId);
    expect(supportVersion.width).toBe(16);
    expect(supportVersion.height).toBe(8);

    const artifactKinds = await prisma.annotationArtifact.findMany({
      where: { imageId },
      select: { kind: true },
    });
    expect(artifactKinds.map((artifact) => artifact.kind).sort()).toContain("SEMANTIC_MASK");
    expect(artifactKinds.map((artifact) => artifact.kind).sort()).toContain("SLICE_SUPPORT_MASK");
  });

  it("persists slice classifications as attributed draft versions", async () => {
    await setSliceClassificationForUser(
      { imageId, userId: ownerId, class: "UNKNOWN" },
      prisma,
    );
    const state = await setSliceClassificationForUser(
      { imageId, userId: ownerId, class: "COPPER_SLICE" },
      prisma,
    );

    expect(state.latestClassification?.class).toBe("COPPER_SLICE");
    expect(state.latestClassification?.version).toBe(2);
    expect(state.latestClassification?.createdBy?.id).toBe(ownerId);

    const persisted = await prisma.sliceClassificationVersion.findUniqueOrThrow({
      where: { id: state.latestClassification?.id },
      select: {
        projectId: true,
        imageId: true,
        createdById: true,
        labelSchemaVersionId: true,
        reviewState: true,
      },
    });
    expect(persisted.projectId).toBe(projectId);
    expect(persisted.imageId).toBe(imageId);
    expect(persisted.createdById).toBe(ownerId);
    expect(persisted.labelSchemaVersionId).toBe(labelSchemaVersionId);
    expect(persisted.reviewState).toBe("DRAFT");
  });

  it("rejects viewers and obvious support-mask dimension mismatches", async () => {
    await expect(
      ensureDefaultSliceInstanceForUser({ imageId, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      createSupportMaskVersionForUser(
        {
          imageId,
          userId: ownerId,
          storageKey: `tests/slice/${suffix}-bad-size.msk`,
          size: 127,
          width: 16,
          height: 8,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "MASK_SIZE_MISMATCH" });
  });

  it("rejects semantic artifact versions as support geometry", async () => {
    const semantic = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId,
        kind: "SEMANTIC_MASK",
        scopeKey: "not-support",
        createdById: ownerId,
      },
    });
    const semanticVersion = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: semantic.id,
        version: 1,
        storageKey: `tests/slice/${suffix}-not-support.msk`,
        size: 128,
        width: 16,
        height: 8,
        labelSchemaVersionId,
        createdById: ownerId,
      },
      select: { id: true },
    });

    await expect(
      assertSupportArtifactVersionForImage(
        { versionId: semanticVersion.id, imageId, projectId },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "ARTIFACT_NOT_SUPPORT_GEOMETRY" });
  });
});
