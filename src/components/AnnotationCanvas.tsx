import { useRef, useEffect, useState, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Move, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LogoutButton } from "@/components/LogoutButton";


export interface DrawingTool {
  type: "brush" | "lasso" | "relabel";
  size?: number;
}

export interface AnnotationLabel {
  id: string;
  name: string;
  color: string;
}

interface AnnotationCanvasProps {
  imageUrl: string;
  activeTool: DrawingTool;
  activeLabel: string;
  labels: AnnotationLabel[];
  onDraw: (data: ImageData) => void;
  maskOpacity: number;
  maskImageData: ImageData | null;
  isPanMode: boolean;
  onTogglePanMode: (enabled: boolean) => void;
  toolsBar?: ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  historyStep: number;
  maxHistorySteps: number;
  currentUser: {
    name: string;
    role: string;
  };
}

export function AnnotationCanvas({
  imageUrl,
  activeTool,
  activeLabel,
  labels,
  onDraw,
  maskOpacity,
  maskImageData,
  isPanMode,
  onTogglePanMode,
  toolsBar,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyStep,
  maxHistorySteps,
  currentUser,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ left: 0, top: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const lassoBaseMaskRef = useRef<ImageData | null>(null);

  // Load image
  useEffect(() => {
      if (!imageUrl) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
img.onload = () => {
  setImage(img);

  // Fit-to-screen zoom when new image loads
  const fit = computeFitZoom(img);
  setZoom(fit);

  // Optional: reset scroll position so the image starts at the top-left of the viewport
  if (containerRef.current) {
    containerRef.current.scrollLeft = 0;
    containerRef.current.scrollTop = 0;
  }
};

  }, [imageUrl]);

  // Draw image and mask
  useEffect(() => {
    if (!image || !canvasRef.current || !maskCanvasRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");

    if (!ctx || !maskCtx) return;

    // Set canvas size
    canvas.width = image.width;
    canvas.height = image.height;
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;

    // Draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    // Mask is drawn separately and composited with opacity
  }, [image]);

  useEffect(() => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext("2d");
    if (!ctx) return;

    if (!maskImageData) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      return;
    }

    if (
      maskImageData.width !== maskCanvasRef.current.width ||
      maskImageData.height !== maskCanvasRef.current.height
    ) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      return;
    }

    ctx.putImageData(maskImageData, 0, 0);
  }, [maskImageData, image]);

  const getCanvasCoordinates = (e: React.MouseEvent) => {
    if (!maskCanvasRef.current) return null;

    const rect = maskCanvasRef.current.getBoundingClientRect();
    const scaleX = maskCanvasRef.current.width / rect.width;
    const scaleY = maskCanvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    if (isPanMode) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) {
        scrollStartRef.current = {
          left: containerRef.current.scrollLeft,
          top: containerRef.current.scrollTop,
        };
      }
    } else if (activeTool.type === "lasso") {
      setIsDrawing(true);
      setLastPos(coords);
      lassoPointsRef.current = [coords];
      if (maskCanvasRef.current) {
        const ctx = maskCanvasRef.current.getContext("2d");
        if (ctx) {
          lassoBaseMaskRef.current = ctx.getImageData(
            0,
            0,
            maskCanvasRef.current.width,
            maskCanvasRef.current.height
          );
        }
      }
    } else if (activeTool.type === "relabel") {
      if (!maskCanvasRef.current) return;
      const ctx = maskCanvasRef.current.getContext("2d");
      if (!ctx) return;

      const x = Math.floor(coords.x);
      const y = Math.floor(coords.y);
      if (
        x < 0 ||
        y < 0 ||
        x >= maskCanvasRef.current.width ||
        y >= maskCanvasRef.current.height
      ) {
        return;
      }

      const imageData = ctx.getImageData(
        0,
        0,
        maskCanvasRef.current.width,
        maskCanvasRef.current.height
      );
      const data = imageData.data;
      const idx = (y * imageData.width + x) * 4;
      const source = [
        data[idx],
        data[idx + 1],
        data[idx + 2],
        data[idx + 3],
      ] as const;

      if (source[3] === 0) return;

      const backgroundLabel = labels.find((l) => l.id === "background");
      if (
        backgroundLabel &&
        source[0] === parseInt(backgroundLabel.color.slice(1, 3), 16) &&
        source[1] === parseInt(backgroundLabel.color.slice(3, 5), 16) &&
        source[2] === parseInt(backgroundLabel.color.slice(5, 7), 16)
      ) {
        return;
      }

      const targetLabel = labels.find((l) => l.id === activeLabel);
      if (!targetLabel) return;
      const target = [
        parseInt(targetLabel.color.slice(1, 3), 16),
        parseInt(targetLabel.color.slice(3, 5), 16),
        parseInt(targetLabel.color.slice(5, 7), 16),
        255,
      ] as const;

      if (
        source[0] === target[0] &&
        source[1] === target[1] &&
        source[2] === target[2] &&
        source[3] === target[3]
      ) {
        return;
      }

      const stack: number[] = [x, y];
      const width = imageData.width;
      const height = imageData.height;

      while (stack.length) {
        const cy = stack.pop() as number;
        const cx = stack.pop() as number;
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;

        const i = (cy * width + cx) * 4;
        if (
          data[i] !== source[0] ||
          data[i + 1] !== source[1] ||
          data[i + 2] !== source[2] ||
          data[i + 3] !== source[3]
        ) {
          continue;
        }

        data[i] = target[0];
        data[i + 1] = target[1];
        data[i + 2] = target[2];
        data[i + 3] = target[3];

        stack.push(cx + 1, cy);
        stack.push(cx - 1, cy);
        stack.push(cx, cy + 1);
        stack.push(cx, cy - 1);
      }

      ctx.putImageData(imageData, 0, 0);
      onDraw(imageData);
    } else {
      setIsDrawing(true);
      setLastPos(coords);
      drawAtPoint(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && isPanMode) {
      if (!containerRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = scrollStartRef.current.left - dx;
      containerRef.current.scrollTop = scrollStartRef.current.top - dy;
    } else if (isDrawing && !isPanMode) {
      const coords = getCanvasCoordinates(e);
      if (!coords) return;
      if (activeTool.type === "lasso") {
        lassoPointsRef.current.push(coords);
        if (maskCanvasRef.current) {
          const ctx = maskCanvasRef.current.getContext("2d");
          const baseMask = lassoBaseMaskRef.current;
          const label = labels.find((l) => l.id === activeLabel);
          if (ctx && baseMask && label) {
            ctx.putImageData(baseMask, 0, 0);
            ctx.strokeStyle = label.color;
            ctx.lineWidth = Math.max(1, (activeTool.size || 10) / 2);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            const points = lassoPointsRef.current;
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i += 1) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
          }
        }
      } else {
        drawLine(lastPos.x, lastPos.y, coords.x, coords.y);
      }
      setLastPos(coords);
    }
  };

  const handleMouseUp = () => {
    const wasDrawing = isDrawing;
    setIsDrawing(false);
    setIsPanning(false);

    if (wasDrawing && maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext("2d");
      if (!ctx) return;

      if (activeTool.type === "lasso") {
        const points = lassoPointsRef.current;
        const label = labels.find((l) => l.id === activeLabel);
        const baseMask = lassoBaseMaskRef.current;
        if (points.length > 2 && label && baseMask) {
          ctx.putImageData(baseMask, 0, 0);
          ctx.fillStyle = label.color;
          ctx.globalCompositeOperation = "source-over";
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.closePath();
          ctx.fill();
        }
        lassoPointsRef.current = [];
        lassoBaseMaskRef.current = null;
      }

      onDraw(
        ctx.getImageData(
          0,
          0,
          maskCanvasRef.current.width,
          maskCanvasRef.current.height
        )
      );
    }
  };

  const drawAtPoint = (x: number, y: number) => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const label = labels.find((l) => l.id === activeLabel);
    if (!label) return;

    ctx.fillStyle = label.color;
    ctx.globalCompositeOperation = "source-over";

    const size = activeTool.size || 10;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const label = labels.find((l) => l.id === activeLabel);
    if (!label) return;

    ctx.strokeStyle = label.color;
    ctx.lineWidth =
      activeTool.type === "lasso"
        ? Math.max(1, (activeTool.size || 10) / 2)
        : (activeTool.size || 10) * 2;
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "source-over";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.1));
  };

const handleFitToScreen = () => {
  if (!image) return;
  const fit = computeFitZoom(image);
  setZoom(fit);
  if (containerRef.current) {
    containerRef.current.scrollLeft = 0;
    containerRef.current.scrollTop = 0;
  }
};



  const computeFitZoom = (img: HTMLImageElement) => {
  const el = containerRef.current;
  if (!el) return 1;

  // visible viewport of the scroll container
  const vw = el.clientWidth;
  const vh = el.clientHeight;

  // subtract a little padding so it doesn't touch edges
  const padding = 24;
  const availW = Math.max(1, vw - padding * 2);
  const availH = Math.max(1, vh - padding * 2);

  const zx = availW / img.width;
  const zy = availH / img.height;

  // never upscale above 100% on initial fit (optional, but usually desired)
  return Math.min(1, zx, zy);
};



  const handleResetZoom = () => {
    setZoom(1);
  };

  const scaledWidth = image ? image.width * zoom : 0;
  const scaledHeight = image ? image.height * zoom : 0;

  return (
    <div className="h-full flex flex-col bg-gray-900 min-w-0">
      {/* Navigation Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pan Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onTogglePanMode(!isPanMode)}
                variant={isPanMode ? "default" : "ghost"}
                size="sm"
                className={`${
                  isPanMode
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-white hover:bg-gray-700"
                }`}
              >
                <Move className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pan</TooltipContent>
          </Tooltip>

          {/* Zoom Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleZoomOut}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-gray-700"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
          <span className="text-white text-sm min-w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleZoomIn}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-gray-700"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleFitToScreen}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-gray-700"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to Screen</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleResetZoom}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset Zoom</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {/* History Icons */}
          <div className="flex items-center gap-3 ml-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onUndo}
                disabled={!canUndo}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-gray-700 disabled:opacity-100 disabled:text-gray-600"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onRedo}
                disabled={!canRedo}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-gray-700 disabled:opacity-100 disabled:text-gray-600"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <span className="text-xs text-gray-200 ml-1">
            History {historyStep} of {maxHistorySteps}
          </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-200">
            <span className="font-medium">{currentUser.name}</span>
            <span className="text-gray-400 ml-2 text-xs">{currentUser.role}</span>
          </div>
          <LogoutButton className="text-red-200 hover:bg-red-500/20 hover:text-red-100" />
        </div>
      </div>

      {toolsBar}

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 min-w-0 overflow-auto relative whitespace-nowrap ${
          isPanMode ? "cursor-move" : "cursor-crosshair"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: "relative",
            minWidth: scaledWidth,
            minHeight: scaledHeight,
          }}
          className="inline-block align-top"
        >
          <div
            style={{
              width: image ? image.width : 0,
              height: image ? image.height : 0,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              left: 0,
              top: 0,
            }}
          >
            <canvas ref={canvasRef} className="absolute top-0 left-0" />
            <canvas
              ref={maskCanvasRef}
              className="absolute top-0 left-0"
              style={{ opacity: maskOpacity / 100 }}
            />
          </div>
        </div>

        {!image && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Loading image...
          </div>
        )}
      </div>
    </div>
  );
}
