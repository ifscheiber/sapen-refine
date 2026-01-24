"use client";

import { useState, useEffect } from "react";
import { TabSidebar, ImageItem, Project, ImageMetadata } from "@/components/TabSidebar";
import { AnnotationCanvas, DrawingTool, AnnotationLabel } from "@/components/AnnotationCanvas";
import { EditorToolsBar } from "@/components/EditorToolsBar";
import { AppFooter } from "@/components/AppFooter";

// Mock data
const mockProjects: Project[] = [
  {
    id: "proj-001",
    name: "Wood Penetration Study 2025",
    referenceId: "WPS-2025-001",
    createdBy: "Dr. Schmidt",
    createdAt: "2025-01-10",
    description: "Baseline annotation set for treated pine samples.",
  },
  {
    id: "proj-002",
    name: "Sapwood Analysis Project",
    referenceId: "SAP-2024-042",
    createdBy: "M. Anderson",
    createdAt: "2024-12-08",
    description: "Comparative sapwood segmentation across treatments.",
  },
];

const mockImages: ImageItem[] = [
  {
    id: "img-001",
    filename: "WS_Sample_001.jpg",
    thumbnail: "https://images.unsplash.com/photo-1709099152713-fa91965cc131?w=200&h=150&fit=crop",
    status: "reviewed",
    lastModified: "2025-01-20 14:32",
    lastAnnotator: "Dr. Schmidt",
    projectId: "proj-001",
  },
  {
    id: "img-002",
    filename: "WS_Sample_002.jpg",
    thumbnail: "https://images.unsplash.com/photo-1611600700192-d87eaeed4f81?w=200&h=150&fit=crop",
    status: "annotated",
    lastModified: "2025-01-20 11:15",
    lastAnnotator: "Dr. Schmidt",
    projectId: "proj-001",
  },
  {
    id: "img-003",
    filename: "WS_Sample_003.jpg",
    thumbnail: "https://images.unsplash.com/photo-1763566440117-e69cf2090625?w=200&h=150&fit=crop",
    status: "in_progress",
    lastModified: "2025-01-21 09:45",
    lastAnnotator: "M. Anderson",
    hasUnsavedChanges: true,
    projectId: "proj-001",
  },
  {
    id: "img-004",
    filename: "WS_Sample_004.jpg",
    thumbnail: "https://images.unsplash.com/photo-1680538993934-f81adb9e7828?w=200&h=150&fit=crop",
    status: "not_annotated",
    lastModified: "2025-01-19 16:20",
    lastAnnotator: "—",
    projectId: "proj-001",
  },
  {
    id: "img-005",
    filename: "WS_Sample_005.jpg",
    thumbnail: "https://images.unsplash.com/photo-1709099152713-fa91965cc131?w=200&h=150&fit=crop",
    status: "not_annotated",
    lastModified: "2025-01-19 16:20",
    lastAnnotator: "—",
    projectId: "proj-002",
  },
  {
    id: "img-006",
    filename: "WS_Sample_006.jpg",
    thumbnail: "https://images.unsplash.com/photo-1611600700192-d87eaeed4f81?w=200&h=150&fit=crop",
    status: "in_progress",
    lastModified: "2025-01-20 10:30",
    lastAnnotator: "M. Anderson",
    projectId: "proj-002",
  },
];

const annotationLabels: AnnotationLabel[] = [
  { id: "background", name: "Background", color: "#1f2937" },
  { id: "sapwood", name: "Sapwood", color: "#fbbf24" },
  { id: "heartwood", name: "Heartwood", color: "#b91c1c" },
  { id: "penetration", name: "Penetration", color: "#3b82f6" },
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [selectedProject, setSelectedProject] = useState(mockProjects[0].id);
  const [images, setImages] = useState<ImageItem[]>(mockImages);
  const [selectedImage, setSelectedImage] = useState<string | null>(mockImages[0].id);
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
  const currentUser = { name: "Dr. Schmidt", role: "Reviewer" };

  const [metadata, setMetadata] = useState<ImageMetadata>({
    imageId: "WS_Sample_001",
    projectReference: "WPS-2025-001",
    annotator: "Dr. Schmidt",
    status: "reviewed",
    lastModified: "2025-01-20 14:32",
    notes: "Clear distinction between sapwood and heartwood. Penetration depth measured at 12mm.",
    treatmentId: "TRT-450",
    woodSpecies: "Pinus sylvestris",
    experimentId: "EXP-2025-A3",
  });

  // Current image URL
  const currentImage = images.find((img) => img.id === selectedImage);
  const currentImageUrl = currentImage?.thumbnail.replace("w=200&h=150&fit=crop", "w=1200") || "";

  // Autosave simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (maskHistory.index >= 0) {
        setSaveStatus("saving");
        setTimeout(() => {
          setSaveStatus("saved");
          const now = new Date();
          setLastSaveTime(
            `${now.getHours().toString().padStart(2, "0")}:${now
              .getMinutes()
              .toString()
              .padStart(2, "0")}`
          );
        }, 1000);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [maskHistory.index]);

  useEffect(() => {
    const projectImages = images.filter((img) => img.projectId === selectedProject);
    if (projectImages.length === 0) {
      setSelectedImage(null);
      setMetadata({
        imageId: "",
        projectReference: projects.find((p) => p.id === selectedProject)?.referenceId || "",
        annotator: "",
        status: "not_annotated",
        lastModified: "",
        notes: "",
        treatmentId: "",
        woodSpecies: "",
        experimentId: "",
      });
      setMaskHistory({ items: [], index: 0 });
      return;
    }

    if (!projectImages.some((img) => img.id === selectedImage)) {
      const nextImage = projectImages[0];
      setSelectedImage(nextImage.id);
      setMetadata({
        imageId: nextImage.filename,
        projectReference: projects.find((p) => p.id === selectedProject)?.referenceId || "",
        annotator: nextImage.lastAnnotator,
        status: nextImage.status,
        lastModified: nextImage.lastModified,
        notes: "",
        treatmentId: "",
        woodSpecies: "",
        experimentId: "",
      });
      setMaskHistory({ items: [], index: 0 });
    }
  }, [images, selectedProject, selectedImage, projects]);

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
      setMetadata({
        imageId: image.filename,
        projectReference: projects.find((p) => p.id === selectedProject)?.referenceId || "",
        annotator: image.lastAnnotator,
        status: image.status,
        lastModified: image.lastModified,
        notes: "",
        treatmentId: "",
        woodSpecies: "",
        experimentId: "",
      });
    }
    setMaskHistory({ items: [], index: 0 });
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const isAllowedImageFile = (file: File) => {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/tiff"]);
    if (allowedTypes.has(file.type)) return true;
    const lowerName = file.name.toLowerCase();
    return lowerName.endsWith(".tif") || lowerName.endsWith(".tiff");
  };

  const handleAddImages = (files: File[]) => {
    const validFiles = files.filter(isAllowedImageFile);
    if (validFiles.length === 0) return;

    const newImages: ImageItem[] = validFiles.map((file, index) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `img-${Date.now()}-${index}`;

      return {
        id,
        filename: file.name,
        thumbnail: URL.createObjectURL(file),
        status: "not_annotated",
        lastModified: formatDateTime(file.lastModified),
        lastAnnotator: "You",
        projectId: selectedProject,
      };
    });

    setImages((prev) => [...newImages, ...prev]);
    setSelectedImage(newImages[0].id);
    setMetadata({
      imageId: newImages[0].filename,
      projectReference: projects.find((p) => p.id === selectedProject)?.referenceId || "",
      annotator: "You",
      status: "not_annotated",
      lastModified: newImages[0].lastModified,
      notes: "",
      treatmentId: "",
      woodSpecies: "",
      experimentId: "",
    });
    setMaskHistory({ items: [], index: 0 });
  };

  const handleCreateProject = (data: {
    name: string;
    createdBy: string;
    createdAt: string;
    description?: string;
  }) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `proj-${Date.now()}`;
    const referenceId = `PRJ-${Date.now()}`;
    const newProject: Project = {
      id,
      name: data.name.trim(),
      referenceId,
      createdBy: data.createdBy.trim(),
      createdAt: data.createdAt,
      description: data.description?.trim() || "",
    };

    setProjects((prev) => [newProject, ...prev]);
    setSelectedProject(id);
  };

  const handleDraw = (data: ImageData) => {
    setMaskHistory((prev) => {
      const base =
        prev.items.length === 0 ? [new ImageData(data.width, data.height)] : prev.items;
      const trimmed = base.slice(0, prev.index + 1);
      const nextItems = [...trimmed, data];
      const maxStates = maxHistorySteps + 1;
      if (nextItems.length > maxStates) {
        nextItems.splice(1, 1);
      }
      return { items: nextItems, index: nextItems.length - 1 };
    });
  };

  const handleUndo = () => {
    setMaskHistory((prev) =>
      prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev
    );
  };

  const handleRedo = () => {
    setMaskHistory((prev) =>
      prev.index < prev.items.length - 1
        ? { ...prev, index: prev.index + 1 }
        : prev
    );
  };

  const currentProject = projects.find((p) => p.id === selectedProject);
  const projectImages = images.filter((img) => img.projectId === selectedProject);
  const annotatedCount = projectImages.filter(
    (img) => img.status === "annotated" || img.status === "reviewed"
  ).length;
  const canUndo = maskHistory.index > 0;
  const canRedo = maskHistory.index < maskHistory.items.length - 1;
  const historyStep = Math.max(0, maskHistory.index);
  const currentMask =
    maskHistory.items.length > 0 ? maskHistory.items[maskHistory.index] : null;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Main 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Tab-based Sidebar */}
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

        {/* Right Column: Main Canvas */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <AnnotationCanvas
            imageUrl={currentImageUrl}
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

      {/* Footer */}
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
