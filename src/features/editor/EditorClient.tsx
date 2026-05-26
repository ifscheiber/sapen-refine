"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MaskBuffer } from "@/mask/maskBuffer";
import { DEFAULT_LABELS, Labels, supportMaskLabels, type LabelId } from "@/mask/labels";
import { applyBrush, applyPolygonFill } from "@/mask/tools";
import { applyPatch } from "@/mask/patch";
import { buildPalette, updateOverlayRegionWithPalette } from "@/mask/renderOverlay";
import { editorCanvasPreviewStyle } from "@/design/editorCanvas";
import {
  clampBBoxPreviewZoom,
  clampNumber,
  makeIdentityBBoxPreviewMetadata,
  clientPointToImagePoint,
  hitTestImageRect,
  imageRectsOverlap,
  imageRectFromPoints,
  moveImageRect,
  originalRectToPreviewRect,
  previewRectToOriginalRect,
  resizeImageRect,
  type BBoxPreviewMetadata,
  type BBoxHitTarget,
  type BBoxResizeHandle,
  type ImageRect,
} from "./canvasGeometry";
import {
  API_ARTIFACT_REVIEW,
  API_CLASSIFICATION_REVIEW,
  API_CONFIRM_SLICE_BBOX_SET,
  API_CORRECTION_CONTEXT,
  API_GENERATE_SLICE_CROP,
  API_IMAGE_VIEW,
  API_MASK_LATEST,
  API_MASK_UPLOAD,
  API_PROJECT_CROP_READINESS,
  API_REVIEW_STATE,
  API_SLICE_BBOX,
  API_SLICE_BBOXES,
  API_SLICE_CROPS,
  API_SLICE_CLASSIFICATION,
  API_SLICE_STATE,
  API_SUPPORT_MASK_LATEST,
  API_SUPPORT_MASK_UPLOAD,
} from "./editorApi";
import {
  type BBoxSaveState,
  dispatchBBoxStageStatus,
} from "./bboxStageEvents";
import {
  errorMessage,
  formatBBoxErrorMessage,
  formatReviewState,
  formatSliceClassLabel,
  isAbortError,
} from "./editorFormatters";
import { uploadEditorMask } from "./editorMaskUpload";
import { capturePointer, releasePointer, shouldIgnorePointerDown } from "./editorPointer";
import { activeButtonClass, idleButtonClass } from "./editorStyles";
import { getPaintLabelForTool, isBrushLikeTool } from "./editorTools";
import {
  type CorrectionContext,
  type CropWorkflowReadinessCandidate,
  type DerivedSliceCrop,
  type EditorProps,
  type ImageBBoxWorkflowState,
  type ImageReviewState,
  type MaskMode,
  type Point,
  type ReviewAction,
  type ReviewableState,
  type SliceBBoxOverlapIssue,
  type SliceBBoxSummary,
  type SliceBoundingBoxProposal,
  type SliceClassValue,
  type SliceState,
  type Stroke,
  type Tool,
} from "./editorTypes";
import { EditorAssistedCorrectionPanel } from "./components/EditorAssistedCorrectionPanel";
import { EditorBBoxPanel } from "./components/EditorBBoxPanel";
import { EditorCanvasStack } from "./components/EditorCanvasStack";
import { EditorReviewPanel } from "./components/EditorReviewPanel";
import { EditorSliceClassificationPanel } from "./components/EditorSliceClassificationPanel";
import { EditorToolbar } from "./components/EditorToolbar";
import { useCanvasZoomControls } from "./useCanvasZoomControls";

type BBoxDrawOptions = {
  selected?: boolean;
  issue?: boolean;
  protected?: boolean;
};

type BBoxDragState =
  | { kind: "add"; start: Point }
  | { kind: "move"; bboxVersionId: string; start: Point; initialRect: ImageRect }
  | {
      kind: "resize";
      bboxVersionId: string;
      handle: BBoxResizeHandle;
      initialRect: ImageRect;
    };

type PendingBBoxInvalidationAction =
  | { kind: "replace"; bboxVersionId: string; rect: ImageRect }
  | { kind: "delete"; bboxVersionId: string };

const BBOX_MIN_DRAW_SIZE_PX = 4;

type EditorImageView = {
  url: string;
  fallbackUrl?: string;
  filename?: string | null;
  contentType?: string | null;
  variant?: "original" | "bbox-preview";
  originalWidth?: number | null;
  originalHeight?: number | null;
  displayWidth?: number | null;
  displayHeight?: number | null;
  scaleX?: number | null;
  scaleY?: number | null;
};

function drawBBoxRect(ctx: CanvasRenderingContext2D, rect: ImageRect, options: BBoxDrawOptions = {}) {
  const selected = Boolean(options.selected);
  ctx.save();
  ctx.lineWidth = selected ? 3 : 2;
  ctx.setLineDash(options.issue ? [] : selected ? [10, 5] : [6, 4]);
  ctx.strokeStyle = options.issue
    ? editorCanvasPreviewStyle.bboxIssueStroke
    : selected
      ? editorCanvasPreviewStyle.bboxSelectedStroke
      : options.protected
        ? editorCanvasPreviewStyle.bboxProtectedStroke
        : editorCanvasPreviewStyle.bboxStroke;
  ctx.fillStyle = options.issue
    ? editorCanvasPreviewStyle.bboxIssueFill
    : selected
      ? editorCanvasPreviewStyle.bboxSelectedFill
      : options.protected
        ? editorCanvasPreviewStyle.bboxProtectedFill
        : editorCanvasPreviewStyle.bboxFill;
  ctx.shadowColor = editorCanvasPreviewStyle.bboxShadow;
  ctx.shadowBlur = 2;
  ctx.beginPath();
  ctx.rect(rect.x + 0.5, rect.y + 0.5, Math.max(1, rect.width), Math.max(1, rect.height));
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBBoxHandles(ctx: CanvasRenderingContext2D, rect: ImageRect, radius: number) {
  const left = rect.x;
  const right = rect.x + rect.width - 1;
  const top = rect.y;
  const bottom = rect.y + rect.height - 1;
  const centerX = Math.round((left + right) / 2);
  const centerY = Math.round((top + bottom) / 2);
  const points = [
    [left, top],
    [centerX, top],
    [right, top],
    [right, centerY],
    [right, bottom],
    [centerX, bottom],
    [left, bottom],
    [left, centerY],
  ];

  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = editorCanvasPreviewStyle.handleStroke;
  ctx.fillStyle = editorCanvasPreviewStyle.handleFill;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.rect(x - radius + 0.5, y - radius + 0.5, radius * 2, radius * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export default function EditorClient({
  projectId,
  imageId,
  canEdit,
  correctionTaskId,
  correctionMode,
  workflowMode,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const bboxCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [editorReady, setEditorReady] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [opacity, setOpacity] = useState<number>(0.45);
  const [brushRadius, setBrushRadius] = useState<number>(12);
  const [activeLabel, setActiveLabel] = useState<LabelId>(Labels.COPPER);
  const [tool, setTool] = useState<Tool>("brush");
  const [maskMode, setMaskMode] = useState<MaskMode>(correctionMode ?? "semantic");
  const [sliceState, setSliceState] = useState<SliceState | null>(null);
  const [selectedSliceClass, setSelectedSliceClass] = useState<SliceClassValue | "">("");
  const [classificationStatus, setClassificationStatus] = useState<string>("");
  const [classificationSaving, setClassificationSaving] = useState(false);
  const [reviewState, setReviewState] = useState<ImageReviewState | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewComment, setReviewComment] = useState<string>("");
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);
  const [correctionContext, setCorrectionContext] = useState<CorrectionContext | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<string>("");
  const [predictionOverlayEnabled, setPredictionOverlayEnabled] = useState(true);
  const [predictionLoaded, setPredictionLoaded] = useState(false);
  const [bboxProposals, setBBoxProposals] = useState<SliceBoundingBoxProposal[]>([]);
  const [bboxWorkflow, setBBoxWorkflow] = useState<ImageBBoxWorkflowState | null>(null);
  const [bboxIssues, setBBoxIssues] = useState<SliceBBoxOverlapIssue[]>([]);
  const [bboxSummary, setBBoxSummary] = useState<SliceBBoxSummary | null>(null);
  const [sliceCrops, setSliceCrops] = useState<DerivedSliceCrop[]>([]);
  const [cropReadinessCandidates, setCropReadinessCandidates] = useState<CropWorkflowReadinessCandidate[]>([]);
  const [bboxStatus, setBBoxStatus] = useState("");
  const [bboxSaveState, setBBoxSaveState] = useState<BBoxSaveState>("idle");
  const [bboxConfirming, setBBoxConfirming] = useState(false);
  const [selectedBBoxId, setSelectedBBoxId] = useState<string | null>(null);
  const [bboxReplaceArmed, setBBoxReplaceArmed] = useState(false);
  const [pendingBBoxInvalidation, setPendingBBoxInvalidation] =
    useState<PendingBBoxInvalidationAction | null>(null);
  const [bboxCanvasReadyRevision, setBBoxCanvasReadyRevision] = useState(0);
  const [bboxPreviewMetadata, setBBoxPreviewMetadata] = useState<BBoxPreviewMetadata | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const isCorrectionMode = Boolean(correctionTaskId);
  const isBBoxStageMode = workflowMode === "bboxStage";
  const editorCanEdit = canEdit && editorReady;
  const canEditBBox = editorCanEdit && !isCorrectionMode;
  const canMutateBBox = canEditBBox;
  const cropWorkflowSlicesHref = `/app/projects/${projectId}/images/${imageId}/crop/slices`;

  const supportLabelValue = sliceState?.supportLabels.sliceSupport ?? Labels.SLICE_SUPPORT;
  const supportBackgroundValue = sliceState?.supportLabels.background ?? Labels.BG;
  const labels = useMemo(
    () => (maskMode === "support" ? supportMaskLabels(supportLabelValue) : DEFAULT_LABELS),
    [maskMode, supportLabelValue],
  );
  const selectedBBox = useMemo(
    () => bboxProposals.find((box) => box.bboxVersionId === selectedBBoxId) ?? null,
    [bboxProposals, selectedBBoxId],
  );
  const bboxIssueBoxIds = useMemo(
    () => new Set(bboxIssues.flatMap((issue) => issue.bboxVersionIds)),
    [bboxIssues],
  );
  const hasBBoxIssues = bboxIssues.length > 0;

  const maskRef = useRef<MaskBuffer | null>(null);
  const predictionBytesRef = useRef<Uint8Array | null>(null);
  const bboxPreviewMetadataRef = useRef<BBoxPreviewMetadata | null>(null);
  const imageViewRef = useRef<EditorImageView | null>(null);

  // Pointer state
  const draggingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<Point[]>([]);
  const lassoActiveRef = useRef(false);
  const lassoDragIndexRef = useRef<number | null>(null);
  const bboxDragRef = useRef<BBoxDragState | null>(null);

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
  const saveGenerationRef = useRef(0);
  const saveContextRef = useRef(0);
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
    deleteSelectedBBox: () => void;
  } | null>(null);
  const zoomCanvasRefs = useMemo(
    () => [baseCanvasRef, predictionCanvasRef, overlayCanvasRef, bboxCanvasRef, previewCanvasRef] as const,
    [],
  );
  const { applyZoom, fitToContainer, setViewportZoom: setEditorZoom } = useCanvasZoomControls({
    containerRef,
    canvasRefs: zoomCanvasRefs,
    setZoom,
    minZoom: isBBoxStageMode ? 0.01 : 0.05,
    maxZoom: isBBoxStageMode ? 1 : 3,
  });

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

  const loadBBoxProposals = useCallback(async () => {
    const res = await fetch(API_SLICE_BBOXES(imageId), { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setBBoxStatus(formatBBoxErrorMessage(new Error(data?.error ?? `SLICE_BBOXES_FAILED_${res.status}`)));
      return [];
    }

    const boxes = (data.boxes ?? []) as SliceBoundingBoxProposal[];
    const workflow = (data.bboxWorkflow ?? null) as ImageBBoxWorkflowState | null;
    const issues = (data.bboxIssues ?? []) as SliceBBoxOverlapIssue[];
    const summary = (data.bboxSummary ?? null) as SliceBBoxSummary | null;
    setBBoxProposals(boxes);
    setBBoxWorkflow(workflow);
    setBBoxIssues(issues);
    setBBoxSummary(summary);
    setSelectedBBoxId((current) => {
      if (current && boxes.some((box) => box.bboxVersionId === current)) return current;
      return null;
    });
    setBBoxStatus("");
    dispatchBBoxStageStatus({ refresh: true });
    return boxes;
  }, [imageId]);

  const loadSliceCrops = useCallback(async () => {
    const res = await fetch(API_SLICE_CROPS(imageId), { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setBBoxStatus(formatBBoxErrorMessage(new Error(data?.error ?? `SLICE_CROPS_FAILED_${res.status}`)));
      return [];
    }

    const crops = (data.crops ?? []) as DerivedSliceCrop[];
    setSliceCrops(crops);
    return crops;
  }, [imageId]);

  const loadCropReadiness = useCallback(async () => {
    const res = await fetch(API_PROJECT_CROP_READINESS(projectId, { imageId }), {
      method: "GET",
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setBBoxStatus(formatBBoxErrorMessage(new Error(data?.error ?? `CROP_READINESS_FAILED_${res.status}`)));
      return [];
    }

    const candidates = (data.candidates ?? []) as CropWorkflowReadinessCandidate[];
    setCropReadinessCandidates(candidates);
    return candidates;
  }, [imageId, projectId]);

  const loadCorrectionContext = useCallback(async (taskId: string) => {
    setCorrectionStatus("Loading correction task");
    try {
      const res = await fetch(API_CORRECTION_CONTEXT(taskId), { method: "GET", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `CORRECTION_CONTEXT_FAILED_${res.status}`);
      }
      const context = data.context as CorrectionContext;
      setCorrectionContext(context);
      setMaskMode(context.mode);
      setActiveLabel(context.mode === "support" ? supportLabelValue : Labels.COPPER);
      setCorrectionStatus("");
      return context;
    } catch (error) {
      setCorrectionStatus(errorMessage(error, "Correction task failed"));
      return null;
    }
  }, [supportLabelValue]);

  useEffect(() => {
    void loadSliceState();
    void loadReviewState();
    void loadBBoxProposals();
    void loadSliceCrops();
    void loadCropReadiness();
  }, [loadBBoxProposals, loadCropReadiness, loadReviewState, loadSliceCrops, loadSliceState]);

  useEffect(() => {
    if (!correctionTaskId) return;
    void loadCorrectionContext(correctionTaskId);
  }, [correctionTaskId, loadCorrectionContext]);

  useEffect(() => {
    if (!isBBoxStageMode || isCorrectionMode) return;
    setTool("bbox");
  }, [isBBoxStageMode, isCorrectionMode]);

  useEffect(() => {
    if (!isBBoxStageMode) return;
    dispatchBBoxStageStatus({ selectedBBoxId });
  }, [isBBoxStageMode, selectedBBoxId]);

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

  const resetEditorLoadState = useCallback(() => {
    saveContextRef.current += 1;
    saveGenerationRef.current += 1;
    loadedOnceRef.current = false;
    dirtyMaskRef.current = false;
    dirtyRevisionRef.current = 0;
    saveQueuedRef.current = false;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    maskRef.current = null;
    undoRef.current = [];
    redoRef.current = [];
    currentStrokeRef.current = [];
    draggingRef.current = false;
    lastPtRef.current = null;
    lassoActiveRef.current = false;
    lassoPointsRef.current = [];
    lassoDragIndexRef.current = null;
    const preview = previewCanvasRef.current;
    const previewCtx = previewCtxRef.current;
    if (preview && previewCtx) previewCtx.clearRect(0, 0, preview.width, preview.height);
    bboxPreviewMetadataRef.current = null;
    imageViewRef.current = null;
    setBBoxPreviewMetadata(null);
    setEditorReady(false);
    setHasUnsavedChanges(false);
    setBBoxSaveState("idle");
  }, []);

  function switchMaskMode(nextMode: MaskMode) {
    if (isCorrectionMode) {
      setStatus("Correction task fixes the mask mode");
      return;
    }
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

  const renderPredictionOverlayFull = useCallback(() => {
    const canvas = predictionCanvasRef.current;
    const ctx = predictionCtxRef.current;
    const bytes = predictionBytesRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!predictionOverlayEnabled || !bytes || bytes.length !== canvas.width * canvas.height) return;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const dst = imageData.data;
    for (let i = 0; i < bytes.length; i++) {
      const value = bytes[i] ?? 0;
      if (value === 0) continue;
      const offset = i * 4;
      dst[offset] = 0;
      dst[offset + 1] = 180;
      dst[offset + 2] = 255;
      dst[offset + 3] = 90;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [predictionOverlayEnabled]);

  useEffect(() => {
    if (!correctionContext?.predictionMaskUrl) return;
    let alive = true;
    const controller = new AbortController();
    setPredictionLoaded(false);
    (async () => {
      try {
        const res = await fetch(correctionContext.predictionMaskUrl, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`PREDICTION_MASK_FAILED_${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!alive) return;
        predictionBytesRef.current = bytes;
        setPredictionLoaded(true);
        renderPredictionOverlayFull();
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        predictionBytesRef.current = null;
        setPredictionLoaded(false);
        setCorrectionStatus(errorMessage(error, "Prediction mask failed"));
        renderPredictionOverlayFull();
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [correctionContext?.predictionMaskUrl, renderPredictionOverlayFull]);

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

  const renderBBoxOverlay = useCallback(() => {
    const ctx = bboxCtxRef.current;
    const c = bboxCanvasRef.current;
    if (!ctx || !c) return;

    ctx.clearRect(0, 0, c.width, c.height);
    const handleRadius = Math.max(4, Math.round(5 / Math.max(zoom, 0.05)));
    const bounds = bboxImageBounds();
    const metadata =
      bboxPreviewMetadataRef.current ?? (bounds ? makeIdentityBBoxPreviewMetadata(bounds.width, bounds.height) : null);
    for (const box of bboxProposals) {
      const selected = box.bboxVersionId === selectedBBoxId;
      const rect = metadata ? originalRectToPreviewRect(bboxRect(box), metadata) : bboxRect(box);
      drawBBoxRect(
        ctx,
        rect,
        {
          selected,
          issue: bboxIssueBoxIds.has(box.bboxVersionId),
          protected: !(box.protection?.canReplaceGeometry ?? true),
        },
      );
      if (selected) drawBBoxHandles(ctx, rect, handleRadius);
    }
  }, [bboxIssueBoxIds, bboxProposals, selectedBBoxId, zoom]);

  function drawBBoxPreview(rect: ImageRect, options: BBoxDrawOptions = {}) {
    const ctx = previewCtxRef.current;
    const c = previewCanvasRef.current;
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawBBoxRect(ctx, rect, { selected: true, ...options });
  }

  const resetLasso = useCallback(() => {
    lassoActiveRef.current = false;
    lassoPointsRef.current = [];
    lassoDragIndexRef.current = null;
    clearPreview();
  }, [clearPreview]);

  function commitLasso(points: Point[]) {
    if (!editorCanEdit) return;
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
    if (!loadedOnceRef.current || !editorReady) return;
    if (!editorCanEdit) return;
    if (isCorrectionMode) return;

    markMaskDirty();
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    // debounce: 1.2s nach letzter Änderung
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveMaskNow({ manual: false });
    }, 1200);
  }

  async function saveMaskNow(options: { manual?: boolean } = {}) {
    if (options.manual && saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (options.manual) {
      saveGenerationRef.current += 1;
    }

    const mask = maskRef.current;
    if (!mask) return;
    if (!editorCanEdit) {
      if (options.manual) setStatus(editorReady ? "Editing not allowed" : "Editor still loading");
      return;
    }
    if (!dirtyMaskRef.current) return;

    if (savingRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    const saveRevision = dirtyRevisionRef.current;
    const saveContext = saveContextRef.current;
    const saveGeneration = saveGenerationRef.current + 1;
    saveGenerationRef.current = saveGeneration;
    try {
      setStatus("Saving…");

      const endpoint = correctionContext?.correctionSaveUrl ??
        (maskMode === "support" ? API_SUPPORT_MASK_UPLOAD(imageId) : API_MASK_UPLOAD(imageId));

      if (isCorrectionMode && !correctionContext) {
        throw new Error("CORRECTION_CONTEXT_NOT_LOADED");
      }

      await uploadEditorMask(endpoint, {
        data: mask.data,
        width: mask.width,
        height: mask.height,
      });

      if (saveContextRef.current !== saveContext || saveGenerationRef.current !== saveGeneration) return;

      if (dirtyRevisionRef.current === saveRevision) {
        dirtyMaskRef.current = false;
        setHasUnsavedChanges(false);
        setStatus(isCorrectionMode ? "Correction draft saved" : "Saved");
        setTimeout(() => setStatus(""), 800);
        if (maskMode === "support") void loadSliceState();
        void loadReviewState();
        if (correctionTaskId) void loadCorrectionContext(correctionTaskId);
      } else {
        saveQueuedRef.current = true;
      }
    } catch (e: unknown) {
      console.error(e);
      if (saveContextRef.current === saveContext && saveGenerationRef.current === saveGeneration) {
        setStatus(errorMessage(e));
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      if (saveContextRef.current === saveContext && saveQueuedRef.current) {
        saveQueuedRef.current = false;
        await saveMaskNow({ manual: false });
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
      resetEditorLoadState();
      setImgUrl(null);
      imageViewRef.current = null;
      setStatus("Loading image…");
      const res = await fetch(
        API_IMAGE_VIEW(imageId, isBBoxStageMode ? { variant: "bbox-preview" } : undefined),
        { method: "GET" },
      );
      if (!res.ok) {
        setStatus("Failed to load image URL");
        return;
      }
      const json = (await res.json()) as EditorImageView;
      if (!alive) return;
      imageViewRef.current = json;
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
    if (isBBoxStageMode) {
      pendingMaskRef.current = null;
      maskFetchAbortRef.current = null;
      return () => {
        alive = false;
      };
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
  }, [fetchLatestMaskBytes, imageId, isBBoxStageMode, maskMode, resetEditorLoadState]);

  useEffect(() => {
    if (!imgUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    // Use a local cancel flag to avoid HMR/double-render races without global token bumps.
    let cancelled = false;

    img.onload = async () => {
      if (cancelled) return;
      setEditorReady(false);
      setStatus("Preparing editor…");
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const view = imageViewRef.current;
      const originalWidth =
        isBBoxStageMode && Number.isInteger(view?.originalWidth) && view!.originalWidth! > 0
          ? view!.originalWidth!
          : w;
      const originalHeight =
        isBBoxStageMode && Number.isInteger(view?.originalHeight) && view!.originalHeight! > 0
          ? view!.originalHeight!
          : h;
      const bboxMetadata: BBoxPreviewMetadata = isBBoxStageMode
        ? {
            variant: view?.variant === "bbox-preview" ? "bbox-preview" : "original",
            originalWidth,
            originalHeight,
            previewWidth: w,
            previewHeight: h,
            scaleX: originalWidth / w,
            scaleY: originalHeight / h,
          }
        : makeIdentityBBoxPreviewMetadata(w, h);
      bboxPreviewMetadataRef.current = bboxMetadata;
      setBBoxPreviewMetadata(bboxMetadata);

      const base = baseCanvasRef.current!;
      const prediction = predictionCanvasRef.current!;
      const over = overlayCanvasRef.current!;
      const bbox = bboxCanvasRef.current!;
      const preview = previewCanvasRef.current!;
      base.width = w;
      base.height = h;
      prediction.width = w;
      prediction.height = h;
      over.width = w;
      over.height = h;
      bbox.width = w;
      bbox.height = h;
      preview.width = w;
      preview.height = h;
      predictionCtxRef.current = prediction.getContext("2d");
      overlayCtxRef.current = over.getContext("2d");
      bboxCtxRef.current = bbox.getContext("2d");
      previewCtxRef.current = preview.getContext("2d");
      setBBoxCanvasReadyRevision((revision) => revision + 1);

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
      renderPredictionOverlayFull();
      clearPreview();

      // fit & zoom
      fitToContainer();

      if (!isBBoxStageMode) {
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
          if (cancelled || isAbortError(e)) return;
          console.warn("Failed to load latest mask:", e);
          rerenderOverlayFull();
        }
      }

      loadedOnceRef.current = true;
      if (maskRef.current?.data.byteLength !== w * h) {
        setEditorReady(false);
        setStatus("Mask buffer dimensions do not match image");
        return;
      }
      setEditorReady(true);
      setStatus("");
    };

    img.onerror = () => {
      if (cancelled) return;
      const view = imageViewRef.current;
      if (isBBoxStageMode && view?.fallbackUrl && view.fallbackUrl !== imgUrl) {
        imageViewRef.current = {
          ...view,
          url: view.fallbackUrl,
          variant: "original",
          displayWidth: view.originalWidth,
          displayHeight: view.originalHeight,
          scaleX: 1,
          scaleY: 1,
        };
        setImgUrl(view.fallbackUrl);
        setStatus("BBox preview unavailable. Loading original image…");
        return;
      }
      setEditorReady(false);
      setStatus("Failed to load image asset");
    };
    img.src = imgUrl;
    return () => {
      cancelled = true;
    };
  }, [
    clearPreview,
    fetchLatestMaskBytes,
    fitToContainer,
    imageId,
    imgUrl,
    isBBoxStageMode,
    maskMode,
    renderPredictionOverlayFull,
    rerenderOverlayFull,
  ]);

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
      await Promise.all([loadReviewState(), loadSliceState()]);
      setReviewStatus(`${reviewable.label} ${formatReviewState(data.toState)}`);
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

  function bboxRect(box: SliceBoundingBoxProposal): ImageRect {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  function currentBBoxPreviewMetadata() {
    const metadata = bboxPreviewMetadataRef.current;
    if (metadata) return metadata;
    const bounds = bboxImageBounds();
    return bounds ? makeIdentityBBoxPreviewMetadata(bounds.width, bounds.height) : null;
  }

  function bboxPreviewRect(box: SliceBoundingBoxProposal): ImageRect {
    const metadata = currentBBoxPreviewMetadata();
    return metadata ? originalRectToPreviewRect(bboxRect(box), metadata) : bboxRect(box);
  }

  function bboxOriginalRectFromPreview(rect: ImageRect) {
    const metadata = currentBBoxPreviewMetadata();
    return metadata ? previewRectToOriginalRect(rect, metadata) : rect;
  }

  function bboxImageBounds() {
    const base = baseCanvasRef.current;
    return base ? { width: base.width, height: base.height } : null;
  }

  function bboxOverlapsExistingOriginal(rect: ImageRect, excludeBBoxVersionId?: string | null) {
    return bboxProposals.some((box) => {
      if (box.bboxVersionId === excludeBBoxVersionId) return false;
      return imageRectsOverlap(rect, bboxRect(box));
    });
  }

  function bboxWorkflowMessage(error: unknown, fallback: string) {
    return formatBBoxErrorMessage(error, fallback);
  }

  function bboxLockReasonLabel(reason: string) {
    if (reason === "SEMANTIC_MASK_EXISTS") return "semantic mask exists";
    if (reason === "SUPPORT_MASK_EXISTS") return "support mask exists";
    if (reason === "INSTANCE_MASK_EXISTS") return "instance/support mask exists";
    if (reason === "CLASSIFICATION_EXISTS") return "classification exists";
    return reason.toLowerCase().replaceAll("_", " ");
  }

  function bboxLockMessage(box: SliceBoundingBoxProposal | null) {
    const reasons = box?.protection?.reasons ?? [];
    if (reasons.length === 0) return "Locked: this BBox already has downstream annotation.";
    return `Locked: ${reasons.map(bboxLockReasonLabel).join(", ")}.`;
  }

  function hitTestBBoxAtPoint(point: Point) {
    const handleRadius = Math.max(4, Math.round(8 / Math.max(zoom, 0.05)));
    if (selectedBBox) {
      const selectedHit = hitTestImageRect(point, bboxPreviewRect(selectedBBox), handleRadius);
      if (selectedHit) return { box: selectedBBox, hit: selectedHit };
    }

    for (let index = bboxProposals.length - 1; index >= 0; index -= 1) {
      const box = bboxProposals[index];
      if (box.bboxVersionId === selectedBBoxId) continue;
      const hit = hitTestImageRect(point, bboxPreviewRect(box), handleRadius);
      if (hit) return { box, hit };
    }
    return null;
  }

  function rectForBBoxDrag(drag: BBoxDragState, point: Point) {
    const bounds = bboxImageBounds();
    if (drag.kind === "add") return imageRectFromPoints(drag.start, point);
    if (!bounds) return drag.initialRect;
    if (drag.kind === "move") {
      return moveImageRect(
        drag.initialRect,
        { x: point.x - drag.start.x, y: point.y - drag.start.y },
        bounds,
      );
    }
    return resizeImageRect(drag.initialRect, drag.handle, point, bounds);
  }

  async function saveBBoxProposal(
    rect: ImageRect,
    options?: { replaceBBoxId?: string | null; allowDependencyInvalidation?: boolean },
  ) {
    if (!canMutateBBox) return;

    const originalRect = bboxOriginalRectFromPreview(rect);
    const replaceBBoxId = options?.replaceBBoxId ?? (bboxReplaceArmed ? selectedBBoxId : null);
    const replacing = Boolean(replaceBBoxId);
    const replacingBox = replaceBBoxId
      ? bboxProposals.find((box) => box.bboxVersionId === replaceBBoxId) ?? null
      : null;
    if (replacingBox && !(replacingBox.protection?.canReplaceGeometry ?? true) && !options?.allowDependencyInvalidation) {
      setPendingBBoxInvalidation({ kind: "replace", bboxVersionId: replaceBBoxId!, rect });
      const message = bboxLockMessage(replacingBox);
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ lastAction: message });
      return;
    }
    if (bboxOverlapsExistingOriginal(originalRect, replaceBBoxId)) {
      const message = formatBBoxErrorMessage(new Error("BBOX_OVERLAP"));
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ saveState: "failed", lastAction: message });
      return;
    }

    const url = replacing && replaceBBoxId ? API_SLICE_BBOX(replaceBBoxId) : API_SLICE_BBOXES(imageId);
    const method = replacing ? "PATCH" : "POST";

    const savingMessage = replacing ? "Saving BBox edit" : "Saving BBox proposal";
    setBBoxSaveState("saving");
    setBBoxStatus(savingMessage);
    dispatchBBoxStageStatus({ saveState: "saving", lastAction: savingMessage });
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...originalRect,
          allowDependencyInvalidation: options?.allowDependencyInvalidation === true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `BBOX_SAVE_FAILED_${res.status}`);
      }

      await loadBBoxProposals();
      await loadSliceCrops();
      await loadCropReadiness();
      setSelectedBBoxId(data.box.bboxVersionId);
      setBBoxReplaceArmed(false);
      const savedMessage = replacing ? "BBox proposal replaced" : "BBox proposal saved";
      setBBoxSaveState("saved");
      setBBoxStatus(savedMessage);
      dispatchBBoxStageStatus({ saveState: "saved", lastAction: savedMessage, refresh: true });
    } catch (error) {
      const message = bboxWorkflowMessage(error, "BBox proposal save failed");
      setBBoxSaveState("failed");
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ saveState: "failed", lastAction: message, refresh: true });
    }
  }

  async function deleteSelectedBBoxProposal(
    bboxVersionId = selectedBBoxId,
    options?: { allowDependencyInvalidation?: boolean },
  ) {
    if (!canMutateBBox || !bboxVersionId) return;
    const box = bboxProposals.find((candidate) => candidate.bboxVersionId === bboxVersionId) ?? null;
    if (box && !(box.protection?.canDelete ?? true) && !options?.allowDependencyInvalidation) {
      setPendingBBoxInvalidation({ kind: "delete", bboxVersionId });
      const message = bboxLockMessage(box);
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ lastAction: message });
      return;
    }

    setBBoxSaveState("saving");
    setBBoxStatus("Deleting BBox proposal");
    dispatchBBoxStageStatus({ saveState: "saving", lastAction: "Deleting BBox proposal" });
    try {
      const res = await fetch(API_SLICE_BBOX(bboxVersionId), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowDependencyInvalidation: options?.allowDependencyInvalidation === true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `BBOX_DELETE_FAILED_${res.status}`);
      }

      setSelectedBBoxId(null);
      setBBoxReplaceArmed(false);
      await loadBBoxProposals();
      await loadSliceCrops();
      await loadCropReadiness();
      setBBoxSaveState("saved");
      setBBoxStatus("BBox proposal deleted");
      dispatchBBoxStageStatus({ saveState: "saved", lastAction: "BBox proposal deleted", refresh: true });
    } catch (error) {
      const message = bboxWorkflowMessage(error, "BBox proposal delete failed");
      setBBoxSaveState("failed");
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ saveState: "failed", lastAction: message, refresh: true });
    }
  }

  async function confirmPendingBBoxInvalidation() {
    const pending = pendingBBoxInvalidation;
    if (!pending) return;
    setPendingBBoxInvalidation(null);
    if (pending.kind === "replace") {
      await saveBBoxProposal(pending.rect, {
        replaceBBoxId: pending.bboxVersionId,
        allowDependencyInvalidation: true,
      });
      return;
    }
    await deleteSelectedBBoxProposal(pending.bboxVersionId, { allowDependencyInvalidation: true });
  }

  async function generateSelectedSliceCrop() {
    if (!canEditBBox || !selectedBBoxId) return;

    setBBoxStatus("Generating derived crop");
    setBBoxSaveState("saving");
    dispatchBBoxStageStatus({ saveState: "saving", lastAction: "Generating derived crop" });
    try {
      const res = await fetch(API_GENERATE_SLICE_CROP(selectedBBoxId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `SLICE_CROP_FAILED_${res.status}`);
      }

      await loadSliceCrops();
      await loadCropReadiness();
      setBBoxSaveState("saved");
      setBBoxStatus("Derived crop generated");
      dispatchBBoxStageStatus({ saveState: "saved", lastAction: "Derived crop generated", refresh: true });
    } catch (error) {
      const message = formatBBoxErrorMessage(error, "Derived crop generation failed");
      setBBoxSaveState("failed");
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ saveState: "failed", lastAction: message, refresh: true });
    }
  }

  async function confirmBBoxSet() {
    if (!bboxWorkflow?.canConfirm || bboxProposals.length === 0) return;
    if (hasBBoxIssues) {
      setBBoxStatus("BBox overlap detected. Move or resize boxes before continuing.");
      return;
    }

    setBBoxConfirming(true);
    setBBoxSaveState("saving");
    setBBoxStatus("Confirming BBox set");
    dispatchBBoxStageStatus({ saveState: "saving", lastAction: "Preparing slices" });
    try {
      const res = await fetch(API_CONFIRM_SLICE_BBOX_SET(imageId), { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `BBOX_CONFIRM_FAILED_${res.status}`);
      }

      const boxes = (data.boxes ?? []) as SliceBoundingBoxProposal[];
      const workflow = (data.bboxWorkflow ?? null) as ImageBBoxWorkflowState | null;
      const issues = (data.bboxIssues ?? []) as SliceBBoxOverlapIssue[];
      const summary = (data.bboxSummary ?? null) as SliceBBoxSummary | null;
      setBBoxProposals(boxes);
      setBBoxWorkflow(workflow);
      setBBoxIssues(issues);
      setBBoxSummary(summary);
      setSelectedBBoxId((current) => {
        if (current && boxes.some((box) => box.bboxVersionId === current)) return current;
        return boxes[0]?.bboxVersionId ?? null;
      });
      setBBoxSaveState("saved");
      setBBoxStatus("BBox set confirmed");
      dispatchBBoxStageStatus({ saveState: "saved", lastAction: "BBox set confirmed", refresh: true });
    } catch (error) {
      const message = bboxWorkflowMessage(error, "BBox set confirmation failed");
      setBBoxSaveState("failed");
      setBBoxStatus(message);
      dispatchBBoxStageStatus({ saveState: "failed", lastAction: message, refresh: true });
    } finally {
      setBBoxConfirming(false);
    }
  }

  // Opacity affects palette => full redraw (rare)
  useEffect(() => {
    paletteRef.current = null;
    rerenderOverlayFull();
  }, [rerenderOverlayFull]);

  useEffect(() => {
    renderPredictionOverlayFull();
  }, [renderPredictionOverlayFull]);

  useEffect(() => {
    renderBBoxOverlay();
  }, [bboxCanvasReadyRevision, renderBBoxOverlay]);

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
    bboxDragRef.current = null;
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
    if (!mask || !editorCanEdit) return;

    const patch = applyBrush(
      mask,
      x,
      y,
      brushRadius,
      getPaintLabelForTool({
        tool,
        maskMode,
        activeLabel,
        supportBackgroundLabel: supportBackgroundValue,
      }),
    );
    currentStrokeRef.current.push(patch);
    queueOverlayUpdate(patch.x, patch.y, patch.w, patch.h);

    // Mark immediately so iPad/browser users see unsaved state while drawing.
    markMaskDirty();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!editorCanEdit) return;
    if (!maskRef.current) return;
    if (shouldIgnorePointerDown(e)) return;
    e.preventDefault();

    const target = e.currentTarget;
    const p = canvasToImageCoords(e);

    if (tool === "bbox") {
      if (!isBBoxStageMode) {
        if (!canMutateBBox) return;
        bboxDragRef.current = { kind: "add", start: p };
        capturePointer(target, e.pointerId);
        drawBBoxPreview(imageRectFromPoints(p, p));
        return;
      }

      const hit = hitTestBBoxAtPoint(p);
      if (hit) {
        setSelectedBBoxId(hit.box.bboxVersionId);
        setBBoxReplaceArmed(false);

        if (!canMutateBBox) return;

        const rect = bboxPreviewRect(hit.box);
        const hitTarget = hit.hit as BBoxHitTarget;
        if (hitTarget && hitTarget !== "body") {
          bboxDragRef.current = {
            kind: "resize",
            bboxVersionId: hit.box.bboxVersionId,
            handle: hitTarget,
            initialRect: rect,
          };
          capturePointer(target, e.pointerId);
          drawBBoxPreview(rect);
          return;
        }

        bboxDragRef.current = {
          kind: "move",
          bboxVersionId: hit.box.bboxVersionId,
          start: p,
          initialRect: rect,
        };
        capturePointer(target, e.pointerId);
        drawBBoxPreview(rect);
        return;
      }

      if (!canMutateBBox) {
        setSelectedBBoxId(null);
        return;
      }
      bboxDragRef.current = { kind: "add", start: p };
      capturePointer(target, e.pointerId);
      drawBBoxPreview(imageRectFromPoints(p, p));
      return;
    }

    if (isBrushLikeTool(tool)) {
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
    if (!editorCanEdit) return;
    if (!maskRef.current) return;
    e.preventDefault();

    const p = canvasToImageCoords(e);
    if (tool === "bbox") {
      const drag = bboxDragRef.current;
      if (!drag) return;
      const rect = rectForBBoxDrag(drag, p);
      const excludeBBoxVersionId =
        drag.kind === "add" ? (bboxReplaceArmed ? selectedBBoxId : null) : drag.bboxVersionId;
      drawBBoxPreview(rect, {
        issue: bboxOverlapsExistingOriginal(bboxOriginalRectFromPreview(rect), excludeBBoxVersionId),
      });
      return;
    }

    if (isBrushLikeTool(tool)) {
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
      scheduleAutosave();
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const target = e.currentTarget;

    if (tool === "bbox") {
      const drag = bboxDragRef.current;
      bboxDragRef.current = null;
      releasePointer(target, e.pointerId);
      clearPreview();
      if (drag) {
        const end = canvasToImageCoords(e);
        const rect = rectForBBoxDrag(drag, end);
        const replaceBBoxId = drag.kind === "add" ? (bboxReplaceArmed ? selectedBBoxId : null) : drag.bboxVersionId;
        const originalRect = bboxOriginalRectFromPreview(rect);
        if (
          drag.kind === "add" &&
          (Math.abs(end.x - drag.start.x) < BBOX_MIN_DRAW_SIZE_PX ||
            Math.abs(end.y - drag.start.y) < BBOX_MIN_DRAW_SIZE_PX ||
            originalRect.width < BBOX_MIN_DRAW_SIZE_PX ||
            originalRect.height < BBOX_MIN_DRAW_SIZE_PX)
        ) {
          setSelectedBBoxId(null);
          setBBoxReplaceArmed(false);
          return;
        }
        if (bboxOverlapsExistingOriginal(originalRect, replaceBBoxId)) {
          setBBoxStatus("BBox overlap detected. Move or resize boxes before continuing.");
          return;
        }
        if (drag.kind !== "add" && rect.x === drag.initialRect.x && rect.y === drag.initialRect.y &&
          rect.width === drag.initialRect.width && rect.height === drag.initialRect.height) {
          return;
        }
        void saveBBoxProposal(rect, { replaceBBoxId });
      }
      return;
    }

    if (isBrushLikeTool(tool)) {
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

    if (tool === "bbox") {
      bboxDragRef.current = null;
      clearPreview();
      releasePointer(target, e.pointerId);
      return;
    }

    if (isBrushLikeTool(tool)) {
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
    if (tool === "bbox" && bboxDragRef.current === null) {
      clearPreview();
    }
    if (tool === "lasso_poly" && lassoDragIndexRef.current === null) {
      drawLassoPreview(lassoPointsRef.current, null, true);
    }
    if (isBrushLikeTool(tool) && draggingRef.current && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
    }
  }

  function undo() {
    const mask = maskRef.current;
    if (!mask || !editorCanEdit) return;

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
    if (!mask || !editorCanEdit) return;

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

  function usePredictionAsStartingMask() {
    if (!editorCanEdit) {
      setCorrectionStatus(editorReady ? "Editing not allowed" : "Editor still loading");
      return;
    }
    const predictionBytes = predictionBytesRef.current;
    const mask = maskRef.current;
    if (!predictionBytes || !mask) {
      setCorrectionStatus("Prediction mask not loaded");
      return;
    }
    if (predictionBytes.length !== mask.width * mask.height) {
      setCorrectionStatus("Prediction dimensions do not match image");
      return;
    }
    if ((hasUnsavedChanges || dirtyMaskRef.current) && !window.confirm("Replace current editable mask with the prediction proposal?")) {
      return;
    }

    mask.data.set(predictionBytes);
    undoRef.current = [];
    redoRef.current = [];
    dirtyMaskRef.current = true;
    dirtyRevisionRef.current += 1;
    setHasUnsavedChanges(true);
    rerenderOverlayFull();
    setCorrectionStatus("Prediction copied into editable mask");
  }

  keyboardActionsRef.current = {
    canEdit: editorCanEdit,
    tool,
    undo,
    redo,
    resetLasso,
    commitLasso,
    deleteSelectedBBox: () => void deleteSelectedBBoxProposal(),
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

      if (actions.tool === "bbox" && (e.key === "Delete" || e.key === "Backspace")) {
        const target = e.target;
        const tagName = target instanceof HTMLElement ? target.tagName.toLowerCase() : "";
        if (tagName === "input" || tagName === "textarea" || target instanceof HTMLSelectElement) return;
        if (target instanceof HTMLElement && target.isContentEditable) return;
        e.preventDefault();
        actions.deleteSelectedBBox();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- UI ----------
  const editorStatus = isSaving ? "Saving…" : status || (hasUnsavedChanges ? "Unsaved changes" : "");
  const latestClassificationLabel = formatSliceClassLabel(sliceState?.latestClassification?.class);
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
  const pendingInvalidationBox = pendingBBoxInvalidation
    ? bboxProposals.find((box) => box.bboxVersionId === pendingBBoxInvalidation.bboxVersionId) ?? null
    : null;
  const pendingInvalidationReasons = pendingInvalidationBox?.protection?.reasons ?? [];

  return (
    <>
      <Dialog
        open={Boolean(pendingBBoxInvalidation)}
        onOpenChange={(open) => {
          if (!open) setPendingBBoxInvalidation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invalidate downstream annotations?</DialogTitle>
            <DialogDescription>
              This BBox already has semantic, support, or classification data for its generated slice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Changing it will supersede the existing downstream annotations and regenerate the slice from the new
              BBox geometry. This cannot be undone automatically.
            </p>
            {pendingInvalidationReasons.length > 0 ? (
              <div>
                <div className="font-medium text-foreground">Will supersede:</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {pendingInvalidationReasons.map((reason) => (
                    <li key={reason}>{bboxLockReasonLabel(reason)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button type="button" className={idleButtonClass} onClick={() => setPendingBBoxInvalidation(null)}>
              Cancel
            </button>
            <button type="button" className={activeButtonClass} onClick={() => void confirmPendingBBoxInvalidation()}>
              Invalidate annotations and unlock BBox
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div
        className={
          isBBoxStageMode
            ? "overflow-hidden border border-[var(--border-subtle)] bg-[var(--workspace-background)] text-[var(--text-primary)]"
            : "overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
        }
      >
      <div
        className={
          isBBoxStageMode
            ? "border-b border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-4 py-3"
            : "border-b border-border bg-muted p-3"
        }
      >
        {isCorrectionMode && (
          <EditorAssistedCorrectionPanel
            correctionContext={correctionContext}
            correctionStatus={correctionStatus}
            predictionOverlayEnabled={predictionOverlayEnabled}
            onPredictionOverlayEnabledChange={setPredictionOverlayEnabled}
            canEdit={editorCanEdit}
            predictionLoaded={predictionLoaded}
            onUsePredictionAsStartingMask={usePredictionAsStartingMask}
          />
        )}

        {!isBBoxStageMode && (
          <EditorToolbar
            maskMode={maskMode}
            isCorrectionMode={isCorrectionMode}
            latestSupportStatus={latestSupportStatus}
            latestClassificationLabel={latestClassificationLabel}
            onSwitchMaskMode={switchMaskMode}
            tool={tool}
            onToolChange={setTool}
            brushRadius={brushRadius}
            onBrushRadiusChange={setBrushRadius}
            labels={labels}
            activeLabel={activeLabel}
            onActiveLabelChange={setActiveLabel}
            canEdit={editorCanEdit}
            opacity={opacity}
            onOpacityChange={setOpacity}
            onUndo={undo}
            onRedo={redo}
            onFit={fitToContainer}
            onSave={() => void saveMaskNow({ manual: true })}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            editorStatus={editorStatus}
            zoom={zoom}
            onZoomChange={setEditorZoom}
          />
        )}

        <EditorBBoxPanel
          projectId={projectId}
          imageId={imageId}
          boxes={bboxProposals}
          crops={sliceCrops}
          cropReadinessCandidates={cropReadinessCandidates}
          selectedBBoxId={selectedBBoxId}
          bboxIssues={bboxIssues}
          bboxSummary={bboxSummary}
          replaceArmed={bboxReplaceArmed}
          bboxWorkflow={bboxWorkflow}
          stageMode={isBBoxStageMode}
          confirmBusy={bboxConfirming}
          canEdit={canMutateBBox}
          canUnlockConfirmedSet={canEditBBox}
          status={bboxStatus}
          saveState={bboxSaveState}
          zoom={zoom}
          bboxPreviewMetadata={bboxPreviewMetadata}
          onZoomChange={(nextZoom) => setEditorZoom(isBBoxStageMode ? clampBBoxPreviewZoom(nextZoom) : nextZoom)}
          onFit={fitToContainer}
          onSelect={(bboxVersionId) => {
            setSelectedBBoxId(bboxVersionId);
            setBBoxReplaceArmed(false);
          }}
          onArmReplace={() => {
            setTool("bbox");
            setBBoxReplaceArmed(true);
            setBBoxStatus("Draw a replacement BBox proposal on the image.");
          }}
          onDelete={() => void deleteSelectedBBoxProposal()}
          onGenerateCrop={() => void generateSelectedSliceCrop()}
          onConfirmBBoxSet={() => void confirmBBoxSet()}
          continueHref={cropWorkflowSlicesHref}
        />

        {!isBBoxStageMode && (
          <>
            <EditorSliceClassificationPanel
              selectedSliceClass={selectedSliceClass}
              onSelectedSliceClassChange={setSelectedSliceClass}
              canEdit={canEdit}
              classificationSaving={classificationSaving}
              onSaveClassification={() => void saveSliceClassification()}
              classificationStatus={classificationStatus}
            />

            <EditorReviewPanel
              reviewState={reviewState}
              reviewItems={reviewItems}
              reviewStatus={reviewStatus}
              reviewComment={reviewComment}
              onReviewCommentChange={setReviewComment}
              reviewBusyKey={reviewBusyKey}
              onReviewAction={(reviewable, action) => void runReviewAction(reviewable, action)}
            />
          </>
        )}
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
        onCommitPolygon={() => commitLasso(lassoPointsRef.current.slice())}
      />
      </div>
    </>
  );
}
