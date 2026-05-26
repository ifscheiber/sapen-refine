import Link from "next/link";
import { Trash2Icon } from "lucide-react";

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
import { activeButtonClass, idleButtonClass } from "../editorStyles";
import {
  AnnotationIconButton,
  AnnotationToolbarDivider,
  AnnotationToolbarGroup,
  AnnotationToolbarShell,
  AnnotationZoomControl,
} from "./AnnotationToolbar";

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
      <AnnotationToolbarShell ariaLabel="BBox tools">
        <AnnotationToolbarGroup>
          <AnnotationIconButton
            icon={Trash2Icon}
            label="Delete selected BBox"
            tooltip={selected ? "Delete selected BBox" : "Select a BBox to delete"}
            onClick={onDelete}
            disabled={!selectedCanDelete}
          />
        </AnnotationToolbarGroup>

        <AnnotationToolbarDivider />

        <AnnotationZoomControl
          zoom={zoom}
          minZoom={0.01}
          maxZoom={1}
          label="Zoom preview"
          title={zoomTitle}
          onZoomChange={onZoomChange}
          onFit={onFit}
        />

        <div className="ml-auto min-w-32 text-right text-[11px] font-medium text-[var(--text-secondary)]">
          {compactStatus ? <span role="status">{compactStatus}</span> : null}
          {replaceArmed ? <span className="sr-only">Draw a replacement BBox on the image.</span> : null}
        </div>
      </AnnotationToolbarShell>
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
