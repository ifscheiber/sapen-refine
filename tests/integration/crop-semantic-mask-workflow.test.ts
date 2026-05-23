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
import type {
  createCropSupportMaskVersionForUser as CreateCropSupportMaskVersionForUser,
} from "@/server/domain/cropSupportMasks";
import type {
  createCropSemanticMaskVersionForUser as CreateCropSemanticMaskVersionForUser,
  loadCropSemanticMaskStateForUser as LoadCropSemanticMaskStateForUser,
} from "@/server/domain/cropSemanticMasks";
import type {
  loadSliceClassificationStateForUser as LoadSliceClassificationStateForUser,
  setSliceInstanceClassificationForUser as SetSliceInstanceClassificationForUser,
} from "@/server/domain/sliceClassifications";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let createSliceBoundingBoxForUser: typeof CreateSliceBoundingBoxForUser;
let generateCropForSliceBBox: typeof GenerateCropForSliceBBox;
let createCropSupportMaskVersionForUser: typeof CreateCropSupportMaskVersionForUser;
let createCropSemanticMaskVersionForUser: typeof CreateCropSemanticMaskVersionForUser;
let loadCropSemanticMaskStateForUser: typeof LoadCropSemanticMaskStateForUser;
let loadSliceClassificationStateForUser: typeof LoadSliceClassificationStateForUser;
let setSliceInstanceClassificationForUser: typeof SetSliceInstanceClassificationForUser;
let storage: typeof import("@/server/storage/s3");

describe("crop semantic mask workflow", () => {
  let ownerId: string;
  let viewerId: string;
  let projectId: string;
  let imageId: string;
  let labelSchemaVersionId: string;
  let suffix: string;
  const sourceKeys = new Set<string>();
  const supportKeys = new Set<string>();
  const semanticKeys = new Set<string>();

  beforeAll(async () => {
    ({ createSliceBoundingBoxForUser } = await import("@/server/domain/sliceBboxes"));
    ({ generateCropForSliceBBox } = await import("@/server/domain/sliceCrops"));
    ({ createCropSupportMaskVersionForUser } = await import("@/server/domain/cropSupportMasks"));
    ({
      createCropSemanticMaskVersionForUser,
      loadCropSemanticMaskStateForUser,
    } = await import("@/server/domain/cropSemanticMasks"));
    ({
      loadSliceClassificationStateForUser,
      setSliceInstanceClassificationForUser,
    } = await import("@/server/domain/sliceClassifications"));
    storage = await import("@/server/storage/s3");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `crop-semantic-owner-${suffix}@test.local`, name: "Crop Semantic Owner" },
      select: { id: true },
    });
    const viewer = await prisma.user.create({
      data: { email: `crop-semantic-viewer-${suffix}@test.local`, name: "Crop Semantic Viewer" },
      select: { id: true },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Crop Semantic Test ${suffix}`,
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
      [
        ...sourceKeys,
        ...supportKeys,
        ...semanticKeys,
        ...cropKeys.map((crop) => crop.storageKey),
      ]
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
        background: { r: 150, g: 110, b: 90 },
      },
    })
      .png()
      .toBuffer();
    const storageKey = `tests/crop-semantic/${suffix}/${name}.png`;
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

  function supportBytes(crop: { cropWidth: number; cropHeight: number }) {
    const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    for (let y = 1; y < crop.cropHeight - 1; y += 1) {
      for (let x = 1; x < crop.cropWidth - 1; x += 1) {
        bytes[y * crop.cropWidth + x] = Labels.SLICE_SUPPORT;
      }
    }
    return bytes;
  }

  async function saveSupport(crop: Awaited<ReturnType<typeof createCrop>>["crop"]) {
    const bytes = supportBytes(crop);
    const storageKey = `tests/crop-semantic/${suffix}/${crop.id}-support.msk`;
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
    if (!state.latestSupportMask) throw new Error("SUPPORT_SAVE_FAILED");
    return { supportMask: state.latestSupportMask, bytes };
  }

  async function saveSemantic(params: {
    crop: Awaited<ReturnType<typeof createCrop>>["crop"];
    supportMaskVersionId: string;
    semanticMode: "SAP_HEARTWOOD" | "COPPER";
    bytes: Uint8Array;
    name: string;
    userId?: string;
    width?: number;
    height?: number;
  }) {
    const width = params.width ?? params.crop.cropWidth;
    const height = params.height ?? params.crop.cropHeight;
    const storageKey =
      `tests/crop-semantic/${suffix}/${params.crop.id}-${params.name}-${params.semanticMode}.msk`;
    semanticKeys.add(storageKey);
    await storage.putObject(storageKey, params.bytes, "application/octet-stream");

    return createCropSemanticMaskVersionForUser(
      {
        cropId: params.crop.id,
        userId: params.userId ?? ownerId,
        supportMaskVersionId: params.supportMaskVersionId,
        semanticMode: params.semanticMode,
        storageKey,
        contentType: "application/octet-stream",
        size: params.bytes.byteLength,
        checksum: sha256Checksum(params.bytes),
        width,
        height,
        format: "u8raw-v1",
        semanticBytes: params.bytes,
      },
      prisma,
    );
  }

  it("requires support before crop semantic masks can be saved", async () => {
    const { crop } = await createCrop();
    const state = await loadCropSemanticMaskStateForUser({ cropId: crop.id, userId: ownerId }, prisma);
    expect(state.supportRequired).toBe(true);
    expect(state.currentSupportMask).toBeNull();

    await expect(
      saveSemantic({
        crop,
        supportMaskVersionId: "missing-support",
        semanticMode: "SAP_HEARTWOOD",
        bytes: new Uint8Array(crop.cropWidth * crop.cropHeight),
        name: "missing-support",
      }),
    ).rejects.toMatchObject({ code: "SUPPORT_MASK_REQUIRED" });
  });

  it("saves and reloads a support-constrained Sap/Heartwood crop semantic mask", async () => {
    const { crop } = await createCrop();
    const { supportMask } = await saveSupport(crop);
    const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    const firstInside = crop.cropWidth + 1;
    bytes[firstInside] = Labels.SAPWOOD;
    bytes[firstInside + 1] = Labels.HEARTWOOD;
    bytes[firstInside + 2] = Labels.UNKNOWN;

    const state = await saveSemantic({
      crop,
      supportMaskVersionId: supportMask.id,
      semanticMode: "SAP_HEARTWOOD",
      bytes,
      name: "sap-heartwood",
    });

    const latest = state.latestSemanticMasks.SAP_HEARTWOOD;
    expect(latest).toMatchObject({
      version: 1,
      width: crop.cropWidth,
      height: crop.cropHeight,
      coordinateSpace: "CROP_PIXEL",
      derivedCropId: crop.id,
      sliceInstanceId: crop.sliceInstanceId,
      supportMaskVersionId: supportMask.id,
      semanticMode: "SAP_HEARTWOOD",
      reviewState: "DRAFT",
      format: "u8raw-v1",
    });
    expect("storageKey" in (latest ?? {})).toBe(false);

    if (!latest) throw new Error("LATEST_SEMANTIC_MASK_MISSING");
    const persisted = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: latest.id },
      select: {
        artifact: { select: { kind: true, scopeKey: true, imageId: true, projectId: true } },
        coordinateSpace: true,
        coordinateTransform: true,
        derivedCropId: true,
        sliceInstanceId: true,
        supportMaskVersionId: true,
        cropSemanticMode: true,
        labelSchemaVersionId: true,
        createdById: true,
        reviewState: true,
      },
    });
    expect(persisted.artifact.kind).toBe("SEMANTIC_MASK");
    expect(persisted.artifact.scopeKey).toBe(`crop-semantic:${crop.id}:SAP_HEARTWOOD`);
    expect(persisted.artifact.imageId).toBe(imageId);
    expect(persisted.artifact.projectId).toBe(projectId);
    expect(persisted.coordinateSpace).toBe("CROP_PIXEL");
    expect(persisted.coordinateTransform).toMatchObject({
      derivedCropId: crop.id,
      supportMaskVersionId: supportMask.id,
      semanticMode: "SAP_HEARTWOOD",
      cropCoordinateSpace: "CROP_PIXEL",
    });
    expect(persisted.derivedCropId).toBe(crop.id);
    expect(persisted.sliceInstanceId).toBe(crop.sliceInstanceId);
    expect(persisted.supportMaskVersionId).toBe(supportMask.id);
    expect(persisted.cropSemanticMode).toBe("SAP_HEARTWOOD");
    expect(persisted.labelSchemaVersionId).toBe(labelSchemaVersionId);
    expect(persisted.createdById).toBe(ownerId);
    expect(persisted.reviewState).toBe("DRAFT");
    expect(state.classificationDerivation).toMatchObject({
      ok: true,
      semanticMaskVersionId: latest.id,
      reason: "SAP_HEARTWOOD_PIXELS_PRESENT",
      classification: {
        class: "SAP_HEARTWOOD_SLICE",
        source: "AUTO_FROM_SEMANTIC_MASK",
        derivationReason: "SAP_HEARTWOOD_PIXELS_PRESENT",
        derivedFromSemanticMaskVersionId: latest.id,
        derivedFromSupportMaskVersionId: supportMask.id,
        derivedFromCropId: crop.id,
        reviewState: "DRAFT",
      },
    });
    expect(state.latestClassification).toMatchObject({
      class: "SAP_HEARTWOOD_SLICE",
      source: "AUTO_FROM_SEMANTIC_MASK",
      derivationReason: "SAP_HEARTWOOD_PIXELS_PRESENT",
      derivedFromSemanticMaskVersionId: latest.id,
      derivedFromSupportMaskVersionId: supportMask.id,
      derivedFromCropId: crop.id,
      reviewState: "DRAFT",
    });

    const reloaded = await loadCropSemanticMaskStateForUser({ cropId: crop.id, userId: ownerId }, prisma);
    expect(reloaded.latestSemanticMasks.SAP_HEARTWOOD?.id).toBe(latest.id);
    expect(reloaded.currentSupportMask?.id).toBe(supportMask.id);
    expect(reloaded.latestClassification?.id).toBe(state.latestClassification?.id);
  });

  it("saves Copper as a semantic mask without mutating support geometry", async () => {
    const { crop } = await createCrop();
    const { supportMask } = await saveSupport(crop);
    const supportVersionCountBefore = await prisma.annotationArtifactVersion.count({
      where: { derivedCropId: crop.id, artifact: { kind: "SLICE_SUPPORT_MASK" } },
    });
    const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    bytes[crop.cropWidth + 1] = Labels.COPPER;

    const state = await saveSemantic({
      crop,
      supportMaskVersionId: supportMask.id,
      semanticMode: "COPPER",
      bytes,
      name: "copper",
    });

    const latest = state.latestSemanticMasks.COPPER;
    expect(latest).toMatchObject({
      supportMaskVersionId: supportMask.id,
      semanticMode: "COPPER",
      coordinateSpace: "CROP_PIXEL",
    });
    if (!latest) throw new Error("LATEST_COPPER_MASK_MISSING");

    const persisted = await prisma.annotationArtifactVersion.findUniqueOrThrow({
      where: { id: latest.id },
      select: {
        artifact: { select: { kind: true, scopeKey: true } },
        cropSemanticMode: true,
      },
    });
    expect(persisted.artifact.kind).toBe("SEMANTIC_MASK");
    expect(persisted.artifact.scopeKey).toBe(`crop-semantic:${crop.id}:COPPER`);
    expect(persisted.cropSemanticMode).toBe("COPPER");
    expect(state.latestClassification).toMatchObject({
      class: "COPPER_SLICE",
      source: "AUTO_FROM_SEMANTIC_MASK",
      derivationReason: "COPPER_PIXELS_PRESENT",
      derivedFromSemanticMaskVersionId: latest.id,
      derivedFromSupportMaskVersionId: supportMask.id,
      derivedFromCropId: crop.id,
      reviewState: "DRAFT",
    });

    const supportVersionCountAfter = await prisma.annotationArtifactVersion.count({
      where: { derivedCropId: crop.id, artifact: { kind: "SLICE_SUPPORT_MASK" } },
    });
    expect(supportVersionCountAfter).toBe(supportVersionCountBefore);

    const slice = await prisma.sliceInstance.findUniqueOrThrow({
      where: { id: crop.sliceInstanceId },
      select: { supportArtifactVersionId: true },
    });
    expect(slice.supportArtifactVersionId).toBe(supportMask.id);
  });

  it("keeps auto classification as a draft suggestion and appends manual overrides", async () => {
    const { crop } = await createCrop();
    const { supportMask } = await saveSupport(crop);
    const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    bytes[crop.cropWidth + 1] = Labels.COPPER;

    const autoState = await saveSemantic({
      crop,
      supportMaskVersionId: supportMask.id,
      semanticMode: "COPPER",
      bytes,
      name: "manual-override-source",
    });
    const autoClassification = autoState.latestClassification;
    if (!autoClassification) throw new Error("AUTO_CLASSIFICATION_MISSING");
    expect(autoClassification).toMatchObject({
      class: "COPPER_SLICE",
      source: "AUTO_FROM_SEMANTIC_MASK",
      reviewState: "DRAFT",
    });

    const approvedAuto = await prisma.sliceClassificationVersion.findFirst({
      where: { id: autoClassification.id, reviewState: "APPROVED" },
      select: { id: true },
    });
    expect(approvedAuto).toBeNull();

    await expect(
      setSliceInstanceClassificationForUser(
        { sliceInstanceId: crop.sliceInstanceId, userId: viewerId, class: "UNKNOWN" },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const manualState = await setSliceInstanceClassificationForUser(
      { sliceInstanceId: crop.sliceInstanceId, userId: ownerId, class: "SAP_HEARTWOOD_SLICE" },
      prisma,
    );
    expect(manualState.latestClassification).toMatchObject({
      class: "SAP_HEARTWOOD_SLICE",
      source: "MANUAL",
      derivationReason: null,
      reviewState: "DRAFT",
    });
    expect(manualState.latestClassification?.version).toBe(autoClassification.version + 1);

    const persistedVersions = await prisma.sliceClassificationVersion.findMany({
      where: { sliceInstanceId: crop.sliceInstanceId },
      orderBy: { version: "asc" },
      select: {
        id: true,
        version: true,
        class: true,
        source: true,
        derivationReason: true,
        derivedFromSemanticMaskVersionId: true,
        derivedFromSupportMaskVersionId: true,
        derivedFromCropId: true,
        reviewState: true,
      },
    });
    expect(persistedVersions).toEqual([
      expect.objectContaining({
        id: autoClassification.id,
        source: "AUTO_FROM_SEMANTIC_MASK",
        derivedFromSemanticMaskVersionId: autoClassification.derivedFromSemanticMaskVersionId,
        derivedFromSupportMaskVersionId: supportMask.id,
        derivedFromCropId: crop.id,
        reviewState: "DRAFT",
      }),
      expect.objectContaining({
        class: "SAP_HEARTWOOD_SLICE",
        source: "MANUAL",
        derivationReason: null,
        derivedFromSemanticMaskVersionId: null,
        reviewState: "DRAFT",
      }),
    ]);

    const loaded = await loadSliceClassificationStateForUser(
      { sliceInstanceId: crop.sliceInstanceId, userId: ownerId },
      prisma,
    );
    expect(loaded.latestClassification?.id).toBe(manualState.latestClassification?.id);
  });

  it("rejects invalid crop semantic saves", async () => {
    const { crop } = await createCrop();
    const { supportMask } = await saveSupport(crop);

    const outsideSupport = new Uint8Array(crop.cropWidth * crop.cropHeight);
    outsideSupport[0] = Labels.SAPWOOD;
    await expect(
      saveSemantic({
        crop,
        supportMaskVersionId: supportMask.id,
        semanticMode: "SAP_HEARTWOOD",
        bytes: outsideSupport,
        name: "outside-support",
      }),
    ).rejects.toMatchObject({ code: "SEMANTIC_OUTSIDE_SUPPORT" });

    const invalidCopper = new Uint8Array(crop.cropWidth * crop.cropHeight);
    invalidCopper[crop.cropWidth + 1] = Labels.SAPWOOD;
    await expect(
      saveSemantic({
        crop,
        supportMaskVersionId: supportMask.id,
        semanticMode: "COPPER",
        bytes: invalidCopper,
        name: "invalid-copper",
      }),
    ).rejects.toMatchObject({ code: "SEMANTIC_MASK_VALUES_INVALID" });

    await expect(
      saveSemantic({
        crop,
        supportMaskVersionId: supportMask.id,
        semanticMode: "SAP_HEARTWOOD",
        bytes: new Uint8Array((crop.cropWidth - 1) * crop.cropHeight),
        name: "bad-dims",
        width: crop.cropWidth - 1,
      }),
    ).rejects.toMatchObject({ code: "MASK_DIMENSIONS_MISMATCH" });

    await expect(
      saveSemantic({
        crop,
        supportMaskVersionId: supportMask.id,
        semanticMode: "SAP_HEARTWOOD",
        bytes: new Uint8Array(crop.cropWidth * crop.cropHeight),
        name: "viewer",
        userId: viewerId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const { crop: otherCrop } = await createCrop();
    const { supportMask: otherSupportMask } = await saveSupport(otherCrop);
    await expect(
      saveSemantic({
        crop,
        supportMaskVersionId: otherSupportMask.id,
        semanticMode: "SAP_HEARTWOOD",
        bytes: new Uint8Array(crop.cropWidth * crop.cropHeight),
        name: "wrong-lineage",
      }),
    ).rejects.toMatchObject({ code: "SUPPORT_MASK_LINEAGE_MISMATCH" });
  });
});
