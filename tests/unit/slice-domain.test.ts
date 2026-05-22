import { beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import { AnnotationArtifactKind } from "@prisma/client";
import type * as SliceModule from "@/server/domain/slices";

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
