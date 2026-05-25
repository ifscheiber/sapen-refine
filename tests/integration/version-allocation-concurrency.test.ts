import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { Labels } from "@/mask/labels";
import { sha256Checksum } from "@/server/uploads/integrity";
import type { createSliceBoundingBoxForUser as CreateSliceBoundingBoxForUser } from "@/server/domain/sliceBboxes";
import type { replaceSliceBoundingBoxForUser as ReplaceSliceBoundingBoxForUser } from "@/server/domain/sliceBboxes";
import type { generateCropForSliceBBox as GenerateCropForSliceBBox } from "@/server/domain/sliceCrops";
import type { createCropSupportMaskVersionForUser as CreateCropSupportMaskVersionForUser } from "@/server/domain/cropSupportMasks";
import type { createCropSemanticMaskVersionForUser as CreateCropSemanticMaskVersionForUser } from "@/server/domain/cropSemanticMasks";
import type {
  ensureDefaultSliceInstanceForUser as EnsureDefaultSliceInstanceForUser,
  setSliceClassificationForUser as SetSliceClassificationForUser,
} from "@/server/domain/slices";

loadEnv({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let createSliceBoundingBoxForUser: typeof CreateSliceBoundingBoxForUser;
let replaceSliceBoundingBoxForUser: typeof ReplaceSliceBoundingBoxForUser;
let generateCropForSliceBBox: typeof GenerateCropForSliceBBox;
let createCropSupportMaskVersionForUser: typeof CreateCropSupportMaskVersionForUser;
let createCropSemanticMaskVersionForUser: typeof CreateCropSemanticMaskVersionForUser;
let ensureDefaultSliceInstanceForUser: typeof EnsureDefaultSliceInstanceForUser;
let setSliceClassificationForUser: typeof SetSliceClassificationForUser;
let storage: typeof import("@/server/storage/s3");

describe("safe version allocation concurrency", () => {
  let ownerId: string;
  let projectId: string;
  let labelSchemaVersionId: string;
  let sourceImageId: string;
  let classificationImageId: string;
  let suffix: string;
  let cropImageCounter = 0;
  const objectKeys = new Set<string>();

  beforeAll(async () => {
    ({ createSliceBoundingBoxForUser, replaceSliceBoundingBoxForUser } = await import("@/server/domain/sliceBboxes"));
    ({ generateCropForSliceBBox } = await import("@/server/domain/sliceCrops"));
    ({ createCropSupportMaskVersionForUser } = await import("@/server/domain/cropSupportMasks"));
    ({ createCropSemanticMaskVersionForUser } = await import("@/server/domain/cropSemanticMasks"));
    ({ ensureDefaultSliceInstanceForUser, setSliceClassificationForUser } = await import("@/server/domain/slices"));
    storage = await import("@/server/storage/s3");

    const labelSchema = await prisma.labelSchemaVersion.findFirstOrThrow({
      where: { isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    labelSchemaVersionId = labelSchema.id;

    suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await prisma.user.create({
      data: { email: `version-allocation-${suffix}@test.local`, name: "Version Allocation Owner" },
      select: { id: true },
    });
    ownerId = owner.id;

    const project = await prisma.annotationProject.create({
      data: {
        name: `Version Allocation ${suffix}`,
        labelSchemaVersionId,
        createdById: ownerId,
        members: { create: { userId: ownerId, role: "OWNER" } },
      },
      select: { id: true },
    });
    projectId = project.id;
    sourceImageId = await createImage("source", 90, 70, true);
    classificationImageId = await createImage("classification", 32, 24, false);
  });

  afterAll(async () => {
    if (projectId) {
      const cropKeys = await prisma.derivedSliceCrop
        .findMany({ where: { projectId }, select: { storageKey: true } })
        .catch(() => []);
      cropKeys.forEach((crop) => objectKeys.add(crop.storageKey));
    }
    await Promise.all([...objectKeys].map((key) => storage.deleteObjectBestEffort(key)));
    if (projectId) await prisma.annotationProject.delete({ where: { id: projectId } }).catch(() => undefined);
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    await prisma.$disconnect();
    await pool.end();
  });

  async function createImage(name: string, width: number, height: number, storeBytes: boolean) {
    const imageBytes = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 160, g: 120, b: 80 },
      },
    })
      .png()
      .toBuffer();
    const storageKey = `tests/version-allocation/${suffix}/${name}.png`;
    objectKeys.add(storageKey);
    if (storeBytes) await storage.putObject(storageKey, imageBytes, "image/png");

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
    cropImageCounter += 1;
    const cropImageId = await createImage(`crop-${cropImageCounter}`, 90, 70, true);
    const bbox = await createSliceBoundingBoxForUser(
      { imageId: cropImageId, userId: ownerId, box: { x: 18, y: 14, width: 24, height: 18 } },
      prisma,
    );
    const crop = await generateCropForSliceBBox(
      { bboxVersionId: bbox.bboxVersionId, userId: ownerId, paddingRequestedPx: 16 },
      prisma,
    );
    return { bbox, crop };
  }

  it("allocates distinct versions for concurrent crop support mask saves", async () => {
    const { crop } = await createCrop();
    const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
    bytes[crop.cropWidth + 1] = Labels.SLICE_SUPPORT;

    const requests = [0, 1].map(async (index) => {
      const storageKey = `tests/version-allocation/${suffix}/${crop.id}-support-${index}.msk`;
      objectKeys.add(storageKey);
      await storage.putObject(storageKey, bytes, "application/octet-stream");
      return createCropSupportMaskVersionForUser(
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
          supportBytes: bytes,
        },
        prisma,
      );
    });

    await Promise.all(requests);

    const versions = await prisma.annotationArtifactVersion.findMany({
      where: { derivedCropId: crop.id, artifact: { kind: "SLICE_SUPPORT_MASK" } },
      orderBy: { version: "asc" },
      select: { version: true },
    });
    expect(versions.map((version) => version.version)).toEqual([1, 2]);
  });

  it("allocates distinct versions for concurrent crop semantic saves and derived classifications", async () => {
    const { crop } = await createCrop();

    const requests = [Labels.SAPWOOD, Labels.HEARTWOOD].map(async (label, index) => {
      const bytes = new Uint8Array(crop.cropWidth * crop.cropHeight);
      bytes[crop.cropWidth + 1 + index] = label;
      const storageKey = `tests/version-allocation/${suffix}/${crop.id}-semantic-${index}.msk`;
      objectKeys.add(storageKey);
      await storage.putObject(storageKey, bytes, "application/octet-stream");
      return createCropSemanticMaskVersionForUser(
        {
          cropId: crop.id,
          userId: ownerId,
          supportMaskVersionId: null,
          semanticMode: "SAP_HEARTWOOD",
          storageKey,
          contentType: "application/octet-stream",
          size: bytes.byteLength,
          checksum: sha256Checksum(bytes),
          width: crop.cropWidth,
          height: crop.cropHeight,
          format: "u8raw-v1",
          semanticBytes: bytes,
          semanticFamilyReset: false,
        },
        prisma,
      );
    });

    await Promise.all(requests);

    const semanticVersions = await prisma.annotationArtifactVersion.findMany({
      where: { derivedCropId: crop.id, artifact: { kind: "SEMANTIC_MASK" } },
      orderBy: { version: "asc" },
      select: { version: true },
    });
    expect(semanticVersions.map((version) => version.version)).toEqual([1, 2]);

    const classifications = await prisma.sliceClassificationVersion.findMany({
      where: { sliceInstanceId: crop.sliceInstanceId },
      orderBy: { version: "asc" },
      select: { version: true, source: true },
    });
    expect(classifications.map((version) => version.version)).toEqual([1, 2]);
    expect(classifications.map((version) => version.source)).toEqual([
      "AUTO_FROM_SEMANTIC_MASK",
      "AUTO_FROM_SEMANTIC_MASK",
    ]);
  });

  it("allocates distinct versions for concurrent default slice classification saves", async () => {
    await ensureDefaultSliceInstanceForUser({ imageId: classificationImageId, userId: ownerId }, prisma);

    await Promise.all([
      setSliceClassificationForUser({ imageId: classificationImageId, userId: ownerId, class: "UNKNOWN" }, prisma),
      setSliceClassificationForUser({ imageId: classificationImageId, userId: ownerId, class: "COPPER_SLICE" }, prisma),
    ]);

    const versions = await prisma.sliceClassificationVersion.findMany({
      where: { imageId: classificationImageId },
      orderBy: { version: "asc" },
      select: { version: true },
    });
    expect(versions.map((version) => version.version)).toEqual([1, 2]);
  });

  it("returns a stable stale-version conflict for concurrent BBox replacements", async () => {
    const bbox = await createSliceBoundingBoxForUser(
      { imageId: sourceImageId, userId: ownerId, box: { x: 45, y: 20, width: 18, height: 16 } },
      prisma,
    );

    const outcomes = await Promise.allSettled([
      replaceSliceBoundingBoxForUser(
        { bboxVersionId: bbox.bboxVersionId, userId: ownerId, box: { x: 12, y: 12, width: 20, height: 16 } },
        prisma,
      ),
      replaceSliceBoundingBoxForUser(
        { bboxVersionId: bbox.bboxVersionId, userId: ownerId, box: { x: 16, y: 18, width: 20, height: 16 } },
        prisma,
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "BBOX_VERSION_STALE" },
    });
  });
});
