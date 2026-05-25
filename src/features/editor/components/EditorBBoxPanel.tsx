import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CropIcon,
  LockKeyholeIcon,
  Maximize2Icon,
  MousePointer2Icon,
  SquarePlusIcon,
  Trash2Icon,
} from "lucide-react";

import type {
  BBoxEditTool,
  CropWorkflowReadinessCandidate,
  DerivedSliceCrop,
  ImageBBoxWorkflowState,
  SliceBBoxOverlapIssue,
  SliceBBoxSummary,
  SliceBoundingBoxProposal,
} from "../editorTypes";
import type { BBoxPreviewMetadata } from "../canvasGeometry";
import { activeButtonClass, idleButtonClass } from "../editorStyles";

type EditorBBoxPanelProps = {
  projectId: string;
  imageId: string;
  boxes: SliceBoundingBoxProposal[];
  crops: DerivedSliceCrop[];
  cropReadinessCandidates: CropWorkflowReadinessCandidate[];
  selectedBBoxId: string | null;
  bboxTool?: BBoxEditTool;
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
  onSelect: (bboxVersionId: string) => void;
  onBBoxToolChange?: (tool: BBoxEditTool) => void;
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

function protectedReasonLabel(reason: string) {
  if (reason === "SEMANTIC_MASK_EXISTS") return "semantic mask";
  if (reason === "SUPPORT_MASK_EXISTS") return "support mask";
  if (reason === "INSTANCE_MASK_EXISTS") return "instance/support mask";
  if (reason === "CLASSIFICATION_EXISTS") return "classification";
  return reason.toLowerCase().replaceAll("_", " ");
}

function clampZoom(value: number) {
  return Math.min(1, Math.max(0.01, value));
}

function formatBBoxWorkflowMessage({
  status,
  editingConfirmedSet,
  hasIssues,
  boxCount,
}: {
  status: ImageBBoxWorkflowState["bboxSetStatus"] | undefined;
  editingConfirmedSet: boolean;
  hasIssues: boolean;
  boxCount: number;
}) {
  if (boxCount === 0) return "Draw at least one slice work area before opening slice annotation.";
  if (hasIssues) return "Resolve BBox issues before preparing slices.";
  if (status === "BBOX_CONFIRMED" && !editingConfirmedSet) return "Slice annotation is ready for this BBox set.";
  if (status === "BBOX_NEEDS_UPDATE") return "BBox edits changed the slice plan. Prepare slices again before continuing.";
  if (editingConfirmedSet) return "BBox editing is unlocked. Prepare slices again after changes.";
  return "Prepare slices after drawing the required work areas.";
}

function selectedProtectionMessage(selected: SliceBoundingBoxProposal | null) {
  const reasons = selected?.protection?.reasons ?? [];
  if (reasons.length === 0) return null;
  return `Locked: ${reasons.map(protectedReasonLabel).join(", ")} data exists.`;
}

export function EditorBBoxPanel({
  projectId,
  imageId,
  boxes,
  crops,
  cropReadinessCandidates,
  selectedBBoxId,
  bboxTool = "select",
  bboxIssues = [],
  bboxSummary,
  replaceArmed,
  bboxWorkflow,
  stageMode = false,
  editingConfirmedSet = false,
  confirmBusy = false,
  canEdit,
  canUnlockConfirmedSet = canEdit,
  status,
  onSelect,
  onBBoxToolChange,
  onArmReplace,
  onDelete,
  onGenerateCrop,
  onConfirmBBoxSet,
  onEditConfirmedSet,
  continueHref,
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
  const workflowStatus = bboxWorkflow?.bboxSetStatus;
  const issueCount = bboxSummary?.issueCount ?? bboxIssues.length;
  const validCount = bboxSummary?.validCount ?? Math.max(0, boxes.length - issueCount);
  const protectedCount =
    bboxSummary?.protectedCount ??
    boxes.filter((box) =>
      box.protection ? !box.protection.canDelete || !box.protection.canReplaceGeometry : false,
    ).length;
  const hasIssues = issueCount > 0;
  const canConfirm = Boolean(
    onConfirmBBoxSet && bboxWorkflow?.canConfirm && boxes.length > 0 && !confirmBusy && !hasIssues,
  );
  const protectionMessage = selectedProtectionMessage(selected);
  const selectedCanDelete = Boolean(selected && canEdit && (selected.protection?.canDelete ?? true));
  const selectedCanEditGeometry = Boolean(selected && canEdit && (selected.protection?.canReplaceGeometry ?? true));
  const workflowMessage = formatBBoxWorkflowMessage({
    status: workflowStatus,
    editingConfirmedSet,
    hasIssues,
    boxCount: boxes.length,
  });
  const showOpenSlices = Boolean(continueHref && workflowStatus === "BBOX_CONFIRMED" && !hasIssues);
  const zoomTitle = bboxPreviewMetadata
    ? `Preview ${bboxPreviewMetadata.previewWidth} x ${bboxPreviewMetadata.previewHeight} from ${bboxPreviewMetadata.originalWidth} x ${bboxPreviewMetadata.originalHeight}`
    : "Zoom preview";

  if (stageMode) {
    return (
      <div className="space-y-2 text-sm">
        <div aria-label="BBox tools" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={bboxTool === "select"}
              className={bboxTool === "select" ? activeButtonClass : idleButtonClass}
              onClick={() => onBBoxToolChange?.("select")}
              title="Select, move, or drag handles on editable BBoxes"
            >
              <MousePointer2Icon className="size-3.5" aria-hidden="true" />
              Select/Edit
            </button>
            <button
              type="button"
              aria-pressed={bboxTool === "add"}
              className={bboxTool === "add" ? activeButtonClass : idleButtonClass}
              onClick={() => onBBoxToolChange?.("add")}
              disabled={!canEdit}
              title="Draw a new BBox on the source image"
            >
              <SquarePlusIcon className="size-3.5" aria-hidden="true" />
              Add BBox
            </button>
            <button
              type="button"
              aria-pressed={bboxTool === "resize"}
              className={bboxTool === "resize" ? activeButtonClass : idleButtonClass}
              onClick={() => onBBoxToolChange?.("resize")}
              disabled={!selectedCanEditGeometry}
              title="Drag a selected BBox handle to resize"
            >
              <CropIcon className="size-3.5" aria-hidden="true" />
              Resize
            </button>
            <button
              type="button"
              className={idleButtonClass}
              onClick={onDelete}
              disabled={!selectedCanDelete}
              title={selectedCanDelete ? "Delete selected BBox" : "Cannot delete locked or missing BBox"}
            >
              <Trash2Icon className="size-3.5" aria-hidden="true" />
              Delete
            </button>
          </div>

          <div
            className="ml-auto flex min-h-8 flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]"
            title={zoomTitle}
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Zoom
            </span>
            <input
              aria-label="Zoom preview"
              type="range"
              min={1}
              max={100}
              value={Math.round(zoom * 100)}
              onChange={(event) => onZoomChange?.(clampZoom(Number(event.target.value) / 100))}
              disabled={!onZoomChange}
              className="w-28"
            />
            <span className="w-10 tabular-nums text-[11px]">{Math.round(zoom * 100)}%</span>
            <button type="button" className={idleButtonClass} onClick={onFit} disabled={!onFit} title="Fit image">
              <Maximize2Icon className="size-3.5" aria-hidden="true" />
              Fit
            </button>
          </div>
        </div>

        <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2 text-[11px] font-medium text-[var(--text-secondary)]">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            BBoxes
          </span>
          <span>
            {boxes.length} boxes · {validCount} valid · {issueCount} issues
            {protectedCount > 0 ? ` · ${protectedCount} locked` : ""}
          </span>
          <span>{selected ? "Selected BBox active on canvas." : boxes.length === 0 ? "Use Add BBox and drag on the image." : "Select a BBox on the canvas to edit."}</span>
          {hasIssues ? (
            <span className="inline-flex items-center gap-1 text-[var(--warning-text)]">
              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              BBox overlap detected. Move or resize boxes before continuing.
            </span>
          ) : null}
          {protectionMessage ? (
            <span className="inline-flex items-center gap-1 text-[var(--warning-text)]">
              <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
              {protectionMessage}
            </span>
          ) : null}
          {status ? <span role="status">{status}</span> : null}
          {replaceArmed ? <span>Draw a replacement BBox on the image.</span> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-2 text-[11px]">
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">
              Workflow
            </div>
            <div className="mt-0.5 text-[var(--text-secondary)]">{workflowMessage}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {workflowStatus === "BBOX_CONFIRMED" && !editingConfirmedSet ? (
              <button
                type="button"
                className={idleButtonClass}
                onClick={onEditConfirmedSet}
                disabled={!onEditConfirmedSet || !canUnlockConfirmedSet}
              >
                Unlock BBox editing
              </button>
            ) : (
              <button type="button" className={activeButtonClass} onClick={onConfirmBBoxSet} disabled={!canConfirm}>
                <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                Prepare slices
              </button>
            )}
            {showOpenSlices ? (
              <Link className={activeButtonClass} href={continueHref ?? "#"}>
                Open slice annotation
              </Link>
            ) : (
              <button type="button" className={idleButtonClass} disabled>
                Open slice annotation
              </button>
            )}
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
