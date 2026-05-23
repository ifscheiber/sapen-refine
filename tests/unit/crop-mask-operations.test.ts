import { describe, expect, it } from "vitest";

import { applyCropBrush, applyCropPolygonFill } from "@/features/editor/cropMaskOperations";
import { Labels } from "@/mask/labels";
import { MaskBuffer } from "@/mask/maskBuffer";

describe("crop mask operations", () => {
  it("fills crop-space polygons without support constraints", () => {
    const mask = new MaskBuffer(6, 6, Labels.BG);

    const patch = applyCropPolygonFill({
      mask,
      points: [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 5 },
        { x: 1, y: 5 },
      ],
      label: Labels.SLICE_SUPPORT,
    });

    expect(patch).not.toBeNull();
    expect(mask.data[2 * mask.width + 2]).toBe(Labels.SLICE_SUPPORT);
    expect(mask.data[0]).toBe(Labels.BG);
  });

  it("clips crop-space polygon fills to explicit support masks when requested", () => {
    const mask = new MaskBuffer(6, 6, Labels.BG);
    const supportMask = new MaskBuffer(6, 6, Labels.BG);
    supportMask.data[2 * supportMask.width + 2] = Labels.SLICE_SUPPORT;
    supportMask.data[2 * supportMask.width + 3] = Labels.SLICE_SUPPORT;
    supportMask.data[3 * supportMask.width + 2] = Labels.SLICE_SUPPORT;
    supportMask.data[3 * supportMask.width + 3] = Labels.SLICE_SUPPORT;

    const patch = applyCropPolygonFill({
      mask,
      supportMask,
      constrainToSupport: true,
      points: [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 5 },
        { x: 1, y: 5 },
      ],
      label: Labels.COPPER,
    });

    expect(patch).not.toBeNull();
    expect(mask.data[2 * mask.width + 2]).toBe(Labels.COPPER);
    expect(mask.data[3 * mask.width + 3]).toBe(Labels.COPPER);
    expect(mask.data[1 * mask.width + 1]).toBe(Labels.BG);
    expect(mask.data[4 * mask.width + 4]).toBe(Labels.BG);
  });

  it("clips crop-space brush strokes to explicit support masks when requested", () => {
    const mask = new MaskBuffer(5, 5, Labels.BG);
    const supportMask = new MaskBuffer(5, 5, Labels.BG);
    supportMask.data[2 * supportMask.width + 2] = Labels.SLICE_SUPPORT;

    const patch = applyCropBrush({
      mask,
      supportMask,
      constrainToSupport: true,
      x: 2,
      y: 2,
      radius: 2,
      label: Labels.COPPER,
    });

    expect(patch).not.toBeNull();
    expect(mask.data[2 * mask.width + 2]).toBe(Labels.COPPER);
    expect(mask.data[2 * mask.width + 1]).toBe(Labels.BG);
  });
});
