"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/components/ui/utils";
import type {
  CropSliceNavigatorModel,
  CropSliceNavigatorSlice,
} from "@/server/domain/cropSliceNavigator";
import {
  computeCropNavigatorViewport,
  renderMaskContourPreviewRgba,
  renderSemanticMaskPreviewRgba,
  sapHeartwoodSupportForegroundLabels,
  sourceRectToViewportPercent,
  type NavigatorViewport,
} from "./cropNavigatorPreview";
import { API_ENSURE_SLICE_CROPS } from "./editorApi";
import {
  CROP_SEMANTIC_EDITOR_MASK_EVENT,
  requestCropSemanticEditorFlush,
  type CropSemanticEditorMaskDetail,
} from "./cropSemanticEditorEvents";

type CropEditorMode = "editor" | "support" | "semantic";

type EnsuredCrop = {
  id: string;
  sliceInstanceId: string;
};

type OverlayRequest = {
  id: string;
  assetUrl: string;
  width: number;
  height: number;
};

type OverlayCacheEntry =
  | {
      status: "loaded";
      width: number;
      height: number;
      bytes: Uint8Array;
    }
  | {
      status: "unavailable";
    };

type LocalNavigatorMaskOverlay = CropSemanticEditorMaskDetail;

const MAX_NAVIGATOR_MASK_PREVIEW_PIXELS = 4_000_000;
const MAX_NAVIGATOR_OVERLAY_EDGE_PX = 1024;

function cropEditorHref(params: {
  navigator: CropSliceNavigatorModel;
  sliceInstanceId: string;
  cropId: string;
  editorMode: CropEditorMode;
}) {
  const base =
    `/app/projects/${params.navigator.projectId}/images/${params.navigator.imageId}` +
    `/crop/slices/${params.sliceInstanceId}/crops/${params.cropId}`;
  return params.editorMode === "editor" ? base : `${base}/${params.editorMode}`;
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && value! > 0;
}

function isPreviewRenderable(
  preview: CropSliceNavigatorSlice["semanticMaskPreview"] | CropSliceNavigatorSlice["supportMaskPreview"],
): preview is NonNullable<typeof preview> & { width: number; height: number } {
  return (
    Boolean(preview) &&
    isPositiveInteger(preview?.width) &&
    isPositiveInteger(preview?.height) &&
    preview.width * preview.height <= MAX_NAVIGATOR_MASK_PREVIEW_PIXELS &&
    preview?.format === "u8raw-v1" &&
    preview?.coordinateSpace === "CROP_PIXEL"
  );
}

function overlayCanvasSize(viewport: NavigatorViewport) {
  const scale = Math.min(1, MAX_NAVIGATOR_OVERLAY_EDGE_PX / Math.max(viewport.width, viewport.height));
  return {
    width: Math.max(1, Math.round(viewport.width * scale)),
    height: Math.max(1, Math.round(viewport.height * scale)),
    scale,
  };
}

function collectOverlayRequests(slices: CropSliceNavigatorSlice[]) {
  const requests = new Map<string, OverlayRequest>();
  for (const slice of slices) {
    if (isPreviewRenderable(slice.semanticMaskPreview)) {
      requests.set(slice.semanticMaskPreview.id, {
        id: slice.semanticMaskPreview.id,
        assetUrl: slice.semanticMaskPreview.assetUrl,
        width: slice.semanticMaskPreview.width,
        height: slice.semanticMaskPreview.height,
      });
    }
    if (isPreviewRenderable(slice.supportMaskPreview)) {
      requests.set(slice.supportMaskPreview.id, {
        id: slice.supportMaskPreview.id,
        assetUrl: slice.supportMaskPreview.assetUrl,
        width: slice.supportMaskPreview.width,
        height: slice.supportMaskPreview.height,
      });
    }
  }
  return Array.from(requests.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function sourceImageLayerStyle(navigator: CropSliceNavigatorModel, viewport: NavigatorViewport) {
  const imageWidth = navigator.image.width ?? viewport.width;
  const imageHeight = navigator.image.height ?? viewport.height;
  return {
    left: `${(-viewport.x / viewport.width) * 100}%`,
    top: `${(-viewport.y / viewport.height) * 100}%`,
    width: `${(imageWidth / viewport.width) * 100}%`,
    height: `${(imageHeight / viewport.height) * 100}%`,
  };
}

function drawRgbaMask(
  ctx: CanvasRenderingContext2D,
  rgba: Uint8ClampedArray,
  maskWidth: number,
  maskHeight: number,
  viewport: NavigatorViewport,
  slice: CropSliceNavigatorSlice,
) {
  const crop = slice.currentCrop;
  if (!crop) return;
  if (maskWidth !== crop.cropWidth || maskHeight !== crop.cropHeight) return;

  const offscreen = document.createElement("canvas");
  offscreen.width = maskWidth;
  offscreen.height = maskHeight;
  const offscreenCtx = offscreen.getContext("2d");
  if (!offscreenCtx) return;

  const imageData = offscreenCtx.createImageData(maskWidth, maskHeight);
  imageData.data.set(rgba);
  offscreenCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(offscreen, crop.sourceX - viewport.x, crop.sourceY - viewport.y, crop.cropWidth, crop.cropHeight);
}

function drawNavigatorOverlays(
  ctx: CanvasRenderingContext2D,
  viewport: NavigatorViewport,
  slices: CropSliceNavigatorSlice[],
  overlayCache: Record<string, OverlayCacheEntry>,
  localOverlay: LocalNavigatorMaskOverlay | null,
  scale: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  for (const slice of slices) {
    if (!slice.currentCrop) continue;
    const localSliceOverlay = localOverlay?.cropId === slice.currentCrop.id ? localOverlay : null;
    if (localSliceOverlay?.kind === "semantic") {
      drawRgbaMask(
        ctx,
        renderSemanticMaskPreviewRgba(localSliceOverlay.bytes, localSliceOverlay.width, localSliceOverlay.height),
        localSliceOverlay.width,
        localSliceOverlay.height,
        viewport,
        slice,
      );
      continue;
    }
    if (isPreviewRenderable(slice.semanticMaskPreview)) {
      const semantic = overlayCache[slice.semanticMaskPreview.id];
      if (semantic?.status === "loaded") {
        drawRgbaMask(
          ctx,
          renderSemanticMaskPreviewRgba(semantic.bytes, semantic.width, semantic.height),
          semantic.width,
          semantic.height,
          viewport,
          slice,
        );
      }
    }
  }

  for (const slice of slices) {
    if (!slice.currentCrop) continue;
    const localSliceOverlay = localOverlay?.cropId === slice.currentCrop.id ? localOverlay : null;
    if (localSliceOverlay?.kind === "support") {
      drawRgbaMask(
        ctx,
        renderMaskContourPreviewRgba(localSliceOverlay.bytes, localSliceOverlay.width, localSliceOverlay.height),
        localSliceOverlay.width,
        localSliceOverlay.height,
        viewport,
        slice,
      );
      continue;
    }
    if (isPreviewRenderable(slice.supportMaskPreview)) {
      const support = overlayCache[slice.supportMaskPreview.id];
      if (support?.status === "loaded") {
        drawRgbaMask(
          ctx,
          renderMaskContourPreviewRgba(support.bytes, support.width, support.height),
          support.width,
          support.height,
          viewport,
          slice,
        );
      }
      continue;
    }

    if (
      localSliceOverlay?.kind === "semantic" &&
      localSliceOverlay.semanticMode === "SAP_HEARTWOOD"
    ) {
      drawRgbaMask(
        ctx,
        renderMaskContourPreviewRgba(
          localSliceOverlay.bytes,
          localSliceOverlay.width,
          localSliceOverlay.height,
          sapHeartwoodSupportForegroundLabels(),
        ),
        localSliceOverlay.width,
        localSliceOverlay.height,
        viewport,
        slice,
      );
      continue;
    }

    if (slice.semanticMode === "SAP_HEARTWOOD" && isPreviewRenderable(slice.semanticMaskPreview)) {
      const semantic = overlayCache[slice.semanticMaskPreview.id];
      if (semantic?.status === "loaded") {
        drawRgbaMask(
          ctx,
          renderMaskContourPreviewRgba(
            semantic.bytes,
            semantic.width,
            semantic.height,
            sapHeartwoodSupportForegroundLabels(),
          ),
          semantic.width,
          semantic.height,
          viewport,
          slice,
        );
      }
    }
  }
}

function currentEditorHref(
  navigator: CropSliceNavigatorModel,
  slice: CropSliceNavigatorSlice,
  editorMode: CropEditorMode,
) {
  if (!slice.currentCrop) return null;
  return cropEditorHref({
    navigator,
    sliceInstanceId: slice.sliceInstanceId,
    cropId: slice.currentCrop.id,
    editorMode,
  });
}

export function CropEditorSliceNavigatorRailClient({
  navigator,
  editorMode,
}: {
  navigator: CropSliceNavigatorModel;
  editorMode: CropEditorMode;
}) {
  const router = useRouter();
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busySliceId, setBusySliceId] = useState<string | null>(null);
  const [overlayCache, setOverlayCache] = useState<Record<string, OverlayCacheEntry>>({});
  const [localOverlay, setLocalOverlay] = useState<LocalNavigatorMaskOverlay | null>(null);
  const [status, setStatus] = useState("");
  const overlayCacheRef = useRef(overlayCache);
  const selectedSlice = useMemo(
    () =>
      navigator.slices.find((slice) => slice.sliceInstanceId === navigator.selectedSliceInstanceId) ??
      navigator.slices[0] ??
      null,
    [navigator.selectedSliceInstanceId, navigator.slices],
  );
  const viewport = useMemo(
    () =>
      computeCropNavigatorViewport(
        navigator.image.width,
        navigator.image.height,
        navigator.slices.map((slice) => slice.sourceRect),
      ),
    [navigator.image.height, navigator.image.width, navigator.slices],
  );
  const overlayRequests = useMemo(() => collectOverlayRequests(navigator.slices), [navigator.slices]);
  const selectedCropId = selectedSlice?.currentCrop?.id ?? null;

  useEffect(() => {
    overlayCacheRef.current = overlayCache;
  }, [overlayCache]);

  useEffect(() => {
    const onMask = (event: CustomEvent<CropSemanticEditorMaskDetail>) => {
      if (event.detail.cropId !== selectedCropId) return;
      setLocalOverlay(event.detail);
    };
    window.addEventListener(CROP_SEMANTIC_EDITOR_MASK_EVENT, onMask as EventListener);
    return () => window.removeEventListener(CROP_SEMANTIC_EDITOR_MASK_EVENT, onMask as EventListener);
  }, [selectedCropId]);

  useEffect(() => {
    if (localOverlay && localOverlay.cropId !== selectedCropId) setLocalOverlay(null);
  }, [localOverlay, selectedCropId]);

  useEffect(() => {
    const missingRequests = overlayRequests.filter((request) => !overlayCacheRef.current[request.id]);
    if (missingRequests.length === 0) return;

    const controller = new AbortController();
    void Promise.all(
      missingRequests.map(async (request) => {
        try {
          const response = await fetch(request.assetUrl, { credentials: "include", signal: controller.signal });
          if (!response.ok) return [request.id, { status: "unavailable" } satisfies OverlayCacheEntry] as const;
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength !== request.width * request.height) {
            return [request.id, { status: "unavailable" } satisfies OverlayCacheEntry] as const;
          }
          return [
            request.id,
            {
              status: "loaded",
              width: request.width,
              height: request.height,
              bytes,
            } satisfies OverlayCacheEntry,
          ] as const;
        } catch {
          if (controller.signal.aborted) return null;
          return [request.id, { status: "unavailable" } satisfies OverlayCacheEntry] as const;
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      setOverlayCache((current) => {
        const next = { ...current };
        for (const result of results) {
          if (!result) continue;
          next[result[0]] = result[1];
        }
        return next;
      });
    });

    return () => controller.abort();
  }, [overlayRequests]);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !viewport) return;

    const { width, height, scale } = overlayCanvasSize(viewport);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawNavigatorOverlays(ctx, viewport, navigator.slices, overlayCache, localOverlay, scale);
  }, [navigator.slices, localOverlay, overlayCache, viewport]);

  async function openSlice(slice: CropSliceNavigatorSlice) {
    const canNavigate = await requestCropSemanticEditorFlush();
    if (!canNavigate) {
      setStatus("Save failed. Retry before switching slices.");
      return;
    }

    const existingHref = currentEditorHref(navigator, slice, editorMode);
    if (existingHref) {
      router.push(existingHref);
      return;
    }

    setBusySliceId(slice.sliceInstanceId);
    setStatus("");
    try {
      const response = await fetch(API_ENSURE_SLICE_CROPS(navigator.imageId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sliceInstanceId: slice.sliceInstanceId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `SLICE_CROP_ENSURE_FAILED_${response.status}`);
      }
      const crop = (data.crops as EnsuredCrop[] | undefined)?.find(
        (entry) => entry.sliceInstanceId === slice.sliceInstanceId,
      );
      if (!crop) throw new Error("SLICE_CROP_ENSURE_MISSING_CROP");
      router.push(
        cropEditorHref({
          navigator,
          sliceInstanceId: slice.sliceInstanceId,
          cropId: crop.id,
          editorMode,
        }),
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Slice crop navigation failed");
    } finally {
      setBusySliceId(null);
    }
  }

  return (
    <aside aria-label="Slice navigator" className="min-w-0 space-y-4">
      <div className="space-y-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            Slices
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {navigator.summary.totalSlices} slices · {navigator.summary.currentCropCount} current ·{" "}
            {navigator.summary.readyCount} ready
          </div>
        </div>

        <div
          className="relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--workspace-panel)]"
          style={viewport ? { aspectRatio: `${viewport.width} / ${viewport.height}` } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={navigator.image.assetUrl}
            alt={`Slice navigator for ${navigator.image.filename ?? navigator.image.id}`}
            draggable={false}
            className={cn(viewport ? "absolute max-w-none select-none" : "block h-auto w-full")}
            style={viewport ? sourceImageLayerStyle(navigator, viewport) : undefined}
          />
          {viewport && (
            <canvas
              ref={overlayCanvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
            />
          )}
          <div className="absolute inset-0">
            {navigator.slices.map((slice) => {
              const selected = slice.sliceInstanceId === selectedSlice?.sliceInstanceId;
              const busy = busySliceId === slice.sliceInstanceId;
              const rect = viewport ? sourceRectToViewportPercent(slice.sourceRect, viewport) : slice.sourceRectPercent;
              return (
                <button
                  key={slice.sliceInstanceId}
                  type="button"
                  aria-label={`Open ${slice.label}`}
                  aria-current={selected ? "page" : undefined}
                  aria-busy={busy ? "true" : undefined}
                  onClick={() => void openSlice(slice)}
                  className={cn(
                    "absolute cursor-pointer border bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    selected
                      ? "border-2 border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]"
                      : "border-[var(--border-hover)] hover:border-[var(--accent-primary)]",
                    busy && "cursor-wait opacity-80",
                  )}
                  style={{
                    left: `${rect.left}%`,
                    top: `${rect.top}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {status && (
        <div className="sr-only" role="status">
          {status}
        </div>
      )}
    </aside>
  );
}
