import { type Prisma, type PrismaClient } from "@prisma/client";

import { APPROVED_SNAPSHOT_FRESHNESS_POLICY } from "@/server/domain/approvedSnapshotFreshness";
import type { CropWorkflowCandidate } from "@/server/domain/cropReadiness";
import type { ExportPackageSource } from "@/server/domain/exportPackageWriter";
import { getObjectBytes } from "@/server/storage/s3";

type SnapshotDb = PrismaClient | Prisma.TransactionClient;

export const SAPEN_CNN_TRAINING_TARGET = "sapen_cnn_training";
export const SAPEN_CNN_TRAINING_MANIFEST_VERSION = "sapen-annotate-cnn-training-dataset-v1";

type SnapshotUser = { id: string; email: string; name: string | null };
type SnapshotProject = { id: string; name: string };
type SnapshotCandidate = CropWorkflowCandidate;
type SplitName = "train" | "val";

const SPLIT_SEED = "sapen-cnn-training-v1";

const SAP_HEARTWOOD_LABEL_MAPPING = {
  raw: { "0": 0, "1": 1, "2": 2 },
  classes: {
    "0": "background",
    "1": "sapwood",
    "2": "heartwood",
  },
};

const COPPER_LABEL_MAPPING = {
  raw: { "0": 0, "3": 1 },
  classes: {
    "0": "background",
    "1": "copper",
  },
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeExtension(filename: string | null, contentType: string | null, fallback: string) {
  const ext = filename?.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (ext) return ext;
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg") return ".jpg";
  return fallback;
}

function groupKey(candidate: SnapshotCandidate) {
  const tNumber = cleanText(candidate.crop.sourceImage.sampleMetadata?.tNumber);
  const specimen = cleanText(candidate.crop.sourceImage.sampleMetadata?.specimenIdentifier);
  if (tNumber || specimen) return `${tNumber ?? "unknown-t"}::${specimen ?? "unknown-specimen"}`;
  return `source:${candidate.crop.sourceImageId}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildGroupSplitMap(groupKeys: string[]) {
  const uniqueGroups = Array.from(new Set(groupKeys)).sort();
  const sorted = uniqueGroups
    .map((key) => ({ key, hash: hashText(`${SPLIT_SEED}:${key}`) }))
    .sort((left, right) => left.hash - right.hash || left.key.localeCompare(right.key));
  const valCount = sorted.length >= 2 ? Math.max(1, Math.round(sorted.length * 0.2)) : 0;
  const valGroups = new Set(sorted.slice(-valCount).map((entry) => entry.key));
  const map: Record<string, SplitName> = {};
  for (const entry of sorted) map[entry.key] = valGroups.has(entry.key) ? "val" : "train";
  return map;
}

function splitFor(map: Record<string, SplitName>, key: string): SplitName {
  return map[key] ?? "train";
}

function userManifest(user: { id: string; email: string; name: string | null } | null) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

function approvalManifest(
  approval: {
    decisionId: string;
    approvedBy: { id: string; email: string; name: string | null };
    approvedAt: Date;
  } | null,
) {
  if (!approval) return null;
  return {
    decisionId: approval.decisionId,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt.toISOString(),
  };
}

function sourceImageRef(candidate: SnapshotCandidate) {
  return {
    objectRefId: `image:${candidate.crop.sourceImage.id}`,
    path: `source-images/${candidate.crop.sourceImage.id}${safeExtension(
      candidate.crop.sourceImage.filename,
      candidate.crop.sourceImage.contentType,
      ".bin",
    )}`,
  };
}

function cropImageRef(candidate: SnapshotCandidate) {
  return {
    objectRefId: `crop:${candidate.crop.id}`,
    path: `crops/${candidate.crop.id}.png`,
  };
}

function semanticMaskRef(candidate: SnapshotCandidate) {
  if (!candidate.semanticMask) return null;
  return {
    objectRefId: `artifact:${candidate.semanticMask.id}`,
    path: `masks/crop-semantic/${candidate.semanticMask.id}.u8raw`,
  };
}

function supportMaskRef(candidate: SnapshotCandidate) {
  if (!candidate.supportMask) return null;
  return {
    objectRefId: `artifact:${candidate.supportMask.id}`,
    path: `masks/crop-support/${candidate.supportMask.id}.u8raw`,
  };
}

function objectReference(params: {
  objectRefId: string;
  role: string;
  checksum: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  coordinateSpace: string | null;
  labelSchemaVersionId?: string | null;
}) {
  return {
    objectRefId: params.objectRefId,
    role: params.role,
    checksum: params.checksum,
    size: params.size,
    width: params.width,
    height: params.height,
    format: params.format,
    coordinateSpace: params.coordinateSpace,
    labelSchemaVersionId: params.labelSchemaVersionId ?? null,
  };
}

function sourceImageManifest(candidate: SnapshotCandidate) {
  const ref = sourceImageRef(candidate);
  return {
    id: candidate.crop.sourceImage.id,
    filename: candidate.crop.sourceImage.filename,
    objectRefId: ref.objectRefId,
    contentType: candidate.crop.sourceImage.contentType,
    size: candidate.crop.sourceImage.size,
    width: candidate.crop.sourceImage.width,
    height: candidate.crop.sourceImage.height,
    checksum: candidate.crop.sourceImage.checksum,
    uploadedAt: candidate.crop.sourceImage.uploadedAt.toISOString(),
    sampleMetadata: candidate.crop.sourceImage.sampleMetadata,
    acquisitionMetadata: candidate.crop.sourceImage.acquisitionMetadata
      ? {
          ...candidate.crop.sourceImage.acquisitionMetadata,
          capturedAt: candidate.crop.sourceImage.acquisitionMetadata.capturedAt?.toISOString() ?? null,
        }
      : null,
  };
}

function sourceRect(candidate: SnapshotCandidate) {
  return {
    x: candidate.crop.sourceX,
    y: candidate.crop.sourceY,
    width: candidate.crop.sourceWidth,
    height: candidate.crop.sourceHeight,
    x0: candidate.crop.sourceX,
    y0: candidate.crop.sourceY,
    x1: candidate.crop.sourceX + candidate.crop.sourceWidth,
    y1: candidate.crop.sourceY + candidate.crop.sourceHeight,
  };
}

function sapenCnnClassificationLabel(value: string) {
  if (value === "COPPER_SLICE") return "COPPER";
  if (value === "SAP_HEARTWOOD_SLICE") return "HEARTWOOD_STAINED";
  return null;
}

function readyCandidate(candidate: SnapshotCandidate) {
  return (
    candidate.readinessStatus === "READY" &&
    candidate.supportGeometrySource &&
    candidate.semanticMask &&
    candidate.classification &&
    (candidate.supportGeometrySource === "SEMANTIC_FOREGROUND" || candidate.supportMask)
  );
}

async function readMaskBytes(
  version: { storageKey: string; size: number; width: number; height: number; id: string } | null,
) {
  if (!version) return { bytes: null, warning: "MASK_MISSING" };
  try {
    const bytes = await getObjectBytes(version.storageKey);
    if (bytes.byteLength !== version.width * version.height) {
      return { bytes: null, warning: "MASK_BYTE_LENGTH_MISMATCH" };
    }
    return { bytes, warning: null };
  } catch {
    return { bytes: null, warning: "MASK_READ_FAILED" };
  }
}

function foregroundPixelIndexes(bytes: Uint8Array, candidate: SnapshotCandidate) {
  const indexes: Array<{ sourceX: number; sourceY: number }> = [];
  const width = candidate.crop.cropWidth;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    if (bytes[index] === 0) continue;
    const y = Math.floor(index / width);
    const x = index % width;
    indexes.push({
      sourceX: candidate.crop.sourceX + x,
      sourceY: candidate.crop.sourceY + y,
    });
  }
  return indexes;
}

async function supportForegroundForInstance(candidate: SnapshotCandidate) {
  const source =
    candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK"
      ? candidate.supportMask
      : candidate.semanticMask;
  const read = await readMaskBytes(source);
  if (!read.bytes) return { pixels: [], warning: read.warning ?? "MASK_READ_FAILED" };
  return { pixels: foregroundPixelIndexes(read.bytes, candidate), warning: null };
}

function semanticTask(candidate: SnapshotCandidate) {
  if (
    candidate.semanticMask?.cropSemanticMode === "SAP_HEARTWOOD" &&
    candidate.classification?.class === "SAP_HEARTWOOD_SLICE"
  ) {
    return "SAP_HEARTWOOD_SEMSEG" as const;
  }
  if (
    candidate.semanticMask?.cropSemanticMode === "COPPER" &&
    candidate.classification?.class === "COPPER_SLICE"
  ) {
    return "COPPER_SEMSEG" as const;
  }
  return null;
}

function invalidSemanticLabels(task: "SAP_HEARTWOOD_SEMSEG" | "COPPER_SEMSEG", bytes: Uint8Array) {
  const allowed = task === "SAP_HEARTWOOD_SEMSEG" ? new Set([0, 1, 2]) : new Set([0, 3]);
  const invalid = new Set<number>();
  for (const value of bytes) {
    if (!allowed.has(value)) invalid.add(value);
  }
  return Array.from(invalid).sort((left, right) => left - right);
}

async function loadLabelSchemas(db: SnapshotDb, labelSchemaVersionIds: string[]) {
  return db.labelSchemaVersion.findMany({
    where: { id: { in: labelSchemaVersionIds } },
    orderBy: [{ name: "asc" }, { version: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      version: true,
      status: true,
      definitions: {
        orderBy: [{ sortOrder: "asc" }, { stableId: "asc" }],
        select: {
          stableId: true,
          byteValue: true,
          displayName: true,
          semanticMeaning: true,
          applicability: true,
          colorToken: true,
          sortOrder: true,
          isTrainable: true,
        },
      },
    },
  });
}

function collectLabelSchemaIds(candidates: SnapshotCandidate[]) {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.supportMask) ids.add(candidate.supportMask.labelSchemaVersionId);
    if (candidate.semanticMask) ids.add(candidate.semanticMask.labelSchemaVersionId);
    if (candidate.classification) ids.add(candidate.classification.labelSchemaVersionId);
  }
  return Array.from(ids).sort();
}

function addObjectSource(
  sources: Map<string, ExportPackageSource>,
  source: ExportPackageSource,
) {
  sources.set(source.objectRefId ?? source.path, source);
}

export async function buildSapenCnnTrainingSnapshot(params: {
  db: SnapshotDb;
  exportId: string;
  exportedAt: Date;
  exportedBy: SnapshotUser;
  project: SnapshotProject;
  candidates: SnapshotCandidate[];
}) {
  const readyCandidates = params.candidates.filter(readyCandidate);
  const groupMap = buildGroupSplitMap(readyCandidates.map(groupKey));
  const objectSources = new Map<string, ExportPackageSource>();
  const skippedItems: Array<Record<string, unknown>> = [];
  const warnings: Array<Record<string, unknown>> = [];

  for (const candidate of readyCandidates) {
    const sourceRef = sourceImageRef(candidate);
    addObjectSource(objectSources, {
      objectRefId: sourceRef.objectRefId,
      path: sourceRef.path,
      storageKey: candidate.crop.sourceImage.storageKey,
      expectedChecksum: candidate.crop.sourceImage.checksum ?? null,
      expectedSize: candidate.crop.sourceImage.size ?? null,
      resourceType: "ImageAsset",
      resourceId: candidate.crop.sourceImage.id,
    });

    const cropRef = cropImageRef(candidate);
    addObjectSource(objectSources, {
      objectRefId: cropRef.objectRefId,
      path: cropRef.path,
      storageKey: candidate.crop.storageKey,
      expectedChecksum: candidate.crop.checksum ?? null,
      expectedSize: candidate.crop.byteSize ?? null,
      resourceType: "DerivedSliceCrop",
      resourceId: candidate.crop.id,
    });

    const semanticRef = semanticMaskRef(candidate);
    if (candidate.semanticMask && semanticRef) {
      addObjectSource(objectSources, {
        objectRefId: semanticRef.objectRefId,
        path: semanticRef.path,
        storageKey: candidate.semanticMask.storageKey,
        expectedChecksum: candidate.semanticMask.checksum ?? null,
        expectedSize: candidate.semanticMask.size ?? null,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.semanticMask.id,
      });
    }

    const supportRef = supportMaskRef(candidate);
    if (candidate.supportMask && supportRef) {
      addObjectSource(objectSources, {
        objectRefId: supportRef.objectRefId,
        path: supportRef.path,
        storageKey: candidate.supportMask.storageKey,
        expectedChecksum: candidate.supportMask.checksum ?? null,
        expectedSize: candidate.supportMask.size ?? null,
        resourceType: "AnnotationArtifactVersion",
        resourceId: candidate.supportMask.id,
      });
    }
  }

  const classificationItems = readyCandidates.flatMap((candidate) => {
    const mappedLabel = sapenCnnClassificationLabel(candidate.classification?.class ?? "");
    if (!mappedLabel || !candidate.classification) {
      skippedItems.push({
        type: "classification",
        sourceImageId: candidate.crop.sourceImageId,
        derivedCropId: candidate.crop.id,
        sliceInstanceId: candidate.crop.sliceInstanceId,
        reason: "CLASSIFICATION_LABEL_SKIPPED",
        class: candidate.classification?.class ?? null,
      });
      return [];
    }
    const key = groupKey(candidate);
    const cropRef = cropImageRef(candidate);
    const sourceRef = sourceImageRef(candidate);
    return [{
      itemId: `classification:${candidate.classification.id}`,
      sourceImageId: candidate.crop.sourceImageId,
      sourceImage: sourceImageManifest(candidate),
      derivedCropId: candidate.crop.id,
      cropId: candidate.crop.id,
      cropImage: objectReference({
        objectRefId: cropRef.objectRefId,
        role: "derived-crop",
        checksum: candidate.crop.checksum,
        size: candidate.crop.byteSize,
        width: candidate.crop.cropWidth,
        height: candidate.crop.cropHeight,
        format: candidate.crop.format,
        coordinateSpace: candidate.crop.coordinateSpace,
      }),
      sourceImageRef: objectReference({
        objectRefId: sourceRef.objectRefId,
        role: "source-image",
        checksum: candidate.crop.sourceImage.checksum,
        size: candidate.crop.sourceImage.size,
        width: candidate.crop.sourceImage.width,
        height: candidate.crop.sourceImage.height,
        format: candidate.crop.sourceImage.contentType,
        coordinateSpace: "SOURCE_IMAGE_PIXEL",
      }),
      sliceInstanceId: candidate.crop.sliceInstanceId,
      sourceRect: sourceRect(candidate),
      transformToSource: candidate.crop.transformToSourceJson,
      originalBBoxVersion: {
        bboxVersionId: candidate.crop.bboxVersionId,
        version: candidate.crop.bboxVersion.version,
      },
      classification: {
        classificationVersionId: candidate.classification.id,
        classLabel: candidate.classification.class,
        sapenCnnLabel: mappedLabel,
        approval: approvalManifest(candidate.classification.approval),
        createdBy: userManifest(candidate.classification.createdBy),
        createdAt: candidate.classification.createdAt.toISOString(),
      },
      groupKey: key,
      split: splitFor(groupMap, key),
      warnings: [],
    }];
  });

  const cropSemanticItems = [];
  for (const candidate of readyCandidates) {
    const task = semanticTask(candidate);
    if (!task || !candidate.semanticMask) {
      skippedItems.push({
        type: "crop-semantic",
        sourceImageId: candidate.crop.sourceImageId,
        derivedCropId: candidate.crop.id,
        sliceInstanceId: candidate.crop.sliceInstanceId,
        reason: "SEMANTIC_TASK_MISMATCH",
        cropSemanticMode: candidate.semanticMask?.cropSemanticMode ?? null,
        class: candidate.classification?.class ?? null,
      });
      continue;
    }
    if (task === "COPPER_SEMSEG" && !candidate.supportMask) {
      skippedItems.push({
        type: "crop-semantic",
        sourceImageId: candidate.crop.sourceImageId,
        derivedCropId: candidate.crop.id,
        reason: "COPPER_SUPPORT_REQUIRED",
      });
      continue;
    }
    const read = await readMaskBytes(candidate.semanticMask);
    if (!read.bytes) {
      skippedItems.push({
        type: "crop-semantic",
        sourceImageId: candidate.crop.sourceImageId,
        derivedCropId: candidate.crop.id,
        semanticMaskVersionId: candidate.semanticMask.id,
        reason: read.warning ?? "SEMANTIC_MASK_READ_FAILED",
      });
      continue;
    }
    const invalidLabels = invalidSemanticLabels(task, read.bytes);
    if (invalidLabels.length > 0) {
      const warning = {
        type: "crop-semantic",
        sourceImageId: candidate.crop.sourceImageId,
        derivedCropId: candidate.crop.id,
        semanticMaskVersionId: candidate.semanticMask.id,
        code: "SEMANTIC_LABELS_INVALID_FOR_TASK",
        invalidLabels,
      };
      warnings.push(warning);
      skippedItems.push({ ...warning, reason: "SEMANTIC_LABELS_INVALID_FOR_TASK" });
      continue;
    }

    const key = groupKey(candidate);
    const cropRef = cropImageRef(candidate);
    const semanticRef = semanticMaskRef(candidate);
    const supportRef = supportMaskRef(candidate);
    cropSemanticItems.push({
      itemId: `crop-semantic:${candidate.semanticMask.id}`,
      task,
      sourceImageId: candidate.crop.sourceImageId,
      sourceImage: sourceImageManifest(candidate),
      derivedCropId: candidate.crop.id,
      cropId: candidate.crop.id,
      cropImage: objectReference({
        objectRefId: cropRef.objectRefId,
        role: "derived-crop",
        checksum: candidate.crop.checksum,
        size: candidate.crop.byteSize,
        width: candidate.crop.cropWidth,
        height: candidate.crop.cropHeight,
        format: candidate.crop.format,
        coordinateSpace: candidate.crop.coordinateSpace,
      }),
      semanticMask: {
        ...objectReference({
          objectRefId: semanticRef?.objectRefId ?? `artifact:${candidate.semanticMask.id}`,
          role: "crop-semantic-mask",
          checksum: candidate.semanticMask.checksum,
          size: candidate.semanticMask.size,
          width: candidate.semanticMask.width,
          height: candidate.semanticMask.height,
          format: candidate.semanticMask.format,
          coordinateSpace: candidate.semanticMask.coordinateSpace,
          labelSchemaVersionId: candidate.semanticMask.labelSchemaVersionId,
        }),
        artifactVersionId: candidate.semanticMask.id,
        cropSemanticMode: candidate.semanticMask.cropSemanticMode,
        approval: approvalManifest(candidate.semanticMask.approval),
      },
      supportGeometry: {
        source: candidate.supportGeometrySource,
        supportMaskVersionId:
          candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK"
            ? candidate.supportMask?.id ?? null
            : null,
        semanticMaskVersionId:
          candidate.supportGeometrySource === "SEMANTIC_FOREGROUND" ? candidate.semanticMask.id : null,
      },
      supportMask: candidate.supportMask && supportRef
        ? {
            ...objectReference({
              objectRefId: supportRef.objectRefId,
              role: "crop-support-mask",
              checksum: candidate.supportMask.checksum,
              size: candidate.supportMask.size,
              width: candidate.supportMask.width,
              height: candidate.supportMask.height,
              format: candidate.supportMask.format,
              coordinateSpace: candidate.supportMask.coordinateSpace,
              labelSchemaVersionId: candidate.supportMask.labelSchemaVersionId,
            }),
            artifactVersionId: candidate.supportMask.id,
            approval: approvalManifest(candidate.supportMask.approval),
          }
        : null,
      classification: {
        classificationVersionId: candidate.classification?.id ?? null,
        class: candidate.classification?.class ?? null,
        approval: approvalManifest(candidate.classification?.approval ?? null),
      },
      labelMapping: task === "SAP_HEARTWOOD_SEMSEG" ? SAP_HEARTWOOD_LABEL_MAPPING : COPPER_LABEL_MAPPING,
      groupKey: key,
      split: splitFor(groupMap, key),
      warnings: [],
    });
  }

  const fullImageItems = [];
  const candidatesByImage = new Map<string, SnapshotCandidate[]>();
  for (const candidate of readyCandidates) {
    const list = candidatesByImage.get(candidate.crop.sourceImageId) ?? [];
    list.push(candidate);
    candidatesByImage.set(candidate.crop.sourceImageId, list);
  }

  for (const [sourceImageId, imageCandidates] of candidatesByImage) {
    const sorted = [...imageCandidates].sort(
      (left, right) =>
        left.crop.sourceY - right.crop.sourceY ||
        left.crop.sourceX - right.crop.sourceX ||
        left.crop.sliceInstanceId.localeCompare(right.crop.sliceInstanceId) ||
        left.crop.id.localeCompare(right.crop.id),
    );
    const occupied = new Map<string, SnapshotCandidate>();
    const overlapWarnings = [];
    const sourceImage = sorted[0]?.crop.sourceImage;
    if (!sourceImage?.width || !sourceImage.height) continue;

    for (const candidate of sorted) {
      const support = await supportForegroundForInstance(candidate);
      if (support.warning) {
        overlapWarnings.push({
          code: support.warning,
          sourceImageId,
          derivedCropId: candidate.crop.id,
          supportMaskVersionId: candidate.supportMask?.id ?? null,
          semanticMaskVersionId: candidate.semanticMask?.id ?? null,
        });
        continue;
      }
      for (const pixel of support.pixels) {
        if (
          pixel.sourceX < 0 ||
          pixel.sourceY < 0 ||
          pixel.sourceX >= sourceImage.width ||
          pixel.sourceY >= sourceImage.height
        ) {
          overlapWarnings.push({
            code: "SUPPORT_REPROJECTION_OUT_OF_BOUNDS",
            sourceImageId,
            derivedCropId: candidate.crop.id,
          });
          continue;
        }
        const key = `${pixel.sourceX}:${pixel.sourceY}`;
        const existing = occupied.get(key);
        if (existing && existing.crop.id !== candidate.crop.id) {
          overlapWarnings.push({
            code: "SUPPORT_REPROJECTION_OVERLAP",
            sourceImageId,
            derivedCropIds: [existing.crop.id, candidate.crop.id].sort(),
          });
        } else {
          occupied.set(key, candidate);
        }
      }
    }

    if (overlapWarnings.length > 0) {
      const uniqueWarnings = Array.from(
        new Map(overlapWarnings.map((warning) => [JSON.stringify(warning), warning])).values(),
      );
      warnings.push(...uniqueWarnings);
      skippedItems.push({
        type: "full-image-instance",
        sourceImageId,
        reason: "FULL_IMAGE_INSTANCE_CONFLICT",
        warnings: uniqueWarnings,
      });
      continue;
    }

    const first = sorted[0];
    const key = groupKey(first);
    fullImageItems.push({
      itemId: `full-image:${sourceImageId}`,
      sourceImage: sourceImageManifest(first),
      instanceMask: {
        derivation: "CROP_REPROJECTED_SUPPORT_GEOMETRY",
        format: "tiff-i32",
        coordinateSpace: "SOURCE_IMAGE_PIXEL",
        width: sourceImage.width,
        height: sourceImage.height,
        checksum: null,
        sourceCropIds: sorted.map((candidate) => candidate.crop.id),
        sourceSliceInstanceIds: sorted.map((candidate) => candidate.crop.sliceInstanceId),
        sourceArtifactVersionIds: sorted.flatMap((candidate) =>
          [
            candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK" ? candidate.supportMask?.id : null,
            candidate.supportGeometrySource === "SEMANTIC_FOREGROUND" ? candidate.semanticMask?.id : null,
          ].filter((id): id is string => Boolean(id)),
        ),
        instanceIdMap: sorted.map((candidate, index) => ({
          instanceId: index + 1,
          derivedCropId: candidate.crop.id,
          sliceInstanceId: candidate.crop.sliceInstanceId,
          supportGeometrySource: candidate.supportGeometrySource,
          supportGeometryObjectRefId:
            candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK"
              ? candidate.supportMask ? supportMaskRef(candidate)?.objectRefId ?? null : null
              : candidate.semanticMask ? semanticMaskRef(candidate)?.objectRefId ?? null : null,
          supportGeometryWidth:
            candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK"
              ? candidate.supportMask?.width ?? null
              : candidate.semanticMask?.width ?? null,
          supportGeometryHeight:
            candidate.supportGeometrySource === "EXPLICIT_SUPPORT_MASK"
              ? candidate.supportMask?.height ?? null
              : candidate.semanticMask?.height ?? null,
          supportMaskVersionId: candidate.supportMask?.id ?? null,
          semanticMaskVersionId: candidate.semanticMask?.id ?? null,
        })),
      },
      sourceCropRefs: sorted.map((candidate) => ({
        derivedCropId: candidate.crop.id,
        cropObjectRefId: cropImageRef(candidate).objectRefId,
        cropWidth: candidate.crop.cropWidth,
        cropHeight: candidate.crop.cropHeight,
        sourceRect: sourceRect(candidate),
        transformToSource: candidate.crop.transformToSourceJson,
      })),
      groupKey: key,
      split: splitFor(groupMap, key),
      warnings: [],
    });
  }

  const skippedNotReady = params.candidates.filter((candidate) => !readyCandidate(candidate));
  for (const candidate of skippedNotReady) {
    skippedItems.push({
      type: "crop-candidate",
      sourceImageId: candidate.crop.sourceImageId,
      derivedCropId: candidate.crop.id,
      sliceInstanceId: candidate.crop.sliceInstanceId,
      readinessStatus: candidate.readinessStatus,
      readinessReasons: candidate.readinessReasons,
      reason: "CROP_NOT_READY",
    });
  }

  const labelSchemas = await loadLabelSchemas(params.db, collectLabelSchemaIds(readyCandidates));
  const objectRefs = Array.from(objectSources.values()).map((source) => ({
    objectRefId: source.objectRefId ?? source.path,
    role: source.resourceType,
    path: source.path,
    resourceType: source.resourceType,
    resourceId: source.resourceId,
    checksum: source.expectedChecksum ?? null,
    size: source.expectedSize ?? null,
  }));

  const manifest = {
    manifestVersion: SAPEN_CNN_TRAINING_MANIFEST_VERSION,
    exportId: params.exportId,
    snapshotId: params.exportId,
    createdAt: params.exportedAt.toISOString(),
    exportedAt: params.exportedAt.toISOString(),
    createdBy: params.exportedBy,
    exportedBy: params.exportedBy,
    project: params.project,
    selection: {
      targets: [SAPEN_CNN_TRAINING_TARGET],
      approvedOnly: true,
      approvedSnapshotFreshnessPolicy: APPROVED_SNAPSHOT_FRESHNESS_POLICY,
      source: "crop-workflow-ready-candidates",
      packageMode: "manifest_only",
    },
    labelSchemas,
    splitPolicy: {
      seed: SPLIT_SEED,
      deterministicHash: "fnv1a32",
      ratios: { train: 0.8, val: 0.2 },
      groupKeyStrategy: "sampleMetadata.tNumber + specimenIdentifier else sourceImageId",
      groupSplitMap: groupMap,
    },
    objectAccess: {
      publicManifestUsesObjectRefIds: true,
      privateRefsEndpoint: `/api/exports/${params.exportId}/materialization-refs`,
      exposesStorageKeys: false,
    },
    objectRefs,
    fullImageItems,
    classificationItems,
    cropSemanticItems,
    skippedItems,
    warnings,
    summary: {
      itemCount: fullImageItems.length + classificationItems.length + cropSemanticItems.length,
      fullImageItemCount: fullImageItems.length,
      classificationItemCount: classificationItems.length,
      cropSemanticItemCount: cropSemanticItems.length,
      skippedItemCount: skippedItems.length,
      warningCount: warnings.length,
      objectRefCount: objectRefs.length,
      totalCropCandidates: params.candidates.length,
      readyCropCandidates: readyCandidates.length,
    },
  };

  return {
    manifest,
    objectSources: Array.from(objectSources.values()),
  };
}

export function sapenCnnTrainingExportItemsFromManifest(params: {
  manifest: Awaited<ReturnType<typeof buildSapenCnnTrainingSnapshot>>["manifest"];
}) {
  const rows: Prisma.ExportItemCreateManyExportBatchInput[] = [];
  const seen = new Set<string>();
  function add(row: Prisma.ExportItemCreateManyExportBatchInput) {
    const key = JSON.stringify(row);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  }

  for (const item of params.manifest.fullImageItems) {
    add({ role: "image", imageId: item.sourceImage.id });
  }
  for (const item of params.manifest.classificationItems) {
    add({ role: "original-image", imageId: item.sourceImageId, derivedCropId: item.derivedCropId });
    add({ role: "derived-crop", imageId: item.sourceImageId, derivedCropId: item.derivedCropId });
    add({
      role: "crop-slice-classification",
      imageId: item.sourceImageId,
      sliceClassificationVersionId: item.classification.classificationVersionId,
      derivedCropId: item.derivedCropId,
    });
  }
  for (const item of params.manifest.cropSemanticItems) {
    add({ role: "original-image", imageId: item.sourceImageId, derivedCropId: item.derivedCropId });
    add({ role: "derived-crop", imageId: item.sourceImageId, derivedCropId: item.derivedCropId });
    add({
      role: "crop-semantic-mask",
      imageId: item.sourceImageId,
      artifactVersionId: item.semanticMask.artifactVersionId,
      derivedCropId: item.derivedCropId,
    });
    if (item.supportMask) {
      add({
        role: "crop-support-mask",
        imageId: item.sourceImageId,
        artifactVersionId: item.supportMask.artifactVersionId,
        derivedCropId: item.derivedCropId,
      });
    }
  }
  return rows;
}
