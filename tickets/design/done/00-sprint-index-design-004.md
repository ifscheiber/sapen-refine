# DESIGN-004 Sprint — Editor Polish: Navigator Simplification and BBox Tab Integration

## Status

Completed

## Implementation notes

- Implemented the sprint as one cohesive polish slice because the right rail, BBox route shell, BBox toolbar, and smoke-test expectations are tightly coupled.
- Added a shared Core-aligned editor workspace frame for the BBox and crop-mask editor routes.
- Simplified the crop editor right rail to slice counts plus the whole-image navigator only.
- Replaced the BBox stage's separate "Step 1" page treatment with the shared `Annotation Editor` shell, active `BBoxes` tab, and compact `BBox work areas` toolbar.
- Preserved BBox, crop, mask, API, storage, and route contracts.

## Sprint goal

Polish the editor after the first successful DESIGN-003 pass.

The current editor is already much closer to the SaPen Core / Quick Analysis style, but two issues remain:

1. The right rail is still too busy.
   - The slice boxes below the navigator image are not needed.
   - The `Edit BBoxes` button above the navigator image is not needed.
   - The `Refresh navigator` button is not needed.
   - Only the brief `Slices` information and navigator image should remain.

2. The BBox editor still feels like a separate page.
   - Clicking the `BBoxes` tab should keep the user inside the same editor shell/tab system.
   - The BBox editor should not be a visually different “Step 1” page.
   - The large grey/green instruction box above the BBox editor should be removed.
   - Instead, BBox editing should use a compact toolbar similar to the SaPen Core Images / Quick Analysis instance-segmentation toolbar.

## Sprint tickets

Implement in this order:

1. `DESIGN-004A-editor-right-rail-navigator-only.md`
2. `DESIGN-004B-integrate-bbox-editor-into-editor-tab.md`
3. `DESIGN-004C-bbox-toolbar-core-style.md`
4. `DESIGN-004D-editor-polish-validation-smoke.md`

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


## Useful read-only reference areas in `../sapen`

Use these as visual/layout references only:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/quick-analysis/components
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/apps/sapen-core/src/components/workspace
../sapen/apps/sapen-core/src/features/shell
../sapen/packages/ui/src/styles/theme.css
```

Because exact file names may differ, use `rg` inside `../sapen/apps/sapen-core/src/features` for terms such as:

```text
toolbar
Toolbar
Instance
Segmentation
Image
QuickAnalysisTopBars
SliceBrowser
CanvasSurface
```

Reference goal:
The BBox editor toolbar should visually resemble the compact SaPen Core image/quick-analysis/instance-segmentation toolbars, not the current large instruction card.
