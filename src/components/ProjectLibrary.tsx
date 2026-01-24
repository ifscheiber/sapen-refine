import { useState } from "react";
import { ChevronDown, Plus, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

export interface Project {
  id: string;
  name: string;
  referenceId: string;
}

interface ProjectLibraryProps {
  projects: Project[];
  selectedProject: string;
  onProjectChange: (projectId: string) => void;
  images: ImageItem[];
  selectedImage: string | null;
  onImageSelect: (imageId: string) => void;
  onCreateProject: () => void;
}

const statusConfig = {
  not_annotated: { label: "Not annotated", color: "bg-gray-400" },
  in_progress: { label: "In progress", color: "bg-blue-500" },
  annotated: { label: "Annotated", color: "bg-green-500" },
  reviewed: { label: "Reviewed", color: "bg-purple-500" },
};

export function ProjectLibrary({
  projects,
  selectedProject,
  onProjectChange,
  images,
  selectedImage,
  onImageSelect,
  onCreateProject,
}: ProjectLibraryProps) {
  const currentProject = projects.find((p) => p.id === selectedProject);

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
      {/* Project Selector */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="space-y-3">
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
          
          {currentProject && (
            <div className="text-xs text-gray-500">
              Ref: {currentProject.referenceId}
            </div>
          )}

          <Button
            onClick={onCreateProject}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Image Library */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => onImageSelect(image.id)}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left hover:border-blue-300 ${
                  selectedImage === image.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative mb-2">
                  <img
                    src={image.thumbnail}
                    alt={image.filename}
                    className="w-full h-24 object-cover rounded"
                  />
                  {image.hasUnsavedChanges && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </div>

                {/* Filename */}
                <div className="text-sm font-medium text-gray-900 mb-2 truncate">
                  {image.filename}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 mb-2">
                  <Circle
                    className={`w-2 h-2 fill-current ${statusConfig[image.status].color} text-transparent`}
                  />
                  <span className="text-xs text-gray-600">
                    {statusConfig[image.status].label}
                  </span>
                </div>

                {/* Metadata */}
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Modified: {image.lastModified}</div>
                  <div>By: {image.lastAnnotator}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
