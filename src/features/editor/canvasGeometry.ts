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
