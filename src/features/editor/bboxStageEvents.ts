export const BBOX_STAGE_STATUS_EVENT = "sapen:bbox-stage-status-change";

export type BBoxSaveState = "idle" | "saving" | "saved" | "failed";

export type BBoxStageStatusEventDetail = {
  saveState?: BBoxSaveState;
  lastAction?: string;
  refresh?: boolean;
  selectedBBoxId?: string | null;
  sliceGenerationRetryAvailable?: boolean;
};

export function dispatchBBoxStageStatus(detail: BBoxStageStatusEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BBoxStageStatusEventDetail>(BBOX_STAGE_STATUS_EVENT, { detail }));
}
