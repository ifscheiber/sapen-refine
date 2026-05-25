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

export type BBoxPreviewMetadata = {
  variant: "original" | "bbox-preview";
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
  scaleX: number;
  scaleY: number;
};

export type BBoxResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type BBoxHitTarget = BBoxResizeHandle | "body" | null;

export const BBOX_PREVIEW_ORIGINAL_MAX_PIXELS = 4_000_000;
export const BBOX_PREVIEW_ORIGINAL_MAX_LONG_EDGE = 2400;
export const BBOX_PREVIEW_TARGET_MAX_PIXELS = 3_000_000;
export const BBOX_PREVIEW_TARGET_MAX_LONG_EDGE = 2000;

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

export function getViewportCenteredScroll({
  centerX,
  centerY,
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
}: {
  centerX: number;
  centerY: number;
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  return {
    left: clampNumber(Math.round(centerX - viewportWidth / 2), 0, Math.max(0, contentWidth - viewportWidth)),
    top: clampNumber(Math.round(centerY - viewportHeight / 2), 0, Math.max(0, contentHeight - viewportHeight)),
  };
}

export function clampBBoxPreviewZoom(value: number) {
  return clampNumber(value, 0.01, 1);
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && value! > 0;
}

export function computeBBoxPreviewMetadata(
  originalWidth: number | null | undefined,
  originalHeight: number | null | undefined,
): BBoxPreviewMetadata | null {
  if (!isPositiveInteger(originalWidth) || !isPositiveInteger(originalHeight)) return null;

  const pixels = originalWidth * originalHeight;
  const longEdge = Math.max(originalWidth, originalHeight);
  if (pixels <= BBOX_PREVIEW_ORIGINAL_MAX_PIXELS && longEdge <= BBOX_PREVIEW_ORIGINAL_MAX_LONG_EDGE) {
    return {
      variant: "original",
      originalWidth,
      originalHeight,
      previewWidth: originalWidth,
      previewHeight: originalHeight,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const longEdgeScale = BBOX_PREVIEW_TARGET_MAX_LONG_EDGE / longEdge;
  const pixelScale = Math.sqrt(BBOX_PREVIEW_TARGET_MAX_PIXELS / pixels);
  const scale = Math.min(1, longEdgeScale, pixelScale);
  const previewWidth = Math.max(1, Math.round(originalWidth * scale));
  const previewHeight = Math.max(1, Math.round(originalHeight * scale));

  return {
    variant: "bbox-preview",
    originalWidth,
    originalHeight,
    previewWidth,
    previewHeight,
    scaleX: originalWidth / previewWidth,
    scaleY: originalHeight / previewHeight,
  };
}

export function makeIdentityBBoxPreviewMetadata(width: number, height: number): BBoxPreviewMetadata {
  return {
    variant: "original",
    originalWidth: width,
    originalHeight: height,
    previewWidth: width,
    previewHeight: height,
    scaleX: 1,
    scaleY: 1,
  };
}

export function originalRectToPreviewRect(rect: ImageRect, preview: BBoxPreviewMetadata): ImageRect {
  return {
    x: Math.round(rect.x / preview.scaleX),
    y: Math.round(rect.y / preview.scaleY),
    width: Math.max(1, Math.round(rect.width / preview.scaleX)),
    height: Math.max(1, Math.round(rect.height / preview.scaleY)),
  };
}

export function previewRectToOriginalRect(rect: ImageRect, preview: BBoxPreviewMetadata): ImageRect {
  const left = clampNumber(Math.round(rect.x * preview.scaleX), 0, preview.originalWidth - 1);
  const top = clampNumber(Math.round(rect.y * preview.scaleY), 0, preview.originalHeight - 1);
  const width = clampNumber(Math.round(rect.width * preview.scaleX), 1, preview.originalWidth - left);
  const height = clampNumber(Math.round(rect.height * preview.scaleY), 1, preview.originalHeight - top);

  return {
    x: left,
    y: top,
    width,
    height,
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
