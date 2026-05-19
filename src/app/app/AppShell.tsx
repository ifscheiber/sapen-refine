"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TabSidebar, ImageItem, Project, ImageMetadata } from "@/components/TabSidebar";
import { AnnotationCanvas, DrawingTool, AnnotationLabel } from "@/components/AnnotationCanvas";
import { EditorToolsBar } from "@/components/EditorToolsBar";
import { AppFooter } from "@/components/AppFooter";

import {
  apiListProjects,
  apiCreateProject,
  apiListImages,
  apiGetImageViewUrl,
  apiPresignImageUpload,
  apiCommitImage,
} from "@/lib/projectsClient";

import { fetchImageView, apiGetLatestMask, apiPresignMask, apiCommitMask } from "@/lib/imagesApi";

import { serializeMask, deserializeMask } from "@/mask/serialize";
import { MaskBuffer } from "@/mask/maskBuffer";
import { renderOverlay } from "@/mask/renderOverlay";
import { DEFAULT_LABELS } from "@/mask/labels";

// UI label configuration (NOT mock DB data)
const annotationLabels: AnnotationLabel[] = [
  { id: "background", name: "Background", color: "#1f2937" },
  { id: "sapwood", name: "Sapwood", color: "#fbbf24" },
  { id: "heartwood", name: "Heartwood", color: "#b91c1c" },
  { id: "penetration", name: "Penetration", color: "#3b82f6" },
];

function fmt(dt: string) {
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

type PaletteEntry = { id: number; rgb: [number, number, number] };

function nearestLabelIdFast(r: number, g: number, b: number, palette: PaletteEntry[]) {
  let bestId = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const p of palette) {
    const dr = r - p.rgb[0];
    const dg = g - p.rgb[1];
    const db = b - p.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = p.id;
    }
  }

  return bestId;
}

/**
 * Convert overlay ImageData (RGBA) into label bytes (0..n), chunked to avoid UI freezes.
 * Strategy:
 *   - If alpha <= threshold => background (0)
 *   - Exact RGB match => mapped id
 *   - Else => nearest palette color id
 */
async function imageDataToLabelBytesChunked(
  img: ImageData,
  exactMap: Map<number, number>,
  palette: PaletteEntry[],
  alphaThreshold = 16
) {
  const out = new Uint8Array(img.width * img.height);
  const d = img.data;

  // yield every N pixels (tune if needed)
  const YIELD_EVERY = 200_000;

  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const a = d[i + 3];
    if (a <= alphaThreshold) {
      out[p] = 0;
      continue;
    }

    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    const key = (r << 16) | (g << 8) | b;
    const exact = exactMap.get(key);
    out[p] = exact ?? nearestLabelIdFast(r, g, b, palette);

    if (p % YIELD_EVERY === 0) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  return out;
}

export default function App() {
  // --- User (MVP placeholder; later from session) ---
  const currentUser = { name: "You", role: "Annotator" };

  // --- Data from DB ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageViewUrl, setSelectedImageViewUrl] = useState<string>("");

  // --- Editor state ---
  const [activeTool, setActiveTool] = useState<DrawingTool>({ type: "brush" });
  const [activeLabel, setActiveLabel] = useState(annotationLabels[1].id);
  const [brushSize, setBrushSize] = useState(10);
  const [maskOpacity, setMaskOpacity] = useState(60);
  const [isPanMode, setIsPanMode] = useState(false);

  const [maxHistorySteps] = useState(10);
  const [maskHistory, setMaskHistory] = useState<{ items: ImageData[]; index: number }>({
    items: [],
    index: 0,
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);

  // only autosave when user actually changed the mask
  const [maskDirty, setMaskDirty] = useState(false);

  // --- Metadata panel state ---
  const [metadata, setMetadata] = useState<ImageMetadata>({
    imageId: "",
    projectReference: "",
    annotator: "",
    status: "not_annotated",
    lastModified: "",
    notes: "",
    treatmentId: "",
    woodSpecies: "",
    experimentId: "",
  });

  // --- palette used to interpret overlay pixels back to label IDs ---
  // We include DEFAULT_LABELS (canonical) plus the UI label colors (in case canvas paints with those exact RGBs).
  const palette: PaletteEntry[] = useMemo(() => {
    const entries: PaletteEntry[] = [];

    // canonical ids + colors
    for (const l of DEFAULT_LABELS) {
      entries.push({ id: l.id, rgb: [l.rgb[0], l.rgb[1], l.rgb[2]] });
    }

    // UI colors as alternative exact matches
    const uiIdToNumeric: Record<string, number> = {
      background: 0,
      sapwood: 1,
      heartwood: 2,
      penetration: 3,
    };

    for (const l of annotationLabels) {
      const rgb = hexToRgb(l.color);
      if (!rgb) continue;
      const numeric = uiIdToNumeric[l.id] ?? 0;
      entries.push({ id: numeric, rgb });
    }

    // de-dup by (id,rgb)
    const seen = new Set<string>();
    return entries.filter((e) => {
      const k = `${e.id}:${e.rgb[0]},${e.rgb[1]},${e.rgb[2]}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, []);

  // Exact RGB => id map (fast path)
  const exactRgbMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of palette) {
      const key = (p.rgb[0] << 16) | (p.rgb[1] << 8) | p.rgb[2];
      m.set(key, p.id);
    }
    return m;
  }, [palette]);

  // palette for rendering loaded masks (id -> rgba)
function overlayLabelsFromUI() {
  // Map your UI labels to the numeric ids that are stored in the mask bytes
  const uiIdToNumeric: Record<string, number> = {
    background: 0,
    sapwood: 1,
    heartwood: 2,
    penetration: 3,
  };

  return annotationLabels.map((l) => {
    const rgb = hexToRgb(l.color) ?? [255, 255, 255];

    // IMPORTANT:
    // - background should be transparent so you only see overlay where label != 0
    // - others should be full alpha; maskOpacity slider will handle visual transparency
    const alpha = l.id === "background" ? 0 : 255;

    return {
      id: uiIdToNumeric[l.id] ?? 0,
      rgba: [rgb[0], rgb[1], rgb[2], alpha] as [number, number, number, number],
    };
  });
}


  // guard against overlapping saves (older save finishing after a newer one)
  const saveSeq = useRef(0);

  async function saveCurrentMaskNow() {
    if (!selectedImage) return;

    const current = maskHistory.items[maskHistory.index];
    if (!current) return;

    // Convert overlay pixels -> label bytes (chunked, responsive)
    const labelBytes = await imageDataToLabelBytesChunked(current, exactRgbMap, palette);

    const mb = new MaskBuffer(current.width, current.height, 0, labelBytes);
    const bytes = serializeMask(mb);

    const contentType = "application/octet-stream";
    const { uploadUrl, key } = await apiPresignMask(selectedImage, contentType);

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: bytes,
    });

    if (!putRes.ok) throw new Error(`MASK_UPLOAD_FAILED_${putRes.status}`);

    await apiCommitMask(selectedImage, {
      key,
      size: bytes.byteLength,
      width: mb.width,
      height: mb.height,
      format: "u8raw-v1",
    });
  }

  // --- Helpers to load + map DB -> UI types ---
  async function refreshProjects(selectId?: string) {
    const ps = await apiListProjects();
    const mapped: Project[] = ps.map((p) => ({
      id: p.id,
      name: p.name,
      referenceId: p.id.slice(0, 8),
      createdBy: "—",
      createdAt: p.createdAt ? String(p.createdAt) : "",
      description: "",
    }));

    setProjects(mapped);

    const nextSelected =
      selectId ??
      (selectedProject && mapped.some((x) => x.id === selectedProject) ? selectedProject : mapped[0]?.id ?? "");

    setSelectedProject(nextSelected);
  }

  async function refreshImages(projectId: string, selectImageId?: string) {
    const rows = await apiListImages(projectId);

    const urls = await Promise.all(rows.map((r) => apiGetImageViewUrl(projectId, r.id).catch(() => "")));

    const mapped: ImageItem[] = rows.map((r, i) => ({
      id: r.id,
      filename: r.filename ?? "(unnamed)",
      thumbnail: urls[i] || "",
      status: "not_annotated",
      lastModified: fmt(r.createdAt),
      lastAnnotator: "—",
      projectId,
    }));

    setImages(mapped);

    const nextSel =
      selectImageId ??
      (selectedImage && mapped.some((x) => x.id === selectedImage) ? selectedImage : mapped[0]?.id ?? null);

    setSelectedImage(nextSel);

    if (nextSel) {
      const img = mapped.find((x) => x.id === nextSel)!;
      setMetadata((m) => ({
        ...m,
        imageId: img.filename,
        projectReference: projectId.slice(0, 8),
        annotator: currentUser.name,
        status: img.status,
        lastModified: img.lastModified,
        notes: "",
      }));
    }

    setMaskHistory({ items: [], index: 0 });
    setMaskDirty(false);
    setSaveStatus("idle");
    setLastSaveTime(null);
  }

  // Initial load
  useEffect(() => {
    refreshProjects().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When project changes -> load images
  useEffect(() => {
    if (!selectedProject) {
      setImages([]);
      setSelectedImage(null);
      setMaskHistory({ items: [], index: 0 });
      setMaskDirty(false);
      return;
    }

    refreshImages(selectedProject).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Load image view URL for the selected image
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!selectedImage) {
        setSelectedImageViewUrl("");
        return;
      }

      const view = await fetchImageView(selectedImage);
      if (!cancelled) setSelectedImageViewUrl(view.url || "");
    })().catch((e) => {
      console.error(e);
      if (!cancelled) setSelectedImageViewUrl("");
    });

    return () => {
      cancelled = true;
    };
  }, [selectedImage]);

  // Load latest mask for selected image and initialize history
  useEffect(() => {
    if (!selectedImage) {
      setMaskHistory({ items: [], index: 0 });
      setMaskDirty(false);
      return;
    }

    const ac = new AbortController();
    const imageId = selectedImage;

    async function loadLatestMask() {
      try {
        const latest = await apiGetLatestMask(imageId);

        if (!latest.exists) {
          setMaskHistory({ items: [], index: 0 });
          setMaskDirty(false);
          setSaveStatus("idle");
          setLastSaveTime(null);
          return;
        }

        const binRes = await fetch(latest.url, { signal: ac.signal });
        if (!binRes.ok) throw new Error(`MASK_DOWNLOAD_FAILED_${binRes.status}`);

        const buf = await binRes.arrayBuffer();

        // In your app: only MSK1 masks should exist
        const parsed = deserializeMask(buf);

        const mask = new MaskBuffer(parsed.width, parsed.height, 0, parsed.data);
        const overlay = renderOverlay(mask, overlayLabelsFromUI(), 1);


        setMaskHistory({ items: [overlay], index: 0 });
        setMaskDirty(false);
        setSaveStatus("idle");
        setLastSaveTime(null);
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error("Failed to load latest mask", e);
        setMaskHistory({ items: [], index: 0 });
        setMaskDirty(false);
      }
    }

    loadLatestMask();
    return () => ac.abort();
  }, [selectedImage]);

  // Autosave (debounced): only run after user changes the mask
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedImage) return;
      if (!maskDirty) return;

      const mySeq = ++saveSeq.current;

      setSaveStatus("saving");

      saveCurrentMaskNow()
        .then(() => {
          // ignore if a newer save started after this one
          if (mySeq !== saveSeq.current) return;

          setSaveStatus("saved");
          setMaskDirty(false);

          const now = new Date();
          setLastSaveTime(
            `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
          );
        })
        .catch((e) => {
          if (mySeq !== saveSeq.current) return;
          console.error(e);
          setSaveStatus("idle");
        });
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskHistory.index, selectedImage, maskDirty]);

  // --- UI callbacks ---
  const handleToolChange = (tool: DrawingTool) => {
    setActiveTool({ ...tool, size: brushSize });
    setIsPanMode(false);
  };

  const handleBrushSizeChange = (size: number) => {
    setBrushSize(size);
    setActiveTool({ ...activeTool, size });
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImage(imageId);

    const image = images.find((img) => img.id === imageId);
    if (image) {
      setMetadata((m) => ({
        ...m,
        imageId: image.filename,
        projectReference: selectedProject ? selectedProject.slice(0, 8) : "",
        annotator: currentUser.name,
        status: image.status,
        lastModified: image.lastModified,
        notes: "",
      }));
    }

    setMaskHistory({ items: [], index: 0 });
    setMaskDirty(false);
    setSaveStatus("idle");
    setLastSaveTime(null);
  };

  const isAllowedImageFile = (file: File) => {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/tiff"]);
    if (allowedTypes.has(file.type)) return true;

    const lowerName = file.name.toLowerCase();
    return lowerName.endsWith(".tif") || lowerName.endsWith(".tiff");
  };

  const handleAddImages = async (files: File[]) => {
    if (!selectedProject) return;

    const validFiles = files.filter(isAllowedImageFile);
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const { uploadUrl, key } = await apiPresignImageUpload(selectedProject, file);

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!put.ok) throw new Error("UPLOAD_FAILED");

      await apiCommitImage(selectedProject, { key, file });
    }

    await refreshImages(selectedProject);
  };

  const handleCreateProject = async (data: { name: string; createdBy: string; createdAt: string; description?: string }) => {
    const name = data.name?.trim();
    if (!name) return;

    const created = await apiCreateProject(name);
    await refreshProjects(created.id);
  };

  /**
   * IMPORTANT: keep drawing smooth.
   * We do NOT convert ImageData->bytes here anymore.
   * Conversion only happens during debounced autosave.
   */
  const handleDraw = (data: ImageData) => {
    setMaskHistory((prev) => {
      const base = prev.items.length === 0 ? [new ImageData(data.width, data.height)] : prev.items;
      const trimmed = base.slice(0, prev.index + 1);

      const nextItems = [...trimmed, data];
      const maxStates = maxHistorySteps + 1;

      if (nextItems.length > maxStates) {
        // keep baseline at [0], drop one intermediate near the front
        nextItems.splice(1, 1);
      }

      return { items: nextItems, index: nextItems.length - 1 };
    });

    setMaskDirty(true);
    setSaveStatus("idle");
  };

  const handleUndo = () => {
    setMaskHistory((prev) => (prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev));
    setMaskDirty(true);
    setSaveStatus("idle");
  };

  const handleRedo = () => {
    setMaskHistory((prev) => (prev.index < prev.items.length - 1 ? { ...prev, index: prev.index + 1 } : prev));
    setMaskDirty(true);
    setSaveStatus("idle");
  };

  // --- Derived values used by UI ---
  const currentProject = projects.find((p) => p.id === selectedProject) || null;
  const projectImages = images;

  const annotatedCount = projectImages.filter((img) => img.status === "annotated" || img.status === "reviewed").length;

  const canUndo = maskHistory.index > 0;
  const canRedo = maskHistory.index < maskHistory.items.length - 1;
  const historyStep = Math.max(0, maskHistory.index);

  const currentMask = maskHistory.items.length > 0 ? maskHistory.items[maskHistory.index] : null;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0">
          <TabSidebar
            projects={projects}
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            images={projectImages}
            selectedImage={selectedImage}
            onImageSelect={handleImageSelect}
            onCreateProject={handleCreateProject}
            onAddImages={handleAddImages}
            metadata={metadata}
            onMetadataChange={setMetadata}
            currentUser={currentUser}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <AnnotationCanvas
            imageUrl={selectedImageViewUrl || ""}
            activeTool={activeTool}
            activeLabel={activeLabel}
            labels={annotationLabels}
            onDraw={handleDraw}
            maskOpacity={maskOpacity}
            maskImageData={currentMask}
            isPanMode={isPanMode}
            onTogglePanMode={setIsPanMode}
            toolsBar={
              <EditorToolsBar
                activeTool={activeTool}
                onToolChange={handleToolChange}
                activeLabel={activeLabel}
                onLabelChange={setActiveLabel}
                labels={annotationLabels}
                brushSize={brushSize}
                onBrushSizeChange={handleBrushSizeChange}
                maskOpacity={maskOpacity}
                onMaskOpacityChange={setMaskOpacity}
              />
            }
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            historyStep={historyStep}
            maxHistorySteps={maxHistorySteps}
            currentUser={currentUser}
          />
        </div>
      </div>

      <AppFooter
        saveStatus={saveStatus}
        lastSaveTime={lastSaveTime}
        projectName={currentProject?.name || ""}
        annotatedCount={annotatedCount}
        totalCount={projectImages.length}
      />
    </div>
  );
}
