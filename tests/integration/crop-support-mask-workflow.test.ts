import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { Labels } from "@/mask/labels";
import { sha256Checksum } from "@/server/uploads/integrity";
import type { createSliceBoundingBoxForUser as CreateSliceBoundingBoxForUser } from "@/server/domain/sliceBboxes";
import type { generateCropForSliceBBox as GenerateCropForSliceBBox } from "@/server/domain/sliceCrops";
import type { createCropSemanticMaskVersionForUser as CreateCropSemanticMaskVersionForUser } from "@/server/domain/cropSemanticMasks";
import type {
  createCropSupportMaskVersionForUser as CreateCropSupportMaskVersionForUser,
  loadCropSupportMaskStateForUser as LoadCropSupportMaskStateForUser,
} from "@/server/domain/cropSupportMasks";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let createSliceBoundingBoxForUser: typeof CreateSliceBoundingBoxForUser;
let generateCropForSliceBBox: typeof GenerateCropForSliceBBox;
let createCropSemanticMaskVersionForUser: typeof CreateCropSemanticMaskVersionForUser;
let createCropSupportMaskVersionForUser: typeof CreateCropSupportMaskVersionForUser;
let loadCropSupportMaskStateForUser: typeof LoadCropSupportMaskStateForUser;
let storage: typeof import("@/server/storage/s3");

describe("crop support mask workflow", () => {
  let ownerId: string;
  let viewerId: string;
  let projectId: string;
  let imageId: string;
  let labelSchemaVersionId: string;
  let suffix: string;
  const sourceKeys = new Set<string>();
  const semanticKeys = new Set<string>();
  const supportKeys = new Set<string>();

  beforeAll(async () => {
    ({ createSliceBoundingBoxForUser } = await import("@/server/domain/sliceBboxes"));
    ({ generateCropForSliceBBox } = await import("@/server/domain/sliceCrops"));
    ({ createCropSemanticMaskVersionForUser } = await import("@/server/domain/cropSemanticMasks"));
    ({
      createCropSupportMaskVersionForUser,
      loadCropSupportMaskStateForUser,
    } = await import("@/server/domain/cropSupportMasks"));
    storage = await import("@/server/storage/s3");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `crop-support-owner-${suffix}@test.local`, name: "Crop Support Owner" },
      select: { id: true },
    });
    const viewer = await prisma.user.create({
      data: { email: `crop-support-viewer-${suffix}@test.local`, name: "Crop Support Viewer" },
      select: { id: true },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Crop Support Test ${suffix}`,
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
    imageId = await createImage("source", 80, 60);
  });

  afterAll(async () => {
    const cropKeys = projectId
      ? await prisma.derivedSliceCrop
        .findMany({ where: { projectId }, select: { storageKey: true } })
        .catch(() => [])
      : [];
    await Promise.all(
      [...sourceKeys, ...semanticKeys, ...supportKeys, ...cropKeys.map((crop) => crop.storageKey)]
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
        background: { r: 170, g: 120, b: 80 },
      },
    })
      .png()
      .toBuffer();
    const storageKey = `tests/crop-support/${suffix}/${name}.png`;
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

  async function createCrop() {
    const box = await createSliceBoundingBoxForUser(
      { imageId, userId: ownerId, box: { x: 20, y: 15, width: 24, height: 18 } },
      prisma,
    );
    const crop = await generateCropForSliceBBox(
      { bboxVersionId: box.bboxVersionId, userId: ownerId, paddingRequestedPx: 16 },
      prisma,
    );
    return { box, crop };
  }

  async function saveSapHeartwoodSemantic(params: {
    crop: Awaited<ReturnType<typeof createCrop>>["crop"];
    bytes: Uint8Array;
    name: string;
  }) {
    const storageKey = `tests/crop-support/${suffix}/${params.crop.id}-${params.name}-sap.msk`;
    semanticKeys.add(storageKey);
    await storage.putObject(storageKey, params.bytes, "application/octet-stream");
    return createCropSemanticMaskVersionForUser(
      {
        cropId: params.crop.id,
        userId: ownerId,
        semanticMode: "SAP_HEARTWOOD",
        storageKey,
        contentType: "application/octet-stream",
        size: params.bytes.byteLength,
        checksum: sha256Checksum(params.bytes),
        width: params.crop.cropWidth,
        height: params.crop.cropHeight,
        format: "u8raw-v1",
        semanticBytes: params.bytes,
      },
      prisma,
    );
  }

  it("saves and reloads a crop-space SLICE_SUPPORT_MASK version linked to crop and slice", async () => {
    const { crop } = await createCrop();
    const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    bytes.fill(0);
    bytes.fill(10, crop.cropWidth + 1, crop.cropWidth * 2);

    const storageKey = `tests/crop-support/${suffix}/${crop.id}-support.msk`;
    supportKeys.add(storageKey);
    await storage.putObject(storageKey, bytes, "application/octet-stream");

    const state = await createCropSupportMaskVersionForUser(
      {
        cropId: crop.id,
        userId: ownerId,
        storageKey,
        contentType: "application/octet-stream",
        size: bytes.byteLength,
        checksum: sha256Checksum(bytes),
        width: crop.cropWidth,
        height: crop.cropHeight,
        format: "u8raw-v1",
      },
      prisma,
    );

    expect(state.exists).toBe(true);
    expect(state.canEdit).toBe(true);
    expect(state.crop.id).toBe(crop.id);
    expect(state.latestSupportMask).toMatchObject({
      version: 1,
      width: crop.cropWidth,
      height: crop.cropHeight,
      coordinateSpace: "CROP_PIXEL",
      derivedCropId: crop.id,
      sliceInstanceId: crop.sliceInstanceId,
      reviewState: "DRAFT",
      format: "u8raw-v1",
    });
    const latestSupportMask = state.latestSupportMask;
    expect(latestSupportMask).not.toBeNull();
    if (!latestSupportMask) throw new Error("LATEST_SUPPORT_MASK_MISSING");
    expect(latestSupportMask.url).toBe(
      `/api/images/${crop.sourceImageId}/mask/versions/${latestSupportMask.id}/asset`,
    );
    expect("storageKey" in (state.latestSupportMask ?? {})).toBe(false);

    const persisted = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: latestSupportMask.id },
      select: {
        artifact: { select: { kind: true, scopeKey: true, imageId: true, projectId: true } },
        coordinateSpace: true,
        coordinateTransform: true,
        derivedCropId: true,
        sliceInstanceId: true,
        labelSchemaVersionId: true,
        createdById: true,
        reviewState: true,
      },
    });
    expect(persisted.artifact.kind).toBe("SLICE_SUPPORT_MASK");
    expect(persisted.artifact.scopeKey).toBe(`crop-support:${crop.id}`);
    expect(persisted.artifact.imageId).toBe(imageId);
    expect(persisted.artifact.projectId).toBe(projectId);
    expect(persisted.coordinateSpace).toBe("CROP_PIXEL");
    expect(persisted.coordinateTransform).toMatchObject({
      derivedCropId: crop.id,
      sourceOrigin: { x: crop.sourceX, y: crop.sourceY },
      cropCoordinateSpace: "CROP_PIXEL",
    });
    expect(persisted.derivedCropId).toBe(crop.id);
    expect(persisted.sliceInstanceId).toBe(crop.sliceInstanceId);
    expect(persisted.labelSchemaVersionId).toBe(labelSchemaVersionId);
    expect(persisted.createdById).toBe(ownerId);
    expect(persisted.reviewState).toBe("DRAFT");

    const slice = await prisma.sliceInstance.findUniqueOrThrow({
      where: { id: crop.sliceInstanceId },
      select: { supportArtifactVersionId: true },
    });
    expect(slice.supportArtifactVersionId).toBe(latestSupportMask.id);

    const reloaded = await loadCropSupportMaskStateForUser({ cropId: crop.id, userId: ownerId }, prisma);
    expect(reloaded.latestSupportMask?.id).toBe(latestSupportMask.id);
    expect(reloaded.supportReadiness.status).toBe("DRAFT");
  });

  it("allows viewers to read crop support state but rejects crop support saves", async () => {
    const { crop } = await createCrop();
    const viewerState = await loadCropSupportMaskStateForUser({ cropId: crop.id, userId: viewerId }, prisma);
    expect(viewerState.canEdit).toBe(false);
    expect(viewerState.exists).toBe(false);

    await expect(
      createCropSupportMaskVersionForUser(
        {
          cropId: crop.id,
          userId: viewerId,
          storageKey: `tests/crop-support/${suffix}/${crop.id}-viewer.msk`,
          size: crop.cropWidth * crop.cropHeight,
          width: crop.cropWidth,
          height: crop.cropHeight,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects crop support masks whose dimensions do not match the derived crop", async () => {
    const { crop } = await createCrop();

    await expect(
      createCropSupportMaskVersionForUser(
        {
          cropId: crop.id,
          userId: ownerId,
          storageKey: `tests/crop-support/${suffix}/${crop.id}-bad-dims.msk`,
          size: (crop.cropWidth - 1) * crop.cropHeight,
          width: crop.cropWidth - 1,
          height: crop.cropHeight,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "MASK_DIMENSIONS_MISMATCH" });
  });

  it("blocks support masks until Sapwood/Heartwood annotation is cleared", async () => {
    const { crop } = await createCrop();
    const sapBytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    sapBytes[crop.cropWidth + 1] = Labels.SAPWOOD;
    await saveSapHeartwoodSemantic({ crop, bytes: sapBytes, name: "family-lock" });

    const supportBytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    supportBytes.fill(Labels.SLICE_SUPPORT, crop.cropWidth + 1, crop.cropWidth * 2);
    await expect(
      createCropSupportMaskVersionForUser(
        {
          cropId: crop.id,
          userId: ownerId,
          storageKey: `tests/crop-support/${suffix}/${crop.id}-support-blocked.msk`,
          contentType: "application/octet-stream",
          size: supportBytes.byteLength,
          checksum: sha256Checksum(supportBytes),
          width: crop.cropWidth,
          height: crop.cropHeight,
          format: "u8raw-v1",
          supportBytes,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "CROP_ANNOTATION_FAMILY_CONFLICT" });

    await saveSapHeartwoodSemantic({
      crop,
      bytes: new Uint8Array(crop.cropWidth * crop.cropHeight),
      name: "family-lock-cleared",
    });

    const storageKey = `tests/crop-support/${suffix}/${crop.id}-support-unlocked.msk`;
    supportKeys.add(storageKey);
    await storage.putObject(storageKey, supportBytes, "application/octet-stream");
    const state = await createCropSupportMaskVersionForUser(
      {
        cropId: crop.id,
        userId: ownerId,
        storageKey,
        contentType: "application/octet-stream",
        size: supportBytes.byteLength,
        checksum: sha256Checksum(supportBytes),
        width: crop.cropWidth,
        height: crop.cropHeight,
        format: "u8raw-v1",
        supportBytes,
      },
      prisma,
    );

    expect(state.annotationFamily).toMatchObject({
      state: "CU_SUPPORT",
      activeFamily: "CU_SUPPORT",
      blockedFamilies: ["SAP_HEARTWOOD"],
      families: {
        cuSupport: {
          occupied: true,
          hasSupport: true,
        },
      },
    });
  });
});
