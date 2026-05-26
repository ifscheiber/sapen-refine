import { describe, expect, it } from "vitest";
import { CropSemanticMode } from "@prisma/client";

import { Labels } from "@/mask/labels";
import {
  buildCropMaskStatsMetadata,
  cropMaskStatsFromMetadata,
  deepValidateCropMaskStats,
  histogramCount,
} from "@/server/domain/maskStats";
import { sha256Checksum } from "@/server/uploads/integrity";

describe("crop mask stats", () => {
  it("summarizes empty masks with no foreground bbox", () => {
    const bytes = new Uint8Array(6);
    const stats = buildCropMaskStatsMetadata({
      kind: "crop-semantic-mask",
      bytes,
      width: 3,
      height: 2,
      checksum: sha256Checksum(bytes),
      backgroundValue: Labels.BG,
      foregroundValues: new Set([Labels.SAPWOOD, Labels.HEARTWOOD, Labels.UNKNOWN]),
      unknownValue: Labels.UNKNOWN,
      semanticMode: CropSemanticMode.SAP_HEARTWOOD,
    });

    expect(stats.foregroundPixelCount).toBe(0);
    expect(stats.foregroundBBox).toBeNull();
    expect(stats.containsUnknownLabel).toBe(false);
    expect(stats.labelHistogram).toEqual({ "0": 6 });
  });

  it("records semantic histograms, foreground bbox, and unknown labels", () => {
    const bytes = new Uint8Array([
      Labels.BG,
      Labels.SAPWOOD,
      Labels.BG,
      Labels.HEARTWOOD,
      Labels.UNKNOWN,
      Labels.BG,
    ]);
    const stats = buildCropMaskStatsMetadata({
      kind: "crop-semantic-mask",
      bytes,
      width: 3,
      height: 2,
      checksum: sha256Checksum(bytes),
      backgroundValue: Labels.BG,
      foregroundValues: new Set([Labels.SAPWOOD, Labels.HEARTWOOD, Labels.UNKNOWN]),
      unknownValue: Labels.UNKNOWN,
      semanticMode: CropSemanticMode.SAP_HEARTWOOD,
    });

    expect(histogramCount(stats, Labels.SAPWOOD)).toBe(1);
    expect(histogramCount(stats, Labels.HEARTWOOD)).toBe(1);
    expect(histogramCount(stats, Labels.UNKNOWN)).toBe(1);
    expect(stats.foregroundPixelCount).toBe(3);
    expect(stats.foregroundBBox).toEqual({ x: 0, y: 0, width: 2, height: 2 });
    expect(stats.containsUnknownLabel).toBe(true);
  });

  it("records support coverage for Copper semantic masks", () => {
    const semanticBytes = new Uint8Array([
      Labels.BG,
      Labels.COPPER,
      Labels.COPPER,
      Labels.BG,
    ]);
    const supportBytes = new Uint8Array([
      0,
      Labels.SLICE_SUPPORT,
      0,
      0,
    ]);
    const stats = buildCropMaskStatsMetadata({
      kind: "crop-semantic-mask",
      bytes: semanticBytes,
      width: 2,
      height: 2,
      checksum: sha256Checksum(semanticBytes),
      backgroundValue: Labels.BG,
      foregroundValues: new Set([Labels.COPPER, Labels.UNKNOWN]),
      unknownValue: Labels.UNKNOWN,
      semanticMode: CropSemanticMode.COPPER,
      supportMask: {
        versionId: "support-1",
        checksum: sha256Checksum(supportBytes),
        bytes: supportBytes,
      },
    });

    expect(stats.supportMaskVersionId).toBe("support-1");
    expect(stats.supportCoveredSemanticPixelCount).toBe(1);
    expect(stats.semanticOutsideSupportPixelCount).toBe(1);
  });

  it("rejects stale metadata fingerprints and detects deep drift", () => {
    const bytes = new Uint8Array([Labels.BG, Labels.COPPER, Labels.BG, Labels.BG]);
    const checksum = sha256Checksum(bytes);
    const stats = buildCropMaskStatsMetadata({
      kind: "crop-semantic-mask",
      bytes,
      width: 2,
      height: 2,
      checksum,
      backgroundValue: Labels.BG,
      foregroundValues: new Set([Labels.COPPER, Labels.UNKNOWN]),
      unknownValue: Labels.UNKNOWN,
      semanticMode: CropSemanticMode.COPPER,
    });

    expect(cropMaskStatsFromMetadata(stats, {
      kind: "crop-semantic-mask",
      width: 2,
      height: 2,
      size: bytes.byteLength,
      checksum,
    })).not.toBeNull();
    expect(cropMaskStatsFromMetadata(stats, {
      kind: "crop-semantic-mask",
      width: 2,
      height: 2,
      size: bytes.byteLength,
      checksum: sha256Checksum(new Uint8Array([1, 1, 1, 1])),
    })).toBeNull();

    const drift = deepValidateCropMaskStats({
      metadata: stats,
      bytes: new Uint8Array([Labels.BG, Labels.BG, Labels.BG, Labels.BG]),
      width: 2,
      height: 2,
      checksum,
      kind: "crop-semantic-mask",
      backgroundValue: Labels.BG,
      foregroundValues: new Set([Labels.COPPER, Labels.UNKNOWN]),
      unknownValue: Labels.UNKNOWN,
      semanticMode: CropSemanticMode.COPPER,
    });
    expect(drift).toMatchObject({ ok: false, code: "MASK_STATS_METADATA_MISMATCH" });
  });
});
