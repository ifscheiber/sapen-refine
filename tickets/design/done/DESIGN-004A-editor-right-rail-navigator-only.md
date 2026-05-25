# DESIGN-004A — Simplify Editor Right Rail to Navigator Image Only

## Status

Completed

## Implementation notes

- Removed the visible right-rail `Edit BBoxes` action, persistent slice list, and `Refresh navigator` button from the crop editor rail.
- Kept the slice-count header, whole-image navigator, clickable overlay boxes, and defensive crop-ensure navigation behavior.
- BBox re-entry is now handled by the shared `BBoxes` tab instead of the right rail.

## Type

Design / right-rail cleanup ticket

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at `../sapen`.

When inspecting SaPen Core / SaPen Refine reference files, use paths prefixed with `../sapen/...`.

Do **not** assume that `apps/sapen-core/...` or `apps/sapen-refine/...` exists inside `sapen-annotate`.

## Sprint boundary

This is a focused design/UI polish sprint after commit `b52669f` (`design: align crop editor with core workspace`).

Preserve the existing annotation logic, BBox logic, mask semantics, API contracts, storage contracts, autosave/commit behavior, and Core handoff contracts.

Do not rewrite the canvas engine.
Do not port SaPen Core editor logic into `sapen-annotate`.
Use `../sapen` only as read-only visual/layout reference.


## Goal

Further simplify the editor right rail after the DESIGN-003C compact navigator implementation.

The right rail should now contain only:

1. a brief `Slices` information header
2. the navigator/overview image

Everything else currently shown below or above the navigator image should be removed from the default right rail.

## Current problem

The post-DESIGN-003 editor still shows unnecessary right-rail elements:

- `Edit BBoxes` button above the navigator image
- individual slice boxes below the navigator image
- `Refresh navigator` button

These are not needed in the editing view and take attention away from the canvas.

## Required UI

The right rail should look conceptually like:

```text
SLICES
4 slices · 4 current · 0 ready

[navigator image / overview image]
```

No persistent slice list below the navigator.
No `Edit BBoxes` button in the right rail.
No `Refresh navigator` button.

## Important behavior boundary

Do not delete the underlying functionality if it is used elsewhere.

- If `Edit BBoxes` is still needed, it should be accessible via the `BBoxes` tab or the BBox toolbar, not the right rail.
- If navigator refresh is technically needed, it should be automatic or handled internally, not exposed as a default button.
- If slice selection currently depends on the slice list, preserve selection through existing supported behavior; do not add new complex interaction logic in this ticket.

## Must preserve

- navigator image rendering
- existing image/canvas state
- existing slice/BBox data
- existing editor behavior
- existing route/API contracts

## Acceptance criteria

- [ ] Right rail shows only brief `Slices` information and navigator image.
- [ ] `Edit BBoxes` button is removed from the right rail.
- [ ] Slice boxes/list below the navigator image are removed.
- [ ] `Refresh navigator` button is removed from the default UI.
- [ ] Navigator image still renders.
- [ ] No BBox/slice/canvas logic is removed.
- [ ] No regressions in editor loading.

## Codex implementation prompt

```text
Implement DESIGN-004A in the sapen-annotate repository.

Goal:
Simplify the editor right rail so it only shows:
- brief Slices info
- navigator/overview image

Remove from the default right rail:
- Edit BBoxes button
- slice boxes/list below the navigator image
- Refresh navigator button

Do not delete underlying BBox/slice/navigation logic unless it is purely unused UI code. Preserve APIs, canvas behavior, BBox behavior, and editor state.

Run typecheck/lint/tests/build if available and report results.
```
