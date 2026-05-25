"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  AlertTriangleIcon,
  BrushIcon,
  LassoIcon,
  Maximize2Icon,
  PentagonIcon,
  Redo2Icon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
  XIcon,
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
  API_CROP_SUPPORT_MASK_UPLOAD,
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
import { defaultLabelForSemanticMode } from "./cropAnnotationGuidance";
import { getPaintLabelForTool, isBrushLikeTool } from "./editorTools";
import {
  SLICE_CLASS_OPTIONS,
  type CropAnnotationFamily,
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
  initialSemanticMode?: CropSemanticMode;
  initialTarget?: "semantic" | "support";
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

const FAMILY_LABELS: Record<CropAnnotationFamily, string> = {
  SAP_HEARTWOOD: "Sapwood / Heartwood",
  CU_SUPPORT: "Cu / Support mask",
};

const TARGET_LABELS = {
  support: "Support",
  copper: "Cu",
} as const;

const LABEL_COLORS: Record<string, Pick<LabelDef, "rgb" | "alpha">> = {
  background: { rgb: [0, 0, 0], alpha: 0 },
  sapwood: { rgb: [255, 170, 0], alpha: 0.45 },
  heartwood: { rgb: [255, 70, 70], alpha: 0.45 },
  copper: { rgb: [40, 120, 255], alpha: 0.55 },
  slice_support: { rgb: [30, 180, 120], alpha: 0.5 },
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
  return mode.labels.map((label) => ({
    id: label.value as LabelId,
    name: label.name,
    stableId: label.stableId,
  }));
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

function initialFamilyFromMode(mode: CropSemanticMode | undefined): CropAnnotationFamily {
  return mode === "COPPER" ? "CU_SUPPORT" : "SAP_HEARTWOOD";
}

function semanticModeForFamily(family: CropAnnotationFamily): CropSemanticMode {
  return family === "SAP_HEARTWOOD" ? "SAP_HEARTWOOD" : "COPPER";
}

function annotationFamilyLabel(state: CropSemanticMaskState | null) {
  const family = state?.annotationFamily;
  if (!family || family.state === "EMPTY") return "Annotation family: empty";
  if (family.state === "CONFLICT") return "Annotation family: conflict";
  return `Annotation family: ${FAMILY_LABELS[family.state]}`;
}

function displaySupportMask(source: MaskBuffer) {
  const display = new MaskBuffer(source.width, source.height, Labels.BG);
  for (let index = 0; index < source.data.length; index += 1) {
    display.data[index] = source.data[index] === 0 ? Labels.BG : Labels.SLICE_SUPPORT;
  }
  return display;
}

export function CropSemanticEditorClient({
  cropId,
  canEdit,
  initialSemanticMode = "SAP_HEARTWOOD",
  initialTarget,
}: CropSemanticEditorClientProps) {
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
  const lassoClosedRef = useRef(false);
  const lassoDragIndexRef = useRef<number | null>(null);
  const currentStrokeRef = useRef<Stroke>([]);
  const undoRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const opacityRef = useRef(0.5);
  const supportOpacityRef = useRef(0.3);
  const loadSequenceRef = useRef(0);
  const editingSupportRef = useRef(initialTarget === "support");

  const [state, setState] = useState<CropSemanticMaskState | null>(null);
  const [status, setStatus] = useState("");
  const [editorReady, setEditorReady] = useState(false);
  const [tool, setTool] = useState<Tool>("lasso_poly");
  const [activeFamily, setActiveFamily] = useState<CropAnnotationFamily>(
    initialTarget === "support" ? "CU_SUPPORT" : initialFamilyFromMode(initialSemanticMode),
  );
  const [cuSupportTarget, setCuSupportTarget] = useState<"support" | "copper">(
    initialTarget === "support" ? "support" : "copper",
  );
  const [activeLabel, setActiveLabel] = useState<LabelId>(defaultLabelForSemanticMode(initialSemanticMode));
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
  const [lassoClosed, setLassoClosed] = useState(false);

  const editingSupport = activeFamily === "CU_SUPPORT" && cuSupportTarget === "support";
  const semanticMode = semanticModeForFamily(activeFamily);
  const supportLabelValue = state?.supportLabels.sliceSupport ?? Labels.SLICE_SUPPORT;
  const supportBackgroundValue = state?.supportLabels.background ?? Labels.BG;
  const activeBackgroundLabel = editingSupport
    ? supportBackgroundValue
    : (state?.semanticLabels[semanticMode]?.backgroundValue ?? Labels.BG);
  const overlayLabels = useMemo(
    () => (editingSupport ? supportMaskLabels(supportLabelValue) : semanticOverlayLabels(state, semanticMode)),
    [editingSupport, semanticMode, state, supportLabelValue],
  );
  const paintLabels = useMemo(
    () =>
      editingSupport
        ? [
            { id: supportBackgroundValue as LabelId, name: "Background", stableId: "background" },
            { id: supportLabelValue as LabelId, name: "Support", stableId: "slice_support" },
          ]
        : semanticPaintLabels(state, semanticMode),
    [editingSupport, semanticMode, state, supportBackgroundValue, supportLabelValue],
  );
  const palette = useMemo(() => buildPalette(overlayLabels, opacity), [overlayLabels, opacity]);
  const supportPalette = useMemo(
    () => buildPalette(supportMaskLabels(Labels.SLICE_SUPPORT), supportOpacity),
    [supportOpacity],
  );
  const annotationFamily = state?.annotationFamily;
  const blockedFamilies = annotationFamily?.blockedFamilies ?? [];
  const familyBlocked =
    annotationFamily?.state !== "CONFLICT" && blockedFamilies.includes(activeFamily);
  const editorCanEdit = canEdit && Boolean(state?.canEdit) && editorReady && !familyBlocked;
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
    if (!ctx) return;
    if (editingSupportRef.current || !support) {
      const canvas = supportCanvasRef.current;
      if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

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

  function setPolygonClosed(nextClosed: boolean) {
    lassoClosedRef.current = nextClosed;
    setLassoClosed(nextClosed);
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
    lassoDragIndexRef.current = null;
    lassoClosedRef.current = false;
    setLassoPointCount(0);
    setLassoClosed(false);
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
    lassoDragIndexRef.current = null;
    lassoClosedRef.current = false;
    setLassoPointCount(0);
    setLassoClosed(false);
    clearPreview();
  }, [clearPreview]);

  const loadEditor = useCallback(async (signal?: AbortSignal) => {
    const loadGuard = createEditorLoadGuard(loadSequenceRef, signal);
    resetEditor();
    setStatus(editingSupport ? "Loading crop support mask" : "Loading crop semantic mask");
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
      const nextSupportLabel = nextState.supportLabels.sliceSupport;
      paletteRef.current = buildPalette(
        editingSupport ? supportMaskLabels(nextSupportLabel) : semanticOverlayLabels(nextState, semanticMode),
        opacityRef.current,
      );
      supportPaletteRef.current = buildPalette(
        supportMaskLabels(nextSupportLabel),
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
      const latestSemantic = editingSupport ? null : nextState.latestSemanticMasks[semanticMode];
      if (editingSupport) {
        latestBytes = supportBytes;
      } else if (latestSemantic?.url) {
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

      const supportMask = supportBytes ? new MaskBuffer(width, height, nextState.supportLabels.background as LabelId) : null;
      if (supportMask && supportBytes) {
        supportMask.data.set(supportBytes);
      }
      supportMaskRef.current = supportMask;

      const editorMask = new MaskBuffer(
        width,
        height,
        editingSupport
          ? (nextState.supportLabels.background as LabelId)
          : (nextState.semanticLabels[semanticMode].backgroundValue as LabelId),
      );
      if (latestBytes) {
        if (latestBytes.byteLength !== width * height) throw new Error("SAVED_MASK_DIMENSIONS_MISMATCH");
        editorMask.data.set(latestBytes);
      }
      maskRef.current = editorMask;

      supportCtx.clearRect(0, 0, width, height);
      if (!editingSupport && supportMask) renderSupportOverlayFull();
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
      setStatus(errorMessage(error, editingSupport ? "Crop support editor failed" : "Crop semantic editor failed"));
    }
  }, [cropId, editingSupport, fitToContainer, renderOverlayFull, renderSupportOverlayFull, resetEditor, semanticMode]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEditor(controller.signal);
    return () => controller.abort();
  }, [loadEditor]);

  useEffect(() => {
    editingSupportRef.current = editingSupport;
  }, [editingSupport]);

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
        if (lassoClosedRef.current) {
          commitLasso(lassoPointsRef.current.slice());
        } else {
          closePolygonPreview();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (paintLabels.length === 0) return;
    if (!paintLabels.some((label) => label.id === activeLabel)) {
      setActiveLabel(paintLabels.find((label) => label.id !== activeBackgroundLabel)?.id ?? paintLabels[0].id);
    }
  }, [activeBackgroundLabel, activeLabel, paintLabels]);

  useEffect(() => {
    const family = state?.annotationFamily;
    if (!family || family.state === "EMPTY" || family.state === "CONFLICT" || hasUnsavedChanges) return;
    if (family.state !== activeFamily) {
      setActiveFamily(family.state);
      if (family.state === "CU_SUPPORT") {
        setCuSupportTarget(family.families.cuSupport.hasSupport ? "support" : "copper");
      }
    }
  }, [activeFamily, hasUnsavedChanges, state?.annotationFamily]);

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
      maskMode: editingSupport ? "support" : "semantic",
      activeLabel,
      supportBackgroundLabel: supportBackgroundValue,
    });
    const patch = applyCropBrush({
      mask,
      supportMask,
      constrainToSupport: !editingSupport && semanticMode === "COPPER" && Boolean(supportMask),
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

  function closePolygonPreview() {
    const points = lassoPointsRef.current;
    if (!editorCanEdit || tool !== "lasso_poly" || points.length < 3) return;
    setPolygonClosed(true);
    drawLassoPreview(points, null, true);
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
      points,
      label: getPaintLabelForTool({
        tool,
        maskMode: editingSupport ? "support" : "semantic",
        activeLabel,
        supportBackgroundLabel: supportBackgroundValue,
      }),
      constrainToSupport: !editingSupport && semanticMode === "COPPER" && Boolean(supportMask),
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
      if (lassoClosedRef.current) {
        const handleRadius = 6;
        for (let index = 0; index < points.length; index += 1) {
          const dx = point.x - points[index].x;
          const dy = point.y - points[index].y;
          if (dx * dx + dy * dy <= handleRadius * handleRadius) {
            lassoDragIndexRef.current = index;
            capturePointer(target, event.pointerId);
            drawLassoPreview(points, null, true);
            return;
          }
        }
        drawLassoPreview(points, null, true);
        return;
      }

      const first = points[0];
      if (first && points.length >= 3) {
        const dx = point.x - first.x;
        const dy = point.y - first.y;
        if (dx * dx + dy * dy <= 36) {
          closePolygonPreview();
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
      const dragIndex = lassoDragIndexRef.current;
      if (dragIndex !== null) {
        const nextPoints = points.slice();
        nextPoints[dragIndex] = point;
        setLassoPoints(nextPoints);
        drawLassoPreview(nextPoints, null, true);
        return;
      }
      if (points.length > 0) drawLassoPreview(points, lassoClosedRef.current ? null : point, true);
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

    if (tool === "lasso_poly" && lassoDragIndexRef.current !== null) {
      lassoDragIndexRef.current = null;
      releasePointer(event.currentTarget, event.pointerId);
      drawLassoPreview(lassoPointsRef.current, null, true);
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
      lassoDragIndexRef.current = null;
      releasePointer(event.currentTarget, event.pointerId);
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

  function familyBlockedReason(family: CropAnnotationFamily) {
    const annotation = state?.annotationFamily;
    if (!annotation || annotation.state === "EMPTY" || annotation.state === "CONFLICT") return null;
    if (!annotation.blockedFamilies.includes(family)) return null;
    const active = annotation.activeFamily ? FAMILY_LABELS[annotation.activeFamily] : "the opposite family";
    return `${FAMILY_LABELS[family]} is unavailable because this crop already contains ${active} annotation. Remove that annotation to switch families.`;
  }

  function selectFamily(nextFamily: CropAnnotationFamily, nextTarget?: "support" | "copper") {
    const blockedReason = familyBlockedReason(nextFamily);
    if (blockedReason) {
      setStatus(blockedReason);
      return;
    }
    if (
      (nextFamily !== activeFamily || (nextTarget && nextTarget !== cuSupportTarget)) &&
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved crop annotation changes?")
    ) {
      return;
    }
    resetLasso();
    setActiveFamily(nextFamily);
    if (nextFamily === "CU_SUPPORT" && nextTarget) setCuSupportTarget(nextTarget);
    const nextMode = semanticModeForFamily(nextFamily);
    setActiveLabel(nextFamily === "CU_SUPPORT" && nextTarget === "support" ? supportLabelValue : defaultLabelForSemanticMode(nextMode));
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
    setStatus(editingSupport ? "Saving crop support mask" : "Saving crop semantic mask");
    try {
      if (editingSupport) {
        const response = await uploadEditorMask(API_CROP_SUPPORT_MASK_UPLOAD(cropId), {
          data: mask.data,
          width: mask.width,
          height: mask.height,
        });
        const data = await response.json().catch(() => null);
        if (!data?.ok) throw new Error(data?.error ?? "CROP_SUPPORT_MASK_SAVE_FAILED");
        await loadEditor();
        setHasUnsavedChanges(false);
        setStatus("Saved");
        setTimeout(() => setStatus(""), 800);
        return;
      }

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
      setStatus(errorMessage(error, editingSupport ? "Crop support mask save failed" : "Crop semantic mask save failed"));
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
    if (hasUnsavedChanges && !window.confirm("Discard unsaved crop annotation changes?")) return;
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
  const canClosePolygon = editorCanEdit && tool === "lasso_poly" && !lassoClosed && lassoPointCount >= 3;
  const canApplyPolygon = editorCanEdit && tool === "lasso_poly" && lassoClosed && lassoPointCount >= 3;
  const canCancelPolygon = tool === "lasso_poly" && lassoPointCount > 0;
  const activeLabelIsBackground = activeLabel === activeBackgroundLabel;
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
  const sapHeartwoodBlockedReason = familyBlockedReason("SAP_HEARTWOOD");
  const cuSupportBlockedReason = familyBlockedReason("CU_SUPPORT");
  const familyConflict = state?.annotationFamily.state === "CONFLICT";
  const activeEditLabel = editingSupport ? "support mask" : `${MODE_LABELS[semanticMode]} semantic mask`;
  const familyWarning = familyConflict
    ? "This crop has both annotation families. Erase and save one family before adding more annotation."
    : (sapHeartwoodBlockedReason ?? cuSupportBlockedReason);

  return (
    <div className="overflow-hidden border border-[var(--border-subtle)] bg-[var(--workspace-background)] text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
          <span>{annotationFamilyLabel(state)}</span>
          <span>{supportReadinessLabel(state)}</span>
          <span>{editingSupport ? "Editing support mask" : semanticVersionLabel(state, semanticMode)}</span>
          <span>{classificationLabel(state)}</span>
          {state?.cropReadiness && (
            <span id="export-readiness">
              Export readiness: {state.cropReadiness.readinessStatus.toLowerCase().replaceAll("_", " ")}
            </span>
          )}
          {state?.cropReadiness?.readinessReasons.includes("CLASSIFICATION_SEMANTIC_FAMILY_MISMATCH") && (
            <span>Classification conflicts with active semantic family.</span>
          )}
          {activeFamily === "SAP_HEARTWOOD" && <span>Support geometry derives from semantic foreground.</span>}
          {activeFamily === "CU_SUPPORT" && cuSupportTarget === "copper" && state?.currentSupportMask && (
            <span>Outside-support pixels are locked.</span>
          )}
          {activeFamily === "CU_SUPPORT" && cuSupportTarget === "copper" && !state?.currentSupportMask && (
            <span>Copper drafts can save now; support is required before export.</span>
          )}
          {activeFamily === "CU_SUPPORT" && cuSupportTarget === "support" && (
            <span>Draw the complete support region for the physical slice.</span>
          )}
        </div>

        {familyWarning && (
          <div className="mt-3 flex items-center gap-2 border border-[var(--border-warning)] bg-[var(--warning-surface)] px-3 py-2 text-xs font-medium text-[var(--warning-text)]">
            <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{familyWarning}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Family
            </span>
            <button
              className={activeFamily === "SAP_HEARTWOOD" ? activeButtonClass : idleButtonClass}
              aria-pressed={activeFamily === "SAP_HEARTWOOD"}
              onClick={() => selectFamily("SAP_HEARTWOOD")}
              disabled={isSaving || Boolean(sapHeartwoodBlockedReason)}
            >
              Sapwood / Heartwood
            </button>
            <button
              className={activeFamily === "CU_SUPPORT" ? activeButtonClass : idleButtonClass}
              aria-pressed={activeFamily === "CU_SUPPORT"}
              onClick={() => selectFamily("CU_SUPPORT", cuSupportTarget)}
              disabled={isSaving || Boolean(cuSupportBlockedReason)}
            >
              Cu / Support mask
            </button>
            {activeFamily === "CU_SUPPORT" && (
              <>
                <button
                  className={cuSupportTarget === "support" ? activeButtonClass : idleButtonClass}
                  aria-pressed={cuSupportTarget === "support"}
                  onClick={() => selectFamily("CU_SUPPORT", "support")}
                  disabled={!editorReady || isSaving}
                >
                  {TARGET_LABELS.support}
                </button>
                <button
                  className={cuSupportTarget === "copper" ? activeButtonClass : idleButtonClass}
                  aria-pressed={cuSupportTarget === "copper"}
                  onClick={() => selectFamily("CU_SUPPORT", "copper")}
                  disabled={!editorReady || isSaving}
                >
                  {TARGET_LABELS.copper}
                </button>
              </>
            )}
          </div>

          <div className="hidden h-5 w-px bg-[var(--border-subtle)] lg:block" />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Tools
            </span>
            <button
              className={tool === "lasso_poly" ? activeButtonClass : idleButtonClass}
              aria-pressed={tool === "lasso_poly"}
              onClick={() => selectTool("lasso_poly")}
              disabled={!editorCanEdit}
              title="Polygon"
            >
              <PentagonIcon className="size-3.5" aria-hidden="true" />
              Polygon
            </button>
            <button
              className={tool === "lasso_free" ? activeButtonClass : idleButtonClass}
              aria-pressed={tool === "lasso_free"}
              onClick={() => selectTool("lasso_free")}
              disabled={!editorCanEdit}
              title="Lasso"
            >
              <LassoIcon className="size-3.5" aria-hidden="true" />
              Lasso
            </button>
            <button
              className={tool === "brush" ? activeButtonClass : idleButtonClass}
              aria-pressed={tool === "brush"}
              onClick={() => selectTool("brush")}
              disabled={!editorCanEdit}
              title="Brush"
            >
              <BrushIcon className="size-3.5" aria-hidden="true" />
              Brush
            </button>
            {tool === "lasso_poly" && (
              <>
                <button
                  className={idleButtonClass}
                  onClick={closePolygonPreview}
                  disabled={!canClosePolygon}
                  title="Close polygon"
                >
                  Close polygon
                </button>
                <button
                  className={activeButtonClass}
                  onClick={() => commitLasso(lassoPointsRef.current.slice())}
                  disabled={!canApplyPolygon}
                  title="Apply polygon"
                >
                  <SaveIcon className="size-3.5" aria-hidden="true" />
                  Apply polygon
                </button>
                <button className={idleButtonClass} onClick={resetLasso} disabled={!canCancelPolygon} title="Cancel">
                  <XIcon className="size-3.5" aria-hidden="true" />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Labels
          </span>
          {paintLabels.map((label) => {
            const color = LABEL_COLORS[label.stableId] ?? LABEL_COLORS.unknown;
            return (
              <button
                key={`${editingSupport ? "support" : semanticMode}-${label.id}`}
                className={activeLabel === label.id ? activeButtonClass : idleButtonClass}
                aria-pressed={activeLabel === label.id}
                onClick={() => setActiveLabel(label.id)}
                disabled={!editorCanEdit}
              >
                <span
                  className="size-2 rounded-full border border-[var(--border-subtle)]"
                  style={{
                    backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                    opacity: label.id === activeBackgroundLabel ? 0.5 : 1,
                  }}
                  aria-hidden="true"
                />
                {label.name}
              </button>
            );
          })}
          {activeLabelIsBackground && (
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Background clears pixels with the active tool.
            </span>
          )}
          <label className="ml-auto flex h-8 items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
            <span>Brush size {brushRadius}px</span>
            <input
              type="range"
              min={1}
              max={80}
              value={brushRadius}
              onChange={(event) => setBrushRadius(Number(event.target.value))}
              disabled={!editorCanEdit || tool === "lasso_poly"}
              className="w-28"
            />
          </label>
        </div>

        {tool === "lasso_poly" && (
          <div className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">
            Click to add points · close polygon · drag points to refine · apply
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3 text-sm">
          <button className={idleButtonClass} onClick={undo} disabled={!editorCanEdit} title="Undo">
            <Undo2Icon className="size-3.5" aria-hidden="true" />
            Undo
          </button>
          <button className={idleButtonClass} onClick={redo} disabled={!editorCanEdit} title="Redo">
            <Redo2Icon className="size-3.5" aria-hidden="true" />
            Redo
          </button>
          <button className={idleButtonClass} onClick={fitToContainer} title="Fit">
            <Maximize2Icon className="size-3.5" aria-hidden="true" />
            Fit
          </button>
          <button className={idleButtonClass} onClick={reloadLatest} disabled={isSaving} title="Reload latest">
            <RotateCcwIcon className="size-3.5" aria-hidden="true" />
            Reload latest
          </button>
          <button
            className={idleButtonClass}
            onClick={() => void saveMask()}
            disabled={!editorCanEdit || isSaving || !hasUnsavedChanges}
            title="Commit mask"
          >
            <SaveIcon className="size-3.5" aria-hidden="true" />
            Commit {activeEditLabel}
          </button>

          <label id="classification" className="flex h-8 items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">Slice classification</span>
            <select
              aria-label="Slice classification"
              value={selectedSliceClass}
              disabled={!classificationCanEdit || classificationSaving}
              onChange={(event) => setSelectedSliceClass(event.target.value as SliceClassValue | "")}
              className="h-8 rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-input-background)] px-2 text-[11px] font-medium text-[var(--text-primary)]"
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
            <SaveIcon className="size-3.5" aria-hidden="true" />
            {classificationSaving ? "Saving classification..." : "Save classification"}
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] font-medium text-[var(--text-secondary)]">
            <label className="flex items-center gap-2">
              <span>Semantic opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(event) => setOpacity(Number(event.target.value) / 100)}
                className="w-24"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Support opacity</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(supportOpacity * 100)}
                onChange={(event) => setSupportOpacity(Number(event.target.value) / 100)}
                className="w-24"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Zoom</span>
              <input
                type="range"
                min={5}
                max={300}
                value={Math.round(zoom * 100)}
                onChange={(event) => setZoom(clampNumber(Number(event.target.value) / 100, 0.05, 3))}
                className="w-24"
              />
              <span className="w-10 tabular-nums">{Math.round(zoom * 100)}%</span>
            </label>
          </div>
        </div>

        {(reviewTargets.length > 0 || reviewComment || editorStatus) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
            {reviewTargets.map((target) => {
              const blocked = hasUnsavedChanges || reviewBusyKey !== null;
              return (
                <div
                  key={target.key}
                  data-review-target={target.key}
                  className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]"
                >
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
                className="h-8 w-48 rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-input-background)] px-2 text-[11px] font-medium text-[var(--text-primary)]"
              />
            )}
            {editorStatus && (
              <div className="ml-auto text-[11px] font-medium text-[var(--text-secondary)]" role="status">
                {editorStatus}
              </div>
            )}
          </div>
        )}
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
        onCommitPolygon={() => {
          if (lassoClosedRef.current) commitLasso(lassoPointsRef.current.slice());
          else closePolygonPreview();
        }}
      />
    </div>
  );
}
