import type { LabelId } from "@/mask/labels";

import { clampNumber } from "../canvasGeometry";
import { activeButtonClass, idleButtonClass } from "../editorStyles";
import { formatEraserHint } from "../editorTools";
import type { EditorLabelOption, MaskMode, Tool } from "../editorTypes";

type EditorToolbarProps = {
  maskMode: MaskMode;
  isCorrectionMode: boolean;
  latestSupportStatus: string;
  latestClassificationLabel: string;
  onSwitchMaskMode: (mode: MaskMode) => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  brushRadius: number;
  onBrushRadiusChange: (radius: number) => void;
  labels: EditorLabelOption[];
  activeLabel: LabelId;
  onActiveLabelChange: (label: LabelId) => void;
  canEdit: boolean;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  editorStatus: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export function EditorToolbar({
  maskMode,
  isCorrectionMode,
  latestSupportStatus,
  latestClassificationLabel,
  onSwitchMaskMode,
  tool,
  onToolChange,
  brushRadius,
  onBrushRadiusChange,
  labels,
  activeLabel,
  onActiveLabelChange,
  canEdit,
  opacity,
  onOpacityChange,
  onUndo,
  onRedo,
  onFit,
  onSave,
  isSaving,
  hasUnsavedChanges,
  editorStatus,
  zoom,
  onZoomChange,
}: EditorToolbarProps) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          aria-pressed={maskMode === "semantic"}
          className={maskMode === "semantic" ? activeButtonClass : idleButtonClass}
          onClick={() => onSwitchMaskMode("semantic")}
          disabled={isCorrectionMode}
        >
          Semantic mask
        </button>
        <button
          aria-pressed={maskMode === "support"}
          className={maskMode === "support" ? activeButtonClass : idleButtonClass}
          onClick={() => onSwitchMaskMode("support")}
          disabled={isCorrectionMode}
        >
          Slice support
        </button>
        <div className="flex min-h-11 flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Support mask: {latestSupportStatus}</span>
          <span>Classification: {latestClassificationLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            aria-pressed={tool === "brush"}
            className={tool === "brush" ? activeButtonClass : idleButtonClass}
            onClick={() => onToolChange("brush")}
            disabled={!canEdit}
          >
            Brush
          </button>
          <button
            aria-pressed={tool === "eraser"}
            className={tool === "eraser" ? activeButtonClass : idleButtonClass}
            onClick={() => onToolChange("eraser")}
            disabled={!canEdit}
            title={formatEraserHint(maskMode)}
          >
            Eraser
          </button>
          <button
            aria-pressed={tool === "lasso_free"}
            className={tool === "lasso_free" ? activeButtonClass : idleButtonClass}
            onClick={() => onToolChange("lasso_free")}
            disabled={!canEdit}
          >
            Lasso
          </button>
          <button
            aria-pressed={tool === "lasso_poly"}
            className={tool === "lasso_poly" ? activeButtonClass : idleButtonClass}
            onClick={() => onToolChange("lasso_poly")}
            disabled={!canEdit}
          >
            Polygon
          </button>
          <button
            aria-pressed={tool === "bbox"}
            className={tool === "bbox" ? activeButtonClass : idleButtonClass}
            onClick={() => onToolChange("bbox")}
            disabled={!canEdit || isCorrectionMode}
            title="Draw rough slice crop proposals. Not ground truth."
          >
            BBox proposal
          </button>
          <div className="ml-3 flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <span>Tool Size: {brushRadius}px</span>
            <input
              type="range"
              min={1}
              max={120}
              value={brushRadius}
              onChange={(event) => onBrushRadiusChange(Number(event.target.value))}
              disabled={!canEdit || tool === "lasso_poly" || tool === "bbox"}
              className="w-32"
            />
            {tool === "eraser" && <span>{formatEraserHint(maskMode)}</span>}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
          {labels.map((label) => (
            <button
              key={label.id}
              aria-pressed={activeLabel === label.id}
              onClick={() => onActiveLabelChange(label.id)}
              disabled={!canEdit}
              className={`flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm ${
                activeLabel === label.id
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: `rgb(${label.rgb[0]}, ${label.rgb[1]}, ${label.rgb[2]})` }}
              />
              <span>{label.name}</span>
            </button>
          ))}
        </div>

        <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
          <span>Mask Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
            className="w-32"
          />
          <span className="tabular-nums w-10">{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button className={idleButtonClass} onClick={onUndo} disabled={!canEdit}>
          Undo
        </button>
        <button className={idleButtonClass} onClick={onRedo} disabled={!canEdit}>
          Redo
        </button>
        <button className={idleButtonClass} onClick={onFit}>
          Fit
        </button>
        <button
          className={idleButtonClass}
          onClick={onSave}
          disabled={!canEdit || isSaving || !hasUnsavedChanges}
        >
          {isCorrectionMode ? "Save correction draft" : maskMode === "support" ? "Save support mask" : "Save now"}
        </button>
        <div className="ml-auto flex min-h-11 items-center gap-3">
          {editorStatus && <div className="text-xs text-muted-foreground">{editorStatus}</div>}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Zoom</span>
            <input
              type="range"
              min={5}
              max={300}
              value={Math.round(zoom * 100)}
              onChange={(event) => onZoomChange(clampNumber(Number(event.target.value) / 100, 0.05, 3))}
              className="w-32"
            />
            <span className="tabular-nums w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </>
  );
}
