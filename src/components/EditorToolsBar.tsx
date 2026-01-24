import { Paintbrush, Lasso, RefreshCw, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { DrawingTool, AnnotationLabel } from "@/components/AnnotationCanvas";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorToolsBarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeLabel: string;
  onLabelChange: (labelId: string) => void;
  labels: AnnotationLabel[];
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  maskOpacity: number;
  onMaskOpacityChange: (opacity: number) => void;
}

export function EditorToolsBar({
  activeTool,
  onToolChange,
  activeLabel,
  onLabelChange,
  labels,
  brushSize,
  onBrushSizeChange,
  maskOpacity,
  onMaskOpacityChange,
}: EditorToolsBarProps) {
  const drawingTools = [
    { type: "brush" as const, icon: Paintbrush, label: "Brush" },
    { type: "lasso" as const, icon: Lasso, label: "Lasso" },
    { type: "relabel" as const, icon: RefreshCw, label: "Relabel Tool" },
  ];

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-3 text-white">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 justify-start">
          {drawingTools.map((tool) => (
            <Tooltip key={tool.type}>
              <TooltipTrigger asChild>
                <Button
                  onClick={() =>
                    onToolChange({ type: tool.type, size: brushSize })
                  }
                  variant={activeTool.type === tool.type ? "default" : "ghost"}
                  size="sm"
                  className={`${
                    activeTool.type === tool.type
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "text-white hover:bg-gray-700"
                  }`}
                >
                  <tool.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          ))}
          <div className="flex items-center gap-2 ml-4">
            <Label className="text-xs text-gray-200">
              Tool Size: {brushSize}px
            </Label>
            <Slider
              value={[brushSize]}
              onValueChange={(value) => onBrushSizeChange(value[0])}
              min={1}
              max={50}
              step={1}
              className="w-32"
            />
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 justify-center">
          {labels.map((label) => (
            <Button
              key={label.id}
              onClick={() => onLabelChange(label.id)}
              variant={activeLabel === label.id ? "default" : "ghost"}
              size="sm"
              className={`${
                activeLabel === label.id
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-white hover:bg-gray-700"
              }`}
            >
              <Circle
                className="h-3 w-3 fill-current"
                style={{ color: label.color }}
              />
              <span className="ml-2 text-xs">{label.name}</span>
            </Button>
          ))}
        </div>

        <div className="flex flex-1 items-center gap-2 justify-end ml-6">
          <Label className="text-xs text-gray-200">Mask Opacity</Label>
          <Slider
            value={[maskOpacity]}
            onValueChange={(value) => onMaskOpacityChange(value[0])}
            min={0}
            max={100}
            step={1}
            className="w-32"
          />
          <span className="text-xs text-gray-200">{maskOpacity}%</span>
        </div>
      </div>
    </div>
  );
}
