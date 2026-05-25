export type CanvasDisplayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ImagePoint = {
  x: number;
  y: number;
};

export type ImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BBoxResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type BBoxHitTarget = BBoxResizeHandle | "body" | null;

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getZoomedCanvasDisplaySize(imageWidth: number, imageHeight: number, zoom: number) {
  const safeZoom = Math.max(0.01, zoom);

  return {
    width: Math.max(1, Math.floor(imageWidth * safeZoom)),
    height: Math.max(1, Math.floor(imageHeight * safeZoom)),
  };
}

export function getFitZoom({
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight,
  maxZoom = 1,
}: {
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
  maxZoom?: number;
}) {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return maxZoom;
  }

  return clampNumber(Math.min(containerWidth / imageWidth, containerHeight / imageHeight), 0.01, maxZoom);
}

export function clientPointToImagePoint({
  clientX,
  clientY,
  canvasWidth,
  canvasHeight,
  rect,
}: {
  clientX: number;
  clientY: number;
  canvasWidth: number;
  canvasHeight: number;
  rect: CanvasDisplayRect;
}): ImagePoint {
  if (canvasWidth <= 0 || canvasHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;
  const x = Math.floor((clientX - rect.left) * scaleX);
  const y = Math.floor((clientY - rect.top) * scaleY);

  return {
    x: clampNumber(x, 0, canvasWidth - 1),
    y: clampNumber(y, 0, canvasHeight - 1),
  };
}

export function imageRectFromPoints(start: ImagePoint, end: ImagePoint): ImageRect {
  const x0 = Math.min(start.x, end.x);
  const y0 = Math.min(start.y, end.y);
  const x1 = Math.max(start.x, end.x);
  const y1 = Math.max(start.y, end.y);

  return {
    x: x0,
    y: y0,
    width: x1 - x0 + 1,
    height: y1 - y0 + 1,
  };
}

export function imageRectsOverlap(first: ImageRect, second: ImageRect) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function pointInImageRect(point: ImagePoint, rect: ImageRect) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function bboxHandlePoints(rect: ImageRect): Array<{ handle: BBoxResizeHandle; x: number; y: number }> {
  const left = rect.x;
  const right = rect.x + rect.width - 1;
  const top = rect.y;
  const bottom = rect.y + rect.height - 1;
  const centerX = Math.round((left + right) / 2);
  const centerY = Math.round((top + bottom) / 2);

  return [
    { handle: "nw", x: left, y: top },
    { handle: "n", x: centerX, y: top },
    { handle: "ne", x: right, y: top },
    { handle: "e", x: right, y: centerY },
    { handle: "se", x: right, y: bottom },
    { handle: "s", x: centerX, y: bottom },
    { handle: "sw", x: left, y: bottom },
    { handle: "w", x: left, y: centerY },
  ];
}

export function hitTestImageRect(point: ImagePoint, rect: ImageRect, handleRadius = 6): BBoxHitTarget {
  for (const handle of bboxHandlePoints(rect)) {
    if (Math.abs(point.x - handle.x) <= handleRadius && Math.abs(point.y - handle.y) <= handleRadius) {
      return handle.handle;
    }
  }
  return pointInImageRect(point, rect) ? "body" : null;
}

export function moveImageRect(
  rect: ImageRect,
  delta: ImagePoint,
  bounds: { width: number; height: number },
): ImageRect {
  return {
    ...rect,
    x: clampNumber(rect.x + delta.x, 0, Math.max(0, bounds.width - rect.width)),
    y: clampNumber(rect.y + delta.y, 0, Math.max(0, bounds.height - rect.height)),
  };
}

export function resizeImageRect(
  rect: ImageRect,
  handle: BBoxResizeHandle,
  point: ImagePoint,
  bounds: { width: number; height: number },
  minSize = 4,
): ImageRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width - 1;
  let bottom = rect.y + rect.height - 1;
  const min = Math.max(1, minSize);

  if (handle.includes("w")) left = clampNumber(point.x, 0, right - min + 1);
  if (handle.includes("e")) right = clampNumber(point.x, left + min - 1, bounds.width - 1);
  if (handle.includes("n")) top = clampNumber(point.y, 0, bottom - min + 1);
  if (handle.includes("s")) bottom = clampNumber(point.y, top + min - 1, bounds.height - 1);

  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}
