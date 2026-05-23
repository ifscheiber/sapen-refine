import Link from "next/link";

import type { DerivedSliceCrop, SliceBoundingBoxProposal } from "../editorTypes";
import { activeButtonClass, idleButtonClass } from "../editorStyles";

type EditorBBoxPanelProps = {
  projectId: string;
  imageId: string;
  boxes: SliceBoundingBoxProposal[];
  crops: DerivedSliceCrop[];
  selectedBBoxId: string | null;
  replaceArmed: boolean;
  canEdit: boolean;
  status: string;
  onSelect: (bboxVersionId: string) => void;
  onArmReplace: () => void;
  onDelete: () => void;
  onGenerateCrop: () => void;
};

export function EditorBBoxPanel({
  projectId,
  imageId,
  boxes,
  crops,
  selectedBBoxId,
  replaceArmed,
  canEdit,
  status,
  onSelect,
  onArmReplace,
  onDelete,
  onGenerateCrop,
}: EditorBBoxPanelProps) {
  const selected = boxes.find((box) => box.bboxVersionId === selectedBBoxId) ?? null;
  const selectedCrop =
    crops
      .filter((crop) => crop.bboxVersionId === selectedBBoxId)
      .sort((a, b) => b.version - a.version)[0] ?? null;

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

      {selected && (
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
