import { idleButtonClass } from "../editorStyles";
import { SLICE_CLASS_OPTIONS, type SliceClassValue } from "../editorTypes";

type EditorSliceClassificationPanelProps = {
  selectedSliceClass: SliceClassValue | "";
  onSelectedSliceClassChange: (value: SliceClassValue | "") => void;
  canEdit: boolean;
  classificationSaving: boolean;
  onSaveClassification: () => void;
  classificationStatus: string;
};

export function EditorSliceClassificationPanel({
  selectedSliceClass,
  onSelectedSliceClassChange,
  canEdit,
  classificationSaving,
  onSaveClassification,
  classificationStatus,
}: EditorSliceClassificationPanelProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <label className="flex min-h-11 items-center gap-2">
        <span className="text-xs text-muted-foreground">Slice classification</span>
        <select
          aria-label="Slice classification"
          value={selectedSliceClass}
          disabled={!canEdit || classificationSaving}
          onChange={(event) => onSelectedSliceClassChange(event.target.value as SliceClassValue | "")}
          className="min-h-11 rounded-md border border-border bg-input-background px-3 py-2 text-sm"
        >
          <option value="">No classification</option>
          {SLICE_CLASS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className={idleButtonClass}
        onClick={onSaveClassification}
        disabled={!canEdit || classificationSaving || !selectedSliceClass}
      >
        {classificationSaving ? "Saving classification..." : "Save classification"}
      </button>
      {classificationStatus && (
        <div className="flex min-h-11 items-center text-xs text-muted-foreground">
          {classificationStatus}
        </div>
      )}
    </div>
  );
}
