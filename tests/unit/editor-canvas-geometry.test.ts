import { describe, expect, it } from "vitest";

import {
  clientPointToImagePoint,
  getFitZoom,
  getZoomedCanvasDisplaySize,
  imageRectFromPoints,
} from "@/features/editor/canvasGeometry";

describe("editor canvas geometry", () => {
  it("maps CSS display coordinates into image pixel coordinates", () => {
    const point = clientPointToImagePoint({
      clientX: 110,
      clientY: 70,
      canvasWidth: 1000,
      canvasHeight: 500,
      rect: { left: 10, top: 20, width: 500, height: 250 },
    });

    expect(point).toEqual({ x: 200, y: 100 });
  });

  it("clamps pointer coordinates to the image coordinate space", () => {
    const high = clientPointToImagePoint({
      clientX: 999,
      clientY: 999,
      canvasWidth: 20,
      canvasHeight: 10,
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });

    const low = clientPointToImagePoint({
      clientX: -20,
      clientY: -20,
      canvasWidth: 20,
      canvasHeight: 10,
      rect: { left: 0, top: 0, width: 100, height: 100 },
    });

    expect(high).toEqual({ x: 19, y: 9 });
    expect(low).toEqual({ x: 0, y: 0 });
  });

  it("fits an image inside a container without exceeding 100 percent zoom", () => {
    expect(
      getFitZoom({
        containerWidth: 500,
        containerHeight: 500,
        imageWidth: 1000,
        imageHeight: 250,
      }),
    ).toBe(0.5);

    expect(
      getFitZoom({
        containerWidth: 2000,
        containerHeight: 2000,
        imageWidth: 1000,
        imageHeight: 250,
      }),
    ).toBe(1);
  });

  it("keeps zoomed canvas display sizes stable and nonzero", () => {
    expect(getZoomedCanvasDisplaySize(1000, 500, 0.25)).toEqual({
      width: 250,
      height: 125,
    });

    expect(getZoomedCanvasDisplaySize(1000, 500, 0)).toEqual({
      width: 10,
      height: 5,
    });
  });

  it("normalizes image rectangles from drag endpoints", () => {
    expect(imageRectFromPoints({ x: 12, y: 9 }, { x: 4, y: 3 })).toEqual({
      x: 4,
      y: 3,
      width: 9,
      height: 7,
    });
  });
});
