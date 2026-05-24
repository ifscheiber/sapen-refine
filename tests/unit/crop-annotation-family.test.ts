import { CropSemanticMode } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  supportBytesOccupyAnnotationFamily,
  semanticBytesOccupyAnnotationFamily,
} from "@/server/domain/cropAnnotationFamilies";

const labels = {
  background: 0,
  sapwood: 1,
  heartwood: 2,
  copper: 3,
  sliceSupport: 10,
};

describe("crop annotation family byte occupancy", () => {
  it("treats all-background masks as empty", () => {
    expect(
      semanticBytesOccupyAnnotationFamily({
        semanticMode: CropSemanticMode.SAP_HEARTWOOD,
        semanticBytes: new Uint8Array([0, 0, 0]),
        labels,
      }),
    ).toBe(false);
    expect(supportBytesOccupyAnnotationFamily({ supportBytes: new Uint8Array([0, 0]), labels })).toBe(false);
  });

  it("detects Sapwood and Heartwood occupancy", () => {
    expect(
      semanticBytesOccupyAnnotationFamily({
        semanticMode: CropSemanticMode.SAP_HEARTWOOD,
        semanticBytes: new Uint8Array([0, labels.sapwood, 0]),
        labels,
      }),
    ).toBe(true);
    expect(
      semanticBytesOccupyAnnotationFamily({
        semanticMode: CropSemanticMode.SAP_HEARTWOOD,
        semanticBytes: new Uint8Array([0, labels.heartwood, 0]),
        labels,
      }),
    ).toBe(true);
  });

  it("detects Copper and support occupancy", () => {
    expect(
      semanticBytesOccupyAnnotationFamily({
        semanticMode: CropSemanticMode.COPPER,
        semanticBytes: new Uint8Array([0, labels.copper, 0]),
        labels,
      }),
    ).toBe(true);
    expect(supportBytesOccupyAnnotationFamily({ supportBytes: new Uint8Array([0, labels.sliceSupport]), labels })).toBe(
      true,
    );
  });
});
