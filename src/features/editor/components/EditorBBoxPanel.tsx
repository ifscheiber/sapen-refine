import type { SliceBoundingBoxProposal } from "../editorTypes";
import { activeButtonClass, idleButtonClass } from "../editorStyles";

type EditorBBoxPanelProps = {
  boxes: SliceBoundingBoxProposal[];
  selectedBBoxId: string | null;
  replaceArmed: boolean;
  canEdit: boolean;
  status: string;
  onSelect: (bboxVersionId: string) => void;
  onArmReplace: () => void;
  onDelete: () => void;
};

export function EditorBBoxPanel({
  boxes,
  selectedBBoxId,
  replaceArmed,
  canEdit,
  status,
  onSelect,
  onArmReplace,
  onDelete,
}: EditorBBoxPanelProps) {
  const selected = boxes.find((box) => box.bboxVersionId === selectedBBoxId) ?? null;

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
    </div>
  );
}
