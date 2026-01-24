import {
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Paintbrush,
  Lasso,
  RefreshCw,
  Undo2,
  Redo2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface DrawingTool {
  type: "pan" | "brush" | "lasso" | "relabel";
  size?: number;
}

export interface AnnotationLabel {
  id: string;
  name: string;
  color: string;
}

interface ToolPanelProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeLabel: string;
  onLabelChange: (labelId: string) => void;
  labels: AnnotationLabel[];
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  historyStep: number;
  maxHistorySteps: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function ToolPanel({
  activeTool,
  onToolChange,
  activeLabel,
  onLabelChange,
  labels,
  brushSize,
  onBrushSizeChange,
  historyStep,
  maxHistorySteps,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolPanelProps) {
  const navigationTools = [
    { type: "pan" as const, icon: Move, label: "Pan" },
    { type: "zoom_in" as const, icon: ZoomIn, label: "Zoom In" },
    { type: "zoom_out" as const, icon: ZoomOut, label: "Zoom Out" },
    { type: "fit" as const, icon: Maximize2, label: "Fit to Screen" },
    { type: "reset" as const, icon: RotateCcw, label: "Reset Zoom" },
  ];

  const drawingTools = [
    { type: "brush" as const, icon: Paintbrush, label: "Brush" },
    { type: "lasso" as const, icon: Lasso, label: "Lasso" },
    { type: "relabel" as const, icon: RefreshCw, label: "Relabel Tool" },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
      <div className="p-4 space-y-6">
        {/* Navigation Tools */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">
            Navigation
          </h3>
          <div className="space-y-1">
            {navigationTools.map((tool) => (
              <Button
                key={tool.type}
                onClick={() =>
                  onToolChange({
                    type: tool.type === "pan" ? "pan" : activeTool.type,
                  })
                }
                variant={
                  activeTool.type === tool.type ? "default" : "ghost"
                }
                size="sm"
                className={`w-full justify-start ${
                  activeTool.type === tool.type
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : ""
                }`}
                title={tool.label}
              >
                <tool.icon className="w-4 h-4 mr-2" />
                {tool.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Drawing Tools */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">
            Drawing & Editing
          </h3>
          <div className="space-y-1">
            {drawingTools.map((tool) => (
              <Button
                key={tool.type}
                onClick={() => onToolChange({ type: tool.type, size: brushSize })}
                variant={
                  activeTool.type === tool.type ? "default" : "ghost"
                }
                size="sm"
                className={`w-full justify-start ${
                  activeTool.type === tool.type
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : ""
                }`}
                title={tool.label}
              >
                <tool.icon className="w-4 h-4 mr-2" />
                {tool.label}
              </Button>
            ))}
          </div>

          {/* Brush Size */}
          {(activeTool.type === "brush" || activeTool.type === "lasso") && (
            <div className="mt-4 px-1">
              <Label className="text-xs text-gray-600 mb-2 block">
                Brush Size: {brushSize}px
              </Label>
              <Slider
                value={[brushSize]}
                onValueChange={(value) => onBrushSizeChange(value[0])}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Label Selection */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">
            Active Label
          </h3>
          <div className="space-y-1">
            {labels.map((label) => (
              <Button
                key={label.id}
                onClick={() => onLabelChange(label.id)}
                variant={activeLabel === label.id ? "default" : "ghost"}
                size="sm"
                className={`w-full justify-start ${
                  activeLabel === label.id
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : ""
                }`}
              >
                <Circle
                  className="w-3 h-3 mr-2 fill-current"
                  style={{ color: label.color }}
                />
                {label.name}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* History / Undo */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">
            History
          </h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={onUndo}
                disabled={!canUndo}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                Undo
              </Button>
              <Button
                onClick={onRedo}
                disabled={!canRedo}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Redo2 className="w-4 h-4 mr-1" />
                Redo
              </Button>
            </div>
            <div className="text-xs text-gray-500 text-center">
              Step {historyStep} / {maxHistorySteps}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
