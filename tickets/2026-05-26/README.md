# SaPen Annotate → SaPen-CNN Training Handoff Tickets

These tickets assume the current work happens in `sapen-annotate`.

Important boundary:

```text
../sapen-cnn is read-only for Codex during this sprint.
```

Ticket sequence:

1. `done/EX-001-sapen-cnn-training-dataset-contract.md`  
   Define the architecture/data contract.

2. `done/EX-002-manifest-only-training-snapshot-mode.md`
   Add manifest-only snapshot transport without making ZIP the primary training path.

3. `done/EX-003-full-image-training-from-crop-annotations.md`
   Build full-image instance/classification manifest data derived from crop annotations.

4. `done/EX-004-crop-semantic-training-dataset-snapshot.md`
   Build crop semantic segmentation manifest data for Sap/Heartwood and Copper models.

5. `done/EX-005-annotate-side-local-sapen-cnn-materializer.md`
   Add an annotate-side local materializer that creates `sapen-cnn`-compatible local folders/manifests without editing `sapen-cnn`.

## Editor Follow-Up Sprint

Active and completed editor follow-up tickets added after the export sprint:

1. `done/DESIGN-022-per-label-opacity-support-contour-state-cleanup.md`
   Add per-label semantic opacity, contour-only support display, and a quieter editor status rail.

2. `done/FEAT-020-live-navigator-refresh-on-mask-changes.md`
   Refresh the crop navigator from local mask edits without requiring slice switches or persisted preview reloads.

3. `done/FEAT-019-reeditable-closed-polygons-semantic-masks.md`
   Preserve in-session closed polygon geometry so committed semantic polygons can be reselected and edited.

4. `FEAT-021-image-level-submission-review-workflow.md`
   Replace mask-level review controls with a persisted image-level submission/review workflow.
