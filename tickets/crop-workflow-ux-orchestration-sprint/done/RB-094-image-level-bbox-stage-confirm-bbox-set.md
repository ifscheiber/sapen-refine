# RB-094 — Image-Level BBox Stage and Confirm BBox Set

## Status

Proposed / Depends on RB-093

## Priority

High

## Type

UX / Editor / BBox Workflow / State / Tests

## Goal

Turn the existing BBox proposal mode into a clear first workflow stage for each image.

## Desired User Flow

```text
Open image
→ draw BBoxes around all slices
→ save BBoxes
→ confirm BBox set
→ continue to slice annotation workspace
```

## Scope

- Add image-level BBox stage UI.
- Show clear instruction: “Step 1: mark slice work areas”.
- Add “Confirm BBox set / Continue to slice annotation”.
- Prevent users from confusing BBoxes with ground-truth masks.
- Ensure confirmed BBoxes remain editable through an explicit “Edit BBoxes” action.
- Show warning if no BBoxes exist.
- Keep append-only BBox versioning.

## Possible Persistence

If needed, add lightweight workflow state:

```text
ImageCropWorkflowState
bboxSetStatus = DRAFT | CONFIRMED | NEEDS_UPDATE
```

If existing data can infer status, avoid schema change and document inference.

## Non-Goals

- No crop support editor changes.
- No semantic annotation.
- No export changes.
- No BBox review/approval as ground-truth.

## Tests

- BBox stage appears for image.
- User can draw and confirm BBox set.
- Reload keeps confirmed state.
- Confirmed BBox set enables slice annotation navigation.
- Editing confirmed BBox creates new version or marks needs-update.

## Acceptance Criteria

1. BBox workflow stage is clear.
2. User can confirm BBox set.
3. Confirmation does not imply ground-truth approval.
4. Existing BBox APIs remain compatible.
5. Docs and smoke tests updated.
6. Full validation passes.
