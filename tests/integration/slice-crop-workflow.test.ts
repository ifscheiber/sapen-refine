import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { readImageDimensions, sha256Checksum } from "@/server/uploads/integrity";
import type {
  createSliceBoundingBoxForUser as CreateSliceBoundingBoxForUser,
  deleteSliceBoundingBoxForUser as DeleteSliceBoundingBoxForUser,
  replaceSliceBoundingBoxForUser as ReplaceSliceBoundingBoxForUser,
} from "@/server/domain/sliceBboxes";
import type {
  generateCropForSliceBBox as GenerateCropForSliceBBox,
  listSliceCropsForImageForUser as ListSliceCropsForImageForUser,
  readSliceCropAssetForUser as ReadSliceCropAssetForUser,
} from "@/server/domain/sliceCrops";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let createSliceBoundingBoxForUser: typeof CreateSliceBoundingBoxForUser;
let replaceSliceBoundingBoxForUser: typeof ReplaceSliceBoundingBoxForUser;
let deleteSliceBoundingBoxForUser: typeof DeleteSliceBoundingBoxForUser;
let generateCropForSliceBBox: typeof GenerateCropForSliceBBox;
let listSliceCropsForImageForUser: typeof ListSliceCropsForImageForUser;
let readSliceCropAssetForUser: typeof ReadSliceCropAssetForUser;
let storage: typeof import("@/server/storage/s3");

describe("derived slice crop workflow", () => {
  let ownerId: string;
  let viewerId: string;
  let projectId: string;
  let imageId: string;
  let labelSchemaVersionId: string;
  let suffix: string;
  const sourceKeys = new Set<string>();

  beforeAll(async () => {
    ({
      createSliceBoundingBoxForUser,
      replaceSliceBoundingBoxForUser,
      deleteSliceBoundingBoxForUser,
    } = await import("@/server/domain/sliceBboxes"));
    ({
      generateCropForSliceBBox,
      listSliceCropsForImageForUser,
      readSliceCropAssetForUser,
    } = await import("@/server/domain/sliceCrops"));
    storage = await import("@/server/storage/s3");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `crop-owner-${suffix}@test.local`, name: "Crop Owner" },
      select: { id: true },
    });
    const viewer = await prisma.user.create({
      data: { email: `crop-viewer-${suffix}@test.local`, name: "Crop Viewer" },
      select: { id: true },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Crop Test ${suffix}`,
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

    imageId = await createImage("source", 100, 80);
  });

  afterAll(async () => {
    const cropKeys = projectId
      ? await prisma.derivedSliceCrop
        .findMany({ where: { projectId }, select: { storageKey: true } })
        .catch(() => [])
      : [];
    await Promise.all(
      [...sourceKeys, ...cropKeys.map((crop) => crop.storageKey)]
        .filter(Boolean)
        .map((key) => storage.deleteObjectBestEffort(key)),
    );
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

  async function createImage(name: string, width: number, height: number) {
    const imageBytes = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 180, g: 120, b: 70 },
      },
    })
      .png()
      .toBuffer();
    const storageKey = `tests/slice-crops/${suffix}/${name}.png`;
    sourceKeys.add(storageKey);
    await storage.putObject(storageKey, imageBytes, "image/png");
    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey,
        filename: `${name}.png`,
        contentType: "image/png",
        size: imageBytes.byteLength,
        checksum: sha256Checksum(imageBytes),
        width,
        height,
        validationStatus: "VALIDATED",
        uploadedById: ownerId,
      },
      select: { id: true },
    });
    return image.id;
  }

  it("generates a private PNG crop with default clipped 32px padding", async () => {
    const box = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 40, y: 20, width: 10, height: 10 } },
      prisma,
    );

    const crop = await generateCropForSliceBBox({ bboxVersionId: box.bboxVersionId, userId: ownerId }, prisma);

    expect(crop.version).toBe(1);
    expect(crop.bboxVersionId).toBe(box.bboxVersionId);
    expect(crop.coordinateSpace).toBe("CROP_PIXEL");
    expect(crop.paddingRequestedPx).toBe(32);
    expect(crop.paddingAppliedLeftPx).toBe(32);
    expect(crop.paddingAppliedTopPx).toBe(20);
    expect(crop.paddingAppliedRightPx).toBe(32);
    expect(crop.paddingAppliedBottomPx).toBe(32);
    expect(crop.paddingClipped).toBe(true);
    expect(crop.sourceX).toBe(8);
    expect(crop.sourceY).toBe(0);
    expect(crop.sourceWidth).toBe(74);
    expect(crop.sourceHeight).toBe(62);
    expect(crop.cropX).toBe(0);
    expect(crop.cropY).toBe(0);
    expect(crop.cropWidth).toBe(74);
    expect(crop.cropHeight).toBe(62);
    expect(crop.assetUrl).toBe(`/api/slice-crops/${crop.id}/asset`);
    expect("storageKey" in crop).toBe(false);

    const persisted = await prisma.derivedSliceCrop.findUniqueOrThrow({
      where: { id: crop.id },
      select: {
        sourceImageChecksum: true,
        sourceImageWidth: true,
        sourceImageHeight: true,
        storageKey: true,
        metadataJson: true,
      },
    });
    expect(persisted.sourceImageChecksum).toBe(crop.sourceImageChecksum);
    expect(persisted.sourceImageWidth).toBe(100);
    expect(persisted.sourceImageHeight).toBe(80);
    expect(persisted.storageKey).toContain(`/derived-crops/${imageId}/${box.sliceInstanceId}/`);
    expect(persisted.metadataJson).toMatchObject({
      sourceContentType: "image/png",
      generatedFromBBoxVersion: 1,
    });

    const asset = await readSliceCropAssetForUser({ cropId: crop.id, userId: ownerId }, prisma);
    expect(asset.contentType).toBe("image/png");
    expect(readImageDimensions(asset.bytes, "image/png")).toEqual({ width: 74, height: 62 });

    const state = await listSliceCropsForImageForUser({ imageId, userId: ownerId }, prisma);
    expect(state.canEdit).toBe(true);
    expect(state.crops.some((entry) => entry.id === crop.id)).toBe(true);
  });

  it("rejects viewer crop generation", async () => {
    const box = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 5, y: 5, width: 12, height: 12 } },
      prisma,
    );

    await expect(
      generateCropForSliceBBox({ bboxVersionId: box.bboxVersionId, userId: viewerId }, prisma),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("versions crops per slice instance and rejects stale or deleted BBoxes", async () => {
    const original = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 30, y: 30, width: 20, height: 15 } },
      prisma,
    );

    const firstCrop = await generateCropForSliceBBox(
      { bboxVersionId: original.bboxVersionId, userId: ownerId, paddingRequestedPx: 16 },
      prisma,
    );
    expect(firstCrop.version).toBe(1);
    expect(firstCrop.paddingRequestedPx).toBe(16);
    expect(firstCrop.paddingClipped).toBe(false);

    const replacement = await replaceSliceBoundingBoxForUser(
      {
        bboxVersionId: original.bboxVersionId,
        userId: ownerId,
        box: { x: 10, y: 8, width: 30, height: 20 },
      },
      prisma,
    );

    await expect(
      generateCropForSliceBBox({ bboxVersionId: original.bboxVersionId, userId: ownerId }, prisma),
    ).rejects.toMatchObject({ code: "BBOX_VERSION_STALE" });

    const secondCrop = await generateCropForSliceBBox(
      { bboxVersionId: replacement.bboxVersionId, userId: ownerId, paddingRequestedPx: 0 },
      prisma,
    );
    expect(secondCrop.sliceInstanceId).toBe(firstCrop.sliceInstanceId);
    expect(secondCrop.version).toBe(2);
    expect(secondCrop.paddingRequestedPx).toBe(0);
    expect(secondCrop.sourceX).toBe(10);
    expect(secondCrop.sourceY).toBe(8);
    expect(secondCrop.cropWidth).toBe(30);
    expect(secondCrop.cropHeight).toBe(20);

    const deleted = await deleteSliceBoundingBoxForUser(
      { bboxVersionId: replacement.bboxVersionId, userId: ownerId },
      prisma,
    );
    await expect(
      generateCropForSliceBBox({ bboxVersionId: deleted.bboxVersionId, userId: ownerId }, prisma),
    ).rejects.toMatchObject({ code: "BBOX_DELETED" });
  });
});
