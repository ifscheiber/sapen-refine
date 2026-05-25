export const BBOX_STAGE_STATUS_EVENT = "sapen:bbox-stage-status-change";
export const BBOX_STAGE_UNLOCK_EVENT = "sapen:bbox-stage-unlock-editing";

export type BBoxSaveState = "idle" | "saving" | "saved" | "failed";

export type BBoxStageStatusEventDetail = {
  saveState?: BBoxSaveState;
  lastAction?: string;
  refresh?: boolean;
};

export function dispatchBBoxStageStatus(detail: BBoxStageStatusEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BBoxStageStatusEventDetail>(BBOX_STAGE_STATUS_EVENT, { detail }));
}

export function dispatchBBoxStageUnlockEditing() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BBOX_STAGE_UNLOCK_EVENT));
}
