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
    <WorkspaceUtilitySection title="Annotation State" className="pt-2">
      <div className="space-y-4 text-[11px] font-medium text-[var(--text-secondary)]">
        <div className="space-y-1.5">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Family</span>
            <span className="text-right text-[var(--text-primary)]">{status.family}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Label</span>
            <span className="text-right text-[var(--text-primary)]">{status.label}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Tool</span>
            <span className="text-right text-[var(--text-primary)]">{status.tool}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Save</span>
            <span className="text-right text-[var(--text-primary)]" role="status">
              {statusText(status.saveState)}
            </span>
          </div>
        </div>

        {status.status ? <div className="text-[var(--text-primary)]">{status.status}</div> : null}
        {status.warning ? (
          <div className="border border-[var(--border-warning)] bg-[var(--warning-surface)] px-2.5 py-2 text-[var(--warning-text)]">
            {status.warning}
          </div>
        ) : null}
        {status.toolState ? <div>{status.toolState}</div> : null}

        <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
          <div>{status.support}</div>
          <div>{status.semantic}</div>
          <div>{status.classification}</div>
          <div>{status.readiness}</div>
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
          <label className="block space-y-1.5">
            <span>Semantic opacity {Math.round(status.semanticOpacity * 100)}%</span>
            <Slider
              aria-label="Semantic opacity"
              value={[status.semanticOpacity]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(value) =>
                dispatchCropSemanticEditorCommand({
                  cropId,
                  command: "setSemanticOpacity",
                  value: value[0] ?? status.semanticOpacity,
                })
              }
            />
          </label>
          <label className="block space-y-1.5">
            <span>Support opacity {Math.round(status.supportOpacity * 100)}%</span>
            <Slider
              aria-label="Support opacity"
              value={[status.supportOpacity]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(value) =>
                dispatchCropSemanticEditorCommand({
                  cropId,
                  command: "setSupportOpacity",
                  value: value[0] ?? status.supportOpacity,
                })
              }
            />
          </label>
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
