import { CropSemanticMode, type Prisma } from "@prisma/client";

import { normalizeChecksum } from "@/server/uploads/integrity";

export const CROP_MASK_STATS_VERSION = "crop-mask-stats-v1";

export type CropMaskStatsKind = "crop-support-mask" | "crop-semantic-mask";

export type MaskForegroundBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropMaskStatsMetadata = {
  statsVersion: typeof CROP_MASK_STATS_VERSION;
  kind: CropMaskStatsKind;
  width: number;
  height: number;
  size: number;
  checksum: string | null;
  labelHistogram: Record<string, number>;
  foregroundPixelCount: number;
  foregroundBBox: MaskForegroundBBox | null;
  containsUnknownLabel: boolean;
  semanticMode?: CropSemanticMode;
  supportMaskVersionId?: string | null;
  supportChecksum?: string | null;
  supportCoveredSemanticPixelCount?: number;
  semanticOutsideSupportPixelCount?: number;
};

export type MaskStatsFingerprint = {
  width: number;
  height: number;
  size: number;
  checksum?: string | null;
  kind?: CropMaskStatsKind;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function normalizeHistogram(value: unknown) {
  if (!isRecord(value)) return null;
  const histogram: Record<string, number> = {};
  for (const [label, count] of Object.entries(value)) {
    if (!/^\d+$/.test(label) || !isNonNegativeInteger(count)) return null;
    histogram[label] = count;
  }
  return histogram;
}

function normalizeBBox(value: unknown): MaskForegroundBBox | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if (
    !isNonNegativeInteger(x) ||
    !isNonNegativeInteger(y) ||
    !isNonNegativeInteger(width) ||
    !isNonNegativeInteger(height) ||
    width === 0 ||
    height === 0
  ) {
    return undefined;
  }
  return { x, y, width, height };
}

export function parseCropMaskStatsMetadata(value: unknown): CropMaskStatsMetadata | null {
  if (!isRecord(value)) return null;
  if (value.statsVersion !== CROP_MASK_STATS_VERSION) return null;
  if (value.kind !== "crop-support-mask" && value.kind !== "crop-semantic-mask") return null;
  if (
    !isNonNegativeInteger(value.width) ||
    !isNonNegativeInteger(value.height) ||
    !isNonNegativeInteger(value.size) ||
    !isNonNegativeInteger(value.foregroundPixelCount) ||
    typeof value.containsUnknownLabel !== "boolean"
  ) {
    return null;
  }

  const checksum = value.checksum === null ? null : normalizeChecksum(String(value.checksum ?? ""));
  if (value.checksum !== null && !checksum) return null;
  const labelHistogram = normalizeHistogram(value.labelHistogram);
  if (!labelHistogram) return null;
  const foregroundBBox = normalizeBBox(value.foregroundBBox);
  if (foregroundBBox === undefined) return null;
  if (
    value.semanticMode !== undefined &&
    value.semanticMode !== CropSemanticMode.SAP_HEARTWOOD &&
    value.semanticMode !== CropSemanticMode.COPPER
  ) {
    return null;
  }

  const supportMaskVersionId =
    typeof value.supportMaskVersionId === "string"
      ? value.supportMaskVersionId
      : value.supportMaskVersionId === null
        ? null
        : undefined;
  const supportChecksum =
    value.supportChecksum === null || value.supportChecksum === undefined
      ? value.supportChecksum
      : normalizeChecksum(String(value.supportChecksum));
  if (value.supportChecksum !== undefined && value.supportChecksum !== null && !supportChecksum) {
    return null;
  }
  if (
    value.supportCoveredSemanticPixelCount !== undefined &&
    !isNonNegativeInteger(value.supportCoveredSemanticPixelCount)
  ) {
    return null;
  }
  if (
    value.semanticOutsideSupportPixelCount !== undefined &&
    !isNonNegativeInteger(value.semanticOutsideSupportPixelCount)
  ) {
    return null;
  }

  return {
    statsVersion: CROP_MASK_STATS_VERSION,
    kind: value.kind,
    width: value.width,
    height: value.height,
    size: value.size,
    checksum,
    labelHistogram,
    foregroundPixelCount: value.foregroundPixelCount,
    foregroundBBox,
    containsUnknownLabel: value.containsUnknownLabel,
    ...(value.semanticMode ? { semanticMode: value.semanticMode } : {}),
    ...(supportMaskVersionId !== undefined ? { supportMaskVersionId } : {}),
    ...(supportChecksum !== undefined ? { supportChecksum } : {}),
    ...(value.supportCoveredSemanticPixelCount !== undefined
      ? { supportCoveredSemanticPixelCount: value.supportCoveredSemanticPixelCount }
      : {}),
    ...(value.semanticOutsideSupportPixelCount !== undefined
      ? { semanticOutsideSupportPixelCount: value.semanticOutsideSupportPixelCount }
      : {}),
  };
}

export function cropMaskStatsFingerprintMatches(
  stats: CropMaskStatsMetadata | null,
  fingerprint: MaskStatsFingerprint,
) {
  if (!stats) return false;
  if (fingerprint.kind && stats.kind !== fingerprint.kind) return false;
  if (
    stats.width !== fingerprint.width ||
    stats.height !== fingerprint.height ||
    stats.size !== fingerprint.size
  ) {
    return false;
  }
  const expectedChecksum = normalizeChecksum(fingerprint.checksum);
  if (expectedChecksum && stats.checksum !== expectedChecksum) return false;
  return true;
}

export function cropMaskStatsFromMetadata(value: unknown, fingerprint: MaskStatsFingerprint) {
  const stats = parseCropMaskStatsMetadata(value);
  return cropMaskStatsFingerprintMatches(stats, fingerprint) ? stats : null;
}

export function histogramCount(stats: CropMaskStatsMetadata | null, labelValue: number) {
  return stats?.labelHistogram[String(labelValue)] ?? 0;
}

export function buildCropMaskStatsMetadata(params: {
  kind: CropMaskStatsKind;
  bytes: Uint8Array;
  width: number;
  height: number;
  checksum?: string | null;
  foregroundValues?: ReadonlySet<number>;
  backgroundValue?: number;
  unknownValue?: number | null;
  semanticMode?: CropSemanticMode;
  supportMask?: {
    versionId: string;
    checksum?: string | null;
    bytes: Uint8Array;
  } | null;
}): CropMaskStatsMetadata {
  const backgroundValue = params.backgroundValue ?? 0;
  const foregroundValues = params.foregroundValues;
  const histogram: Record<string, number> = {};
  let foregroundPixelCount = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  let containsUnknownLabel = false;
  let supportCoveredSemanticPixelCount = 0;
  let semanticOutsideSupportPixelCount = 0;

  for (let index = 0; index < params.bytes.byteLength; index += 1) {
    const value = params.bytes[index];
    histogram[String(value)] = (histogram[String(value)] ?? 0) + 1;
    const isForeground = foregroundValues ? foregroundValues.has(value) : value !== backgroundValue;
    if (params.unknownValue !== null && params.unknownValue !== undefined && value === params.unknownValue) {
      containsUnknownLabel = true;
    }
    if (!isForeground) continue;

    foregroundPixelCount += 1;
    const x = index % params.width;
    const y = Math.floor(index / params.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    if (params.supportMask) {
      if (params.supportMask.bytes[index] === 0) {
        semanticOutsideSupportPixelCount += 1;
      } else {
        supportCoveredSemanticPixelCount += 1;
      }
    }
  }

  const stats: CropMaskStatsMetadata = {
    statsVersion: CROP_MASK_STATS_VERSION,
    kind: params.kind,
    width: params.width,
    height: params.height,
    size: params.bytes.byteLength,
    checksum: normalizeChecksum(params.checksum),
    labelHistogram: histogram,
    foregroundPixelCount,
    foregroundBBox:
      foregroundPixelCount === 0
        ? null
        : {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
    containsUnknownLabel,
    ...(params.semanticMode ? { semanticMode: params.semanticMode } : {}),
    ...(params.supportMask
      ? {
          supportMaskVersionId: params.supportMask.versionId,
          supportChecksum: normalizeChecksum(params.supportMask.checksum),
          supportCoveredSemanticPixelCount,
          semanticOutsideSupportPixelCount,
        }
      : {}),
  };
  return stats;
}

export function cropMaskStatsJson(stats: CropMaskStatsMetadata): Prisma.InputJsonObject {
  return stats as unknown as Prisma.InputJsonObject;
}

export function deepValidateCropMaskStats(params: {
  metadata: unknown;
  bytes: Uint8Array;
  width: number;
  height: number;
  checksum?: string | null;
  kind: CropMaskStatsKind;
  foregroundValues?: ReadonlySet<number>;
  backgroundValue?: number;
  unknownValue?: number | null;
  semanticMode?: CropSemanticMode;
  supportMask?: {
    versionId: string;
    checksum?: string | null;
    bytes: Uint8Array;
  } | null;
}) {
  const stored = cropMaskStatsFromMetadata(params.metadata, {
    width: params.width,
    height: params.height,
    size: params.bytes.byteLength,
    checksum: params.checksum,
    kind: params.kind,
  });
  if (!stored) return { ok: false as const, code: "MASK_STATS_METADATA_INVALID" };
  const recomputed = buildCropMaskStatsMetadata(params);
  return JSON.stringify(stored) === JSON.stringify(recomputed)
    ? { ok: true as const }
    : { ok: false as const, code: "MASK_STATS_METADATA_MISMATCH", stored, recomputed };
}
