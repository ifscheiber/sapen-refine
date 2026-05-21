import { idleButtonClass } from "../editorStyles";
import { formatCorrectionModel, formatCorrectionScore } from "../editorFormatters";
import type { CorrectionContext } from "../editorTypes";

type EditorAssistedCorrectionPanelProps = {
  correctionContext: CorrectionContext | null;
  correctionStatus: string;
  predictionOverlayEnabled: boolean;
  onPredictionOverlayEnabledChange: (enabled: boolean) => void;
  canEdit: boolean;
  predictionLoaded: boolean;
  onUsePredictionAsStartingMask: () => void;
};

export function EditorAssistedCorrectionPanel({
  correctionContext,
  correctionStatus,
  predictionOverlayEnabled,
  onPredictionOverlayEnabledChange,
  canEdit,
  predictionLoaded,
  onUsePredictionAsStartingMask,
}: EditorAssistedCorrectionPanelProps) {
  const correctionModelLabel = formatCorrectionModel(correctionContext);
  const correctionScoreLabel = formatCorrectionScore(correctionContext);

  return (
    <div className="mb-3 rounded-md border border-border bg-background p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            Prediction / model proposal · {correctionContext?.targetType ?? "Loading"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {correctionModelLabel} {correctionScoreLabel ? `· ${correctionScoreLabel}` : ""}
          </div>
          {correctionStatus && (
            <div className="mt-1 text-xs text-muted-foreground">{correctionStatus}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={predictionOverlayEnabled}
              onChange={(event) => onPredictionOverlayEnabledChange(event.target.checked)}
            />
            <span>Prediction overlay</span>
          </label>
          <button
            className={idleButtonClass}
            onClick={onUsePredictionAsStartingMask}
            disabled={!canEdit || !predictionLoaded}
          >
            Use prediction as starting mask
          </button>
        </div>
      </div>
    </div>
  );
}
