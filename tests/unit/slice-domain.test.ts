import { beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import { AnnotationArtifactKind } from "@prisma/client";
import type * as SliceModule from "@/server/domain/slices";

import { Labels } from "@/mask/labels";
import {
  assertSupportArtifactKind,
  isSupportArtifactKind,
  isSupportMaskArtifactKind,
} from "@/server/domain/artifacts";

let slices: typeof SliceModule;

beforeAll(async () => {
  loadEnv({ path: ".env.local" });
  slices = await import("@/server/domain/slices");
});

describe("support artifact kind helpers", () => {
  it("distinguishes support-mask artifacts from semantic masks", () => {
    expect(isSupportMaskArtifactKind(AnnotationArtifactKind.SLICE_SUPPORT_MASK)).toBe(true);
    expect(isSupportMaskArtifactKind(AnnotationArtifactKind.INSTANCE_MASK)).toBe(false);
    expect(isSupportMaskArtifactKind(AnnotationArtifactKind.SEMANTIC_MASK)).toBe(false);

    expect(isSupportArtifactKind(AnnotationArtifactKind.SLICE_SUPPORT_MASK)).toBe(true);
    expect(isSupportArtifactKind(AnnotationArtifactKind.INSTANCE_MASK)).toBe(true);
    expect(isSupportArtifactKind(AnnotationArtifactKind.SEMANTIC_MASK)).toBe(false);
  });

  it("rejects semantic artifacts as support geometry", () => {
    expect(() => assertSupportArtifactKind(AnnotationArtifactKind.SEMANTIC_MASK)).toThrow(
      "ARTIFACT_NOT_SUPPORT_GEOMETRY",
    );
  });
});

describe("slice classification helpers", () => {
  it("resolves the latest classification by version", () => {
    expect(
      slices.pickLatestSliceClassification([
        { version: 1, class: "UNKNOWN" },
        { version: 3, class: "COPPER_SLICE" },
        { version: 2, class: "SAP_HEARTWOOD_SLICE" },
      ]),
    ).toEqual({ version: 3, class: "COPPER_SLICE" });
  });

  it("returns null when no classification exists", () => {
    expect(slices.pickLatestSliceClassification([])).toBeNull();
  });
});

describe("slice BBox validation", () => {
  it("accepts integer boxes inside source image bounds", async () => {
    const { validateSliceBoundingBoxInput } = await import("@/server/domain/sliceBboxes");

    expect(
      validateSliceBoundingBoxInput(
        { x: 2, y: 3, width: 8, height: 4 },
        { width: 16, height: 12 },
      ),
    ).toEqual({ x: 2, y: 3, width: 8, height: 4 });
  });

  it("rejects non-integer, too-small, and out-of-bounds boxes", async () => {
    const { validateSliceBoundingBoxInput } = await import("@/server/domain/sliceBboxes");

    expect(() =>
      validateSliceBoundingBoxInput({ x: 1.5, y: 0, width: 8, height: 8 }, { width: 16, height: 16 }),
    ).toThrow("X_INTEGER_REQUIRED");

    expect(() =>
      validateSliceBoundingBoxInput({ x: 0, y: 0, width: 3, height: 8 }, { width: 16, height: 16 }),
    ).toThrow("BBOX_TOO_SMALL");

    expect(() =>
      validateSliceBoundingBoxInput({ x: 12, y: 0, width: 8, height: 8 }, { width: 16, height: 16 }),
    ).toThrow("BBOX_OUT_OF_BOUNDS");
  });
});

describe("derived slice crop helpers", () => {
  it("accepts only supported padding presets", async () => {
    const { parseSliceCropPadding } = await import("@/server/domain/sliceCrops");

    expect(parseSliceCropPadding(undefined, 32)).toBe(32);
    expect(parseSliceCropPadding(0, 32)).toBe(0);
    expect(parseSliceCropPadding(16, 32)).toBe(16);
    expect(parseSliceCropPadding(32, 16)).toBe(32);
    expect(parseSliceCropPadding(64, 32)).toBe(64);
    expect(() => parseSliceCropPadding(48, 32)).toThrow("CROP_PADDING_INVALID");
  });

  it("clamps requested padding to source-image bounds and records clipping", async () => {
    const { calculateSliceCropGeometry } = await import("@/server/domain/sliceCrops");

    expect(
      calculateSliceCropGeometry({
        bbox: { x: 40, y: 20, width: 10, height: 10 },
        image: { width: 100, height: 80 },
        paddingRequestedPx: 16,
      }),
    ).toMatchObject({
      sourceX: 24,
      sourceY: 4,
      sourceWidth: 42,
      sourceHeight: 42,
      cropX: 0,
      cropY: 0,
      cropWidth: 42,
      cropHeight: 42,
      paddingAppliedLeftPx: 16,
      paddingAppliedTopPx: 16,
      paddingAppliedRightPx: 16,
      paddingAppliedBottomPx: 16,
      paddingClipped: false,
      transformToSourceJson: {
        sourceCoordinateSpace: "SOURCE_IMAGE_PIXEL",
        cropCoordinateSpace: "CROP_PIXEL",
        sourceOrigin: { x: 24, y: 4 },
      },
    });

    expect(
      calculateSliceCropGeometry({
        bbox: { x: 40, y: 20, width: 10, height: 10 },
        image: { width: 100, height: 80 },
        paddingRequestedPx: 32,
      }),
    ).toMatchObject({
      sourceX: 8,
      sourceY: 0,
      sourceWidth: 74,
      sourceHeight: 62,
      cropWidth: 74,
      cropHeight: 62,
      paddingAppliedLeftPx: 32,
      paddingAppliedTopPx: 20,
      paddingAppliedRightPx: 32,
      paddingAppliedBottomPx: 32,
      paddingClipped: true,
    });
  });

  it("keeps zero-padding crops identical to BBox geometry", async () => {
    const { calculateSliceCropGeometry } = await import("@/server/domain/sliceCrops");

    expect(
      calculateSliceCropGeometry({
        bbox: { x: 2, y: 3, width: 8, height: 6 },
        image: { width: 20, height: 20 },
        paddingRequestedPx: 0,
      }),
    ).toMatchObject({
      sourceX: 2,
      sourceY: 3,
      sourceWidth: 8,
      sourceHeight: 6,
      cropWidth: 8,
      cropHeight: 6,
      paddingClipped: false,
    });
  });
});

describe("crop support mask helpers", () => {
  it("maps crop pixels back to source image pixels through integer translation", async () => {
    const { cropPixelToSourcePixel } = await import("@/server/domain/cropSupportMasks");

    expect(cropPixelToSourcePixel({ sourceX: 8, sourceY: 20 }, { x: 0, y: 0 })).toEqual({
      x: 8,
      y: 20,
    });
    expect(cropPixelToSourcePixel({ sourceX: 8, sourceY: 20 }, { x: 5, y: 7 })).toEqual({
      x: 13,
      y: 27,
    });
  });

  it("requires crop support mask dimensions to match the derived crop", async () => {
    const { validateCropSupportMaskDimensions } = await import("@/server/domain/cropSupportMasks");

    expect(() =>
      validateCropSupportMaskDimensions({
        width: 20,
        height: 10,
        size: 200,
        cropWidth: 20,
        cropHeight: 10,
      }),
    ).not.toThrow();

    expect(() =>
      validateCropSupportMaskDimensions({
        width: 20,
        height: 9,
        size: 180,
        cropWidth: 20,
        cropHeight: 10,
      }),
    ).toThrow("MASK_DIMENSIONS_MISMATCH");
  });
});

describe("crop semantic mask helpers", () => {
  it("requires crop semantic mask dimensions to match the derived crop", async () => {
    const { validateCropSemanticMaskDimensions } = await import("@/server/domain/cropSemanticMasks");

    expect(() =>
      validateCropSemanticMaskDimensions({
        width: 20,
        height: 10,
        size: 200,
        cropWidth: 20,
        cropHeight: 10,
      }),
    ).not.toThrow();

    expect(() =>
      validateCropSemanticMaskDimensions({
        width: 20,
        height: 9,
        size: 180,
        cropWidth: 20,
        cropHeight: 10,
      }),
    ).toThrow("MASK_DIMENSIONS_MISMATCH");
  });

  it("rejects semantic labels outside support pixels", async () => {
    const { validateSemanticMaskAgainstSupport } = await import("@/server/domain/cropSemanticMasks");
    const semantic = new Uint8Array([0, 1, 0, 2]);
    const support = new Uint8Array([0, 10, 0, 10]);

    expect(() =>
      validateSemanticMaskAgainstSupport({
        semanticBytes: semantic,
        supportBytes: support,
        allowedValues: new Set([0, 1, 2, 4]),
      }),
    ).not.toThrow();

    semantic[0] = 1;
    expect(() =>
      validateSemanticMaskAgainstSupport({
        semanticBytes: semantic,
        supportBytes: support,
        allowedValues: new Set([0, 1, 2, 4]),
      }),
    ).toThrow("SEMANTIC_OUTSIDE_SUPPORT");
  });

  it("validates semantic mode values", async () => {
    const { parseCropSemanticMode, validateSemanticMaskAgainstSupport } = await import(
      "@/server/domain/cropSemanticMasks"
    );

    expect(parseCropSemanticMode("SAP_HEARTWOOD")).toBe("SAP_HEARTWOOD");
    expect(parseCropSemanticMode("COPPER")).toBe("COPPER");
    expect(() => parseCropSemanticMode("SUPPORT")).toThrow("SEMANTIC_MODE_INVALID");

    expect(() =>
      validateSemanticMaskAgainstSupport({
        semanticBytes: new Uint8Array([3]),
        supportBytes: new Uint8Array([10]),
        allowedValues: new Set([0, 1, 2, 4]),
      }),
    ).toThrow("SEMANTIC_MASK_VALUES_INVALID");
  });
});

describe("crop semantic classification derivation", () => {
  const labelValues = {
    background: Labels.BG,
    sapwood: Labels.SAPWOOD,
    heartwood: Labels.HEARTWOOD,
    copper: Labels.COPPER,
    unknown: Labels.UNKNOWN,
  };

  it("classifies Copper mode from one copper pixel", async () => {
    const { deriveSliceClassificationFromSemanticMask } = await import(
      "@/server/domain/sliceClassifications"
    );

    expect(
      deriveSliceClassificationFromSemanticMask({
        semanticMode: "COPPER",
        semanticBytes: new Uint8Array([Labels.BG, Labels.COPPER]),
        labelValues,
      }),
    ).toMatchObject({
      class: "COPPER_SLICE",
      reason: "COPPER_PIXELS_PRESENT",
      classifyingPixelThreshold: 1,
      counts: { copper: 1, conflict: 0 },
    });
  });

  it("classifies Sap/Heartwood mode from one sapwood or heartwood pixel", async () => {
    const { deriveSliceClassificationFromSemanticMask } = await import(
      "@/server/domain/sliceClassifications"
    );

    expect(
      deriveSliceClassificationFromSemanticMask({
        semanticMode: "SAP_HEARTWOOD",
        semanticBytes: new Uint8Array([Labels.HEARTWOOD]),
        labelValues,
      }),
    ).toMatchObject({
      class: "SAP_HEARTWOOD_SLICE",
      reason: "SAP_HEARTWOOD_PIXELS_PRESENT",
      counts: { heartwood: 1, conflict: 0 },
    });

    expect(
      deriveSliceClassificationFromSemanticMask({
        semanticMode: "SAP_HEARTWOOD",
        semanticBytes: new Uint8Array([Labels.SAPWOOD]),
        labelValues,
      }),
    ).toMatchObject({
      class: "SAP_HEARTWOOD_SLICE",
      reason: "SAP_HEARTWOOD_PIXELS_PRESENT",
      counts: { sapwood: 1, conflict: 0 },
    });
  });

  it("marks background, unknown, and mode-conflict masks with stable reasons", async () => {
    const { deriveSliceClassificationFromSemanticMask } = await import(
      "@/server/domain/sliceClassifications"
    );

    expect(
      deriveSliceClassificationFromSemanticMask({
        semanticMode: "COPPER",
        semanticBytes: new Uint8Array([Labels.BG, Labels.BG]),
        labelValues,
      }),
    ).toMatchObject({
      class: "UNKNOWN",
      reason: "NO_CLASSIFYING_PIXELS",
    });

    expect(
      deriveSliceClassificationFromSemanticMask({
        semanticMode: "SAP_HEARTWOOD",
        semanticBytes: new Uint8Array([Labels.UNKNOWN]),
        labelValues,
      }),
    ).toMatchObject({
      class: "REVIEW_REQUIRED",
      reason: "UNKNOWN_PIXELS_PRESENT",
    });

    expect(
      deriveSliceClassificationFromSemanticMask({
        semanticMode: "COPPER",
        semanticBytes: new Uint8Array([Labels.SAPWOOD]),
        labelValues,
      }),
    ).toMatchObject({
      class: "REVIEW_REQUIRED",
      reason: "SEMANTIC_MODE_LABEL_CONFLICT",
    });
  });
});
