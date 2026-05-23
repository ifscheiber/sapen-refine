"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  BrushIcon,
  EraserIcon,
  LassoIcon,
  Maximize2Icon,
  PentagonIcon,
  Redo2Icon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
} from "lucide-react";

import { Labels, supportMaskLabels, type LabelDef, type LabelId } from "@/mask/labels";
import { MaskBuffer } from "@/mask/maskBuffer";
import { applyPatch } from "@/mask/patch";
import type { Patch } from "@/mask/patch";
import { buildPalette, updateOverlayRegionWithPalette } from "@/mask/renderOverlay";
import { editorCanvasPreviewStyle } from "@/design/editorCanvas";
import {
  clampNumber,
  clientPointToImagePoint,
  getFitZoom,
  getZoomedCanvasDisplaySize,
} from "./canvasGeometry";
import { EditorCanvasStack } from "./components/EditorCanvasStack";
import { applyCropBrush, applyCropPolygonFill } from "./cropMaskOperations";
import {
  API_ARTIFACT_REVIEW,
  API_CLASSIFICATION_REVIEW,
  API_CROP_SEMANTIC_MASK,
  API_CROP_SEMANTIC_MASK_UPLOAD,
  API_SLICE_INSTANCE_CLASSIFICATION,
} from "./editorApi";
import {
  errorMessage,
  formatReviewState,
  formatSliceClassificationReason,
  formatSliceClassificationSource,
  formatSliceClassLabel,
} from "./editorFormatters";
import { createEditorLoadGuard } from "./editorLoadGuard";
import { uploadEditorMask } from "./editorMaskUpload";
import { capturePointer, releasePointer, shouldIgnorePointerDown } from "./editorPointer";
import { activeButtonClass, idleButtonClass } from "./editorStyles";
import { getPaintLabelForTool, isBrushLikeTool } from "./editorTools";
import {
  SLICE_CLASS_OPTIONS,
  type CropReviewActions,
  type CropSemanticMaskState,
  type CropSemanticMode,
  type Point,
  type ReviewAction,
  type SliceClassValue,
  type Tool,
} from "./editorTypes";

type CropSemanticEditorClientProps = {
  cropId: string;
  canEdit: boolean;
};

type Stroke = Patch[];
type CropReviewTarget = {
  key: string;
  label: string;
  versionId: string;
  version: number;
  reviewState: string;
  kind: "artifact" | "classification";
  actions: CropReviewActions | null;
};

const MODE_LABELS: Record<CropSemanticMode, string> = {
  SAP_HEARTWOOD: "Sap/Heartwood",
  COPPER: "Copper",
};

const LABEL_COLORS: Record<string, Pick<LabelDef, "rgb" | "alpha">> = {
  background: { rgb: [0, 0, 0], alpha: 0 },
  sapwood: { rgb: [255, 170, 0], alpha: 0.45 },
  heartwood: { rgb: [255, 70, 70], alpha: 0.45 },
  copper: { rgb: [40, 120, 255], alpha: 0.55 },
  unknown: { rgb: [150, 120, 255], alpha: 0.45 },
};

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("CROP_IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

function semanticOverlayLabels(state: CropSemanticMaskState | null, semanticMode: CropSemanticMode): LabelDef[] {
  const labels = state?.semanticLabels[semanticMode]?.labels ?? [];
  return labels.map((label) => {
    const color = LABEL_COLORS[label.stableId] ?? LABEL_COLORS.unknown;
    return {
      id: label.value,
      key: label.stableId.toUpperCase(),
      name: label.name,
      rgb: color.rgb,
      alpha: color.alpha,
    };
  });
}

function semanticPaintLabels(state: CropSemanticMaskState | null, semanticMode: CropSemanticMode) {
  const mode = state?.semanticLabels[semanticMode];
  if (!mode) return [];
  return mode.labels
    .filter((label) => label.value !== mode.backgroundValue)
    .map((label) => ({ id: label.value as LabelId, name: label.name, stableId: label.stableId }));
}

function supportReadinessLabel(state: CropSemanticMaskState | null) {
  if (!state?.currentSupportMask) return "No explicit support mask";
  return `${state.currentSupportMask.reviewState.toLowerCase()} support v${state.currentSupportMask.version}`;
}

function semanticVersionLabel(state: CropSemanticMaskState | null, semanticMode: CropSemanticMode) {
  const latest = state?.latestSemanticMasks[semanticMode];
  if (!latest) return "No semantic draft";
  return `${latest.reviewState.toLowerCase()} ${MODE_LABELS[semanticMode]} v${latest.version}`;
}

function classificationLabel(state: CropSemanticMaskState | null) {
  const latest = state?.latestClassification;
  if (!latest) return "Classification: missing";
  const reason = formatSliceClassificationReason(latest.derivationReason);
  return [
    `Classification: ${formatSliceClassLabel(latest.class)} v${latest.version}`,
    formatSliceClassificationSource(latest.source),
    reason,
  ]
    .filter(Boolean)
    .join(" / ");
}

function displaySupportMask(source: MaskBuffer) {
  const display = new MaskBuffer(source.width, source.height, Labels.BG);
  for (let index = 0; index < source.data.length; index += 1) {
    display.data[index] = source.data[index] === 0 ? Labels.BG : Labels.SLICE_SUPPORT;
  }
  return display;
}

export function CropSemanticEditorClient({ cropId, canEdit }: CropSemanticEditorClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const supportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const supportCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const supportOverlayImageRef = useRef<ImageData | null>(null);
  const overlayImageRef = useRef<ImageData | null>(null);
  const supportMaskRef = useRef<MaskBuffer | null>(null);
  const maskRef = useRef<MaskBuffer | null>(null);
  const paletteRef = useRef<Uint8ClampedArray>(buildPalette([], 0.5));
  const supportPaletteRef = useRef<Uint8ClampedArray>(
    buildPalette(supportMaskLabels(Labels.SLICE_SUPPORT), 0.3),
  );
  const draggingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<Point[]>([]);
  const lassoActiveRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);
  const undoRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const opacityRef = useRef(0.5);
  const supportOpacityRef = useRef(0.3);
  const loadSequenceRef = useRef(0);

  const [state, setState] = useState<CropSemanticMaskState | null>(null);
  const [status, setStatus] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [semanticMode, setSemanticMode] = useState<CropSemanticMode>("SAP_HEARTWOOD");
  const [activeLabel, setActiveLabel] = useState<LabelId>(Labels.SAPWOOD);
  const [brushRadius, setBrushRadius] = useState(8);
  const [opacity, setOpacity] = useState(0.5);
  const [supportOpacity, setSupportOpacity] = useState(0.3);
  const [zoom, setZoom] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSliceClass, setSelectedSliceClass] = useState<SliceClassValue | "">("");
  const [classificationSaving, setClassificationSaving] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusyKey, setReviewBusyKey] = useState<string | null>(null);
  const [lassoPointCount, setLassoPointCount] = useState(0);

  const overlayLabels = useMemo(() => semanticOverlayLabels(state, semanticMode), [state, semanticMode]);
  const paintLabels = useMemo(() => semanticPaintLabels(state, semanticMode), [state, semanticMode]);
  const palette = useMemo(() => buildPalette(overlayLabels, opacity), [overlayLabels, opacity]);
  const supportPalette = useMemo(
    () => buildPalette(supportMaskLabels(Labels.SLICE_SUPPORT), supportOpacity),
    [supportOpacity],
  );
  const editorCanEdit =
    canEdit && Boolean(state?.canEdit) && editorReady;
  const classificationCanEdit = canEdit && Boolean(state?.canEdit) && Boolean(state);

  const applyZoom = useCallback((z: number) => {
    const canvases = [
      baseCanvasRef.current,
      supportCanvasRef.current,
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

  const ensureSupportOverlayBuffer = useCallback((width: number, height: number) => {
    const ctx = supportCtxRef.current;
    const current = supportOverlayImageRef.current;
    if (!current || current.width !== width || current.height !== height) {
      supportOverlayImageRef.current = ctx?.createImageData(width, height) ?? new ImageData(width, height);
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

  const renderSupportOverlayFull = useCallback(() => {
    const support = supportMaskRef.current;
    const ctx = supportCtxRef.current;
    if (!support || !ctx) return;

    const displayMask = displaySupportMask(support);
    ensureSupportOverlayBuffer(displayMask.width, displayMask.height);
    const imageData = supportOverlayImageRef.current;
    if (!imageData) return;
    updateOverlayRegionWithPalette(
      imageData,
      displayMask,
      supportPaletteRef.current,
      0,
      0,
      displayMask.width,
      displayMask.height,
    );
    ctx.putImageData(imageData, 0, 0);
  }, [ensureSupportOverlayBuffer]);

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

  const clearPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  function setLassoPoints(points: Point[]) {
    lassoPointsRef.current = points;
    setLassoPointCount(points.length);
  }

  function drawLassoPreview(points: Point[], hover?: Point | null, showHandles = false) {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x + 0.5, points[i].y + 0.5);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (points.length > 0) {
      ctx.moveTo(points[0].x + 0.5, points[0].y + 0.5);
      for (let i = 1; i < points.length; i += 1) {
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
      const radius = 5;
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = editorCanvasPreviewStyle.handleStroke;
      ctx.fillStyle = editorCanvasPreviewStyle.handleFill;
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x + 0.5, point.y + 0.5, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  const resetLasso = useCallback(() => {
    lassoActiveRef.current = false;
    lassoPointsRef.current = [];
    setLassoPointCount(0);
    clearPreview();
  }, [clearPreview]);

  const resetEditor = useCallback(() => {
    setEditorReady(false);
    setHasUnsavedChanges(false);
    maskRef.current = null;
    supportMaskRef.current = null;
    overlayImageRef.current = null;
    supportOverlayImageRef.current = null;
    undoRef.current = [];
    redoRef.current = [];
    currentStrokeRef.current = [];
    draggingRef.current = false;
    lastPtRef.current = null;
    lassoActiveRef.current = false;
    lassoPointsRef.current = [];
    setLassoPointCount(0);
    clearPreview();
  }, [clearPreview]);

  const loadEditor = useCallback(async (signal?: AbortSignal) => {
    const loadGuard = createEditorLoadGuard(loadSequenceRef, signal);
    resetEditor();
    setStatus("Loading crop semantic mask");
    try {
      const response = await fetch(API_CROP_SEMANTIC_MASK(cropId), {
        method: "GET",
        cache: "no-store",
        signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `CROP_SEMANTIC_MASK_FAILED_${response.status}`);
      }
      if (!loadGuard.isCurrent()) return;
      const nextState = data as CropSemanticMaskState;
      setState(nextState);
      paletteRef.current = buildPalette(semanticOverlayLabels(nextState, semanticMode), opacityRef.current);
      supportPaletteRef.current = buildPalette(
        supportMaskLabels(Labels.SLICE_SUPPORT),
        supportOpacityRef.current,
      );

      let supportBytes: Uint8Array | null = null;
      if (nextState.currentSupportMask) {
        const supportResponse = await fetch(nextState.currentSupportMask.url, { cache: "no-store", signal });
        if (!supportResponse.ok) throw new Error(`CROP_SUPPORT_MASK_ASSET_FAILED_${supportResponse.status}`);
        supportBytes = new Uint8Array(await supportResponse.arrayBuffer());
        if (!loadGuard.isCurrent()) return;
      }

      let latestBytes: Uint8Array | null = null;
      const latestSemantic = nextState.latestSemanticMasks[semanticMode];
      if (latestSemantic?.url) {
        const assetResponse = await fetch(latestSemantic.url, { cache: "no-store", signal });
        if (!assetResponse.ok) throw new Error(`CROP_SEMANTIC_MASK_ASSET_FAILED_${assetResponse.status}`);
        latestBytes = new Uint8Array(await assetResponse.arrayBuffer());
        if (!loadGuard.isCurrent()) return;
      }

      const img = await loadImageElement(nextState.crop.assetUrl);
      if (!loadGuard.isCurrent()) return;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (width !== nextState.crop.cropWidth || height !== nextState.crop.cropHeight) {
        throw new Error("CROP_IMAGE_DIMENSIONS_MISMATCH");
      }
      if (supportBytes && supportBytes.byteLength !== width * height) {
        throw new Error("SUPPORT_MASK_DIMENSIONS_MISMATCH");
      }

      const canvases = [
        baseCanvasRef.current,
        supportCanvasRef.current,
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
      const supportCanvas = supportCanvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!base || !supportCanvas || !overlay) throw new Error("EDITOR_CANVAS_NOT_READY");
      const baseCtx = base.getContext("2d");
      const supportCtx = supportCanvas.getContext("2d");
      const overlayCtx = overlay.getContext("2d");
      if (!baseCtx || !supportCtx || !overlayCtx) throw new Error("EDITOR_CONTEXT_NOT_READY");
      supportCtxRef.current = supportCtx;
      overlayCtxRef.current = overlayCtx;
      baseCtx.clearRect(0, 0, width, height);
      supportCtx.clearRect(0, 0, width, height);
      overlayCtx.clearRect(0, 0, width, height);
      baseCtx.drawImage(img, 0, 0);

      const supportMask = supportBytes ? new MaskBuffer(width, height, Labels.BG) : null;
      if (supportMask && supportBytes) {
        supportMask.data.set(supportBytes);
      }
      supportMaskRef.current = supportMask;

      const semanticMask = new MaskBuffer(
        width,
        height,
        nextState.semanticLabels[semanticMode].backgroundValue as LabelId,
      );
      if (latestBytes) {
        if (latestBytes.byteLength !== width * height) throw new Error("SAVED_MASK_DIMENSIONS_MISMATCH");
        semanticMask.data.set(latestBytes);
      }
      maskRef.current = semanticMask;

      supportCtx.clearRect(0, 0, width, height);
      if (supportMask) renderSupportOverlayFull();
      renderOverlayFull();
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
      setStatus(errorMessage(error, "Crop semantic editor failed"));
    }
  }, [cropId, fitToContainer, renderOverlayFull, renderSupportOverlayFull, resetEditor, semanticMode]);

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
    supportOpacityRef.current = supportOpacity;
    supportPaletteRef.current = supportPalette;
    renderSupportOverlayFull();
  }, [supportOpacity, supportPalette, renderSupportOverlayFull]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editorCanEdit) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
      ) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape") {
        resetLasso();
        return;
      }
      if (tool === "lasso_poly" && event.key === "Enter") {
        event.preventDefault();
        commitLasso(lassoPointsRef.current.slice());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (paintLabels.length === 0) return;
    if (!paintLabels.some((label) => label.id === activeLabel)) {
      setActiveLabel(paintLabels[0].id);
    }
  }, [activeLabel, paintLabels]);

  useEffect(() => {
    setSelectedSliceClass(state?.latestClassification?.class ?? "");
  }, [state?.latestClassification?.class]);

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
    const supportMask = supportMaskRef.current;
    if (!mask || !editorCanEdit) return;
    const paintLabel = getPaintLabelForTool({
      tool,
      maskMode: "semantic",
      activeLabel,
    });
    const patch = applyCropBrush({
      mask,
      supportMask,
      constrainToSupport: semanticMode === "COPPER" && Boolean(supportMask),
      x,
      y,
      radius: brushRadius,
      label: paintLabel,
    });
    if (!patch) return;
    currentStrokeRef.current.push(patch);
    paintOverlayRect(patch.x, patch.y, patch.w, patch.h);
    markDirty();
  }

  function commitLasso(points: Point[]) {
    const mask = maskRef.current;
    const supportMask = supportMaskRef.current;
    if (!mask || !editorCanEdit) return;
    if (points.length < 3) {
      resetLasso();
      return;
    }

    const patch = applyCropPolygonFill({
      mask,
      supportMask,
      constrainToSupport: semanticMode === "COPPER" && Boolean(supportMask),
      points,
      label: getPaintLabelForTool({
        tool,
        maskMode: "semantic",
        activeLabel,
      }),
    });
    if (!patch) {
      resetLasso();
      return;
    }

    undoRef.current.push([patch]);
    redoRef.current = [];
    paintOverlayRect(patch.x, patch.y, patch.w, patch.h);
    markDirty();
    resetLasso();
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!editorCanEdit || shouldIgnorePointerDown(event)) return;
    event.preventDefault();
    const target = event.currentTarget;
    const point = canvasToCropCoords(event);

    if (isBrushLikeTool(tool)) {
      draggingRef.current = true;
      currentStrokeRef.current = [];
      redoRef.current = [];
      lastPtRef.current = point;
      capturePointer(target, event.pointerId);
      stamp(point.x, point.y);
      return;
    }

    if (tool === "lasso_free") {
      lassoActiveRef.current = true;
      setLassoPoints([point]);
      redoRef.current = [];
      drawLassoPreview(lassoPointsRef.current);
      capturePointer(target, event.pointerId);
      return;
    }

    if (tool === "lasso_poly") {
      const points = lassoPointsRef.current;
      const first = points[0];
      if (first && points.length >= 3) {
        const dx = point.x - first.x;
        const dy = point.y - first.y;
        if (dx * dx + dy * dy <= 36) {
          commitLasso(points.slice());
          return;
        }
      }
      if (points.length === 0) redoRef.current = [];
      setLassoPoints([...points, point]);
      drawLassoPreview(lassoPointsRef.current, null, true);
      return;
    }

    resetLasso();
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!editorCanEdit) return;
    event.preventDefault();
    const point = canvasToCropCoords(event);

    if (isBrushLikeTool(tool)) {
      if (!draggingRef.current) return;
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
      return;
    }

    if (tool === "lasso_free") {
      if (!lassoActiveRef.current) return;
      const points = lassoPointsRef.current;
      const last = points[points.length - 1];
      if (!last) {
        setLassoPoints([point]);
        drawLassoPreview(lassoPointsRef.current);
        return;
      }
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx * dx + dy * dy >= 4) {
        setLassoPoints([...points, point]);
        drawLassoPreview(lassoPointsRef.current);
      }
      return;
    }

    if (tool === "lasso_poly") {
      const points = lassoPointsRef.current;
      if (points.length > 0) drawLassoPreview(points, point, true);
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
    if (isBrushLikeTool(tool)) {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
      releasePointer(event.currentTarget, event.pointerId);
      return;
    }

    if (tool === "lasso_free" && lassoActiveRef.current) {
      lassoActiveRef.current = false;
      releasePointer(event.currentTarget, event.pointerId);
      commitLasso(lassoPointsRef.current.slice());
    }
  }

  function onPointerCancel(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (isBrushLikeTool(tool)) {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
      releasePointer(event.currentTarget, event.pointerId);
      return;
    }

    if (tool === "lasso_free") {
      releasePointer(event.currentTarget, event.pointerId);
      resetLasso();
      return;
    }

    if (tool === "lasso_poly") {
      drawLassoPreview(lassoPointsRef.current, null, true);
    }
  }

  function onPointerLeave(event: PointerEvent<HTMLCanvasElement>) {
    if (isBrushLikeTool(tool) && draggingRef.current && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
    }
    if (tool === "lasso_poly") {
      drawLassoPreview(lassoPointsRef.current, null, true);
    }
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

  function switchMode(nextMode: CropSemanticMode) {
    if (nextMode === semanticMode) return;
    if (hasUnsavedChanges && !window.confirm("Discard unsaved semantic crop mask changes?")) return;
    resetLasso();
    setSemanticMode(nextMode);
  }

  function selectTool(nextTool: Tool) {
    if (nextTool !== tool) resetLasso();
    setTool(nextTool);
  }

  async function saveMask() {
    const mask = maskRef.current;
    const supportMask = state?.currentSupportMask;
    if (!mask || !editorCanEdit || !hasUnsavedChanges) return;
    setIsSaving(true);
    setStatus("Saving crop semantic mask");
    try {
      const headers: Record<string, string> = {
        "x-semantic-mode": semanticMode,
      };
      if (semanticMode === "COPPER" && supportMask) {
        headers["x-support-mask-version-id"] = supportMask.id;
      }
      const response = await uploadEditorMask(API_CROP_SEMANTIC_MASK_UPLOAD(cropId), {
        data: mask.data,
        width: mask.width,
        height: mask.height,
        headers,
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error ?? "CROP_SEMANTIC_MASK_SAVE_FAILED");
      const nextState = data as CropSemanticMaskState;
      setState(nextState);
      setHasUnsavedChanges(false);
      if (nextState.classificationDerivation?.ok === false) {
        setStatus(`Saved; classification derivation failed: ${nextState.classificationDerivation.error}`);
      } else if (nextState.classificationDerivation?.classification) {
        setStatus(
          `Saved; suggested ${formatSliceClassLabel(nextState.classificationDerivation.classification.class)}`,
        );
        setTimeout(() => setStatus(""), 800);
      } else {
        setStatus("Saved");
        setTimeout(() => setStatus(""), 800);
      }
    } catch (error) {
      setStatus(errorMessage(error, "Crop semantic mask save failed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveManualClassification() {
    if (!state || !classificationCanEdit || !selectedSliceClass) return;
    setClassificationSaving(true);
    setStatus("Saving classification");
    try {
      const response = await fetch(API_SLICE_INSTANCE_CLASSIFICATION(state.crop.sliceInstanceId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class: selectedSliceClass }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `SLICE_CLASSIFICATION_SAVE_FAILED_${response.status}`);
      }
      await loadEditor();
      setStatus("Classification saved");
      setTimeout(() => setStatus(""), 800);
    } catch (error) {
      setStatus(errorMessage(error, "Classification save failed"));
    } finally {
      setClassificationSaving(false);
    }
  }

  async function reloadLatest() {
    if (hasUnsavedChanges && !window.confirm("Discard unsaved semantic crop mask changes?")) return;
    await loadEditor();
  }

  async function runReviewAction(target: CropReviewTarget, action: ReviewAction) {
    if (hasUnsavedChanges) return;
    const comment = reviewComment.trim();
    if (action === "reject" && !comment) {
      setStatus("Reject reason required");
      return;
    }

    const busyKey = `${target.key}:${target.versionId}:${action}`;
    setReviewBusyKey(busyKey);
    setStatus("");
    try {
      const endpoint =
        target.kind === "classification"
          ? API_CLASSIFICATION_REVIEW(target.versionId)
          : API_ARTIFACT_REVIEW(target.versionId);
      const response = await fetch(endpoint, {
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
        throw new Error(data?.error ?? `CROP_REVIEW_FAILED_${response.status}`);
      }
      setReviewComment("");
      await loadEditor();
      setStatus(`${target.label} ${formatReviewState(data.toState)}`);
      setTimeout(() => setStatus(""), 800);
    } catch (error) {
      setStatus(errorMessage(error, "Crop review action failed"));
    } finally {
      setReviewBusyKey(null);
    }
  }

  const editorStatus = isSaving ? "Saving..." : status || (hasUnsavedChanges ? "Unsaved changes" : "");
  const canCommitPolygon = editorCanEdit && tool === "lasso_poly" && lassoPointCount >= 3;
  const activeSemanticMask = state?.latestSemanticMasks[semanticMode] ?? null;
  const classificationReviewActions =
    state?.latestClassification &&
    state.cropReadiness?.latestClassificationVersionId === state.latestClassification.id
      ? state.cropReadiness.reviewActions.classification
      : null;
  const reviewTargets: CropReviewTarget[] = [
    ...(state?.currentSupportMask
      ? [
          {
            key: "support",
            label: "Support",
            versionId: state.currentSupportMask.id,
            version: state.currentSupportMask.version,
            reviewState: state.currentSupportMask.reviewState,
            kind: "artifact" as const,
            actions: state.currentSupportMask.reviewActions,
          },
        ]
      : []),
    ...(activeSemanticMask
      ? [
          {
            key: `semantic-${semanticMode}`,
            label: MODE_LABELS[semanticMode],
            versionId: activeSemanticMask.id,
            version: activeSemanticMask.version,
            reviewState: activeSemanticMask.reviewState,
            kind: "artifact" as const,
            actions: activeSemanticMask.reviewActions,
          },
        ]
      : []),
    ...(state?.latestClassification
      ? [
          {
            key: "classification",
            label: "Classification",
            versionId: state.latestClassification.id,
            version: state.latestClassification.version,
            reviewState: state.latestClassification.reviewState,
            kind: "classification" as const,
            actions: classificationReviewActions,
          },
        ]
      : []),
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div className="border-b border-border bg-muted p-3">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{supportReadinessLabel(state)}</span>
          <span>{semanticVersionLabel(state, semanticMode)}</span>
          <span>{classificationLabel(state)}</span>
          {state?.cropReadiness && (
            <span>Export readiness: {state.cropReadiness.readinessStatus.toLowerCase().replaceAll("_", " ")}</span>
          )}
          {semanticMode === "SAP_HEARTWOOD" && <span>Support geometry derives from semantic foreground.</span>}
          {semanticMode === "COPPER" && state?.currentSupportMask && <span>Outside-support pixels are locked.</span>}
          {semanticMode === "COPPER" && !state?.currentSupportMask && (
            <span>Copper drafts can save now; support is required before export.</span>
          )}
          {semanticMode === "COPPER" && <span>Non-copper wood remains background inside support.</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={semanticMode === "SAP_HEARTWOOD" ? activeButtonClass : idleButtonClass}
            aria-pressed={semanticMode === "SAP_HEARTWOOD"}
            onClick={() => switchMode("SAP_HEARTWOOD")}
            disabled={isSaving}
          >
            Sap/Heartwood
          </button>
          <button
            className={semanticMode === "COPPER" ? activeButtonClass : idleButtonClass}
            aria-pressed={semanticMode === "COPPER"}
            onClick={() => switchMode("COPPER")}
            disabled={isSaving}
          >
            Copper
          </button>
          <button
            className={tool === "brush" ? activeButtonClass : idleButtonClass}
            aria-pressed={tool === "brush"}
            onClick={() => selectTool("brush")}
            disabled={!editorCanEdit}
            title="Brush"
          >
            <BrushIcon className="size-4" aria-hidden="true" />
            Brush
          </button>
          <button
            className={tool === "eraser" ? activeButtonClass : idleButtonClass}
            aria-pressed={tool === "eraser"}
            onClick={() => selectTool("eraser")}
            disabled={!editorCanEdit}
            title="Eraser"
          >
            <EraserIcon className="size-4" aria-hidden="true" />
            Eraser
          </button>
          <button
            className={tool === "lasso_free" ? activeButtonClass : idleButtonClass}
            aria-pressed={tool === "lasso_free"}
            onClick={() => selectTool("lasso_free")}
            disabled={!editorCanEdit}
            title="Freehand lasso"
          >
            <LassoIcon className="size-4" aria-hidden="true" />
            Lasso
          </button>
          <button
            className={tool === "lasso_poly" ? activeButtonClass : idleButtonClass}
            aria-pressed={tool === "lasso_poly"}
            onClick={() => selectTool("lasso_poly")}
            disabled={!editorCanEdit}
            title="Polygon lasso"
          >
            <PentagonIcon className="size-4" aria-hidden="true" />
            Polygon
          </button>
          {tool === "lasso_poly" && (
            <button
              className={idleButtonClass}
              onClick={() => commitLasso(lassoPointsRef.current.slice())}
              disabled={!canCommitPolygon}
              title="Commit polygon"
            >
              <SaveIcon className="size-4" aria-hidden="true" />
              Commit
            </button>
          )}
          {paintLabels.map((label) => (
            <button
              key={`${semanticMode}-${label.id}`}
              className={activeLabel === label.id ? activeButtonClass : idleButtonClass}
              aria-pressed={activeLabel === label.id}
              onClick={() => setActiveLabel(label.id)}
              disabled={!editorCanEdit}
            >
              {label.name}
            </button>
          ))}
          <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <span>Size {brushRadius}px</span>
            <input
              type="range"
              min={1}
              max={80}
              value={brushRadius}
              onChange={(event) => setBrushRadius(Number(event.target.value))}
              disabled={!editorCanEdit || tool === "lasso_poly"}
              className="w-32"
            />
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
            Save semantic mask
          </button>
          <label className="flex min-h-11 items-center gap-2">
            <span className="text-xs text-muted-foreground">Slice classification</span>
            <select
              aria-label="Slice classification"
              value={selectedSliceClass}
              disabled={!classificationCanEdit || classificationSaving}
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
            onClick={() => void saveManualClassification()}
            disabled={!classificationCanEdit || classificationSaving || !selectedSliceClass}
            title="Save classification"
          >
            <SaveIcon className="size-4" aria-hidden="true" />
            {classificationSaving ? "Saving classification..." : "Save classification"}
          </button>
          {reviewTargets.map((target) => {
            const blocked = hasUnsavedChanges || reviewBusyKey !== null;
            return (
              <div key={target.key} className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground">
                <span>
                  {target.label}: {formatReviewState(target.reviewState)} v{target.version}
                </span>
                <button
                  className={idleButtonClass}
                  onClick={() => void runReviewAction(target, "submit")}
                  disabled={blocked || !target.actions?.canSubmit}
                >
                  Submit
                </button>
                <button
                  className={idleButtonClass}
                  onClick={() => void runReviewAction(target, "approve")}
                  disabled={blocked || !target.actions?.canApprove}
                >
                  Approve
                </button>
                <button
                  className={idleButtonClass}
                  onClick={() => void runReviewAction(target, "reject")}
                  disabled={blocked || !target.actions?.canReject}
                >
                  Reject
                </button>
              </div>
            );
          })}
          {reviewTargets.length > 0 && (
            <input
              aria-label="Crop review comment"
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Review comment"
              className="min-h-11 w-48 rounded-md border border-border bg-input-background px-3 py-2 text-sm"
            />
          )}
          <div className="ml-auto flex min-h-11 flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Semantic opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(event) => setOpacity(Number(event.target.value) / 100)}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>Support opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(supportOpacity * 100)}
                onChange={(event) => setSupportOpacity(Number(event.target.value) / 100)}
                className="w-28"
              />
            </div>
            {editorStatus && <div>{editorStatus}</div>}
            <div className="flex items-center gap-2">
              <span>Zoom</span>
              <input
                type="range"
                min={5}
                max={300}
                value={Math.round(zoom * 100)}
                onChange={(event) => setZoom(clampNumber(Number(event.target.value) / 100, 0.05, 3))}
                className="w-28"
              />
              <span className="tabular-nums w-10">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <EditorCanvasStack
        containerRef={containerRef}
        baseCanvasRef={baseCanvasRef}
        predictionCanvasRef={supportCanvasRef}
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
  );
}
