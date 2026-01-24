"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MaskBuffer } from "@/mask/maskBuffer";
import { DEFAULT_LABELS, Labels, type LabelId } from "@/mask/labels";
import { applyBrush, applyPolygonFill } from "@/mask/tools";
import { applyPatch, type Patch } from "@/mask/patch";
import { buildPalette, updateOverlayRegionWithPalette } from "@/mask/renderOverlay";

type Props = {
  projectId: string;
  imageId: string;
  canEdit: boolean;
};

const API_IMAGE_VIEW = (imageId: string) => `/api/images/${imageId}/view`;
const API_MASK_LATEST = (imageId: string) => `/api/images/${imageId}/mask/latest`;
const API_MASK_PRESIGN = (imageId: string) => `/api/images/${imageId}/mask/presign`;
const API_MASK_COMMIT = (imageId: string) => `/api/images/${imageId}/mask/commit`;

type Stroke = Patch[];
type Tool = "brush" | "lasso_free" | "lasso_poly";
type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  const [opacity, setOpacity] = useState<number>(0.45);
  const [brushRadius, setBrushRadius] = useState<number>(12);
  const [activeLabel, setActiveLabel] = useState<LabelId>(Labels.COPPER);
  const [tool, setTool] = useState<Tool>("brush");

  const [zoom, setZoom] = useState<number>(1);

  const labels = useMemo(() => DEFAULT_LABELS, []);

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
  const loadedOnceRef = useRef(false);
  const pendingMaskRef = useRef<{ imageId: string; promise: Promise<Uint8Array | null> } | null>(null);
  const maskFetchAbortRef = useRef<AbortController | null>(null);

  // ---------- helpers ----------
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

    const x0 = clamp(x, 0, mask.width);
    const y0 = clamp(y, 0, mask.height);
    const x1 = clamp(x + w, 0, mask.width);
    const y1 = clamp(y + h, 0, mask.height);

    // update just that region in the cached ImageData
    const palette = getPalette();
    updateOverlayRegionWithPalette(oimg, mask, palette, x0, y0, x1 - x0, y1 - y0);

    octx.putImageData(oimg, 0, 0, x0, y0, x1 - x0, y1 - y0);
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

  function rerenderOverlayFull() {
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
  }

  // ---------- Zoom / Fit ----------
  function applyZoom(z: number) {
    const base = baseCanvasRef.current;
    const over = overlayCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!base || !over || !preview) return;

    const iw = base.width;
    const ih = base.height;

    const dispW = Math.max(1, Math.floor(iw * z));
    const dispH = Math.max(1, Math.floor(ih * z));

    base.style.width = `${dispW}px`;
    base.style.height = `${dispH}px`;
    over.style.width = `${dispW}px`;
    over.style.height = `${dispH}px`;
    preview.style.width = `${dispW}px`;
    preview.style.height = `${dispH}px`;
  }

  function fitToContainer() {
    const wrap = containerRef.current;
    const base = baseCanvasRef.current;
    if (!wrap || !base) return;

    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;

    const iw = base.width;
    const ih = base.height;

    if (!iw || !ih) return;

    const z = Math.min(cw / iw, ch / ih, 1);
    setZoom(z);
    applyZoom(z);
  }

  // ---------- Coords ----------
  function canvasToImageCoords(evt: React.PointerEvent<HTMLCanvasElement>) {
    const over = overlayCanvasRef.current!;
    const rect = over.getBoundingClientRect();
    const sx = over.width / rect.width;
    const sy = over.height / rect.height;

    const x = Math.floor((evt.clientX - rect.left) * sx);
    const y = Math.floor((evt.clientY - rect.top) * sy);
    return { x, y };
  }

  function clearPreview() {
    const ctx = previewCtxRef.current;
    const c = previewCanvasRef.current;
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function drawLassoPreview(points: Point[], hover?: Point | null, showHandles = false) {
    const ctx = previewCtxRef.current;
    const c = previewCanvasRef.current;
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (points.length === 0 && !hover) return;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillStyle = "rgba(220, 220, 220, 0.45)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
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
      ctx.strokeStyle = "rgba(20, 20, 20, 0.9)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
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

  function resetLasso() {
    lassoActiveRef.current = false;
    lassoPointsRef.current = [];
    lassoDragIndexRef.current = null;
    clearPreview();
  }

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
    dirtyMaskRef.current = true;
    scheduleAutosave();
    resetLasso();
  }

  // ---------- Autosave ----------
  function scheduleAutosave() {
    if (!loadedOnceRef.current) return; // nicht während initial load
    if (!canEdit) return;

    dirtyMaskRef.current = true;
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
    try {
      setStatus("Saving…");

      const bytes = mask.data; // Uint8Array
      const blob = new Blob([bytes], { type: "application/octet-stream" });

      // 1) presign (contentType muss rein)
      const pres = await fetch(API_MASK_PRESIGN(imageId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: blob.type,
          // falls dein presign endpoint mehr will, kannst du hier erweitern
        }),
      });

      if (!pres.ok) {
        const t = await pres.text().catch(() => "");
        throw new Error(`PRESIGN_FAILED ${pres.status}: ${t}`);
      }

      const { uploadUrl, key } = await pres.json();

      // 2) upload raw u8
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": blob.type },
        body: blob,
      });

      if (!put.ok) {
        const t = await put.text().catch(() => "");
        throw new Error(`UPLOAD_FAILED ${put.status}: ${t}`);
      }

      // 3) commit DB
      const com = await fetch(API_MASK_COMMIT(imageId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        // zur Kompatibilität: width/height/size mitsenden (auch wenn DB es nicht speichert)
        body: JSON.stringify({
          key,
          size: blob.size,
          width: mask.width,
          height: mask.height,
          format: "u8raw-v1",
          contentType: blob.type,
        }),
      });

      if (!com.ok) {
        const t = await com.text().catch(() => "");
        throw new Error(`COMMIT_FAILED ${com.status}: ${t}`);
      }

      dirtyMaskRef.current = false;
      setStatus("Saved");
      setTimeout(() => setStatus(""), 800);
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message ?? "Save failed");
    } finally {
      savingRef.current = false;
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        await saveMaskNow();
      }
    }
  }

  function getPalette() {
    if (!paletteRef.current || paletteOpacityRef.current !== opacity) {
      paletteRef.current = buildPalette(labels, opacity);
      paletteOpacityRef.current = opacity;
    }
    return paletteRef.current;
  }

  // ---------- Load latest mask ----------
  async function fetchLatestMaskBytes(signal?: AbortSignal) {
    const res = await fetch(API_MASK_LATEST(imageId), { method: "GET", signal });
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
  }

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
    })();

    // Start mask fetch early so it can download while the image loads.
    if (maskFetchAbortRef.current) {
      maskFetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    maskFetchAbortRef.current = controller;
    pendingMaskRef.current = { imageId, promise: fetchLatestMaskBytes(controller.signal) };
    return () => {
      alive = false;
      if (maskFetchAbortRef.current) {
        maskFetchAbortRef.current.abort();
        maskFetchAbortRef.current = null;
      }
    };
  }, [imageId]);

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
          pending && pending.imageId === imageId
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
  }, [imgUrl, imageId]);

  // Opacity affects palette => full redraw (rare)
  useEffect(() => {
    paletteRef.current = null;
    rerenderOverlayFull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opacity]);

  // Apply zoom
  useEffect(() => {
    applyZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Fit on resize
  useEffect(() => {
    const onResize = () => fitToContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    resetLasso();
    draggingRef.current = false;
    lastPtRef.current = null;
  }, [tool]);

  // ---------- Painting ----------
function stamp(x: number, y: number) {
  const mask = maskRef.current;
  if (!mask) return;

  const patch = applyBrush(mask, x, y, brushRadius, activeLabel);
  currentStrokeRef.current.push(patch);
  queueOverlayUpdate(patch.x, patch.y, patch.w, patch.h);

  // nur markieren, nicht speichern
  dirtyMaskRef.current = true;
}

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canEdit) return;
    if (!maskRef.current) return;
    e.preventDefault();

    const p = canvasToImageCoords(e);

    if (tool === "brush") {
      draggingRef.current = true;
      currentStrokeRef.current = [];
      redoRef.current = []; // new action kills redo
      lastPtRef.current = p;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
      stamp(p.x, p.y);
      return;
    }

    if (tool === "lasso_free") {
      lassoActiveRef.current = true;
      lassoPointsRef.current = [p];
      redoRef.current = [];
      drawLassoPreview(lassoPointsRef.current);
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
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
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
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
    if (tool === "brush") {
      draggingRef.current = false;
      lastPtRef.current = null;
      finishStroke();
      try {
        (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (tool === "lasso_free") {
      if (lassoActiveRef.current) {
        lassoActiveRef.current = false;
        try {
          (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        } catch {}
        commitLasso(lassoPointsRef.current.slice());
      }
      return;
    }

    if (tool === "lasso_poly") {
      if (lassoDragIndexRef.current !== null) {
        lassoDragIndexRef.current = null;
        try {
          (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        } catch {}
        drawLassoPreview(lassoPointsRef.current, null, true);
      }
      return;
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

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canEdit) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        redo();
      }

      if (e.key === "Escape") {
        resetLasso();
      }

      if (tool === "lasso_poly" && e.key === "Enter") {
        e.preventDefault();
        commitLasso(lassoPointsRef.current.slice());
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, tool]);

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
  return (
    <div className="rounded-lg overflow-hidden border border-gray-800 bg-gray-900 text-white">
      <div className="border-b border-gray-800 bg-gray-900 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              className={`rounded-md px-2 py-1 text-sm ${
                tool === "brush" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-800 hover:bg-gray-700"
              }`}
              onClick={() => setTool("brush")}
              disabled={!canEdit}
            >
              Brush
            </button>
            <button
              className={`rounded-md px-2 py-1 text-sm ${
                tool === "lasso_free" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-800 hover:bg-gray-700"
              }`}
              onClick={() => setTool("lasso_free")}
              disabled={!canEdit}
            >
              Lasso
            </button>
            <button
              className={`rounded-md px-2 py-1 text-sm ${
                tool === "lasso_poly" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-800 hover:bg-gray-700"
              }`}
              onClick={() => setTool("lasso_poly")}
              disabled={!canEdit}
            >
              Polygon
            </button>
            <div className="ml-3 flex items-center gap-2 text-xs text-gray-200">
              <span>Tool Size: {brushRadius}px</span>
              <input
                type="range"
                min={1}
                max={120}
                value={brushRadius}
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                disabled={!canEdit || tool === "lasso_poly"}
                className="w-28"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => setActiveLabel(label.id)}
                disabled={!canEdit}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                  activeLabel === label.id ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: `rgb(${label.rgb[0]}, ${label.rgb[1]}, ${label.rgb[2]})` }}
                />
                <span>{label.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-200">
            <span>Mask Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="w-28"
            />
            <span className="tabular-nums w-10">{Math.round(opacity * 100)}%</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button className="rounded-md bg-gray-800 px-2 py-1 hover:bg-gray-700" onClick={undo} disabled={!canEdit}>
            Undo
          </button>
          <button className="rounded-md bg-gray-800 px-2 py-1 hover:bg-gray-700" onClick={redo} disabled={!canEdit}>
            Redo
          </button>
          <button className="rounded-md bg-gray-800 px-2 py-1 hover:bg-gray-700" onClick={fitToContainer}>
            Fit
          </button>
          <button
            className="rounded-md bg-gray-800 px-2 py-1 hover:bg-gray-700"
            onClick={() => void saveMaskNow()}
            disabled={!canEdit}
          >
            Save now
          </button>
          <button className="rounded-md bg-gray-800 px-2 py-1 hover:bg-gray-700" onClick={() => void exportMaskPng()}>
            Export PNG
          </button>
          <div className="ml-auto flex items-center gap-3">
            {status && <div className="text-xs text-red-400">{status}</div>}
            <div className="flex items-center gap-2 text-xs text-gray-200">
              <span>Zoom</span>
              <input
                type="range"
                min={5}
                max={300}
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(clamp(Number(e.target.value) / 100, 0.05, 3))}
                className="w-28"
              />
              <span className="tabular-nums w-10">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full h-[70vh] overflow-auto bg-gray-950">
        <div className="relative inline-block">
          <canvas ref={baseCanvasRef} className="block" />
          <canvas
            ref={overlayCanvasRef}
            className="absolute left-0 top-0 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
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
