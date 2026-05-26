# DESIGN-004B — Integrate BBox Editor into the Main Editor Tab System

## Status

Completed

## Implementation notes

- Added a shared `AnnotationEditorWorkspace` frame for editor header, metadata, context row, local tabs, and optional navigator rail.
- Updated `/crop/bboxes` to render inside the same `Annotation Editor` shell with the `BBoxes` tab active.
- Kept existing `/crop/bboxes` route/deep-link behavior and BBox mutation APIs unchanged.
- Oversized-image handling remains in place, now inside the editor shell.

## Type

Design / route-layout integration ticket

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


## Goal

The BBox editor must no longer feel like a separate page.

Clicking the `BBoxes` tab in the editor should keep the user inside the same SaPen Annotate editor shell and tab menu.

The BBox editing experience should be a tab state within the editor, consistent with:

```text
BBoxes | Semantic Masks | Support Mask | Classification | Export Readiness
```

## Current problem

The current BBox editor screen still looks like a different page:

- title changes to `Step 1: Mark slice work areas: ...`
- no consistent `Annotation Editor` header/tab structure
- large separate instruction panel
- separate “Image” back button
- visually detached from the rest of the editor

This breaks the mental model: the user clicked a tab, but the UI behaves like a separate workflow page.

## Required behavior

### Same editor shell

The BBox editor should use the same editor page hierarchy as the rest of the annotation editor:

- SaPen Annotate authenticated shell
- same left sidebar
- same compact editor header
- same active image context row
- same editor tab menu
- same dark canvas workspace style

### BBoxes tab active

When the user is editing BBoxes:

- `BBoxes` tab is active
- other tabs remain visible
- switching back to `Semantic Masks`, `Support Mask`, etc. behaves like tab navigation

### Remove separate page wording

Avoid making the screen title:

```text
Step 1: Mark slice work areas
```

Use the editor title/context instead.

Acceptable:

```text
Annotation Editor
IMAGE  T 6574.JPG · MODE  BBoxes · SLICES  4 · EXPORT  Not ready
```

Within the toolbar, a small helper label may say:

```text
BBox work areas
Draw rough boxes around visible slices.
```

But not as a large separate page hero/instruction card.

### Routing

Preserve existing routes and deep links if necessary.

If the existing BBox editor route is separate, it may continue to exist internally, but visually it must render through the same editor layout.

Do not break existing links from:

- image page
- editor tabs
- tests
- upload flow
- crop workflow
- closeout flow

## Must preserve

- BBox proposal display
- BBox editing behavior
- proposal selection behavior
- replace geometry behavior if currently supported
- delete proposal behavior if currently supported
- confirmation/continue behavior
- existing API contracts
- existing Playwright smoke behavior where still logically valid

## Acceptance criteria

- [ ] BBox editor renders within the same editor shell as semantic/support/classification tabs.
- [ ] `BBoxes` tab is visible and active during BBox editing.
- [ ] The BBox editor no longer looks like a separate `Step 1` page.
- [ ] The separate large instruction panel is removed or replaced by compact toolbar/helper text.
- [ ] Existing BBox logic and routes continue to work.
- [ ] Existing tests are updated only for UI wording/layout changes, not logic changes.

## Codex implementation prompt

```text
Implement DESIGN-004B in the sapen-annotate repository.

Goal:
Make BBox editing a consistent tab within the Annotation Editor, not a separate-looking Step 1 page.

Preserve existing routes/deep links if needed, but render BBox editing through the same editor shell:
- same header
- same context row
- same tab menu with BBoxes active
- same dark workspace/canvas styling

Remove separate page wording and separate-page visual treatment. Do not change BBox logic or API contracts.

Run validation and report files changed.
```
