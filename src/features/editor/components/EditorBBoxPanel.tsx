import Link from "next/link";
import {
  Maximize2Icon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  CropWorkflowReadinessCandidate,
  DerivedSliceCrop,
  ImageBBoxWorkflowState,
  SliceBBoxOverlapIssue,
  SliceBBoxSummary,
  SliceBoundingBoxProposal,
} from "../editorTypes";
import type { BBoxPreviewMetadata } from "../canvasGeometry";
import type { BBoxSaveState } from "../bboxStageEvents";
import {
  activeButtonClass,
  canvasToolbarContentClass,
  canvasToolbarDividerClass,
  canvasToolbarIconButtonClass,
  canvasToolbarShellClass,
  canvasToolbarZoomSliderClass,
  idleButtonClass,
} from "../editorStyles";

type EditorBBoxPanelProps = {
  projectId: string;
  imageId: string;
  boxes: SliceBoundingBoxProposal[];
  crops: DerivedSliceCrop[];
  cropReadinessCandidates: CropWorkflowReadinessCandidate[];
  selectedBBoxId: string | null;
  bboxIssues?: SliceBBoxOverlapIssue[];
  bboxSummary?: SliceBBoxSummary | null;
  replaceArmed: boolean;
  bboxWorkflow?: ImageBBoxWorkflowState | null;
  stageMode?: boolean;
  editingConfirmedSet?: boolean;
  confirmBusy?: boolean;
  canEdit: boolean;
  canUnlockConfirmedSet?: boolean;
  status: string;
  saveState?: BBoxSaveState;
  onSelect: (bboxVersionId: string) => void;
  onArmReplace: () => void;
  onDelete: () => void;
  onGenerateCrop: () => void;
  onConfirmBBoxSet?: () => void;
  onEditConfirmedSet?: () => void;
  continueHref?: string;
  zoom?: number;
  bboxPreviewMetadata?: BBoxPreviewMetadata | null;
  onZoomChange?: (zoom: number) => void;
  onFit?: () => void;
};

function clampZoom(value: number) {
  return Math.min(1, Math.max(0.01, value));
}

function saveStateLabel(state: BBoxSaveState | undefined) {
  if (state === "saving") return "Saving...";
  if (state === "saved") return "Saved";
  if (state === "failed") return "Save failed";
  return "";
}

export function EditorBBoxPanel({
  projectId,
  imageId,
  boxes,
  crops,
  cropReadinessCandidates,
  selectedBBoxId,
  replaceArmed,
  stageMode = false,
  canEdit,
  status,
  saveState,
  onSelect,
  onArmReplace,
  onDelete,
  onGenerateCrop,
  zoom = 1,
  bboxPreviewMetadata,
  onZoomChange,
  onFit,
}: EditorBBoxPanelProps) {
  const selected = boxes.find((box) => box.bboxVersionId === selectedBBoxId) ?? null;
  const selectedCrop =
    crops
      .filter((crop) => crop.bboxVersionId === selectedBBoxId)
      .sort((a, b) => b.version - a.version)[0] ?? null;
  const selectedCropReadiness = selectedCrop
    ? cropReadinessCandidates.find((candidate) => candidate.crop.id === selectedCrop.id) ?? null
    : null;
  const selectedCanDelete = Boolean(selected && canEdit);
  const zoomTitle = bboxPreviewMetadata
    ? `Preview ${bboxPreviewMetadata.previewWidth} x ${bboxPreviewMetadata.previewHeight} from ${bboxPreviewMetadata.originalWidth} x ${bboxPreviewMetadata.originalHeight}`
    : "Zoom preview";
  const compactStatus = status || saveStateLabel(saveState);

  if (stageMode) {
    return (
      <div className={canvasToolbarShellClass}>
        <div aria-label="BBox tools" className={canvasToolbarContentClass}>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={canvasToolbarIconButtonClass}
                  onClick={onDelete}
                  disabled={!selectedCanDelete}
                >
                  <Trash2Icon className="size-4" aria-hidden="true" />
                  <span className="sr-only">Delete selected BBox</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {selected ? "Delete selected BBox" : "Select a BBox to delete"}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className={canvasToolbarDividerClass} />

          <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]" title={zoomTitle}>
            <SearchIcon className="size-3.5" aria-hidden="true" />
            <Slider
              aria-label="Zoom preview"
              value={[zoom]}
              min={0.01}
              max={1}
              step={0.01}
              onValueChange={(value) => onZoomChange?.(clampZoom(value[0] ?? zoom))}
              disabled={!onZoomChange}
              className={canvasToolbarZoomSliderClass}
            />
            <span className="w-10 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className={canvasToolbarIconButtonClass} onClick={onFit} disabled={!onFit}>
                  <Maximize2Icon className="size-4" aria-hidden="true" />
                  <span className="sr-only">Fit image</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Fit image</TooltipContent>
            </Tooltip>
          </div>

          <div className="ml-auto min-w-32 text-right text-[11px] font-medium text-[var(--text-secondary)]">
            {compactStatus ? <span role="status">{compactStatus}</span> : null}
            {replaceArmed ? <span className="sr-only">Draw a replacement BBox on the image.</span> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-muted-foreground">
          BBox proposals are rough crop work areas. Pixel-perfect support masks remain ground truth.
        </div>
        {status && <div className="text-muted-foreground">{status}</div>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {boxes.length === 0 ? (
          <span className="text-muted-foreground">No slice proposals yet.</span>
        ) : (
          boxes.map((box, index) => (
            <button
              key={box.bboxVersionId}
              className={box.bboxVersionId === selectedBBoxId ? activeButtonClass : idleButtonClass}
              aria-pressed={box.bboxVersionId === selectedBBoxId}
              onClick={() => onSelect(box.bboxVersionId)}
            >
              Slice proposal {index + 1}: {box.width} x {box.height}
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
          <span>
            Selected source pixels: x {selected.x}, y {selected.y}, {selected.width} x {selected.height}, v
            {selected.version}
          </span>
          <button className={idleButtonClass} onClick={onArmReplace} disabled={!canEdit}>
            {replaceArmed ? "Draw replacement box" : "Replace geometry"}
          </button>
          <button className={idleButtonClass} onClick={onDelete} disabled={!canEdit}>
            Delete proposal
          </button>
        </div>
      )}

      {selected && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
          {selectedCrop ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedCrop.assetUrl}
                alt="Derived slice crop preview"
                className="h-16 max-w-28 border border-border object-contain"
              />
              <span>
                Crop v{selectedCrop.version}: {selectedCrop.cropWidth} x {selectedCrop.cropHeight}, padding{" "}
                {selectedCrop.paddingRequestedPx}px
                {selectedCrop.paddingClipped ? ", clipped" : ""}
              </span>
              {selectedCropReadiness && (
                <span>
                  Readiness: {selectedCropReadiness.readinessStatus.toLowerCase().replaceAll("_", " ")}
                  {selectedCropReadiness.readinessReasons.length > 0
                    ? ` (${selectedCropReadiness.readinessReasons.slice(0, 2).join(", ")}${
                        selectedCropReadiness.readinessReasons.length > 2 ? ", ..." : ""
                      })`
                    : ""}
                </span>
              )}
              {selectedCropReadiness?.nextActions[0] && (
                <span>Next: {selectedCropReadiness.nextActions[0].toLowerCase().replaceAll("_", " ")}</span>
              )}
            </>
          ) : (
            <span>No derived crop for this BBox yet.</span>
          )}
          <button className={idleButtonClass} onClick={onGenerateCrop} disabled={!canEdit || replaceArmed}>
            {selectedCrop ? "Regenerate crop" : "Generate crop"}
          </button>
          {selectedCrop ? (
            <>
              <Link
                className={idleButtonClass}
                href={`/app/projects/${projectId}/images/${imageId}/crop/slices/${selectedCrop.sliceInstanceId}/crops/${selectedCrop.id}`}
              >
                Open editor
              </Link>
            </>
          ) : (
            <button className={idleButtonClass} disabled>
              Editor needs crop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
