"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaskBuffer } from "@/mask/maskBuffer";
import { DEFAULT_LABELS, Labels, supportMaskLabels, type LabelId } from "@/mask/labels";
import { applyBrush, applyPolygonFill } from "@/mask/tools";
import { applyPatch, type Patch } from "@/mask/patch";
import { buildPalette, updateOverlayRegionWithPalette } from "@/mask/renderOverlay";
import { editorCanvasPreviewStyle } from "@/design/editorCanvas";
import {
  clampNumber,
  clientPointToImagePoint,
  getFitZoom,
  getZoomedCanvasDisplaySize,
} from "./canvasGeometry";

type Props = {
  projectId: string;
  imageId: string;
  canEdit: boolean;
};

const API_IMAGE_VIEW = (imageId: string) => `/api/images/${imageId}/view`;
const API_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/mask/latest`;
const API_MASK_UPLOAD = (imageId: string) => `/api/images/${imageId}/mask/upload`;
const API_SUPPORT_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/support-mask/latest`;
const API_SUPPORT_MASK_UPLOAD = (imageId: string) => `/api/images/${imageId}/support-mask/upload`;
const API_SLICE_STATE = (imageId: string) => `/api/images/${imageId}/slice`;
const API_SLICE_CLASSIFICATION = (imageId: string) => `/api/images/${imageId}/slice/classification`;
const API_REVIEW_STATE = (imageId: string) => `/api/images/${imageId}/review-state`;
const API_ARTIFACT_REVIEW = (versionId: string) => `/api/artifact-versions/${versionId}/review`;
const API_CLASSIFICATION_REVIEW = (versionId: string) =>
  `/api/slice-classification-versions/${versionId}/review`;

type Stroke = Patch[];
type Tool = "brush" | "lasso_free" | "lasso_poly";
type MaskMode = "semantic" | "support";
type Point = { x: number; y: number };

type SliceClassValue =
  | "SAP_HEARTWOOD_SLICE"
  | "COPPER_SLICE"
  | "UNKNOWN"
  | "REVIEW_REQUIRED";
type ReviewStateValue = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
type ReviewAction = "submit" | "approve" | "reject";

type SliceState = {
  canEdit: boolean;
  supportLabels: { background: number; sliceSupport: number };
  sliceInstance: { id: string; supportArtifactVersionId: string | null } | null;
  latestSupportMask: {
    id: string;
    version: number;
    reviewState: string;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
  } | null;
  latestClassification: {
    id: string;
    version: number;
    class: SliceClassValue;
    reviewState: string;
    createdAt: string;
    createdBy: { email: string; name: string | null } | null;
  } | null;
};

type ReviewVersion = {
  id: string;
  version: number;
  reviewState: ReviewStateValue;
  createdAt: string;
  createdBy: { email: string; name: string | null } | null;
};

type ClassificationReviewVersion = ReviewVersion & {
  class: SliceClassValue;
};

type ReviewableState = {
  type: "SEMANTIC_MASK" | "SLICE_SUPPORT_MASK" | "SLICE_CLASSIFICATION";
  label: string;
  latestVersion: ReviewVersion | ClassificationReviewVersion | null;
  latestApprovedVersion: ReviewVersion | ClassificationReviewVersion | null;
  exportReady: boolean;
  actions: {
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
  };
};

type ImageReviewState = {
  myRole: string;
  permissions: { canSubmit: boolean; canReview: boolean };
  reviewables: {
    semanticMask: ReviewableState;
    supportMask: ReviewableState;
    sliceClassification: ReviewableState;
  };
  exportReady: boolean;
  warnings: string[];
};

const SLICE_CLASS_OPTIONS: Array<{ value: SliceClassValue; label: string }> = [
  { value: "SAP_HEARTWOOD_SLICE", label: "Sap/Heartwood slice" },
  { value: "COPPER_SLICE", label: "Copper slice" },
  { value: "UNKNOWN", label: "Unknown" },
  { value: "REVIEW_REQUIRED", label: "Review required" },
];

function errorMessage(error: unknown, fallback = "Save failed") {
  return error instanceof Error ? error.message : fallback;
}

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function formatReviewState(state: ReviewStateValue | string | null | undefined) {
  if (!state) return "Missing";
  const normalized = state.toLowerCase().replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatVersion(version: ReviewVersion | ClassificationReviewVersion | null) {
  return version ? `${formatReviewState(version.reviewState)} v${version.version}` : "Missing";
}

function shouldIgnorePointerDown(evt: React.PointerEvent<HTMLCanvasElement>) {
  if (evt.pointerType === "mouse" && evt.button !== 0) return true;
  if (evt.pointerType !== "mouse" && !evt.isPrimary) return true;
  return false;
}

function capturePointer(target: HTMLCanvasElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Pointer capture can fail if the browser already cancelled the pointer.
  }
}

function releasePointer(target: HTMLCanvasElement, pointerId: number) {
  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // Releasing a cancelled pointer is best-effort across browsers.
  }
}

export default function EditorClient({ imageId, canEdit }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [opacity, setOpacity] = useState<number>(0.45);
  const [brushRadius, setBrushRadius] = useState<number>(12);
  const [activeLabel, setActiveLabel] = useState<LabelId>(Labels.COPPER);
  const [tool, setTool] = useState<Tool>("brush");
  const [maskMode, setMaskMode] = useState<MaskMode>("semantic");
  const [sliceState, setSliceState] = useState<SliceState | null>(null);
  const [selectedSliceClass, setSelectedSliceClass] = useState<SliceClassValue | "">("");
  const [classificationStatus, setClassificationStatus] = useState<string>("");
  const [classificationSaving, setClassificationSaving] = useState(false);
  const [reviewState, setReviewState] = useState<ImageReviewState | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewComment, setReviewComment] = useState<string>("");
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(1);

  const supportLabelValue = sliceState?.supportLabels.sliceSupport ?? Labels.SLICE_SUPPORT;
  const labels = useMemo(
    () => (maskMode === "support" ? supportMaskLabels(supportLabelValue) : DEFAULT_LABELS),
    [maskMode, supportLabelValue],
  );

  const maskRef = useRef<MaskBuffer | null>(null);

  // Pointer state
  const draggingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<Point[]>([]);
  const lassoActiveRef = useRef(false);
  const lassoDragIndexRef = useRef<number | null>(null);

  // Undo/Redo: strokes (Patch[])
  const undoRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke>([]);

  // Overlay cache + dirty batching
  const overlayImageRef = useRef<ImageData | null>(null);
  const dirtyRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const rafPendingRef = useRef(false);
  const paletteRef = useRef<Uint8ClampedArray | null>(null);
  const paletteOpacityRef = useRef<number>(opacity);
  const overlayRenderTokenRef = useRef(0);

  // Autosave
  const dirtyMaskRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const dirtyRevisionRef = useRef(0);
  const loadedOnceRef = useRef(false);
  const pendingMaskRef = useRef<{
    imageId: string;
    mode: MaskMode;
    promise: Promise<Uint8Array | null>;
  } | null>(null);
  const maskFetchAbortRef = useRef<AbortController | null>(null);
  const keyboardActionsRef = useRef<{
    canEdit: boolean;
    tool: Tool;
    undo: () => void;
    redo: () => void;
    resetLasso: () => void;
    commitLasso: (points: Point[]) => void;
  } | null>(null);

  const loadSliceState = useCallback(async () => {
    const res = await fetch(API_SLICE_STATE(imageId), { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setClassificationStatus(data?.error ?? `SLICE_STATE_FAILED_${res.status}`);
      return;
    }
    const nextState = data as SliceState;
    setSliceState(nextState);
    setSelectedSliceClass(nextState.latestClassification?.class ?? "");
  }, [imageId]);

  const loadReviewState = useCallback(async () => {
    const res = await fetch(API_REVIEW_STATE(imageId), { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setReviewStatus(data?.error ?? `REVIEW_STATE_FAILED_${res.status}`);
      return;
    }
    setReviewState(data as ImageReviewState);
    setReviewStatus("");
  }, [imageId]);

  useEffect(() => {
    void loadSliceState();
    void loadReviewState();
  }, [loadReviewState, loadSliceState]);

  // ---------- helpers ----------
  const getPalette = useCallback(() => {
    if (!paletteRef.current || paletteOpacityRef.current !== opacity) {
      paletteRef.current = buildPalette(labels, opacity);
      paletteOpacityRef.current = opacity;
    }
    return paletteRef.current;
  }, [labels, opacity]);

  function ensureOverlayBuffer(w: number, h: number) {
    const cur = overlayImageRef.current;
    if (!cur || cur.width !== w || cur.height !== h) {
      const ctx = overlayCtxRef.current;
      overlayImageRef.current = ctx?.createImageData(w, h) ?? new ImageData(w, h);
    }
  }

  function paintOverlayRect(x: number, y: number, w: number, h: number) {
    const mask = maskRef.current;
    const octx = overlayCtxRef.current;
    if (!mask || !octx) return;

    ensureOverlayBuffer(mask.width, mask.height);
    const oimg = overlayImageRef.current;
    if (!oimg) return;

    const x0 = clampNumber(x, 0, mask.width);
    const y0 = clampNumber(y, 0, mask.height);
    const x1 = clampNumber(x + w, 0, mask.width);
    const y1 = clampNumber(y + h, 0, mask.height);

    // update just that region in the cached ImageData
    const palette = getPalette();
    updateOverlayRegionWithPalette(oimg, mask, palette, x0, y0, x1 - x0, y1 - y0);

    octx.putImageData(oimg, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  function markMaskDirty() {
    dirtyMaskRef.current = true;
    dirtyRevisionRef.current += 1;
    setHasUnsavedChanges(true);
  }

  function switchMaskMode(nextMode: MaskMode) {
    if (nextMode === maskMode) return;
    if (hasUnsavedChanges || dirtyMaskRef.current) {
      setStatus("Save current mask before switching modes");
      return;
    }

    resetLasso();
    setMaskMode(nextMode);
    setActiveLabel(nextMode === "support" ? supportLabelValue : Labels.COPPER);
    setStatus("");
  }

  function queueOverlayUpdate(x: number, y: number, w: number, h: number) {
    const x0 = x;
    const y0 = y;
    const x1 = x + w;
    const y1 = y + h;
    const token = overlayRenderTokenRef.current;

    const cur = dirtyRef.current;
    if (!cur) {
      dirtyRef.current = { x0, y0, x1, y1 };
    } else {
      cur.x0 = Math.min(cur.x0, x0);
      cur.y0 = Math.min(cur.y0, y0);
      cur.x1 = Math.max(cur.x1, x1);
      cur.y1 = Math.max(cur.y1, y1);
    }

    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(() => {
        rafPendingRef.current = false;
        if (overlayRenderTokenRef.current !== token) {
          // A full rerender started; re-queue the latest dirty rect for the new token.
          const d = dirtyRef.current;
          dirtyRef.current = null;
          if (d) queueOverlayUpdate(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
          return;
        }
        const d = dirtyRef.current;
        dirtyRef.current = null;
        if (!d) return;
        paintOverlayRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      });
    }
  }

  const rerenderOverlayFull = useCallback(() => {
    const mask = maskRef.current;
    const octx = overlayCtxRef.current;
    if (!mask || !octx) return;

    // Full redraw in blocks (keine UI-freezes bei großen Bildern)
    const W = mask.width;
    const H = mask.height;
    const palette = getPalette();
    const token = overlayRenderTokenRef.current + 1;
    overlayRenderTokenRef.current = token;

    const blockH = 256;
    let y = 0;

    const step = () => {
      if (overlayRenderTokenRef.current !== token) return;
      const yEnd = Math.min(H, y + blockH);
      const oimg = overlayImageRef.current;
      if (!oimg) return;
      updateOverlayRegionWithPalette(oimg, mask, palette, 0, y, W, yEnd - y);
      octx.putImageData(oimg, 0, 0, 0, y, W, yEnd - y);
      y = yEnd;
      if (y < H) requestAnimationFrame(step);
    };

    // start with a fresh buffer, then paint in chunks
    overlayImageRef.current = octx.createImageData(W, H);
    step();
  }, [getPalette]);

  // ---------- Zoom / Fit ----------
  const applyZoom = useCallback((z: number) => {
    const base = baseCanvasRef.current;
    const over = overlayCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!base || !over || !preview) return;

    const iw = base.width;
    const ih = base.height;

    const { width: dispW, height: dispH } = getZoomedCanvasDisplaySize(iw, ih, z);

    base.style.width = `${dispW}px`;
    base.style.height = `${dispH}px`;
    over.style.width = `${dispW}px`;
    over.style.height = `${dispH}px`;
    preview.style.width = `${dispW}px`;
    preview.style.height = `${dispH}px`;
  }, []);

  const fitToContainer = useCallback(() => {
    const wrap = containerRef.current;
    const base = baseCanvasRef.current;
    if (!wrap || !base) return;

    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;

    const iw = base.width;
    const ih = base.height;

    if (!iw || !ih) return;

    const z = getFitZoom({
      containerWidth: cw,
      containerHeight: ch,
      imageWidth: iw,
      imageHeight: ih,
    });
    setZoom(z);
    applyZoom(z);
  }, [applyZoom]);

  // ---------- Coords ----------
  function canvasToImageCoords(evt: React.PointerEvent<HTMLCanvasElement>) {
    const over = overlayCanvasRef.current!;
    const rect = over.getBoundingClientRect();
    return clientPointToImagePoint({
      clientX: evt.clientX,
      clientY: evt.clientY,
      canvasWidth: over.width,
      canvasHeight: over.height,
      rect,
    });
  }

  const clearPreview = useCallback(() => {
    const ctx = previewCtxRef.current;
    const c = previewCanvasRef.current;
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }, []);

  function drawLassoPreview(points: Point[], hover?: Point | null, showHandles = false) {
    const ctx = previewCtxRef.current;
    const c = previewCanvasRef.current;
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (points.length === 0 && !hover) return;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = editorCanvasPreviewStyle.polygonStroke;
    ctx.fillStyle = editorCanvasPreviewStyle.polygonFill;
    ctx.shadowColor = editorCanvasPreviewStyle.polygonShadow;
    ctx.shadowBlur = 2;

    if (points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(points[0].x + 0.5, points[0].y + 0.5);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x + 0.5, points[i].y + 0.5);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (points.length > 0) {
      ctx.moveTo(points[0].x + 0.5, points[0].y + 0.5);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x + 0.5, points[i].y + 0.5);
      }
      if (hover) {
        ctx.lineTo(hover.x + 0.5, hover.y + 0.5);
        if (points.length >= 2) {
          ctx.lineTo(points[0].x + 0.5, points[0].y + 0.5);
        }
      }
    } else if (hover) {
      ctx.moveTo(hover.x + 0.5, hover.y + 0.5);
      ctx.lineTo(hover.x + 0.5, hover.y + 0.5);
    }
    ctx.stroke();

    if (showHandles) {
      const r = 5;
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = editorCanvasPreviewStyle.handleStroke;
      ctx.fillStyle = editorCanvasPreviewStyle.handleFill;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        ctx.beginPath();
        ctx.arc(p.x + 0.5, p.y + 0.5, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const resetLasso = useCallback(() => {
    lassoActiveRef.current = false;
    lassoPointsRef.current = [];
    lassoDragIndexRef.current = null;
    clearPreview();
  }, [clearPreview]);

  function commitLasso(points: Point[]) {
    if (points.length < 3) {
      resetLasso();
      return;
    }
    const mask = maskRef.current;
    if (!mask) return;

    const patch = applyPolygonFill(mask, points, activeLabel);
    if (!patch) {
      resetLasso();
      return;
    }

    undoRef.current.push([patch]);
    redoRef.current = [];
    queueOverlayUpdate(patch.x, patch.y, patch.w, patch.h);
    markMaskDirty();
    scheduleAutosave();
    resetLasso();
  }

  // ---------- Autosave ----------
  function scheduleAutosave() {
    if (!loadedOnceRef.current) return; // nicht während initial load
    if (!canEdit) return;

    markMaskDirty();
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    // debounce: 1.2s nach letzter Änderung
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveMaskNow();
    }, 1200);
  }

  async function saveMaskNow() {
    const mask = maskRef.current;
    if (!mask) return;
    if (!canEdit) return;
    if (!dirtyMaskRef.current) return;

    if (savingRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    const saveRevision = dirtyRevisionRef.current;
    try {
      setStatus("Saving…");

      const bytes = new Uint8Array(mask.data.length);
      bytes.set(mask.data);
      const blob = new Blob([bytes], { type: "application/octet-stream" });

      const upload = await fetch(
        maskMode === "support" ? API_SUPPORT_MASK_UPLOAD(imageId) : API_MASK_UPLOAD(imageId),
        {
        method: "POST",
        headers: {
          "content-type": blob.type,
          "x-mask-width": String(mask.width),
          "x-mask-height": String(mask.height),
          "x-mask-format": "u8raw-v1",
        },
        body: blob,
        },
      );

      if (!upload.ok) {
        const t = await upload.text().catch(() => "");
        throw new Error(`UPLOAD_FAILED ${upload.status}: ${t}`);
      }

      if (dirtyRevisionRef.current === saveRevision) {
        dirtyMaskRef.current = false;
        setHasUnsavedChanges(false);
        setStatus("Saved");
        setTimeout(() => setStatus(""), 800);
        if (maskMode === "support") void loadSliceState();
        void loadReviewState();
      } else {
        saveQueuedRef.current = true;
      }
    } catch (e: unknown) {
      console.error(e);
      setStatus(errorMessage(e));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        await saveMaskNow();
      }
    }
  }

  // ---------- Load latest mask ----------
  const fetchLatestMaskBytes = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(
        maskMode === "support" ? API_SUPPORT_MASK_LATEST(imageId) : API_MASK_LATEST(imageId),
        { method: "GET", signal },
      );
      if (!res.ok) return null;

      const json = await res.json().catch(() => null);
      if (!json?.exists) return null;

      const url = json.url as string | undefined;
      const format = json.format as string | undefined;

      if (!url) return null;
      if (format && format !== "u8raw-v1") {
        console.warn("Unknown mask format:", format);
        return null;
      }

      const ab = await fetch(url, { signal }).then((r) => r.arrayBuffer());
      return new Uint8Array(ab);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return null;
      }
      throw error;
    }
  }, [imageId, maskMode]);

  // ---------- Image load ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus("Loading image…");
      const res = await fetch(API_IMAGE_VIEW(imageId), { method: "GET" });
      if (!res.ok) {
        setStatus("Failed to load image URL");
        return;
      }
      const json = await res.json();
      if (!alive) return;
      setImgUrl(json.url);
      setStatus("");
    })().catch((error) => {
      if (!alive) return;
      console.warn("Failed to load image URL:", error);
      setStatus("Failed to load image URL");
    });

    // Start mask fetch early so it can download while the image loads.
    if (maskFetchAbortRef.current) {
      maskFetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    maskFetchAbortRef.current = controller;
    pendingMaskRef.current = { imageId, mode: maskMode, promise: fetchLatestMaskBytes(controller.signal) };
    return () => {
      alive = false;
      if (maskFetchAbortRef.current) {
        maskFetchAbortRef.current.abort();
        maskFetchAbortRef.current = null;
      }
    };
  }, [fetchLatestMaskBytes, imageId, maskMode]);

  useEffect(() => {
    if (!imgUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    // Use a local cancel flag to avoid HMR/double-render races without global token bumps.
    let cancelled = false;

    img.onload = async () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      const base = baseCanvasRef.current!;
      const over = overlayCanvasRef.current!;
      const preview = previewCanvasRef.current!;
      base.width = w;
      base.height = h;
      over.width = w;
      over.height = h;
      preview.width = w;
      preview.height = h;
      overlayCtxRef.current = over.getContext("2d");
      previewCtxRef.current = preview.getContext("2d");

      // base
      const bctx = base.getContext("2d")!;
      bctx.clearRect(0, 0, w, h);
      bctx.drawImage(img, 0, 0);

      // init empty mask
      maskRef.current = new MaskBuffer(w, h, Labels.BG);

      // reset history
      undoRef.current = [];
      redoRef.current = [];
      currentStrokeRef.current = [];
      dirtyMaskRef.current = false;
      dirtyRevisionRef.current = 0;
      setHasUnsavedChanges(false);
      setIsSaving(false);

      // clear overlay immediately (mask bytes may still be loading)
      const octx = overlayCtxRef.current;
      if (octx) {
        overlayImageRef.current = octx.createImageData(w, h);
        octx.clearRect(0, 0, w, h);
      }
      clearPreview();

      // fit & zoom
      fitToContainer();

      // load saved mask (optional)
      try {
        const pending = pendingMaskRef.current;
        const bytes =
          pending && pending.imageId === imageId && pending.mode === maskMode
            ? await pending.promise
            : await fetchLatestMaskBytes(maskFetchAbortRef.current?.signal);
        if (cancelled) return;
        if (bytes && bytes.length === w * h) {
          maskRef.current.data.set(bytes);
        } else if (bytes) {
          console.warn("Saved mask byteLength mismatch. Ignoring.", {
            got: bytes.length,
            expected: w * h,
          });
        }
        rerenderOverlayFull();
      } catch (e) {
        console.warn("Failed to load latest mask:", e);
        rerenderOverlayFull();
      }

      loadedOnceRef.current = true;
      setStatus("");
    };

    img.onerror = () => {
      if (cancelled) return;
      setStatus("Failed to load image asset");
    };
    img.src = imgUrl;
    return () => {
      cancelled = true;
    };
  }, [clearPreview, fetchLatestMaskBytes, fitToContainer, imageId, imgUrl, maskMode, rerenderOverlayFull]);

  async function runReviewAction(reviewable: ReviewableState, action: ReviewAction) {
    const version = reviewable.latestVersion;
    if (!version) return;

    const comment = reviewComment.trim();
    if (action === "reject" && !comment) {
      setReviewStatus("Reject reason required");
      return;
    }

    const busyKey = `${reviewable.type}:${version.id}:${action}`;
    setReviewBusyKey(busyKey);
    setReviewStatus("");
    try {
      const endpoint =
        reviewable.type === "SLICE_CLASSIFICATION"
          ? API_CLASSIFICATION_REVIEW(version.id)
          : API_ARTIFACT_REVIEW(version.id);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment || undefined,
          reason: action === "reject" ? comment : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `REVIEW_ACTION_FAILED_${res.status}`);
      }
      setReviewComment("");
      setReviewStatus(`${reviewable.label} ${formatReviewState(data.toState)}`);
      await Promise.all([loadReviewState(), loadSliceState()]);
    } catch (error) {
      setReviewStatus(errorMessage(error, "Review action failed"));
    } finally {
      setReviewBusyKey(null);
    }
  }

  async function saveSliceClassification() {
    if (!canEdit || !selectedSliceClass) return;

    setClassificationSaving(true);
    setClassificationStatus("");
    try {
      const res = await fetch(API_SLICE_CLASSIFICATION(imageId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class: selectedSliceClass }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `CLASSIFICATION_FAILED_${res.status}`);
      }
      setSliceState(data as SliceState);
      void loadReviewState();
      setClassificationStatus("Classification saved");
      setTimeout(() => setClassificationStatus(""), 1000);
    } catch (error) {
      setClassificationStatus(errorMessage(error, "Classification save failed"));
    } finally {
      setClassificationSaving(false);
    }
  }

  // Opacity affects palette => full redraw (rare)
  useEffect(() => {
    paletteRef.current = null;
    rerenderOverlayFull();
  }, [rerenderOverlayFull]);

  // Apply zoom
  useEffect(() => {
    applyZoom(zoom);
  }, [applyZoom, zoom]);

  // Fit on resize
  useEffect(() => {
    const onResize = () => fitToContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToContainer]);

  useEffect(() => {
    resetLasso();
    draggingRef.current = false;
    lastPtRef.current = null;
  }, [resetLasso, tool]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  // ---------- Painting ----------
function stamp(x: number, y: number) {
  const mask = maskRef.current;
  if (!mask) return;

  const patch = applyBrush(mask, x, y, brushRadius, activeLabel);
  currentStrokeRef.current.push(patch);
  queueOverlayUpdate(patch.x, patch.y, patch.w, patch.h);

  // Mark immediately so iPad/browser users see unsaved state while drawing.
  markMaskDirty();
}

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    if (!maskRef.current) return;
    if (shouldIgnorePointerDown(e)) return;
    e.preventDefault();

    const target = e.currentTarget;
    const p = canvasToImageCoords(e);

    if (tool === "brush") {
      draggingRef.current = true;
      currentStrokeRef.current = [];
      redoRef.current = []; // new action kills redo
      lastPtRef.current = p;
      capturePointer(target, e.pointerId);
      stamp(p.x, p.y);
      return;
    }

    if (tool === "lasso_free") {
      lassoActiveRef.current = true;
      lassoPointsRef.current = [p];
      redoRef.current = [];
      drawLassoPreview(lassoPointsRef.current);
      capturePointer(target, e.pointerId);
      return;
    }

    if (tool === "lasso_poly") {
      const pts = lassoPointsRef.current;
      const handleRadius = 6;
      if (pts.length > 0) {
        for (let i = 0; i < pts.length; i++) {
          const dx = p.x - pts[i].x;
          const dy = p.y - pts[i].y;
          if (dx * dx + dy * dy <= handleRadius * handleRadius) {
            lassoDragIndexRef.current = i;
            capturePointer(target, e.pointerId);
            drawLassoPreview(pts, null, true);
            return;
          }
        }
      }
      if (pts.length === 0) {
        redoRef.current = [];
      }
      const first = pts[0];
      if (first && pts.length >= 3) {
        const dx = p.x - first.x;
        const dy = p.y - first.y;
        if (dx * dx + dy * dy <= 36) {
          commitLasso(pts.slice());
          return;
        }
      }
      pts.push(p);
      drawLassoPreview(pts, null, true);
      return;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    if (!maskRef.current) return;
    e.preventDefault();

    const p = canvasToImageCoords(e);
    if (tool === "brush") {
      if (!draggingRef.current) return;
      const last = lastPtRef.current;
      lastPtRef.current = p;

      if (!last) {
        stamp(p.x, p.y);
        return;
      }

      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);

      const step = Math.max(1, Math.floor(brushRadius / 2));
      const steps = Math.max(1, Math.ceil(dist / step));

      for (let i = 1; i <= steps; i++) {
        const x = Math.round(last.x + (dx * i) / steps);
        const y = Math.round(last.y + (dy * i) / steps);
        stamp(x, y);
      }
      return;
    }

    if (tool === "lasso_free") {
      if (!lassoActiveRef.current) return;
      const pts = lassoPointsRef.current;
      const last = pts[pts.length - 1];
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      if (dx * dx + dy * dy >= 4) {
        pts.push(p);
        drawLassoPreview(pts);
      }
      return;
    }

    if (tool === "lasso_poly") {
      const pts = lassoPointsRef.current;
      const dragIndex = lassoDragIndexRef.current;
      if (dragIndex !== null) {
        pts[dragIndex] = p;
        drawLassoPreview(pts, null, true);
        return;
      }
      if (pts.length === 0) return;
      drawLassoPreview(pts, p, true);
      return;
    }
  }

  function finishStroke() {
  if (currentStrokeRef.current.length > 0) {
    undoRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = [];
    redoRef.current = [];
    scheduleAutosave(); // <-- hier
  }
}


  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const target = e.currentTarget;

    if (tool === "brush") {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
      releasePointer(target, e.pointerId);
      return;
    }

    if (tool === "lasso_free") {
      if (lassoActiveRef.current) {
        lassoActiveRef.current = false;
        releasePointer(target, e.pointerId);
        commitLasso(lassoPointsRef.current.slice());
      }
      return;
    }

    if (tool === "lasso_poly") {
      if (lassoDragIndexRef.current !== null) {
        lassoDragIndexRef.current = null;
        releasePointer(target, e.pointerId);
        drawLassoPreview(lassoPointsRef.current, null, true);
      }
      return;
    }
  }

  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const target = e.currentTarget;

    if (tool === "brush") {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
      releasePointer(target, e.pointerId);
      return;
    }

    if (tool === "lasso_free") {
      lassoActiveRef.current = false;
      releasePointer(target, e.pointerId);
      resetLasso();
      return;
    }

    if (tool === "lasso_poly") {
      lassoDragIndexRef.current = null;
      releasePointer(target, e.pointerId);
      drawLassoPreview(lassoPointsRef.current, null, true);
    }
  }

  function onPointerLeave(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "lasso_poly" && lassoDragIndexRef.current === null) {
      drawLassoPreview(lassoPointsRef.current, null, true);
    }
    if (tool === "brush" && draggingRef.current && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
    }
  }

  function undo() {
    const mask = maskRef.current;
    if (!mask) return;

    const stroke = undoRef.current.pop();
    if (!stroke) return;

    // apply "before" in reverse order
    for (let i = stroke.length - 1; i >= 0; i--) {
      const p = stroke[i];
      applyPatch(mask, p, "before");
      queueOverlayUpdate(p.x, p.y, p.w, p.h);
    }

    redoRef.current.push(stroke);
    scheduleAutosave();
  }

  function redo() {
    const mask = maskRef.current;
    if (!mask) return;

    const stroke = redoRef.current.pop();
    if (!stroke) return;

    // apply "after" in forward order
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i];
      applyPatch(mask, p, "after");
      queueOverlayUpdate(p.x, p.y, p.w, p.h);
    }

    undoRef.current.push(stroke);
    scheduleAutosave();
  }

  keyboardActionsRef.current = {
    canEdit,
    tool,
    undo,
    redo,
    resetLasso,
    commitLasso,
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const actions = keyboardActionsRef.current;
      if (!actions?.canEdit) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        actions.redo();
      }

      if (e.key === "Escape") {
        actions.resetLasso();
      }

      if (actions.tool === "lasso_poly" && e.key === "Enter") {
        e.preventDefault();
        actions.commitLasso(lassoPointsRef.current.slice());
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- Export (PNG indexed-style: label in RGB) ----------
  async function exportMaskPng() {
    const mask = maskRef.current;
    if (!mask) return;

    const c = document.createElement("canvas");
    c.width = mask.width;
    c.height = mask.height;

    const ctx = c.getContext("2d")!;
    const id = new ImageData(mask.width, mask.height);
    const d = id.data;

    for (let i = 0; i < mask.data.length; i++) {
      const v = mask.data[i] ?? 0;
      const o = i * 4;
      d[o + 0] = v;
      d[o + 1] = v;
      d[o + 2] = v;
      d[o + 3] = 255;
    }

    ctx.putImageData(id, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG_EXPORT_FAILED"))), "image/png");
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mask-${imageId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- UI ----------
  const editorStatus = isSaving ? "Saving…" : status || (hasUnsavedChanges ? "Unsaved changes" : "");
  const activeButtonClass = "min-h-11 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90";
  const idleButtonClass =
    "min-h-11 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent";
  const latestClassificationLabel =
    SLICE_CLASS_OPTIONS.find((option) => option.value === sliceState?.latestClassification?.class)?.label ??
    "Missing";
  const latestSupportStatus = sliceState?.latestSupportMask
    ? `${formatReviewState(sliceState.latestSupportMask.reviewState)} v${sliceState.latestSupportMask.version} saved`
    : "Missing";
  const reviewItems = reviewState
    ? [
        reviewState.reviewables.semanticMask,
        reviewState.reviewables.supportMask,
        reviewState.reviewables.sliceClassification,
      ]
    : [];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div className="border-b border-border bg-muted p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            aria-pressed={maskMode === "semantic"}
            className={maskMode === "semantic" ? activeButtonClass : idleButtonClass}
            onClick={() => switchMaskMode("semantic")}
          >
            Semantic mask
          </button>
          <button
            aria-pressed={maskMode === "support"}
            className={maskMode === "support" ? activeButtonClass : idleButtonClass}
            onClick={() => switchMaskMode("support")}
          >
            Slice support
          </button>
          <div className="flex min-h-11 flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Support mask: {latestSupportStatus}</span>
            <span>Classification: {latestClassificationLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              aria-pressed={tool === "brush"}
              className={tool === "brush" ? activeButtonClass : idleButtonClass}
              onClick={() => setTool("brush")}
              disabled={!canEdit}
            >
              Brush
            </button>
            <button
              aria-pressed={tool === "lasso_free"}
              className={tool === "lasso_free" ? activeButtonClass : idleButtonClass}
              onClick={() => setTool("lasso_free")}
              disabled={!canEdit}
            >
              Lasso
            </button>
            <button
              aria-pressed={tool === "lasso_poly"}
              className={tool === "lasso_poly" ? activeButtonClass : idleButtonClass}
              onClick={() => setTool("lasso_poly")}
              disabled={!canEdit}
            >
              Polygon
            </button>
            <div className="ml-3 flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
              <span>Tool Size: {brushRadius}px</span>
              <input
                type="range"
                min={1}
                max={120}
                value={brushRadius}
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                disabled={!canEdit || tool === "lasso_poly"}
                className="w-32"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
            {labels.map((label) => (
              <button
                key={label.id}
                aria-pressed={activeLabel === label.id}
                onClick={() => setActiveLabel(label.id)}
                disabled={!canEdit}
                className={`flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  activeLabel === label.id
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: `rgb(${label.rgb[0]}, ${label.rgb[1]}, ${label.rgb[2]})` }}
                />
                <span>{label.name}</span>
              </button>
            ))}
          </div>

          <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <span>Mask Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="w-32"
            />
            <span className="tabular-nums w-10">{Math.round(opacity * 100)}%</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            className={idleButtonClass}
            onClick={undo}
            disabled={!canEdit}
          >
            Undo
          </button>
          <button
            className={idleButtonClass}
            onClick={redo}
            disabled={!canEdit}
          >
            Redo
          </button>
          <button className={idleButtonClass} onClick={fitToContainer}>
            Fit
          </button>
          <button
            className={idleButtonClass}
            onClick={() => void saveMaskNow()}
            disabled={!canEdit || isSaving || !hasUnsavedChanges}
          >
            {maskMode === "support" ? "Save support mask" : "Save now"}
          </button>
          <button
            className={idleButtonClass}
            onClick={() => void exportMaskPng()}
          >
            Export PNG
          </button>
          <div className="ml-auto flex min-h-11 items-center gap-3">
            {editorStatus && <div className="text-xs text-muted-foreground">{editorStatus}</div>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Zoom</span>
              <input
                type="range"
                min={5}
                max={300}
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(clampNumber(Number(e.target.value) / 100, 0.05, 3))}
                className="w-32"
              />
              <span className="tabular-nums w-10">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <span className="text-xs text-muted-foreground">Slice classification</span>
            <select
              aria-label="Slice classification"
              value={selectedSliceClass}
              disabled={!canEdit || classificationSaving}
              onChange={(event) => setSelectedSliceClass(event.target.value as SliceClassValue | "")}
              className="min-h-11 rounded-md border border-border bg-input-background px-3 py-2 text-sm"
            >
              <option value="">No classification</option>
              {SLICE_CLASS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={idleButtonClass}
            onClick={() => void saveSliceClassification()}
            disabled={!canEdit || classificationSaving || !selectedSliceClass}
          >
            {classificationSaving ? "Saving classification..." : "Save classification"}
          </button>
          {classificationStatus && (
            <div className="flex min-h-11 items-center text-xs text-muted-foreground">
              {classificationStatus}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Export-ready: {reviewState ? (reviewState.exportReady ? "Yes" : "No") : "Loading"}
            </span>
            {reviewState && !reviewState.exportReady && (
              <span>{reviewState.warnings.length} missing approved item(s)</span>
            )}
            {reviewStatus && <span>{reviewStatus}</span>}
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            {reviewItems.map((item) => {
              const version = item.latestVersion;
              const busyPrefix = version ? `${item.type}:${version.id}:` : "";
              return (
                <div key={item.type} className="rounded-md border border-border bg-background p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Latest: {formatVersion(item.latestVersion)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Approved: {formatVersion(item.latestApprovedVersion)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.exportReady ? "Ground truth" : "Not ready"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-label={`Submit ${item.label}`}
                      className={idleButtonClass}
                      disabled={!item.actions.canSubmit || reviewBusyKey?.startsWith(busyPrefix)}
                      onClick={() => void runReviewAction(item, "submit")}
                    >
                      Submit
                    </button>
                    <button
                      aria-label={`Approve ${item.label}`}
                      className={idleButtonClass}
                      disabled={!item.actions.canApprove || reviewBusyKey?.startsWith(busyPrefix)}
                      onClick={() => void runReviewAction(item, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      aria-label={`Reject ${item.label}`}
                      className={idleButtonClass}
                      disabled={!item.actions.canReject || reviewBusyKey?.startsWith(busyPrefix)}
                      onClick={() => void runReviewAction(item, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-2 block text-xs text-muted-foreground">
            Review comment / reject reason
            <textarea
              aria-label="Review comment"
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              className="mt-1 min-h-16 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
      </div>

      <div ref={containerRef} className="relative h-[70vh] w-full overflow-auto overscroll-contain bg-background">
        <div className="relative inline-block">
          <canvas ref={baseCanvasRef} className="block" />
          <canvas
            ref={overlayCanvasRef}
            aria-label="Mask drawing surface"
            className="absolute left-0 top-0 touch-none select-none"
            draggable={false}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
            style={{ touchAction: "none" }}
            onDoubleClick={() => {
              if (tool === "lasso_poly") {
                commitLasso(lassoPointsRef.current.slice());
              }
            }}
          />
          <canvas ref={previewCanvasRef} className="absolute left-0 top-0 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
