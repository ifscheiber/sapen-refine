import { Labels } from "@/mask/labels";

export type NavigatorSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NavigatorViewport = NavigatorSourceRect;

export type ViewportPercentRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ViewportOptions = {
  paddingPx?: number;
  paddingRatio?: number;
};

const DEFAULT_PADDING_PX = 16;
const DEFAULT_PADDING_RATIO = 0.08;
const SEMANTIC_PREVIEW_ALPHA = 116;
const SUPPORT_CONTOUR_ALPHA = 230;
const SEMANTIC_COLORS = new Map<number, [number, number, number]>([
  [Labels.SAPWOOD, [255, 170, 0]],
  [Labels.HEARTWOOD, [255, 70, 70]],
  [Labels.COPPER, [40, 120, 255]],
  [Labels.UNKNOWN, [150, 120, 255]],
]);
const SUPPORT_CONTOUR_COLOR: [number, number, number] = [30, 180, 120];

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampRectToImage(rect: NavigatorSourceRect, imageWidth: number, imageHeight: number) {
  if (!isPositiveFinite(rect.width) || !isPositiveFinite(rect.height)) return null;
  const left = clamp(rect.x, 0, imageWidth);
  const top = clamp(rect.y, 0, imageHeight);
  const right = clamp(rect.x + rect.width, 0, imageWidth);
  const bottom = clamp(rect.y + rect.height, 0, imageHeight);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function expandRectToAspect(rect: NavigatorSourceRect, imageWidth: number, imageHeight: number) {
  const imageAspect = imageWidth / imageHeight;
  let width = rect.width;
  let height = rect.height;
  const currentAspect = width / height;

  if (currentAspect < imageAspect) {
    width = height * imageAspect;
  } else if (currentAspect > imageAspect) {
    height = width / imageAspect;
  }

  if (width > imageWidth) {
    width = imageWidth;
    height = width / imageAspect;
  }
  if (height > imageHeight) {
    height = imageHeight;
    width = height * imageAspect;
  }

  width = Math.min(imageWidth, Math.max(width, rect.width));
  height = Math.min(imageHeight, Math.max(height, rect.height));

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return {
    x: clamp(centerX - width / 2, 0, imageWidth - width),
    y: clamp(centerY - height / 2, 0, imageHeight - height),
    width,
    height,
  };
}

export function computeCropNavigatorViewport(
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined,
  rects: NavigatorSourceRect[],
  options: ViewportOptions = {},
): NavigatorViewport | null {
  if (!isPositiveFinite(imageWidth) || !isPositiveFinite(imageHeight)) return null;

  const clampedRects = rects
    .map((rect) => clampRectToImage(rect, imageWidth, imageHeight))
    .filter((rect): rect is NavigatorSourceRect => rect !== null);

  if (clampedRects.length === 0) {
    return { x: 0, y: 0, width: imageWidth, height: imageHeight };
  }

  const left = Math.min(...clampedRects.map((rect) => rect.x));
  const top = Math.min(...clampedRects.map((rect) => rect.y));
  const right = Math.max(...clampedRects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...clampedRects.map((rect) => rect.y + rect.height));
  const unionWidth = right - left;
  const unionHeight = bottom - top;
  const padding = Math.max(
    options.paddingPx ?? DEFAULT_PADDING_PX,
    Math.max(unionWidth, unionHeight) * (options.paddingRatio ?? DEFAULT_PADDING_RATIO),
  );

  const padded = {
    x: clamp(left - padding, 0, imageWidth),
    y: clamp(top - padding, 0, imageHeight),
    width: 0,
    height: 0,
  };
  const paddedRight = clamp(right + padding, 0, imageWidth);
  const paddedBottom = clamp(bottom + padding, 0, imageHeight);
  padded.width = Math.max(1, paddedRight - padded.x);
  padded.height = Math.max(1, paddedBottom - padded.y);

  return expandRectToAspect(padded, imageWidth, imageHeight);
}

export function sourceRectToViewportPercent(
  rect: NavigatorSourceRect,
  viewport: NavigatorViewport,
): ViewportPercentRect {
  const left = clamp(((rect.x - viewport.x) / viewport.width) * 100, 0, 100);
  const top = clamp(((rect.y - viewport.y) / viewport.height) * 100, 0, 100);
  const right = clamp(((rect.x + rect.width - viewport.x) / viewport.width) * 100, 0, 100);
  const bottom = clamp(((rect.y + rect.height - viewport.y) / viewport.height) * 100, 0, 100);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function assertMaskDimensions(bytes: Uint8Array, width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("MASK_PREVIEW_DIMENSIONS_INVALID");
  }
  if (bytes.byteLength !== width * height) {
    throw new Error("MASK_PREVIEW_BYTE_LENGTH_MISMATCH");
  }
}

export function renderSemanticMaskPreviewRgba(bytes: Uint8Array, width: number, height: number) {
  assertMaskDimensions(bytes, width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < bytes.length; index += 1) {
    const color = SEMANTIC_COLORS.get(bytes[index] as number);
    if (!color) continue;
    const offset = index * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = SEMANTIC_PREVIEW_ALPHA;
  }

  return rgba;
}

export function renderMaskContourPreviewRgba(
  bytes: Uint8Array,
  width: number,
  height: number,
  foregroundLabels?: readonly number[],
) {
  assertMaskDimensions(bytes, width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const foreground = foregroundLabels ? new Set(foregroundLabels) : null;

  function isForeground(index: number) {
    const value = bytes[index] as number;
    return foreground ? foreground.has(value) : value !== Labels.BG;
  }

  function isEdgePixel(x: number, y: number, index: number) {
    if (!isForeground(index)) return false;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return true;
    return (
      !isForeground(index - 1) ||
      !isForeground(index + 1) ||
      !isForeground(index - width) ||
      !isForeground(index + width)
    );
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!isEdgePixel(x, y, index)) continue;
      const offset = index * 4;
      rgba[offset] = SUPPORT_CONTOUR_COLOR[0];
      rgba[offset + 1] = SUPPORT_CONTOUR_COLOR[1];
      rgba[offset + 2] = SUPPORT_CONTOUR_COLOR[2];
      rgba[offset + 3] = SUPPORT_CONTOUR_ALPHA;
    }
  }

  return rgba;
}

export function sapHeartwoodSupportForegroundLabels() {
  return [Labels.SAPWOOD, Labels.HEARTWOOD] as const;
}
