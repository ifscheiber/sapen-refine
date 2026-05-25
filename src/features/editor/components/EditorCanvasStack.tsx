import type React from "react";

import type { Tool } from "../editorTypes";

type EditorCanvasStackProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  baseCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  predictionCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  bboxCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  tool: Tool;
  onPointerDown: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: React.PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave: React.PointerEventHandler<HTMLCanvasElement>;
  onCommitPolygon: () => void;
};

export function EditorCanvasStack({
  containerRef,
  baseCanvasRef,
  predictionCanvasRef,
  overlayCanvasRef,
  bboxCanvasRef,
  previewCanvasRef,
  tool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onCommitPolygon,
}: EditorCanvasStackProps) {
  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100dvh-24rem)] min-h-[28rem] w-full overflow-auto overscroll-contain bg-[var(--workspace-background)]"
    >
      <div className="relative inline-block">
        <canvas ref={baseCanvasRef} className="block" />
        <canvas
          ref={predictionCanvasRef}
          aria-label="Read-only prediction proposal"
          className="absolute left-0 top-0 pointer-events-none"
        />
        <canvas
          ref={overlayCanvasRef}
          aria-label="Mask drawing surface"
          className="absolute left-0 top-0 touch-none select-none"
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
          style={{ touchAction: "none" }}
          onDoubleClick={() => {
            if (tool === "lasso_poly") onCommitPolygon();
          }}
        />
        <canvas
          ref={bboxCanvasRef}
          aria-label="Slice BBox proposal overlay"
          className="absolute left-0 top-0 pointer-events-none"
        />
        <canvas ref={previewCanvasRef} className="absolute left-0 top-0 pointer-events-none" />
      </div>
    </div>
  );
}
