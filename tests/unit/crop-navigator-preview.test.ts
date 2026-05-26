import { describe, expect, it } from "vitest";

import {
  computeCropNavigatorViewport,
  renderMaskContourPreviewRgba,
  renderSemanticMaskPreviewRgba,
  sapHeartwoodSupportForegroundLabels,
  sourceRectToViewportPercent,
} from "@/features/editor/cropNavigatorPreview";
import { Labels } from "@/mask/labels";

describe("crop navigator preview helpers", () => {
  it("fits the viewport to padded BBox union while preserving source aspect", () => {
    const viewport = computeCropNavigatorViewport(200, 100, [
      { x: 40, y: 30, width: 20, height: 10 },
      { x: 120, y: 40, width: 20, height: 10 },
    ]);

    expect(viewport).not.toBeNull();
    if (!viewport) return;
    expect(viewport.width / viewport.height).toBeCloseTo(2);
    expect(viewport.x).toBeLessThanOrEqual(24);
    expect(viewport.y).toBeLessThanOrEqual(14);
    expect(viewport.x + viewport.width).toBeGreaterThanOrEqual(156);
    expect(viewport.y + viewport.height).toBeGreaterThanOrEqual(66);
  });

  it("falls back to the full image when no valid BBoxes are available", () => {
    expect(computeCropNavigatorViewport(120, 80, [])).toEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(computeCropNavigatorViewport(null, 80, [])).toBeNull();
  });

  it("maps source rects into viewport percentages", () => {
    const percent = sourceRectToViewportPercent(
      { x: 50, y: 30, width: 20, height: 10 },
      { x: 40, y: 20, width: 80, height: 40 },
    );

    expect(percent).toEqual({
      left: 12.5,
      top: 25,
      width: 25,
      height: 25,
    });
  });

  it("renders semantic masks as exclusive indexed-label colors", () => {
    const rgba = renderSemanticMaskPreviewRgba(
      new Uint8Array([Labels.BG, Labels.SAPWOOD, Labels.HEARTWOOD, Labels.COPPER]),
      2,
      2,
    );

    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 170, 0, 116]);
    expect(Array.from(rgba.slice(8, 12))).toEqual([255, 70, 70, 116]);
    expect(Array.from(rgba.slice(12, 16))).toEqual([40, 120, 255, 116]);
  });

  it("renders support contours from foreground edges only", () => {
    const mask = new Uint8Array([
      0,
      0,
      0,
      0,
      Labels.SAPWOOD,
      Labels.SAPWOOD,
      0,
      Labels.SAPWOOD,
      Labels.SAPWOOD,
    ]);

    const rgba = renderMaskContourPreviewRgba(mask, 3, 3, sapHeartwoodSupportForegroundLabels());

    expect(rgba[4 * 4 + 3]).toBe(230);
    expect(rgba[8 * 4 + 3]).toBe(230);
    expect(rgba[0 * 4 + 3]).toBe(0);
  });
});
