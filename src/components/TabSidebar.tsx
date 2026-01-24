"use client";

import { useRef, useState } from "react";
import { Plus, Circle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ImageItem {
  id: string;
  filename: string;
  thumbnail: string;
  status: "not_annotated" | "in_progress" | "annotated" | "reviewed";
  lastModified: string;
  lastAnnotator: string;
  hasUnsavedChanges?: boolean;
  projectId: string;
}

export interface Project {
  id: string;
  name: string;
  referenceId: string;
  createdBy: string;
  createdAt: string;
  description?: string;
}

export interface ImageMetadata {
  imageId: string;
  projectReference: string;
  annotator: string;
  status: "not_annotated" | "in_progress" | "annotated" | "reviewed";
  lastModified: string;
  notes: string;
  treatmentId?: string;
  woodSpecies?: string;
  experimentId?: string;
}

interface TabSidebarProps {
  // Project & Images
  projects: Project[];
  selectedProject: string;
  onProjectChange: (projectId: string) => void;
  images: ImageItem[];
  selectedImage: string | null;
  onImageSelect: (imageId: string) => void;
  onCreateProject: (data: {
    name: string;
    createdBy: string;
    createdAt: string;
    description?: string;
  }) => void;
  onAddImages: (files: File[]) => void;

  // Metadata
  metadata: ImageMetadata;
  onMetadataChange: (metadata: ImageMetadata) => void;
  currentUser: {
    name: string;
    role: string;
  };
}

const statusConfig = {
  not_annotated: { label: "Not annotated", color: "bg-gray-400" },
  in_progress: { label: "In progress", color: "bg-blue-500" },
  annotated: { label: "Annotated", color: "bg-green-500" },
  reviewed: { label: "Reviewed", color: "bg-purple-500" },
};

export function TabSidebar({
  projects,
  selectedProject,
  onProjectChange,
  images,
  selectedImage,
  onImageSelect,
  onCreateProject,
  onAddImages,   // ADDED
  metadata,
  onMetadataChange,
  currentUser,
}: TabSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | ImageItem["status"]>("all");
  const [sortOrder, setSortOrder] = useState<"modified_desc" | "modified_asc" | "name_asc" | "name_desc">(
    "modified_desc"
  );
  const [projectName, setProjectName] = useState("");
  const [projectCreator, setProjectCreator] = useState("");
  const [projectCreatedAt, setProjectCreatedAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [projectDescription, setProjectDescription] = useState("");

  const updateMetadataField = <K extends keyof ImageMetadata>(
    field: K,
    value: ImageMetadata[K]
  ) => {
    onMetadataChange({ ...metadata, [field]: value });
  };
  const canSetReviewed = currentUser.role === "Reviewer" || currentUser.role === "Admin";

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    onAddImages(Array.from(event.target.files));
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!event.dataTransfer.files.length) return;
    onAddImages(Array.from(event.dataTransfer.files));
  };

  const handleOpenCreateDialog = () => {
    setProjectName("");
    setProjectCreator("");
    setProjectCreatedAt(new Date().toISOString().slice(0, 10));
    setProjectDescription("");
    setIsCreateOpen(true);
  };

  const handleCreateProject = () => {
    if (!projectName.trim() || !projectCreator.trim() || !projectCreatedAt) return;
    onCreateProject({
      name: projectName,
      createdBy: projectCreator,
      createdAt: projectCreatedAt,
      description: projectDescription,
    });
    setIsCreateOpen(false);
  };

  const handleSelectImage = (imageId: string) => {
    onImageSelect(imageId);
    setIsGalleryOpen(false);
  };

  const parseModifiedDate = (value: string) => {
    const normalized = value.replace(" ", "T");
    const parsed = Date.parse(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortedImages = [...images].sort((a, b) => {
    if (sortOrder === "name_asc") return a.filename.localeCompare(b.filename);
    if (sortOrder === "name_desc") return b.filename.localeCompare(a.filename);
    const diff = parseModifiedDate(a.lastModified) - parseModifiedDate(b.lastModified);
    return sortOrder === "modified_asc" ? diff : -diff;
  });
  const filteredImages =
    filterStatus === "all"
      ? sortedImages
      : sortedImages.filter((image) => image.status === filterStatus);
  const recentImages = [...images]
    .sort((a, b) => parseModifiedDate(b.lastModified) - parseModifiedDate(a.lastModified))
    .slice(0, 6);

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      <Tabs defaultValue="images" className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-gray-200 bg-white">
          <TabsTrigger value="images" className="text-xs">
            Project & Images
          </TabsTrigger>
          <TabsTrigger value="metadata" className="text-xs">
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Project & Images */}
        <TabsContent value="images" className="flex-1 overflow-hidden m-0 p-0">
          <div className="h-full flex flex-col">
            {/* Project Selector */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="space-y-3">
                <Button
                  onClick={handleOpenCreateDialog}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
                <div>
                  <Label className="text-xs text-gray-600 mb-1.5 block">
                    Project
                  </Label>
                  <Select value={selectedProject} onValueChange={onProjectChange}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Image List */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  <Button
                    onClick={() => setIsGalleryOpen(true)}
                    size="sm"
                    className="w-full justify-center"
                  >
                    Open Project Gallery
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    {recentImages.map((image) => (
                      <button
                        key={image.id}
                        onClick={() => onImageSelect(image.id)}
                        className={`relative overflow-hidden rounded-md border outline outline-2 ${
                          selectedImage === image.id
                            ? "border-blue-500 outline-blue-500"
                            : "border-gray-200 outline-transparent"
                        }`}
                        title={image.filename}
                      >
                        <img
                          src={image.thumbnail}
                          alt={image.filename}
                          className="h-20 w-full object-cover"
                        />
                        {image.hasUnsavedChanges && (
                          <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Upload Images */}
            <div
              className={`border-t border-gray-200 bg-white p-3 ${
                isDragging ? "bg-blue-50" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/tiff,.tif,.tiff"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div
                className={`rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
                  isDragging ? "border-blue-500" : "border-gray-200"
                }`}
              >
                <div className="text-xs text-gray-600 mb-2">
                  Drag and drop PNG, JPEG, or TIFF images here
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Upload Images
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Metadata */}
        <TabsContent value="metadata" className="flex-1 overflow-hidden m-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Image Metadata */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Image Metadata
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Image ID
                    </Label>
                    <Input
                      value={metadata.imageId}
                      disabled
                      className="bg-gray-100 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Project Reference
                    </Label>
                    <Input
                      value={metadata.projectReference}
                      onChange={(e) =>
                        updateMetadataField("projectReference", e.target.value)
                      }
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Annotator
                    </Label>
                    <Input
                      value={metadata.annotator}
                      disabled
                      className="bg-gray-100 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Annotation Status
                    </Label>
                    <Select
                      value={metadata.status}
                      onValueChange={(value) =>
                        updateMetadataField("status", value as ImageMetadata["status"])
                      }
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_annotated">Not annotated</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="annotated">Annotated</SelectItem>
                      <SelectItem value="reviewed" disabled={!canSetReviewed}>
                        Reviewed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!canSetReviewed && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Only reviewers can set status to Reviewed.
                    </p>
                  )}
                </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Last Modified
                    </Label>
                    <Input
                      value={metadata.lastModified}
                      disabled
                      className="bg-gray-100 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Annotation Notes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Annotation Notes
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Document assumptions, uncertainties, or special cases
                </p>
                <Textarea
                  value={metadata.notes}
                  onChange={(e) => updateMetadataField("notes", e.target.value)}
                  placeholder="Add notes about this annotation..."
                  className="min-h-32 text-sm"
                />
              </div>

              {/* Structured Metadata */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Structured Metadata
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Treatment ID
                    </Label>
                    <Input
                      value={metadata.treatmentId || ""}
                      onChange={(e) => updateMetadataField("treatmentId", e.target.value)}
                      placeholder="Optional"
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Wood Species
                    </Label>
                    <Input
                      value={metadata.woodSpecies || ""}
                      onChange={(e) => updateMetadataField("woodSpecies", e.target.value)}
                      placeholder="Optional"
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Experiment ID
                    </Label>
                    <Input
                      value={metadata.experimentId || ""}
                      onChange={(e) => updateMetadataField("experimentId", e.target.value)}
                      placeholder="Optional"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add project metadata to get started. You can update details later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">
                Project Name
              </Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Sapwood Penetration Study"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">
                Created By
              </Label>
              <Input
                value={projectCreator}
                onChange={(e) => setProjectCreator(e.target.value)}
                placeholder="Name or team"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">
                Created On
              </Label>
              <Input
                type="date"
                value={projectCreatedAt}
                onChange={(e) => setProjectCreatedAt(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">
                Description (optional)
              </Label>
              <Textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Add a short description or goal"
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="flex h-[calc(100vh-4rem)] !w-[calc(65vw-2rem)] !max-w-[calc(65vw-2rem)] flex-col gap-3 overflow-hidden p-4">
          <DialogHeader>
            <DialogTitle>Project Images</DialogTitle>
            <DialogDescription>
              Browse all images in the current project.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Select
              value={filterStatus}
              onValueChange={(value) =>
                setFilterStatus(value as "all" | ImageItem["status"])
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="not_annotated">Not annotated</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="annotated">Annotated</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modified_desc">Modified (newest)</SelectItem>
                <SelectItem value="modified_asc">Modified (oldest)</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 pr-3">
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {filteredImages.map((image) => (
                <button
                  key={image.id}
                  onClick={() => handleSelectImage(image.id)}
                  className={`rounded-lg border-2 p-3 text-left transition-all hover:border-blue-300 ${
                    selectedImage === image.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="relative mb-2">
                    <img
                      src={image.thumbnail}
                      alt={image.filename}
                      className="h-48 w-full rounded object-cover"
                    />
                    {image.hasUnsavedChanges && (
                      <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {image.filename}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 space-y-1">
                    <div>Modified: {image.lastModified}</div>
                    <div className="flex items-center gap-1">
                      <Circle
                        className={`h-2 w-2 fill-current ${statusConfig[image.status].color} text-transparent`}
                      />
                      {statusConfig[image.status].label}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
