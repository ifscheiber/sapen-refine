"use client";

export const CROP_SEMANTIC_EDITOR_STATUS_EVENT = "sapen:crop-semantic-editor-status";
export const CROP_SEMANTIC_EDITOR_COMMAND_EVENT = "sapen:crop-semantic-editor-command";
export const CROP_SEMANTIC_EDITOR_FLUSH_REQUEST_EVENT = "sapen:crop-semantic-editor-flush-request";
export const CROP_SEMANTIC_EDITOR_FLUSH_RESPONSE_EVENT = "sapen:crop-semantic-editor-flush-response";
export const CROP_SEMANTIC_EDITOR_MASK_EVENT = "sapen:crop-semantic-editor-mask";

export type CropSemanticEditorSaveState = "idle" | "dirty" | "saving" | "saved" | "failed";

export type CropSemanticEditorStatusDetail = {
  cropId: string;
  editTarget: string;
  saveState: CropSemanticEditorSaveState;
  status: string;
  readiness: string;
  warning: string | null;
  toolState: string | null;
  brushRadius: number;
  semanticOpacityControls: Array<{
    labelId: number;
    name: string;
    value: number;
    swatch: [number, number, number];
  }>;
  canRetrySave: boolean;
  canReloadLatest: boolean;
};

export type CropSemanticEditorCommandDetail =
  | { cropId: string; command: "retrySave" }
  | { cropId: string; command: "reloadLatest" }
  | { cropId: string; command: "setBrushRadius"; value: number }
  | { cropId: string; command: "setSemanticLabelOpacity"; labelId: number; value: number };

export type CropSemanticEditorFlushRequestDetail = {
  requestId: string;
};

export type CropSemanticEditorFlushResponseDetail = {
  requestId: string;
  ok: boolean;
};

export type CropSemanticEditorMaskDetail = {
  cropId: string;
  kind: "semantic" | "support";
  semanticMode: "SAP_HEARTWOOD" | "COPPER" | null;
  width: number;
  height: number;
  bytes: Uint8Array;
  revision: number;
};

export function dispatchCropSemanticEditorStatus(detail: CropSemanticEditorStatusDetail) {
  window.dispatchEvent(new CustomEvent(CROP_SEMANTIC_EDITOR_STATUS_EVENT, { detail }));
}

export function dispatchCropSemanticEditorCommand(detail: CropSemanticEditorCommandDetail) {
  window.dispatchEvent(new CustomEvent(CROP_SEMANTIC_EDITOR_COMMAND_EVENT, { detail }));
}

export function dispatchCropSemanticEditorMask(detail: CropSemanticEditorMaskDetail) {
  window.dispatchEvent(new CustomEvent(CROP_SEMANTIC_EDITOR_MASK_EVENT, { detail }));
}

export function requestCropSemanticEditorFlush(timeoutMs = 10_000) {
  if (typeof window === "undefined") return Promise.resolve(true);

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;
    const cleanup = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener(CROP_SEMANTIC_EDITOR_FLUSH_RESPONSE_EVENT, onResponse as EventListener);
    };
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };
    const onResponse = (event: CustomEvent<CropSemanticEditorFlushResponseDetail>) => {
      if (event.detail.requestId !== requestId) return;
      finish(event.detail.ok);
    };

    window.addEventListener(CROP_SEMANTIC_EDITOR_FLUSH_RESPONSE_EVENT, onResponse as EventListener);
    timeoutId = window.setTimeout(() => finish(false), timeoutMs);
    const handled = !window.dispatchEvent(
      new CustomEvent<CropSemanticEditorFlushRequestDetail>(CROP_SEMANTIC_EDITOR_FLUSH_REQUEST_EVENT, {
        cancelable: true,
        detail: { requestId },
      }),
    );
    if (!handled) finish(true);
  });
}
