"use client";

import { useEffect, useState } from "react";

import { WorkspaceUtilitySection } from "@/components/workspace/WorkspaceLayout";
import { Slider } from "@/components/ui/slider";
import {
  CROP_SEMANTIC_EDITOR_STATUS_EVENT,
  dispatchCropSemanticEditorCommand,
  type CropSemanticEditorStatusDetail,
} from "./cropSemanticEditorEvents";
import { idleButtonClass } from "./editorStyles";

function statusText(state: CropSemanticEditorStatusDetail["saveState"]) {
  if (state === "dirty") return "Unsaved changes";
  if (state === "saving") return "Saving";
  if (state === "saved") return "Saved";
  if (state === "failed") return "Save failed";
  return "Idle";
}

export function CropSemanticEditorStatusRailClient({ cropId }: { cropId: string }) {
  const [status, setStatus] = useState<CropSemanticEditorStatusDetail | null>(null);

  useEffect(() => {
    const onStatus = (event: CustomEvent<CropSemanticEditorStatusDetail>) => {
      if (event.detail.cropId !== cropId) return;
      setStatus(event.detail);
    };
    window.addEventListener(CROP_SEMANTIC_EDITOR_STATUS_EVENT, onStatus as EventListener);
    return () => window.removeEventListener(CROP_SEMANTIC_EDITOR_STATUS_EVENT, onStatus as EventListener);
  }, [cropId]);

  if (!status) return null;

  return (
    <WorkspaceUtilitySection title="Display" className="pt-2">
      <div className="space-y-4 text-[11px] font-medium text-[var(--text-secondary)]">
        <div className="space-y-1.5" title={status.warning ?? undefined}>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Save</span>
            <span className="text-right text-[var(--text-primary)]" role="status">
              {statusText(status.saveState)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Target</span>
            <span className="text-right text-[var(--text-primary)]">{status.editTarget}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Ready</span>
            <span className="text-right text-[var(--text-primary)]">{status.readiness}</span>
          </div>
          {status.status ? <div className="text-[var(--text-primary)]">{status.status}</div> : null}
          {status.warning ? <div className="sr-only">{status.warning}</div> : null}
          {status.toolState ? <div title={status.toolState}>{status.toolState}</div> : null}
        </div>

        <div className="space-y-3 border-t border-[var(--border-subtle)] pt-3">
          <label className="block space-y-1.5">
            <span>Brush {status.brushRadius}px</span>
            <Slider
              aria-label="Brush size"
              value={[status.brushRadius]}
              min={1}
              max={80}
              step={1}
              onValueChange={(value) =>
                dispatchCropSemanticEditorCommand({
                  cropId,
                  command: "setBrushRadius",
                  value: value[0] ?? status.brushRadius,
                })
              }
            />
          </label>
          {status.semanticOpacityControls.map((control) => (
            <label key={control.labelId} className="block space-y-1.5">
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full border border-[var(--border-subtle)]"
                    style={{
                      backgroundColor: `rgb(${control.swatch[0]}, ${control.swatch[1]}, ${control.swatch[2]})`,
                    }}
                    aria-hidden="true"
                  />
                  {control.name}
                </span>
                <span className="tabular-nums">{Math.round(control.value * 100)}%</span>
              </span>
              <Slider
                aria-label={`${control.name} opacity`}
                value={[control.value]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(value) =>
                  dispatchCropSemanticEditorCommand({
                    cropId,
                    command: "setSemanticLabelOpacity",
                    labelId: control.labelId,
                    value: value[0] ?? control.value,
                  })
                }
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
          {status.canRetrySave ? (
            <button
              type="button"
              className={idleButtonClass}
              onClick={() => dispatchCropSemanticEditorCommand({ cropId, command: "retrySave" })}
            >
              Retry save
            </button>
          ) : null}
          <button
            type="button"
            className={idleButtonClass}
            onClick={() => dispatchCropSemanticEditorCommand({ cropId, command: "reloadLatest" })}
            disabled={!status.canReloadLatest}
          >
            Reload latest
          </button>
        </div>
      </div>
    </WorkspaceUtilitySection>
  );
}
