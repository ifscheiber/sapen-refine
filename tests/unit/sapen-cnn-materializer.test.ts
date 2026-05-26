import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

const MANIFEST_VERSION = "sapen-annotate-cnn-training-dataset-v1";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function sha256(bytes: Buffer) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function png(width: number, height: number, color: { r: number; g: number; b: number }) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  }).png().toBuffer();
}

function sourceRect(x: number, y: number, width = 2, height = 2) {
  return { x, y, width, height, x0: x, y0: y, x1: x + width, y1: y + height };
}

function objectReference(params: {
  objectRefId: string;
  checksum: string;
  size: number;
  width: number;
  height: number;
  role?: string;
}) {
  return {
    objectRefId: params.objectRefId,
    role: params.role ?? "test-object",
    checksum: params.checksum,
    size: params.size,
    width: params.width,
    height: params.height,
    format: "image/png",
    coordinateSpace: "CROP_PIXEL",
  };
}

async function buildFixture(options: {
  checksumMismatch?: boolean;
  invalidCopperSemantic?: boolean;
  overlapInstance?: boolean;
} = {}) {
  const dir = tempDir("sapen-cnn-materializer-fixture-");
  const sourceBytes = await png(4, 4, { r: 40, g: 80, b: 120 });
  const sapCropBytes = await png(2, 2, { r: 120, g: 20, b: 40 });
  const copperCropBytes = await png(2, 2, { r: 20, g: 120, b: 40 });
  const sapSemanticBytes = Buffer.from([0, 1, 2, 0]);
  const copperSemanticBytes = Buffer.from(options.invalidCopperSemantic ? [0, 9, 3, 0] : [0, 3, 3, 0]);
  const copperSupportBytes = Buffer.from(options.overlapInstance ? [0, 1, 0, 0] : [1, 0, 0, 1]);
  const objects = [
    ["image:source-a", "source-a.png", sourceBytes],
    ["crop:crop-sap", "crop-sap.png", sapCropBytes],
    ["crop:crop-copper", "crop-copper.png", copperCropBytes],
    ["artifact:sap-semantic", "sap-semantic.u8raw", sapSemanticBytes],
    ["artifact:copper-semantic", "copper-semantic.u8raw", copperSemanticBytes],
    ["artifact:copper-support", "copper-support.u8raw", copperSupportBytes],
  ] as const;

  const refs = objects.map(([objectRefId, filename, bytes]) => {
    const localPath = path.join(dir, filename);
    writeFileSync(localPath, bytes);
    return {
      objectRefId,
      localPath,
      expectedChecksum: sha256(bytes),
      expectedSize: bytes.byteLength,
    };
  });
  if (options.checksumMismatch) refs[0].expectedChecksum = `sha256:${"0".repeat(64)}`;

  const sourceChecksum = sha256(sourceBytes);
  const sapCropChecksum = sha256(sapCropBytes);
  const copperCropChecksum = sha256(copperCropBytes);
  const copperRect = options.overlapInstance ? sourceRect(0, 0) : sourceRect(2, 0);
  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    exportId: "export-materializer-test",
    snapshotId: "export-materializer-test",
    createdAt: "2026-05-26T00:00:00.000Z",
    createdBy: { id: "user-owner", email: "owner@example.test", name: "Owner" },
    project: { id: "project-a", name: "Project A" },
    splitPolicy: {
      seed: "sapen-cnn-training-v1",
      deterministicHash: "fnv1a32",
      groupSplitMap: { "group-a": "train", "group-b": "val" },
    },
    objectRefs: refs.map((ref) => ({
      objectRefId: ref.objectRefId,
      checksum: ref.expectedChecksum,
      size: ref.expectedSize,
    })),
    fullImageItems: [
      {
        itemId: "full-image:source-a",
        sourceImage: {
          id: "source-a",
          filename: "source-a.png",
          objectRefId: "image:source-a",
          contentType: "image/png",
          size: sourceBytes.byteLength,
          width: 4,
          height: 4,
          checksum: sourceChecksum,
          sampleMetadata: null,
          acquisitionMetadata: null,
        },
        instanceMask: {
          derivation: "CROP_REPROJECTED_SUPPORT_GEOMETRY",
          format: "tiff-i32",
          coordinateSpace: "SOURCE_IMAGE_PIXEL",
          width: 4,
          height: 4,
          instanceIdMap: [
            {
              instanceId: 1,
              derivedCropId: "crop-sap",
              supportGeometryObjectRefId: "artifact:sap-semantic",
              supportGeometryWidth: 2,
              supportGeometryHeight: 2,
            },
            {
              instanceId: 2,
              derivedCropId: "crop-copper",
              supportGeometryObjectRefId: "artifact:copper-support",
              supportGeometryWidth: 2,
              supportGeometryHeight: 2,
            },
          ],
        },
        sourceCropRefs: [
          {
            derivedCropId: "crop-sap",
            cropObjectRefId: "crop:crop-sap",
            cropWidth: 2,
            cropHeight: 2,
            sourceRect: sourceRect(0, 0),
            transformToSource: null,
          },
          {
            derivedCropId: "crop-copper",
            cropObjectRefId: "crop:crop-copper",
            cropWidth: 2,
            cropHeight: 2,
            sourceRect: copperRect,
            transformToSource: null,
          },
        ],
        groupKey: "group-a",
        split: "train",
      },
    ],
    classificationItems: [
      {
        itemId: "classification:sap",
        sourceImageId: "source-a",
        derivedCropId: "crop-sap",
        cropId: "crop-sap",
        cropImage: objectReference({
          objectRefId: "crop:crop-sap",
          checksum: sapCropChecksum,
          size: sapCropBytes.byteLength,
          width: 2,
          height: 2,
          role: "derived-crop",
        }),
        sourceRect: sourceRect(0, 0),
        classification: { sapenCnnLabel: "HEARTWOOD_STAINED" },
        groupKey: "group-a",
        split: "train",
      },
      {
        itemId: "classification:copper",
        sourceImageId: "source-a",
        derivedCropId: "crop-copper",
        cropId: "crop-copper",
        cropImage: objectReference({
          objectRefId: "crop:crop-copper",
          checksum: copperCropChecksum,
          size: copperCropBytes.byteLength,
          width: 2,
          height: 2,
          role: "derived-crop",
        }),
        sourceRect: copperRect,
        classification: { sapenCnnLabel: "COPPER" },
        groupKey: "group-b",
        split: "val",
      },
    ],
    cropSemanticItems: [
      {
        itemId: "crop-semantic:sap",
        task: "SAP_HEARTWOOD_SEMSEG",
        sourceImageId: "source-a",
        derivedCropId: "crop-sap",
        cropId: "crop-sap",
        cropImage: objectReference({
          objectRefId: "crop:crop-sap",
          checksum: sapCropChecksum,
          size: sapCropBytes.byteLength,
          width: 2,
          height: 2,
          role: "derived-crop",
        }),
        semanticMask: {
          objectRefId: "artifact:sap-semantic",
          width: 2,
          height: 2,
          format: "u8raw-v1",
          coordinateSpace: "CROP_PIXEL",
        },
        labelMapping: { raw: { "0": 0, "1": 1, "2": 2 } },
        groupKey: "group-a",
        split: "train",
      },
      {
        itemId: "crop-semantic:copper",
        task: "COPPER_SEMSEG",
        sourceImageId: "source-a",
        derivedCropId: "crop-copper",
        cropId: "crop-copper",
        cropImage: objectReference({
          objectRefId: "crop:crop-copper",
          checksum: copperCropChecksum,
          size: copperCropBytes.byteLength,
          width: 2,
          height: 2,
          role: "derived-crop",
        }),
        semanticMask: {
          objectRefId: "artifact:copper-semantic",
          width: 2,
          height: 2,
          format: "u8raw-v1",
          coordinateSpace: "CROP_PIXEL",
        },
        labelMapping: { raw: { "0": 0, "3": 1 } },
        groupKey: "group-b",
        split: "val",
      },
    ],
    skippedItems: [],
    warnings: [],
    summary: {},
  };

  const manifestPath = path.join(dir, "manifest.json");
  const refsPath = path.join(dir, "refs.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(refsPath, `${JSON.stringify({ refs }, null, 2)}\n`);
  return { dir, manifestPath, refsPath };
}

function runMaterializer(input: { manifestPath: string; refsPath: string }, outputDir: string, extraArgs: string[] = []) {
  return spawnSync(process.execPath, [
    "scripts/materialize-sapen-cnn-dataset.mjs",
    "--manifest",
    input.manifestPath,
    "--materialization-refs",
    input.refsPath,
    "--output-dir",
    outputDir,
    ...extraArgs,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("sapen-cnn dataset materializer", () => {
  it("materializes classification, crop semseg, and full-image instseg datasets", async () => {
    const fixture = await buildFixture();
    const outputDir = path.join(tempDir("sapen-cnn-materializer-output-"), "dataset");

    const result = runMaterializer(fixture, outputDir);

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(path.join(outputDir, "source_manifest.json"))).toBe(true);
    expect(existsSync(path.join(outputDir, "materialization_report.json"))).toBe(true);
    expect(existsSync(path.join(outputDir, "label_mappings.json"))).toBe(true);

    expect(existsSync(path.join(outputDir, "instseg/train/images/source-a.png"))).toBe(true);
    const tiff = readFileSync(path.join(outputDir, "instseg/train/masks/source-a.tif"));
    expect(Array.from(tiff.subarray(0, 4))).toEqual([0x49, 0x49, 0x2a, 0x00]);
    const tiffDataOffset = 8 + 2 + 10 * 12 + 4;
    expect(tiff.readUInt32LE(tiffDataOffset + ((0 * 4 + 1) * 4))).toBe(1);
    expect(tiff.readUInt32LE(tiffDataOffset + ((1 * 4 + 0) * 4))).toBe(1);
    expect(tiff.readUInt32LE(tiffDataOffset + ((0 * 4 + 2) * 4))).toBe(2);
    expect(tiff.readUInt32LE(tiffDataOffset + ((1 * 4 + 3) * 4))).toBe(2);

    const trainCsv = readFileSync(path.join(outputDir, "classification/train_manifest.csv"), "utf8");
    const valCsv = readFileSync(path.join(outputDir, "classification/val_manifest.csv"), "utf8");
    expect(trainCsv.split(/\r?\n/)[0]).toContain("crop_path,image_path,label");
    expect(trainCsv).toContain("HEARTWOOD_STAINED");
    expect(valCsv).toContain("COPPER");
    expect(existsSync(path.join(outputDir, "classification/train/images/crop-sap.png"))).toBe(true);
    expect(existsSync(path.join(outputDir, "classification/val/images/crop-copper.png"))).toBe(true);

    const sapMask = await sharp(path.join(outputDir, "semseg/sap_heartwood/train/masks/crop-sap.png"))
      .greyscale()
      .raw()
      .toBuffer();
    const copperMask = await sharp(path.join(outputDir, "semseg/copper/val/masks/crop-copper.png"))
      .greyscale()
      .raw()
      .toBuffer();
    expect(Array.from(sapMask)).toEqual([0, 1, 2, 0]);
    expect(Array.from(copperMask)).toEqual([0, 1, 1, 0]);

    const report = JSON.parse(readFileSync(path.join(outputDir, "materialization_report.json"), "utf8"));
    expect(report.counts).toMatchObject({
      instseg: 1,
      classification: 2,
      semsegSapHeartwood: 1,
      semsegCopper: 1,
      cachedObjects: 6,
    });
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INSTSEG_MASK_FORMAT_TIFF_I32" }),
      ]),
    );
    expect(readdirSync(path.join(outputDir, ".cache/objects")).length).toBe(6);

    const checksums = JSON.parse(readFileSync(path.join(outputDir, "checksums.json"), "utf8"));
    expect(checksums).toHaveProperty("instseg/train/masks/source-a.tif");

    const overwriteResult = runMaterializer(fixture, outputDir);
    expect(overwriteResult.status).not.toBe(0);
    expect(overwriteResult.stderr).toContain("OUTPUT_DIR_NOT_EMPTY");
  });

  it("fails loudly for checksum mismatches, invalid semantic labels, and instance overlap", async () => {
    const cases = [
      { options: { checksumMismatch: true }, expected: "CHECKSUM_MISMATCH:image:source-a" },
      { options: { invalidCopperSemantic: true }, expected: "SEMANTIC_LABEL_INVALID:artifact:copper-semantic:9" },
      { options: { overlapInstance: true }, expected: "INSTANCE_OVERLAP:source-a" },
    ] as const;

    for (const testCase of cases) {
      const fixture = await buildFixture(testCase.options);
      const outputDir = path.join(tempDir("sapen-cnn-materializer-fail-output-"), "dataset");
      const result = runMaterializer(fixture, outputDir);

      expect(result.status, result.stderr).not.toBe(0);
      expect(result.stderr).toContain(testCase.expected);
    }
  });
});
