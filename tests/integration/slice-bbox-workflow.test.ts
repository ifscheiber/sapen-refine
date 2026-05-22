import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type {
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

  it("replaces BBoxes append-only and rejects stale replacement", async () => {
    const original = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 1, y: 1, width: 6, height: 4 } },
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
});
