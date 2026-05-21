import { formatVersion } from "../editorFormatters";
import { idleButtonClass } from "../editorStyles";
import type { ImageReviewState, ReviewAction, ReviewableState } from "../editorTypes";

type EditorReviewPanelProps = {
  reviewState: ImageReviewState | null;
  reviewItems: ReviewableState[];
  reviewStatus: string;
  reviewComment: string;
  onReviewCommentChange: (comment: string) => void;
  reviewBusyKey: string | null;
  onReviewAction: (reviewable: ReviewableState, action: ReviewAction) => void;
};

export function EditorReviewPanel({
  reviewState,
  reviewItems,
  reviewStatus,
  reviewComment,
  onReviewCommentChange,
  reviewBusyKey,
  onReviewAction,
}: EditorReviewPanelProps) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Export-ready: {reviewState ? (reviewState.exportReady ? "Yes" : "No") : "Loading"}
        </span>
        {reviewState && !reviewState.exportReady && (
          <span>{reviewState.warnings.length} missing approved item(s)</span>
        )}
        {reviewStatus && <span>{reviewStatus}</span>}
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        {reviewItems.map((item) => {
          const version = item.latestVersion;
          const busyPrefix = version ? `${item.type}:${version.id}:` : "";
          return (
            <div key={item.type} className="rounded-md border border-border bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Latest: {formatVersion(item.latestVersion)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Approved: {formatVersion(item.latestApprovedVersion)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.exportReady ? "Ground truth" : "Not ready"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  aria-label={`Submit ${item.label}`}
                  className={idleButtonClass}
                  disabled={!item.actions.canSubmit || reviewBusyKey?.startsWith(busyPrefix)}
                  onClick={() => onReviewAction(item, "submit")}
                >
                  Submit
                </button>
                <button
                  aria-label={`Approve ${item.label}`}
                  className={idleButtonClass}
                  disabled={!item.actions.canApprove || reviewBusyKey?.startsWith(busyPrefix)}
                  onClick={() => onReviewAction(item, "approve")}
                >
                  Approve
                </button>
                <button
                  aria-label={`Reject ${item.label}`}
                  className={idleButtonClass}
                  disabled={!item.actions.canReject || reviewBusyKey?.startsWith(busyPrefix)}
                  onClick={() => onReviewAction(item, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <label className="mt-2 block text-xs text-muted-foreground">
        Review comment / reject reason
        <textarea
          aria-label="Review comment"
          value={reviewComment}
          onChange={(event) => onReviewCommentChange(event.target.value)}
          className="mt-1 min-h-16 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground"
        />
      </label>
    </div>
  );
}
