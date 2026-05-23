"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  BrushIcon,
  EraserIcon,
  Maximize2Icon,
  Redo2Icon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
} from "lucide-react";

import { Labels, supportMaskLabels, type LabelId } from "@/mask/labels";
import { MaskBuffer } from "@/mask/maskBuffer";
import { applyPatch } from "@/mask/patch";
import type { Patch } from "@/mask/patch";
import { buildPalette, updateOverlayRegionWithPalette } from "@/mask/renderOverlay";
import { applyBrush } from "@/mask/tools";
import {
  clampNumber,
  clientPointToImagePoint,
  getFitZoom,
  getZoomedCanvasDisplaySize,
} from "./canvasGeometry";
import { EditorCanvasStack } from "./components/EditorCanvasStack";
import { API_ARTIFACT_REVIEW, API_CROP_SUPPORT_MASK, API_CROP_SUPPORT_MASK_UPLOAD } from "./editorApi";
import { errorMessage, formatReviewState } from "./editorFormatters";
import { createEditorLoadGuard } from "./editorLoadGuard";
import { uploadEditorMask } from "./editorMaskUpload";
import { capturePointer, releasePointer, shouldIgnorePointerDown } from "./editorPointer";
import { activeButtonClass, idleButtonClass } from "./editorStyles";
import { getPaintLabelForTool } from "./editorTools";
import type { CropSupportMaskState, ReviewAction, Tool } from "./editorTypes";

type CropSupportEditorClientProps = {
  cropId: string;
  canEdit: boolean;
};

type Stroke = Patch[];

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("CROP_IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

function readinessLabel(state: CropSupportMaskState | null) {
  if (!state?.latestSupportMask) return "Support missing";
  return `${state.latestSupportMask.reviewState.toLowerCase()} support v${state.latestSupportMask.version}`;
}

export function CropSupportEditorClient({ cropId, canEdit }: CropSupportEditorClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayImageRef = useRef<ImageData | null>(null);
  const maskRef = useRef<MaskBuffer | null>(null);
  const paletteRef = useRef<Uint8ClampedArray>(
    buildPalette(supportMaskLabels(Labels.SLICE_SUPPORT), 0.5),
  );
  const draggingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeRef = useRef<Stroke>([]);
  const undoRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const opacityRef = useRef(0.5);
  const loadSequenceRef = useRef(0);

  const [state, setState] = useState<CropSupportMaskState | null>(null);
  const [status, setStatus] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushRadius, setBrushRadius] = useState(8);
  const [opacity, setOpacity] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState<ReviewAction | null>(null);

  const supportLabelValue = state?.supportLabels.sliceSupport ?? Labels.SLICE_SUPPORT;
  const supportBackgroundValue = state?.supportLabels.background ?? Labels.BG;
  const labels = useMemo(() => supportMaskLabels(supportLabelValue), [supportLabelValue]);
  const palette = useMemo(() => buildPalette(labels, opacity), [labels, opacity]);
  const editorCanEdit = canEdit && Boolean(state?.canEdit) && editorReady;

  const applyZoom = useCallback((z: number) => {
    const canvases = [
      baseCanvasRef.current,
      predictionCanvasRef.current,
      overlayCanvasRef.current,
      bboxCanvasRef.current,
      previewCanvasRef.current,
    ];
    const base = baseCanvasRef.current;
    if (!base || canvases.some((canvas) => !canvas)) return;

    const { width, height } = getZoomedCanvasDisplaySize(base.width, base.height, z);
    for (const canvas of canvases) {
      if (!canvas) continue;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }, []);

  const fitToContainer = useCallback(() => {
    const wrap = containerRef.current;
    const base = baseCanvasRef.current;
    if (!wrap || !base || !base.width || !base.height) return;

    const nextZoom = getFitZoom({
      containerWidth: wrap.clientWidth,
      containerHeight: wrap.clientHeight,
      imageWidth: base.width,
      imageHeight: base.height,
    });
    setZoom(nextZoom);
    applyZoom(nextZoom);
  }, [applyZoom]);

  const ensureOverlayBuffer = useCallback((width: number, height: number) => {
    const ctx = overlayCtxRef.current;
    const current = overlayImageRef.current;
    if (!current || current.width !== width || current.height !== height) {
      overlayImageRef.current = ctx?.createImageData(width, height) ?? new ImageData(width, height);
    }
  }, []);

  const renderOverlayFull = useCallback(() => {
    const mask = maskRef.current;
    const ctx = overlayCtxRef.current;
    if (!mask || !ctx) return;

    ensureOverlayBuffer(mask.width, mask.height);
    const imageData = overlayImageRef.current;
    if (!imageData) return;
    updateOverlayRegionWithPalette(imageData, mask, paletteRef.current, 0, 0, mask.width, mask.height);
    ctx.putImageData(imageData, 0, 0);
  }, [ensureOverlayBuffer]);

  function paintOverlayRect(x: number, y: number, width: number, height: number) {
    const mask = maskRef.current;
    const ctx = overlayCtxRef.current;
    if (!mask || !ctx) return;

    ensureOverlayBuffer(mask.width, mask.height);
    const imageData = overlayImageRef.current;
    if (!imageData) return;

    const x0 = clampNumber(x, 0, mask.width);
    const y0 = clampNumber(y, 0, mask.height);
    const x1 = clampNumber(x + width, 0, mask.width);
    const y1 = clampNumber(y + height, 0, mask.height);
    updateOverlayRegionWithPalette(imageData, mask, paletteRef.current, x0, y0, x1 - x0, y1 - y0);
    ctx.putImageData(imageData, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  const resetEditor = useCallback(() => {
    setEditorReady(false);
    setHasUnsavedChanges(false);
    maskRef.current = null;
    overlayImageRef.current = null;
    undoRef.current = [];
    redoRef.current = [];
    currentStrokeRef.current = [];
    draggingRef.current = false;
    lastPtRef.current = null;
  }, []);

  const loadEditor = useCallback(async (signal?: AbortSignal) => {
    const loadGuard = createEditorLoadGuard(loadSequenceRef, signal);
    resetEditor();
    setStatus("Loading crop support mask");
    try {
      const response = await fetch(API_CROP_SUPPORT_MASK(cropId), {
        method: "GET",
        cache: "no-store",
        signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `CROP_SUPPORT_MASK_FAILED_${response.status}`);
      }
      if (!loadGuard.isCurrent()) return;
      const nextState = data as CropSupportMaskState;
      paletteRef.current = buildPalette(
        supportMaskLabels(nextState.supportLabels.sliceSupport),
        opacityRef.current,
      );

      let latestBytes: Uint8Array | null = null;
      if (nextState.latestSupportMask?.url) {
        const assetResponse = await fetch(nextState.latestSupportMask.url, { cache: "no-store", signal });
        if (!assetResponse.ok) throw new Error(`CROP_SUPPORT_MASK_ASSET_FAILED_${assetResponse.status}`);
        const assetBuffer = await assetResponse.arrayBuffer();
        latestBytes = new Uint8Array(assetBuffer);
        if (!loadGuard.isCurrent()) return;
      }

      const img = await loadImageElement(nextState.crop.assetUrl);
      if (!loadGuard.isCurrent()) return;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (width !== nextState.crop.cropWidth || height !== nextState.crop.cropHeight) {
        throw new Error("CROP_IMAGE_DIMENSIONS_MISMATCH");
      }

      const canvases = [
        baseCanvasRef.current,
        predictionCanvasRef.current,
        overlayCanvasRef.current,
        bboxCanvasRef.current,
        previewCanvasRef.current,
      ];
      if (canvases.some((canvas) => !canvas)) throw new Error("EDITOR_CANVAS_NOT_READY");
      for (const canvas of canvases) {
        if (!canvas) continue;
        canvas.width = width;
        canvas.height = height;
      }

      const base = baseCanvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!base || !overlay) throw new Error("EDITOR_CANVAS_NOT_READY");
      const baseCtx = base.getContext("2d");
      const overlayCtx = overlay.getContext("2d");
      if (!baseCtx || !overlayCtx) throw new Error("EDITOR_CONTEXT_NOT_READY");
      overlayCtxRef.current = overlayCtx;
      baseCtx.clearRect(0, 0, width, height);
      baseCtx.drawImage(img, 0, 0);

      const mask = new MaskBuffer(width, height, nextState.supportLabels.background as LabelId);
      if (latestBytes) {
        if (latestBytes.byteLength !== width * height) throw new Error("SAVED_MASK_DIMENSIONS_MISMATCH");
        mask.data.set(latestBytes);
      }
      maskRef.current = mask;
      const initialOverlay = overlayCtx.createImageData(width, height);
      updateOverlayRegionWithPalette(
        initialOverlay,
        mask,
        buildPalette(supportMaskLabels(nextState.supportLabels.sliceSupport), opacityRef.current),
        0,
        0,
        width,
        height,
      );
      overlayImageRef.current = initialOverlay;
      overlayCtx.putImageData(initialOverlay, 0, 0);

      setState(nextState);
      setEditorReady(true);
      setHasUnsavedChanges(false);
      setStatus("");
      requestAnimationFrame(() => {
        if (!loadGuard.isCurrent()) return;
        fitToContainer();
      });
    } catch (error) {
      if (signal?.aborted) return;
      setEditorReady(false);
      setStatus(errorMessage(error, "Crop support editor failed"));
    }
  }, [cropId, fitToContainer, resetEditor]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEditor(controller.signal);
    return () => controller.abort();
  }, [loadEditor]);

  useEffect(() => {
    opacityRef.current = opacity;
    paletteRef.current = palette;
    renderOverlayFull();
  }, [opacity, palette, renderOverlayFull]);

  useEffect(() => {
    applyZoom(zoom);
  }, [applyZoom, zoom]);

  useEffect(() => {
    const onResize = () => fitToContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToContainer]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  function canvasToCropCoords(event: PointerEvent<HTMLCanvasElement>) {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return clientPointToImagePoint({
      clientX: event.clientX,
      clientY: event.clientY,
      canvasWidth: overlay.width,
      canvasHeight: overlay.height,
      rect,
    });
  }

  function markDirty() {
    setHasUnsavedChanges(true);
  }

  function stamp(x: number, y: number) {
    const mask = maskRef.current;
    if (!mask || !editorCanEdit) return;
    const patch = applyBrush(
      mask,
      x,
      y,
      brushRadius,
      getPaintLabelForTool({
        tool,
        maskMode: "support",
        activeLabel: supportLabelValue,
        supportBackgroundLabel: supportBackgroundValue,
      }),
    );
    currentStrokeRef.current.push(patch);
    paintOverlayRect(patch.x, patch.y, patch.w, patch.h);
    markDirty();
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!editorCanEdit || shouldIgnorePointerDown(event)) return;
    event.preventDefault();
    const target = event.currentTarget;
    const point = canvasToCropCoords(event);
    draggingRef.current = true;
    currentStrokeRef.current = [];
    redoRef.current = [];
    lastPtRef.current = point;
    capturePointer(target, event.pointerId);
    stamp(point.x, point.y);
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!editorCanEdit || !draggingRef.current) return;
    event.preventDefault();
    const point = canvasToCropCoords(event);
    const last = lastPtRef.current;
    lastPtRef.current = point;
    if (!last) {
      stamp(point.x, point.y);
      return;
    }

    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const distance = Math.hypot(dx, dy);
    const step = Math.max(1, Math.floor(brushRadius / 2));
    const steps = Math.max(1, Math.ceil(distance / step));
    for (let i = 1; i <= steps; i += 1) {
      stamp(
        Math.round(last.x + (dx * i) / steps),
        Math.round(last.y + (dy * i) / steps),
      );
    }
  }

  function finishStroke() {
    if (currentStrokeRef.current.length > 0) {
      undoRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = [];
    }
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    draggingRef.current = false;
    lastPtRef.current = null;
    finishStroke();
    releasePointer(event.currentTarget, event.pointerId);
  }

  function onPointerCancel(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    draggingRef.current = false;
    lastPtRef.current = null;
    finishStroke();
    releasePointer(event.currentTarget, event.pointerId);
  }

  function onPointerLeave(event: PointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current || event.currentTarget.hasPointerCapture(event.pointerId)) return;
    draggingRef.current = false;
    lastPtRef.current = null;
    finishStroke();
  }

  function undo() {
    const mask = maskRef.current;
    if (!mask || !editorCanEdit) return;
    const stroke = undoRef.current.pop();
    if (!stroke) return;
    for (let i = stroke.length - 1; i >= 0; i -= 1) {
      const patch = stroke[i];
      applyPatch(mask, patch, "before");
      paintOverlayRect(patch.x, patch.y, patch.w, patch.h);
    }
    redoRef.current.push(stroke);
    markDirty();
  }

  function redo() {
    const mask = maskRef.current;
    if (!mask || !editorCanEdit) return;
    const stroke = redoRef.current.pop();
    if (!stroke) return;
    for (const patch of stroke) {
      applyPatch(mask, patch, "after");
      paintOverlayRect(patch.x, patch.y, patch.w, patch.h);
    }
    undoRef.current.push(stroke);
    markDirty();
  }

  async function saveMask() {
    const mask = maskRef.current;
    if (!mask || !editorCanEdit || !hasUnsavedChanges) return;
    setIsSaving(true);
    setStatus("Saving crop support mask");
    try {
      const response = await uploadEditorMask(API_CROP_SUPPORT_MASK_UPLOAD(cropId), {
        data: mask.data,
        width: mask.width,
        height: mask.height,
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error ?? "CROP_SUPPORT_MASK_SAVE_FAILED");
      setState(data as CropSupportMaskState);
      setHasUnsavedChanges(false);
      setStatus("Saved");
      setTimeout(() => setStatus(""), 800);
    } catch (error) {
      setStatus(errorMessage(error, "Crop support mask save failed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function runSupportReviewAction(action: ReviewAction) {
    const version = state?.latestSupportMask;
    if (!version || hasUnsavedChanges) return;
    const comment = reviewComment.trim();
    if (action === "reject" && !comment) {
      setStatus("Reject reason required");
      return;
    }

    setReviewBusy(action);
    setStatus("");
    try {
      const response = await fetch(API_ARTIFACT_REVIEW(version.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment || undefined,
          reason: action === "reject" ? comment : undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `CROP_SUPPORT_REVIEW_FAILED_${response.status}`);
      }
      setReviewComment("");
      await loadEditor();
      setStatus(`Support mask ${formatReviewState(data.toState)}`);
      setTimeout(() => setStatus(""), 800);
    } catch (error) {
      setStatus(errorMessage(error, "Crop support review failed"));
    } finally {
      setReviewBusy(null);
    }
  }

  async function reloadLatest() {
    if (hasUnsavedChanges && !window.confirm("Discard unsaved crop support mask changes?")) return;
    await loadEditor();
  }

  const editorStatus = isSaving ? "Saving..." : status || (hasUnsavedChanges ? "Unsaved changes" : "");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div className="border-b border-border bg-muted p-3">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Draw the complete outline of the physical wood slice.</span>
          <span>This support mask is required before semantic crop annotation.</span>
          <span>Copper penetration masks are not support masks.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={tool === "brush" ? activeButtonClass : idleButtonClass}
            aria-pressed={tool === "brush"}
            onClick={() => setTool("brush")}
            disabled={!editorCanEdit}
            title="Brush"
          >
            <BrushIcon className="size-4" aria-hidden="true" />
            Brush
          </button>
          <button
            className={tool === "eraser" ? activeButtonClass : idleButtonClass}
            aria-pressed={tool === "eraser"}
            onClick={() => setTool("eraser")}
            disabled={!editorCanEdit}
            title="Eraser"
          >
            <EraserIcon className="size-4" aria-hidden="true" />
            Eraser
          </button>
          <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <span>Size {brushRadius}px</span>
            <input
              type="range"
              min={1}
              max={80}
              value={brushRadius}
              onChange={(event) => setBrushRadius(Number(event.target.value))}
              disabled={!editorCanEdit}
              className="w-32"
            />
          </div>
          <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <span>Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(event) => setOpacity(Number(event.target.value) / 100)}
              className="w-32"
            />
            <span className="tabular-nums w-10">{Math.round(opacity * 100)}%</span>
          </div>
          <div className="ml-auto flex min-h-11 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{readinessLabel(state)}</span>
            {state?.cropReadiness && (
              <span>Export readiness: {state.cropReadiness.readinessStatus.toLowerCase().replaceAll("_", " ")}</span>
            )}
            {state?.latestSupportMask && (
              <span>
                {state.latestSupportMask.width} x {state.latestSupportMask.height}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button className={idleButtonClass} onClick={undo} disabled={!editorCanEdit} title="Undo">
            <Undo2Icon className="size-4" aria-hidden="true" />
            Undo
          </button>
          <button className={idleButtonClass} onClick={redo} disabled={!editorCanEdit} title="Redo">
            <Redo2Icon className="size-4" aria-hidden="true" />
            Redo
          </button>
          <button className={idleButtonClass} onClick={fitToContainer} title="Fit">
            <Maximize2Icon className="size-4" aria-hidden="true" />
            Fit
          </button>
          <button className={idleButtonClass} onClick={reloadLatest} disabled={isSaving} title="Reload latest">
            <RotateCcwIcon className="size-4" aria-hidden="true" />
            Reload latest
          </button>
          <button
            className={idleButtonClass}
            onClick={() => void saveMask()}
            disabled={!editorCanEdit || isSaving || !hasUnsavedChanges}
            title="Save"
          >
            <SaveIcon className="size-4" aria-hidden="true" />
            Save support mask
          </button>
          {state?.latestSupportMask && (
            <>
              <button
                className={idleButtonClass}
                onClick={() => void runSupportReviewAction("submit")}
                disabled={
                  hasUnsavedChanges ||
                  reviewBusy !== null ||
                  !state.latestSupportMask.reviewActions.canSubmit
                }
              >
                Submit
              </button>
              <button
                className={idleButtonClass}
                onClick={() => void runSupportReviewAction("approve")}
                disabled={
                  hasUnsavedChanges ||
                  reviewBusy !== null ||
                  !state.latestSupportMask.reviewActions.canApprove
                }
              >
                Approve
              </button>
              <button
                className={idleButtonClass}
                onClick={() => void runSupportReviewAction("reject")}
                disabled={
                  hasUnsavedChanges ||
                  reviewBusy !== null ||
                  !state.latestSupportMask.reviewActions.canReject
                }
              >
                Reject
              </button>
              <input
                aria-label="Support review comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Review comment"
                className="min-h-11 w-48 rounded-md border border-border bg-input-background px-3 py-2 text-sm"
              />
            </>
          )}
          <div className="ml-auto flex min-h-11 items-center gap-3">
            {editorStatus && <div className="text-xs text-muted-foreground">{editorStatus}</div>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Zoom</span>
              <input
                type="range"
                min={5}
                max={300}
                value={Math.round(zoom * 100)}
                onChange={(event) => setZoom(clampNumber(Number(event.target.value) / 100, 0.05, 3))}
                className="w-32"
              />
              <span className="tabular-nums w-10">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <EditorCanvasStack
        containerRef={containerRef}
        baseCanvasRef={baseCanvasRef}
        predictionCanvasRef={predictionCanvasRef}
        overlayCanvasRef={overlayCanvasRef}
        bboxCanvasRef={bboxCanvasRef}
        previewCanvasRef={previewCanvasRef}
        tool={tool}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onCommitPolygon={() => undefined}
      />
    </div>
  );
}
