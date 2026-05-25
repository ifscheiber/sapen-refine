import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type {
  confirmImageBBoxSetForUser as ConfirmImageBBoxSetForUser,
  createSliceBoundingBoxForUser as CreateSliceBoundingBoxForUser,
  deleteSliceBoundingBoxForUser as DeleteSliceBoundingBoxForUser,
  listSliceBoundingBoxesForUser as ListSliceBoundingBoxesForUser,
  replaceSliceBoundingBoxForUser as ReplaceSliceBoundingBoxForUser,
} from "@/server/domain/sliceBboxes";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let createSliceBoundingBoxForUser: typeof CreateSliceBoundingBoxForUser;
let deleteSliceBoundingBoxForUser: typeof DeleteSliceBoundingBoxForUser;
let confirmImageBBoxSetForUser: typeof ConfirmImageBBoxSetForUser;
let listSliceBoundingBoxesForUser: typeof ListSliceBoundingBoxesForUser;
let replaceSliceBoundingBoxForUser: typeof ReplaceSliceBoundingBoxForUser;

describe("slice BBox proposal workflow", () => {
  let ownerId: string;
  let viewerId: string;
  let projectId: string;
  let imageId: string;
  let labelSchemaVersionId: string;
  let suffix: string;

  beforeAll(async () => {
    ({
      confirmImageBBoxSetForUser,
      createSliceBoundingBoxForUser,
      deleteSliceBoundingBoxForUser,
      listSliceBoundingBoxesForUser,
      replaceSliceBoundingBoxForUser,
    } = await import("@/server/domain/sliceBboxes"));

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `bbox-owner-${suffix}@test.local`, name: "BBox Owner" },
      select: { id: true },
    });
    const viewer = await prisma.user.create({
      data: { email: `bbox-viewer-${suffix}@test.local`, name: "BBox Viewer" },
      select: { id: true },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `BBox Test ${suffix}`,
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
        storageKey: `tests/bbox/${suffix}.png`,
        filename: "bbox.png",
        contentType: "image/png",
        size: 256,
        checksum: `sha256:${suffix}`,
        width: 20,
        height: 10,
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

  it("creates and lists active BBox proposals linked to slice instances", async () => {
    const box = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 2, y: 1, width: 8, height: 5 } },
      prisma,
    );

    expect(box.version).toBe(1);
    expect(box.coordinateSpace).toBe("SOURCE_IMAGE_PIXEL");
    expect(box.provenance).toBe("HUMAN_ANNOTATION");
    expect(box.createdBy?.id).toBe(ownerId);
    expect(box.sliceInstanceId).toBeTruthy();

    const state = await listSliceBoundingBoxesForUser({ imageId, userId: ownerId }, prisma);
    expect(state.canEdit).toBe(true);
    expect(state.boxes).toHaveLength(1);
    expect(state.boxes[0].bboxVersionId).toBe(box.bboxVersionId);
    expect(state.bboxWorkflow).toMatchObject({
      bboxSetStatus: "BBOX_DRAFT",
      persistedStatus: "DRAFT",
      activeBBoxCount: 1,
      canConfirm: true,
    });

    const slice = await prisma.sliceInstance.findUniqueOrThrow({
      where: { id: box.sliceInstanceId },
      select: { boundingBox: true },
    });
    expect(slice.boundingBox).toMatchObject({
      bboxVersionId: box.bboxVersionId,
      coordinateSpace: "SOURCE_IMAGE_PIXEL",
      x: 2,
      y: 1,
      width: 8,
      height: 5,
    });
  });

  it("rejects viewer mutation and invalid geometry", async () => {
    await expect(
      createSliceBoundingBoxForUser(
        { imageId, userId: viewerId, box: { x: 1, y: 1, width: 6, height: 4 } },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      createSliceBoundingBoxForUser(
        { imageId, userId: ownerId, box: { x: 18, y: 1, width: 6, height: 4 } },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "BBOX_OUT_OF_BOUNDS" });
  });

  it("rejects overlapping BBoxes for create, replace, and confirmation", async () => {
    const overlapImage = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/bbox/overlap-${suffix}.png`,
        filename: "bbox-overlap.png",
        contentType: "image/png",
        size: 256,
        checksum: `sha256:overlap-${suffix}`,
        width: 40,
        height: 40,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });

    const first = await createSliceBoundingBoxForUser(
      { imageId: overlapImage.id, userId: ownerId, box: { x: 2, y: 2, width: 10, height: 10 } },
      prisma,
    );
    const edgeTouching = await createSliceBoundingBoxForUser(
      { imageId: overlapImage.id, userId: ownerId, box: { x: 12, y: 2, width: 8, height: 10 } },
      prisma,
    );
    expect(edgeTouching.bboxVersionId).toBeTruthy();

    await expect(
      createSliceBoundingBoxForUser(
        { imageId: overlapImage.id, userId: ownerId, box: { x: 11, y: 2, width: 8, height: 10 } },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "BBOX_OVERLAP" });

    await expect(
      replaceSliceBoundingBoxForUser(
        {
          bboxVersionId: edgeTouching.bboxVersionId,
          userId: ownerId,
          box: { x: 11, y: 2, width: 8, height: 10 },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "BBOX_OVERLAP" });

    const legacyImage = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/bbox/legacy-overlap-${suffix}.png`,
        filename: "bbox-legacy-overlap.png",
        contentType: "image/png",
        size: 256,
        checksum: `sha256:legacy-overlap-${suffix}`,
        width: 40,
        height: 40,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    const firstSlice = await prisma.sliceInstance.create({
      data: { projectId, imageId: legacyImage.id, createdById: ownerId },
      select: { id: true },
    });
    const secondSlice = await prisma.sliceInstance.create({
      data: { projectId, imageId: legacyImage.id, createdById: ownerId },
      select: { id: true },
    });
    const firstLegacyBBox = await prisma.sliceBoundingBoxVersion.create({
      data: {
        projectId,
        imageId: legacyImage.id,
        sliceInstanceId: firstSlice.id,
        version: 1,
        x: 2,
        y: 2,
        width: 10,
        height: 10,
        createdById: ownerId,
      },
      select: { id: true },
    });
    const secondLegacyBBox = await prisma.sliceBoundingBoxVersion.create({
      data: {
        projectId,
        imageId: legacyImage.id,
        sliceInstanceId: secondSlice.id,
        version: 1,
        x: 8,
        y: 2,
        width: 10,
        height: 10,
        createdById: ownerId,
      },
      select: { id: true },
    });

    const state = await listSliceBoundingBoxesForUser({ imageId: legacyImage.id, userId: ownerId }, prisma);
    expect(state.bboxIssues).toHaveLength(1);
    expect(state.bboxIssues[0].code).toBe("BBOX_OVERLAP");
    expect(new Set(state.bboxIssues[0].bboxVersionIds)).toEqual(new Set([firstLegacyBBox.id, secondLegacyBBox.id]));
    expect(new Set(state.bboxIssues[0].sliceInstanceIds)).toEqual(new Set([firstSlice.id, secondSlice.id]));
    expect(state.bboxSummary).toMatchObject({ activeCount: 2, validCount: 0, issueCount: 1 });
    await expect(confirmImageBBoxSetForUser({ imageId: legacyImage.id, userId: ownerId }, prisma)).rejects.toMatchObject({
      code: "BBOX_OVERLAP",
    });
    expect(first.bboxVersionId).toBeTruthy();
  });

  it("blocks BBox geometry changes and deletion when dependent masks or classifications exist", async () => {
    const protectedImage = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/bbox/protected-${suffix}.png`,
        filename: "bbox-protected.png",
        contentType: "image/png",
        size: 256,
        checksum: `sha256:protected-${suffix}`,
        width: 40,
        height: 40,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });

    const box = await createSliceBoundingBoxForUser(
      { imageId: protectedImage.id, userId: ownerId, box: { x: 4, y: 4, width: 12, height: 12 } },
      prisma,
    );
    const artifact = await prisma.annotationArtifact.create({
      data: {
        projectId,
        imageId: protectedImage.id,
        kind: "SEMANTIC_MASK",
        scopeKey: `protected-${box.sliceInstanceId}`,
        createdById: ownerId,
      },
      select: { id: true },
    });
    await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: 1,
        storageKey: `tests/bbox/protected-${suffix}-${box.sliceInstanceId}.raw`,
        contentType: "application/octet-stream",
        size: 16,
        checksum: `sha256:protected-mask-${suffix}`,
        width: 4,
        height: 4,
        coordinateSpace: "CROP_PIXEL",
        labelSchemaVersionId,
        sliceInstanceId: box.sliceInstanceId,
        createdById: ownerId,
      },
    });

    const state = await listSliceBoundingBoxesForUser({ imageId: protectedImage.id, userId: ownerId }, prisma);
    expect(state.boxes[0]).toMatchObject({
      bboxVersionId: box.bboxVersionId,
      dependencySummary: { semanticMaskVersionCount: 1, hasBlockingDependencies: true },
      protection: {
        canDelete: false,
        canReplaceGeometry: false,
        reasons: ["SEMANTIC_MASK_EXISTS"],
      },
    });

    await expect(
      replaceSliceBoundingBoxForUser(
        {
          bboxVersionId: box.bboxVersionId,
          userId: ownerId,
          box: { x: 5, y: 5, width: 12, height: 12 },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "BBOX_GEOMETRY_PROTECTED_DEPENDENCIES" });

    await expect(
      deleteSliceBoundingBoxForUser({ bboxVersionId: box.bboxVersionId, userId: ownerId }, prisma),
    ).rejects.toMatchObject({ code: "BBOX_DELETE_PROTECTED_DEPENDENCIES" });
  });

  it("replaces BBoxes append-only and rejects stale replacement", async () => {
    const replaceImage = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/bbox/replace-${suffix}.png`,
        filename: "bbox-replace.png",
        contentType: "image/png",
        size: 256,
        checksum: `sha256:replace-${suffix}`,
        width: 20,
        height: 10,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });

    const original = await createSliceBoundingBoxForUser(
      { imageId: replaceImage.id, userId: ownerId, box: { x: 1, y: 1, width: 6, height: 4 } },
      prisma,
    );

    const replacement = await replaceSliceBoundingBoxForUser(
      {
        bboxVersionId: original.bboxVersionId,
        userId: ownerId,
        box: { x: 3, y: 2, width: 7, height: 4 },
      },
      prisma,
    );

    expect(replacement.sliceInstanceId).toBe(original.sliceInstanceId);
    expect(replacement.version).toBe(2);
    expect(replacement.x).toBe(3);

    await expect(
      replaceSliceBoundingBoxForUser(
        {
          bboxVersionId: original.bboxVersionId,
          userId: ownerId,
          box: { x: 4, y: 2, width: 7, height: 4 },
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "BBOX_VERSION_STALE" });
  });

  it("deletes BBoxes by appending a deleted version and hiding the slice proposal", async () => {
    const original = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 10, y: 1, width: 6, height: 4 } },
      prisma,
    );

    const deleted = await deleteSliceBoundingBoxForUser(
      { bboxVersionId: original.bboxVersionId, userId: ownerId },
      prisma,
    );

    expect(deleted.version).toBe(2);
    expect(deleted.status).toBe("DELETED");

    const state = await listSliceBoundingBoxesForUser({ imageId, userId: ownerId }, prisma);
    expect(state.boxes.some((box) => box.sliceInstanceId === original.sliceInstanceId)).toBe(false);

    const slice = await prisma.sliceInstance.findUniqueOrThrow({
      where: { id: original.sliceInstanceId },
      select: { boundingBox: true },
    });
    expect(slice.boundingBox).toBeNull();
  });

  it("confirms BBox sets and marks confirmed sets as needing update after edits", async () => {
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: `tests/bbox/confirm-${suffix}.png`,
        filename: "bbox-confirm.png",
        contentType: "image/png",
        size: 256,
        checksum: `sha256:confirm-${suffix}`,
        width: 30,
        height: 20,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });

    await expect(confirmImageBBoxSetForUser({ imageId: image.id, userId: ownerId }, prisma)).rejects.toMatchObject({
      code: "BBOX_SET_EMPTY",
    });

    const original = await createSliceBoundingBoxForUser(
      { imageId: image.id, userId: ownerId, box: { x: 2, y: 2, width: 10, height: 8 } },
      prisma,
    );

    await expect(confirmImageBBoxSetForUser({ imageId: image.id, userId: viewerId }, prisma)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const confirmed = await confirmImageBBoxSetForUser({ imageId: image.id, userId: ownerId }, prisma);
    expect(confirmed.bboxWorkflow).toMatchObject({
      bboxSetStatus: "BBOX_CONFIRMED",
      persistedStatus: "CONFIRMED",
      activeBBoxCount: 1,
      canConfirm: true,
    });

    const reloaded = await listSliceBoundingBoxesForUser({ imageId: image.id, userId: ownerId }, prisma);
    expect(reloaded.bboxWorkflow.bboxSetStatus).toBe("BBOX_CONFIRMED");
    expect(reloaded.bboxWorkflow.confirmedBy?.id).toBe(ownerId);

    const replacement = await replaceSliceBoundingBoxForUser(
      {
        bboxVersionId: original.bboxVersionId,
        userId: ownerId,
        box: { x: 4, y: 3, width: 12, height: 8 },
      },
      prisma,
    );
    expect(replacement.version).toBe(2);

    const needsUpdate = await listSliceBoundingBoxesForUser({ imageId: image.id, userId: ownerId }, prisma);
    expect(needsUpdate.bboxWorkflow).toMatchObject({
      bboxSetStatus: "BBOX_NEEDS_UPDATE",
      persistedStatus: "NEEDS_UPDATE",
      activeBBoxCount: 1,
      lastBBoxVersionId: replacement.bboxVersionId,
    });

    const reconfirmed = await confirmImageBBoxSetForUser({ imageId: image.id, userId: ownerId }, prisma);
    expect(reconfirmed.bboxWorkflow.bboxSetStatus).toBe("BBOX_CONFIRMED");
    expect(reconfirmed.bboxWorkflow.confirmedAt).toBeTruthy();
  });
});
