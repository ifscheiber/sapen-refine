import Link from "next/link";

import type {
  CropWorkflowReadinessCandidate,
  DerivedSliceCrop,
  ImageBBoxWorkflowState,
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
  replaceArmed: boolean;
  bboxWorkflow?: ImageBBoxWorkflowState | null;
  stageMode?: boolean;
  editingConfirmedSet?: boolean;
  confirmBusy?: boolean;
  canEdit: boolean;
  status: string;
  onSelect: (bboxVersionId: string) => void;
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

export function EditorBBoxPanel({
  projectId,
  imageId,
  boxes,
  crops,
  cropReadinessCandidates,
  selectedBBoxId,
  replaceArmed,
  bboxWorkflow,
  stageMode = false,
  editingConfirmedSet = false,
  confirmBusy = false,
  canEdit,
  status,
  onSelect,
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
  const canConfirm = Boolean(onConfirmBBoxSet && bboxWorkflow?.canConfirm && boxes.length > 0 && !confirmBusy);
  const confirmedBy = formatConfirmedBy(bboxWorkflow);

  return (
    <div className={stageMode ? "mt-3 rounded-lg border border-border p-4 text-sm" : "mt-3 border-t border-border pt-3 text-sm"}>
      {stageMode && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Step 1: Mark slice work areas</h2>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Draw rough BBoxes around every visible slice. BBoxes seed crop work areas; pixel-perfect support masks remain ground truth.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              {formatBBoxSetStatus(workflowStatus)}
            </span>
            {confirmedBy && (
              <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {confirmedBy}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-muted-foreground">
          BBox proposals are rough crop work areas. Pixel-perfect support masks remain ground truth.
        </div>
        {status && <div className="text-muted-foreground">{status}</div>}
      </div>

      {stageMode && boxes.length === 0 && (
        <div className="mt-3 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
          No slice work areas have been marked yet. Draw at least one BBox before confirming the set.
        </div>
      )}

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

      {stageMode && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {workflowStatus === "BBOX_CONFIRMED" && !editingConfirmedSet ? (
            <button className={idleButtonClass} onClick={onEditConfirmedSet} disabled={!onEditConfirmedSet}>
              Edit BBoxes
            </button>
          ) : (
            <button className={activeButtonClass} onClick={onConfirmBBoxSet} disabled={!canConfirm}>
              {workflowStatus === "BBOX_NEEDS_UPDATE" ? "Re-confirm BBox set" : "Confirm BBox set"}
            </button>
          )}
          {continueHref && workflowStatus === "BBOX_CONFIRMED" ? (
            <Link className={activeButtonClass} href={continueHref}>
              Continue to slice annotation
            </Link>
          ) : (
            <button className={idleButtonClass} disabled>
              Continue to slice annotation
            </button>
          )}
        </div>
      )}

      {selected && !stageMode && (
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
                href={`/app/projects/${projectId}/images/${imageId}/slices/${selectedCrop.sliceInstanceId}/crops/${selectedCrop.id}/support`}
              >
                Open support editor
              </Link>
              <Link
                className={idleButtonClass}
                href={`/app/projects/${projectId}/images/${imageId}/slices/${selectedCrop.sliceInstanceId}/crops/${selectedCrop.id}/semantic`}
              >
                Open semantic editor
              </Link>
            </>
          ) : (
            <button className={idleButtonClass} disabled>
              Support editor needs crop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
