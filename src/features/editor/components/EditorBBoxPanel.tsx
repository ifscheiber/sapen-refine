import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CropIcon,
  LockKeyholeIcon,
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
};

function formatBBoxSetStatus(status: ImageBBoxWorkflowState["bboxSetStatus"] | undefined) {
  if (status === "BBOX_CONFIRMED") return "Confirmed";
  if (status === "BBOX_NEEDS_UPDATE") return "Needs update";
  if (status === "BBOX_DRAFT") return "Draft";
  return "No BBoxes";
}

function formatConfirmedBy(workflow: ImageBBoxWorkflowState | null | undefined) {
  if (!workflow?.confirmedAt) return null;
  const actor = workflow.confirmedBy?.name ?? workflow.confirmedBy?.email ?? "unknown user";
  return `Confirmed by ${actor}`;
}

function protectedReasonLabel(reason: string) {
  if (reason === "SEMANTIC_MASK_EXISTS") return "semantic mask";
  if (reason === "SUPPORT_MASK_EXISTS") return "support mask";
  if (reason === "INSTANCE_MASK_EXISTS") return "instance/support mask";
  if (reason === "CLASSIFICATION_EXISTS") return "classification";
  return reason.toLowerCase().replaceAll("_", " ");
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
  const confirmedBy = formatConfirmedBy(bboxWorkflow);
  const protectionMessage = selectedProtectionMessage(selected);
  const selectedCanDelete = Boolean(selected && canEdit && (selected.protection?.canDelete ?? true));
  const selectedCanEditGeometry = Boolean(selected && canEdit && (selected.protection?.canReplaceGeometry ?? true));

  if (stageMode) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-[12rem] items-baseline gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              BBoxes
            </span>
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              {boxes.length} boxes · {validCount} valid · {issueCount} issues
              {protectedCount > 0 ? ` · ${protectedCount} locked` : ""}
            </span>
          </div>

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

          <label className="flex min-w-[12rem] items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Select
            </span>
            <select
              aria-label="Select BBox"
              value={selectedBBoxId ?? ""}
              onChange={(event) => {
                if (event.target.value) onSelect(event.target.value);
              }}
              disabled={boxes.length === 0}
              className="h-8 min-w-40 rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-2 text-[11px] font-medium text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
            >
              <option value="">No BBox selected</option>
              {boxes.map((box, index) => (
                <option key={box.bboxVersionId} value={box.bboxVersionId}>
                  BBox {index + 1} · {box.width} x {box.height}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {formatBBoxSetStatus(workflowStatus)}
            </span>
            {workflowStatus === "BBOX_CONFIRMED" && !editingConfirmedSet ? (
              <button
                className={idleButtonClass}
                onClick={onEditConfirmedSet}
                disabled={!onEditConfirmedSet || !canUnlockConfirmedSet}
              >
                Edit BBoxes
              </button>
            ) : (
              <button className={activeButtonClass} onClick={onConfirmBBoxSet} disabled={!canConfirm}>
                <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                {workflowStatus === "BBOX_NEEDS_UPDATE" ? "Re-confirm BBox set" : "Confirm BBox set"}
              </button>
            )}
            {continueHref && workflowStatus === "BBOX_CONFIRMED" && !hasIssues ? (
              <Link className={activeButtonClass} href={continueHref}>
                Continue to slice annotation
              </Link>
            ) : (
              <button className={idleButtonClass} disabled>
                Continue to slice annotation
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {selected ? (
            <span>
              Selected x {selected.x} · y {selected.y} · {selected.width} x {selected.height} · v
              {selected.version}
            </span>
          ) : (
            <span>{boxes.length === 0 ? "Use Add BBox and drag on the image." : "Select a BBox to edit."}</span>
          )}
          {confirmedBy ? <span>{confirmedBy}</span> : null}
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
