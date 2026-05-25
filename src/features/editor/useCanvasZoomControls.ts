"use client";

import { useCallback, type RefObject } from "react";

import {
  clampNumber,
  getFitZoom,
  getViewportCenteredScroll,
  getZoomedCanvasDisplaySize,
} from "./canvasGeometry";

type CanvasRef = RefObject<HTMLCanvasElement | null>;

type CanvasZoomOptions = {
  preserveViewportCenter?: boolean;
  centerAfter?: boolean;
};

export function useCanvasZoomControls({
  containerRef,
  canvasRefs,
  setZoom,
  minZoom = 0.01,
  maxZoom = 1,
  fitMaxZoom = 1,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRefs: readonly CanvasRef[];
  setZoom: (zoom: number) => void;
  minZoom?: number;
  maxZoom?: number;
  fitMaxZoom?: number;
}) {
  const applyZoom = useCallback(
    (requestedZoom: number, options: CanvasZoomOptions = {}) => {
      const wrap = containerRef.current;
      const base = canvasRefs[0]?.current ?? null;
      const canvases = canvasRefs.map((ref) => ref.current);
      if (!base || canvases.some((canvas) => !canvas)) return;

      const zoom = clampNumber(requestedZoom, minZoom, maxZoom);
      const imageWidth = base.width;
      const imageHeight = base.height;
      const viewportCenterImagePoint =
        options.preserveViewportCenter && wrap
          ? (() => {
              const canvasRect = base.getBoundingClientRect();
              const viewportRect = wrap.getBoundingClientRect();
              if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
              return {
                x: clampNumber(
                  ((viewportRect.left + viewportRect.width / 2 - canvasRect.left) / canvasRect.width) * imageWidth,
                  0,
                  imageWidth,
                ),
                y: clampNumber(
                  ((viewportRect.top + viewportRect.height / 2 - canvasRect.top) / canvasRect.height) * imageHeight,
                  0,
                  imageHeight,
                ),
              };
            })()
          : null;

      const { width, height } = getZoomedCanvasDisplaySize(imageWidth, imageHeight, zoom);
      for (const canvas of canvases) {
        if (!canvas) continue;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      if (!wrap || (!viewportCenterImagePoint && !options.centerAfter)) return;
      requestAnimationFrame(() => {
        const center = viewportCenterImagePoint ?? { x: imageWidth / 2, y: imageHeight / 2 };
        const next = getViewportCenteredScroll({
          centerX: center.x * zoom,
          centerY: center.y * zoom,
          contentWidth: width,
          contentHeight: height,
          viewportWidth: wrap.clientWidth,
          viewportHeight: wrap.clientHeight,
        });
        wrap.scrollTo({ left: next.left, top: next.top, behavior: "auto" });
      });
    },
    [canvasRefs, containerRef, maxZoom, minZoom],
  );

  const fitToContainer = useCallback(() => {
    const wrap = containerRef.current;
    const base = canvasRefs[0]?.current ?? null;
    if (!wrap || !base || !base.width || !base.height) return;

    const nextZoom = getFitZoom({
      containerWidth: wrap.clientWidth,
      containerHeight: wrap.clientHeight,
      imageWidth: base.width,
      imageHeight: base.height,
      maxZoom: fitMaxZoom,
    });
    const clampedZoom = clampNumber(nextZoom, minZoom, maxZoom);
    setZoom(clampedZoom);
    applyZoom(clampedZoom, { centerAfter: true });
  }, [applyZoom, canvasRefs, containerRef, fitMaxZoom, maxZoom, minZoom, setZoom]);

  const setViewportZoom = useCallback(
    (requestedZoom: number) => {
      const nextZoom = clampNumber(requestedZoom, minZoom, maxZoom);
      setZoom(nextZoom);
      applyZoom(nextZoom, { preserveViewportCenter: true });
    },
    [applyZoom, maxZoom, minZoom, setZoom],
  );

  return { applyZoom, fitToContainer, setViewportZoom };
}
