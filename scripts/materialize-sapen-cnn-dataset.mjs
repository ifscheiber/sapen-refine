#!/usr/bin/env node

import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import {
  markDeprecatedPasswordFlag,
  resolveSecretInput,
} from "./secret-input.mjs";

const DEFAULT_BASE_URL =
  process.env.SAPEN_DATASET_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";

function printHelp() {
  console.log(`Usage:
npm run dataset:materialize -- [options]

Inputs:
  --manifest <path>                 Public SaPen-CNN snapshot manifest JSON.
  --materialization-refs <path>     Private refs JSON from the materialization endpoint.
  --export-id <id>                  Fetch manifest and refs from the app.

Output:
  --output-dir <path>               Destination dataset root.
  --overwrite                       Replace an existing output directory.
  --no-verify-checksums             Disable checksum validation.

Operator fetch options for --export-id:
  --base-url <url>                  Defaults to SAPEN_DATASET_BASE_URL, APP_BASE_URL, or http://localhost:3000.
  --email <email>                   Defaults to SAPEN_DATASET_EMAIL.
  --password-file <path>            Read operator password from a mounted secret file.
  --password-stdin                  Read operator password from stdin.

Secret input precedence:
  --password-file, SAPEN_DATASET_PASSWORD_FILE, SAPEN_DATASET_PASSWORD, --password-stdin.
  Deprecated compatibility: --password.

Direct object download requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.
`);
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };

  const args = {
    manifestPath: "",
    refsPath: "",
    exportId: "",
    outputDir: "",
    overwrite: false,
    verifyChecksums: true,
    baseUrl: DEFAULT_BASE_URL,
    email: process.env.SAPEN_DATASET_EMAIL || "",
    password: "",
    passwordFile: "",
    passwordStdin: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--manifest" && next) {
      args.manifestPath = next;
      index += 1;
    } else if (arg === "--materialization-refs" && next) {
      args.refsPath = next;
      index += 1;
    } else if (arg === "--export-id" && next) {
      args.exportId = next;
      index += 1;
    } else if (arg === "--output-dir" && next) {
      args.outputDir = next;
      index += 1;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--no-verify-checksums") {
      args.verifyChecksums = false;
    } else if (arg === "--base-url" && next) {
      args.baseUrl = next;
      index += 1;
    } else if (arg === "--email" && next) {
      args.email = next;
      index += 1;
    } else if (arg === "--password" && next) {
      args.password = next;
      markDeprecatedPasswordFlag(args);
      index += 1;
    } else if (arg === "--password-file" && next) {
      args.passwordFile = next;
      index += 1;
    } else if (arg === "--password-stdin") {
      args.passwordStdin = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!args.outputDir) throw new Error("--output-dir is required");
  if (args.exportId && (args.manifestPath || args.refsPath)) {
    throw new Error("--export-id cannot be combined with --manifest or --materialization-refs");
  }
  if (!args.exportId && (!args.manifestPath || !args.refsPath)) {
    throw new Error("--manifest and --materialization-refs are required unless --export-id is used");
  }
  if (args.exportId) {
    if (!args.email) throw new Error("--email or SAPEN_DATASET_EMAIL is required with --export-id");
    args.password = resolveSecretInput({
      cliPassword: args.password,
      cliPasswordFile: args.passwordFile,
      cliPasswordStdin: args.passwordStdin,
      envPassword: process.env.SAPEN_DATASET_PASSWORD,
      envPasswordFile: process.env.SAPEN_DATASET_PASSWORD_FILE,
      envPasswordName: "SAPEN_DATASET_PASSWORD",
      envPasswordFileName: "SAPEN_DATASET_PASSWORD_FILE",
      secretDescription: "dataset operator password",
    }).secret;
  }
  return args;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizeChecksum(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(trimmed)) return `sha256:${trimmed}`;
  if (/^sha256:[a-f0-9]{64}$/.test(trimmed)) return trimmed;
  return null;
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function safeCacheName(objectRefId, ref) {
  const checksum = normalizeChecksum(ref.expectedChecksum ?? ref.checksum);
  if (checksum) return checksum.replace("sha256:", "sha256-");
  return safeName(objectRefId);
}

function imageExtension(filename, fallback = ".png") {
  const match = typeof filename === "string" ? filename.match(/\.[a-zA-Z0-9]+$/) : null;
  return match ? match[0].toLowerCase() : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeBytes(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRows(header, rows) {
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function unwrapRefs(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.refs)) return value.refs;
  if (Array.isArray(value?.refs?.refs)) return value.refs.refs;
  throw new Error("MATERIALIZATION_REFS_INVALID");
}

async function sessionCookieFromLogin(baseUrl, args) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: args.email, password: args.password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) throw new Error(body?.error || `LOGIN_HTTP_${response.status}`);
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("LOGIN_SESSION_COOKIE_MISSING");
  return cookie.split(";")[0];
}

async function fetchJsonWithCookie(url, cookie) {
  const response = await fetch(url, { headers: { cookie } });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) throw new Error(body?.error || `HTTP_${response.status}`);
  return body;
}

async function fetchManifestWithCookie(url, cookie) {
  const response = await fetch(url, { headers: { cookie } });
  if (!response.ok) throw new Error(`MANIFEST_HTTP_${response.status}`);
  return response.json();
}

async function loadInputs(args) {
  if (!args.exportId) {
    return {
      manifest: await readJson(args.manifestPath),
      refs: unwrapRefs(await readJson(args.refsPath)),
    };
  }

  const baseUrl = args.baseUrl.replace(/\/$/, "");
  const cookie = await sessionCookieFromLogin(baseUrl, args);
  const [manifest, refsBody] = await Promise.all([
    fetchManifestWithCookie(`${baseUrl}/api/exports/${args.exportId}/download?file=manifest`, cookie),
    fetchJsonWithCookie(`${baseUrl}/api/exports/${args.exportId}/materialization-refs`, cookie),
  ]);
  return { manifest, refs: unwrapRefs(refsBody.refs) };
}

function s3Client() {
  for (const name of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"]) {
    if (!process.env[name]) throw new Error(`${name} is required for storageKey downloads`);
  }
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || "true").toLowerCase() !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
}

async function downloadS3Object(client, storageKey) {
  const response = await client.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey,
  }));
  if (!response.Body) throw new Error(`OBJECT_BODY_EMPTY:${storageKey}`);
  return Buffer.from(await response.Body.transformToByteArray());
}

class Materializer {
  constructor({ manifest, refs, outputDir, verifyChecksums }) {
    this.manifest = manifest;
    this.refs = new Map(refs.map((ref) => [ref.objectRefId, ref]));
    this.outputDir = path.resolve(outputDir);
    this.cacheDir = path.join(this.outputDir, ".cache", "objects");
    this.verifyChecksums = verifyChecksums;
    this.cache = new Map();
    this.outputChecksums = {};
    this.report = {
      exportId: manifest.exportId ?? manifest.snapshotId ?? null,
      manifestVersion: manifest.manifestVersion,
      startedAt: new Date().toISOString(),
      warnings: [
        {
          code: "INSTSEG_MASK_FORMAT_TIFF_I32",
          message: "Instance masks are written as 32-bit integer TIFF; use SCNN-001 if the CNN loader environment cannot consume them.",
        },
      ],
      counts: {
        instseg: 0,
        classification: 0,
        semsegSapHeartwood: 0,
        semsegCopper: 0,
        cachedObjects: 0,
      },
    };
    this.s3 = null;
  }

  ref(objectRefId) {
    const ref = this.refs.get(objectRefId);
    if (!ref) throw new Error(`OBJECT_REF_MISSING:${objectRefId}`);
    return ref;
  }

  async objectBytes(objectRefId) {
    if (this.cache.has(objectRefId)) return this.cache.get(objectRefId);
    const ref = this.ref(objectRefId);
    const cachePath = path.join(this.cacheDir, safeCacheName(objectRefId, ref));
    let bytes = await fs.readFile(cachePath).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });

    if (!bytes) {
      if (ref.localPath) {
        bytes = await fs.readFile(ref.localPath);
      } else if (ref.presignedUrl) {
        const response = await fetch(ref.presignedUrl);
        if (!response.ok) throw new Error(`PRESIGNED_DOWNLOAD_FAILED:${objectRefId}:${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      } else if (ref.storageKey) {
        this.s3 ??= s3Client();
        bytes = await downloadS3Object(this.s3, ref.storageKey);
      } else {
        throw new Error(`OBJECT_SOURCE_MISSING:${objectRefId}`);
      }
      await writeBytes(cachePath, bytes);
      this.report.counts.cachedObjects += 1;
    }

    if (this.verifyChecksums) {
      const expectedChecksum = normalizeChecksum(ref.expectedChecksum ?? ref.checksum);
      if (expectedChecksum && expectedChecksum !== sha256(bytes)) {
        throw new Error(`CHECKSUM_MISMATCH:${objectRefId}`);
      }
    }
    const expectedSize = Number.isInteger(ref.expectedSize) ? ref.expectedSize : ref.size;
    if (Number.isInteger(expectedSize) && bytes.byteLength !== expectedSize) {
      throw new Error(`SIZE_MISMATCH:${objectRefId}`);
    }
    this.cache.set(objectRefId, bytes);
    return bytes;
  }

  async recordOutput(relativePath, bytes) {
    const target = path.join(this.outputDir, relativePath);
    await writeBytes(target, bytes);
    this.outputChecksums[relativePath] = sha256(bytes);
    return target;
  }

  async verifyImageDimensions(bytes, expected, objectRefId) {
    if (!expected?.width || !expected?.height) return;
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== expected.width || metadata.height !== expected.height) {
      throw new Error(`DIMENSION_MISMATCH:${objectRefId}`);
    }
  }

  async writeImage(objectRefId, relativePath, expected) {
    const bytes = await this.objectBytes(objectRefId);
    await this.verifyImageDimensions(bytes, expected, objectRefId);
    return this.recordOutput(relativePath, bytes);
  }

  async semanticPng(objectRefId, width, height, rawMap) {
    const bytes = await this.objectBytes(objectRefId);
    if (bytes.byteLength !== width * height) throw new Error(`MASK_SIZE_MISMATCH:${objectRefId}`);
    const mapped = Buffer.alloc(bytes.byteLength);
    for (let index = 0; index < bytes.byteLength; index += 1) {
      const value = bytes[index];
      if (!Object.prototype.hasOwnProperty.call(rawMap, String(value))) {
        throw new Error(`SEMANTIC_LABEL_INVALID:${objectRefId}:${value}`);
      }
      mapped[index] = Number(rawMap[String(value)]);
    }
    return sharp(mapped, { raw: { width, height, channels: 1 } }).png().toBuffer();
  }

  encodeUint32Tiff(width, height, values) {
    const entries = [
      [256, 4, 1, width],
      [257, 4, 1, height],
      [258, 3, 1, 32],
      [259, 3, 1, 1],
      [262, 3, 1, 1],
      [273, 4, 1, 8 + 2 + 10 * 12 + 4],
      [277, 3, 1, 1],
      [278, 4, 1, height],
      [279, 4, 1, width * height * 4],
      [339, 3, 1, 1],
    ];
    const headerSize = 8 + 2 + entries.length * 12 + 4;
    const buffer = Buffer.alloc(headerSize + width * height * 4);
    let offset = 0;
    buffer.write("II", offset, "ascii"); offset += 2;
    buffer.writeUInt16LE(42, offset); offset += 2;
    buffer.writeUInt32LE(8, offset); offset += 4;
    buffer.writeUInt16LE(entries.length, offset); offset += 2;
    for (const [tag, type, count, value] of entries) {
      buffer.writeUInt16LE(tag, offset); offset += 2;
      buffer.writeUInt16LE(type, offset); offset += 2;
      buffer.writeUInt32LE(count, offset); offset += 4;
      if (type === 3 && count === 1) {
        buffer.writeUInt16LE(value, offset);
        offset += 4;
      } else {
        buffer.writeUInt32LE(value, offset);
        offset += 4;
      }
    }
    buffer.writeUInt32LE(0, offset); offset += 4;
    for (let index = 0; index < values.length; index += 1) {
      buffer.writeUInt32LE(values[index], offset + index * 4);
    }
    return buffer;
  }

  async writeInstseg() {
    for (const item of this.manifest.fullImageItems ?? []) {
      const split = item.split === "val" ? "val" : "train";
      const sourceId = safeName(item.sourceImage.id);
      const imageExt = imageExtension(item.sourceImage.filename);
      await this.writeImage(
        item.sourceImage.objectRefId,
        `instseg/${split}/images/${sourceId}${imageExt}`,
        item.sourceImage,
      );

      const width = item.instanceMask.width;
      const height = item.instanceMask.height;
      const values = new Uint32Array(width * height);
      const cropRefs = new Map((item.sourceCropRefs ?? []).map((ref) => [ref.derivedCropId, ref]));
      for (const instance of item.instanceMask.instanceIdMap ?? []) {
        const cropRef = cropRefs.get(instance.derivedCropId);
        if (!cropRef) throw new Error(`INSTANCE_CROP_REF_MISSING:${instance.derivedCropId}`);
        if (!instance.supportGeometryObjectRefId) {
          throw new Error(`INSTANCE_SUPPORT_REF_MISSING:${instance.derivedCropId}`);
        }
        const maskWidth = instance.supportGeometryWidth ?? cropRef.cropWidth;
        const maskHeight = instance.supportGeometryHeight ?? cropRef.cropHeight;
        if (!Number.isInteger(cropRef.sourceRect.x) || !Number.isInteger(cropRef.sourceRect.y)) {
          throw new Error(`INSTANCE_TRANSFORM_UNSUPPORTED:${instance.derivedCropId}`);
        }
        if (cropRef.sourceRect.width !== maskWidth || cropRef.sourceRect.height !== maskHeight) {
          throw new Error(`INSTANCE_MASK_DIMENSION_MISMATCH:${instance.derivedCropId}`);
        }
        const bytes = await this.objectBytes(instance.supportGeometryObjectRefId);
        if (bytes.byteLength !== maskWidth * maskHeight) {
          throw new Error(`INSTANCE_SUPPORT_SIZE_MISMATCH:${instance.supportGeometryObjectRefId}`);
        }
        for (let index = 0; index < bytes.byteLength; index += 1) {
          if (bytes[index] === 0) continue;
          const y = Math.floor(index / maskWidth);
          const x = index % maskWidth;
          const sourceX = cropRef.sourceRect.x + x;
          const sourceY = cropRef.sourceRect.y + y;
          if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) {
            throw new Error(`INSTANCE_PIXEL_OUT_OF_BOUNDS:${instance.derivedCropId}`);
          }
          const targetIndex = sourceY * width + sourceX;
          if (values[targetIndex] !== 0 && values[targetIndex] !== instance.instanceId) {
            throw new Error(`INSTANCE_OVERLAP:${item.sourceImage.id}`);
          }
          values[targetIndex] = instance.instanceId;
        }
      }
      const tiff = this.encodeUint32Tiff(width, height, values);
      await this.recordOutput(`instseg/${split}/masks/${sourceId}.tif`, tiff);
      this.report.counts.instseg += 1;
    }
  }

  async writeClassification() {
    const header = [
      "sample_id",
      "crop_path",
      "image_path",
      "label",
      "source_image_id",
      "crop_id",
      "bbox_x",
      "bbox_y",
      "bbox_w",
      "bbox_h",
      "group_key",
      "split",
    ];
    const rowsBySplit = { train: [], val: [] };
    for (const item of this.manifest.classificationItems ?? []) {
      const split = item.split === "val" ? "val" : "train";
      const cropId = safeName(item.derivedCropId ?? item.cropId);
      const relativePath = `classification/${split}/images/${cropId}.png`;
      const written = await this.writeImage(item.cropImage.objectRefId, relativePath, item.cropImage);
      rowsBySplit[split].push([
        item.itemId,
        written,
        written,
        item.classification.sapenCnnLabel,
        item.sourceImageId,
        item.derivedCropId ?? item.cropId,
        item.sourceRect.x,
        item.sourceRect.y,
        item.sourceRect.width,
        item.sourceRect.height,
        item.groupKey,
        split,
      ]);
      this.report.counts.classification += 1;
    }
    for (const split of ["train", "val"]) {
      await fs.mkdir(path.join(this.outputDir, `classification/${split}/images`), { recursive: true });
      await fs.writeFile(
        path.join(this.outputDir, `classification/${split}_manifest.csv`),
        csvRows(header, rowsBySplit[split]),
      );
    }
  }

  async writeSemseg() {
    for (const item of this.manifest.cropSemanticItems ?? []) {
      const split = item.split === "val" ? "val" : "train";
      const taskDir = item.task === "COPPER_SEMSEG" ? "copper" : "sap_heartwood";
      const cropId = safeName(item.derivedCropId ?? item.cropId);
      await this.writeImage(
        item.cropImage.objectRefId,
        `semseg/${taskDir}/${split}/images/${cropId}.png`,
        item.cropImage,
      );
      const rawMap = item.labelMapping?.raw ?? {};
      if (item.semanticMask.format !== "u8raw-v1") {
        throw new Error(`SEMANTIC_MASK_FORMAT_UNSUPPORTED:${item.semanticMask.objectRefId}`);
      }
      const png = await this.semanticPng(
        item.semanticMask.objectRefId,
        item.semanticMask.width,
        item.semanticMask.height,
        rawMap,
      );
      await this.recordOutput(`semseg/${taskDir}/${split}/masks/${cropId}.png`, png);
      if (item.task === "COPPER_SEMSEG") this.report.counts.semsegCopper += 1;
      else this.report.counts.semsegSapHeartwood += 1;
    }
  }

  async writeMetadata() {
    await writeJson(path.join(this.outputDir, "source_manifest.json"), this.manifest);
    await writeJson(path.join(this.outputDir, "checksums.json"), this.outputChecksums);
    await writeJson(path.join(this.outputDir, "label_mappings.json"), {
      classification: {
        COPPER_SLICE: "COPPER",
        SAP_HEARTWOOD_SLICE: "HEARTWOOD_STAINED",
      },
      semantic: {
        SAP_HEARTWOOD_SEMSEG: { 0: 0, 1: 1, 2: 2 },
        COPPER_SEMSEG: { 0: 0, 3: 1 },
      },
    });
    this.report.completedAt = new Date().toISOString();
    await writeJson(path.join(this.outputDir, "materialization_report.json"), this.report);
    await fs.writeFile(
      path.join(this.outputDir, "README.md"),
      `# SaPen-CNN Materialized Dataset\n\nSource export: ${this.report.exportId ?? "unknown"}\n\nPoint sapen-cnn configs at the instseg, classification, and semseg folders in this directory.\n`,
    );
  }

  async run() {
    if (this.manifest.manifestVersion !== "sapen-annotate-cnn-training-dataset-v1") {
      throw new Error(`MANIFEST_VERSION_UNSUPPORTED:${this.manifest.manifestVersion}`);
    }
    await this.writeInstseg();
    await this.writeClassification();
    await this.writeSemseg();
    await this.writeMetadata();
  }
}

async function prepareOutputDir(outputDir, overwrite) {
  const resolved = path.resolve(outputDir);
  const existing = await fs.readdir(resolved).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (existing && existing.length > 0) {
    if (!overwrite) throw new Error("OUTPUT_DIR_NOT_EMPTY");
    await fs.rm(resolved, { recursive: true, force: true });
  }
  await fs.mkdir(path.join(resolved, ".cache/objects"), { recursive: true });
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const outputDir = await prepareOutputDir(args.outputDir, args.overwrite);
  const { manifest, refs } = await loadInputs(args);
  const materializer = new Materializer({
    manifest,
    refs,
    outputDir,
    verifyChecksums: args.verifyChecksums,
  });
  await materializer.run();
  console.log(JSON.stringify({
    outputDir,
    counts: materializer.report.counts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
