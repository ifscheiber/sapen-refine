"use client";

import { RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/components/ui/utils";
import {
  BBOX_STAGE_STATUS_EVENT,
  type BBoxSaveState,
  type BBoxStageStatusEventDetail,
  dispatchBBoxStageStatus,
} from "./bboxStageEvents";
import {
  API_CONFIRM_SLICE_BBOX_SET,
  API_ENSURE_SLICE_CROPS,
  API_SLICE_BBOXES,
  API_SLICE_CROPS,
} from "./editorApi";
import { formatBBoxErrorMessage } from "./editorFormatters";
import { idleButtonClass } from "./editorStyles";
import type {
  DerivedSliceCrop,
  ImageBBoxWorkflowState,
  SliceBBoxSummary,
  SliceBoundingBoxProposal,
} from "./editorTypes";

type BBoxRailState = {
  boxes: SliceBoundingBoxProposal[];
  crops: DerivedSliceCrop[];
  bboxSummary: SliceBBoxSummary | null;
  bboxWorkflow: ImageBBoxWorkflowState | null;
};

function saveStateLabel(state: BBoxSaveState) {
  if (state === "saving") return "Saving...";
  if (state === "saved") return "Saved";
  if (state === "failed") return "Save failed";
  return "Idle";
}

function workflowLabel(workflow: ImageBBoxWorkflowState | null) {
  if (!workflow) return "Draft";
  if (workflow.bboxSetStatus === "NO_BBOXES") return "No BBoxes";
  if (workflow.bboxSetStatus === "BBOX_DRAFT") return "Draft";
  if (workflow.bboxSetStatus === "BBOX_CONFIRMED") return "Prepared";
  if (workflow.bboxSetStatus === "BBOX_NEEDS_UPDATE") return "Needs regeneration";
  return workflow.bboxSetStatus;
}

function computeCropSummary(state: BBoxRailState | null) {
  if (!state) return { current: 0, missing: 0, stale: 0 };
  const currentCropBboxIds = new Set(state.crops.map((crop) => crop.bboxVersionId));
  const cropSliceIds = new Set(state.crops.map((crop) => crop.sliceInstanceId));
  let current = 0;
  let missing = 0;
  let stale = 0;
  for (const box of state.boxes) {
    if (currentCropBboxIds.has(box.bboxVersionId)) {
      current += 1;
    } else if (cropSliceIds.has(box.sliceInstanceId)) {
      stale += 1;
    } else {
      missing += 1;
    }
  }
  return { current, missing, stale };
}

export function BBoxStageStatusRailClient({
  imageId,
}: {
  imageId: string;
}) {
  const [state, setState] = useState<BBoxRailState | null>(null);
  const [saveState, setSaveState] = useState<BBoxSaveState>("idle");
  const [lastAction, setLastAction] = useState("");
  const [selectedBBoxId, setSelectedBBoxId] = useState<string | null>(null);
  const [sliceGenerationRetryAvailable, setSliceGenerationRetryAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadState = useCallback(async () => {
    const [bboxResponse, cropResponse] = await Promise.all([
      fetch(API_SLICE_BBOXES(imageId), { method: "GET", cache: "no-store" }),
      fetch(API_SLICE_CROPS(imageId), { method: "GET", cache: "no-store" }),
    ]);
    const bboxBody = await bboxResponse.json().catch(() => null);
    const cropBody = await cropResponse.json().catch(() => null);
    if (!bboxResponse.ok || !bboxBody?.ok) {
      throw new Error(bboxBody?.error ?? `SLICE_BBOXES_FAILED_${bboxResponse.status}`);
    }
    if (!cropResponse.ok || !cropBody?.ok) {
      throw new Error(cropBody?.error ?? `SLICE_CROPS_FAILED_${cropResponse.status}`);
    }
    setState({
      boxes: (bboxBody.boxes ?? []) as SliceBoundingBoxProposal[],
      crops: (cropBody.crops ?? []) as DerivedSliceCrop[],
      bboxSummary: (bboxBody.bboxSummary ?? null) as SliceBBoxSummary | null,
      bboxWorkflow: (bboxBody.bboxWorkflow ?? null) as ImageBBoxWorkflowState | null,
    });
  }, [imageId]);

  useEffect(() => {
    void loadState().catch((error) => {
      setLastAction(formatBBoxErrorMessage(error, "BBox status unavailable"));
    });
  }, [loadState]);

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<BBoxStageStatusEventDetail>).detail ?? {};
      if (detail.saveState) setSaveState(detail.saveState);
      if (detail.lastAction !== undefined) setLastAction(detail.lastAction);
      if ("selectedBBoxId" in detail) setSelectedBBoxId(detail.selectedBBoxId ?? null);
      if (detail.sliceGenerationRetryAvailable !== undefined) {
        setSliceGenerationRetryAvailable(detail.sliceGenerationRetryAvailable);
      }
      if (detail.refresh) {
        void loadState().catch((error) => {
          setLastAction(formatBBoxErrorMessage(error, "BBox status unavailable"));
        });
      }
    };
    window.addEventListener(BBOX_STAGE_STATUS_EVENT, handleEvent);
    return () => window.removeEventListener(BBOX_STAGE_STATUS_EVENT, handleEvent);
  }, [loadState]);

  const cropSummary = useMemo(() => computeCropSummary(state), [state]);
  const issueCount = state?.bboxSummary?.issueCount ?? 0;
  const validCount = state?.bboxSummary?.validCount ?? Math.max(0, (state?.boxes.length ?? 0) - issueCount);
  const selectedBox = selectedBBoxId
    ? state?.boxes.find((box) => box.bboxVersionId === selectedBBoxId) ?? null
    : null;
  const selectedLockReasons = selectedBox?.protection?.reasons ?? [];
  const selectedLocked = Boolean(
    selectedBox && (!(selectedBox.protection?.canDelete ?? true) || !(selectedBox.protection?.canReplaceGeometry ?? true)),
  );
  const canRetrySliceGeneration = Boolean(
    state &&
      sliceGenerationRetryAvailable &&
      state.boxes.length > 0 &&
      issueCount === 0 &&
      (cropSummary.missing > 0 || cropSummary.stale > 0) &&
      state.bboxWorkflow?.canConfirm,
  );

  function reasonLabel(reason: string) {
    if (reason === "SEMANTIC_MASK_EXISTS") return "semantic mask exists";
    if (reason === "SUPPORT_MASK_EXISTS") return "support mask exists";
    if (reason === "INSTANCE_MASK_EXISTS") return "instance/support mask exists";
    if (reason === "CLASSIFICATION_EXISTS") return "classification exists";
    return reason.toLowerCase().replaceAll("_", " ");
  }

  async function retrySliceGeneration() {
    if (!canRetrySliceGeneration || busy) return;
    setBusy(true);
    setSaveState("saving");
    setLastAction("Retrying slice generation");
    dispatchBBoxStageStatus({ saveState: "saving", lastAction: "Retrying slice generation" });
    try {
      const confirmResponse = await fetch(API_CONFIRM_SLICE_BBOX_SET(imageId), { method: "POST" });
      const confirmBody = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok || !confirmBody?.ok) {
        throw new Error(confirmBody?.error ?? `BBOX_CONFIRM_FAILED_${confirmResponse.status}`);
      }
      const ensureResponse = await fetch(API_ENSURE_SLICE_CROPS(imageId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const ensureBody = await ensureResponse.json().catch(() => null);
      if (!ensureResponse.ok || !ensureBody?.ok) {
        throw new Error(ensureBody?.error ?? `SLICE_CROP_ENSURE_FAILED_${ensureResponse.status}`);
      }
      setSaveState("saved");
      setLastAction("Slices generated");
      setSliceGenerationRetryAvailable(false);
      dispatchBBoxStageStatus({
        saveState: "saved",
        lastAction: "Slices generated",
        refresh: true,
        sliceGenerationRetryAvailable: false,
      });
      await loadState();
    } catch (error) {
      const message = formatBBoxErrorMessage(error, "Slice regeneration failed");
      setSaveState("failed");
      setLastAction(message);
      setSliceGenerationRetryAvailable(true);
      dispatchBBoxStageStatus({
        saveState: "failed",
        lastAction: message,
        refresh: true,
        sliceGenerationRetryAvailable: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 border-t border-[var(--border-subtle)] pt-6">
      <div>
        <h2 className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          BBox status
        </h2>
        <div className="mt-3 space-y-2 pl-3 text-[11px] font-medium text-[var(--text-secondary)]">
          <div className="flex items-center justify-between gap-3">
            <span>BBoxes</span>
            <span className="text-right tabular-nums text-[var(--text-primary)]">
              {validCount} valid · {issueCount} issues
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Save state</span>
            <span
              className={cn(
                "text-right text-[var(--text-primary)]",
                saveState === "failed" && "text-[var(--warning-text)]",
              )}
            >
              {saveStateLabel(saveState)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Workflow</span>
            <span className="text-right text-[var(--text-primary)]">{workflowLabel(state?.bboxWorkflow ?? null)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Slices</span>
            <span className="text-right tabular-nums text-[var(--text-primary)]">
              {cropSummary.current} current · {cropSummary.missing} missing · {cropSummary.stale} stale
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Selected BBox</span>
            <span className="text-right text-[var(--text-primary)]">
              {selectedBox ? (selectedLocked ? "Locked" : "Editable") : "None"}
            </span>
          </div>
          {selectedLocked && selectedLockReasons.length > 0 ? (
            <div className="pt-1 text-[var(--warning-text)]">
              {selectedLockReasons.map(reasonLabel).join(", ")}
            </div>
          ) : null}
          {lastAction ? (
            <div className="pt-1 text-[var(--text-muted)]" role="status">
              {lastAction}
            </div>
          ) : null}
        </div>
      </div>
      {sliceGenerationRetryAvailable ? (
        <button
          type="button"
          className={cn(idleButtonClass, "ml-3")}
          onClick={() => void retrySliceGeneration()}
          disabled={!canRetrySliceGeneration || busy}
          title={
            canRetrySliceGeneration
              ? "Retry missing or stale slice generation"
              : "Resolve BBox issues before retrying slice generation"
          }
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
          Retry slice generation
        </button>
      ) : null}
    </section>
  );
}
