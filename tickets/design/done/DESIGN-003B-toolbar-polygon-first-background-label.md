# DESIGN-003B — Redesign Toolbar for Polygon-First Labeling and Background-as-Erase

## Status

Completed

## Implementation notes

- Made Polygon the default and first tool, with Lasso and Brush as secondary tools.
- Removed Eraser from the primary toolbar surface and exposed Background as a normal selectable label backed by the existing background/zero mask value.
- Kept the existing mask patch/fill semantics and commit API behavior; Background is applied through the existing polygon, lasso, and brush paths.
- Restyled tool, label, history, commit, opacity, brush-size, and zoom controls into compact dark token-based groups.

## Type

Design / tool UX ticket

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

When inspecting SaPen Core / SaPen Refine reference files, use paths prefixed with `../sapen/...`.

Do **not** assume that `apps/sapen-core/...` or `apps/sapen-refine/...` exists inside `sapen-annotate`.

## Critical boundary

This is a **design/UI sprint**.

Codex must not port SaPen Core editor logic into `sapen-annotate`.

Use SaPen Core and SaPen Refine only as visual/layout/interaction references. Preserve the existing `sapen-annotate` annotation logic, API contracts, mask storage contracts, canvas rendering behavior, autosave/commit behavior, and handoff contracts.

Do not rewrite the canvas engine.


## Read-only reference files in `../sapen`

Inspect these as visual/layout references:

```text
../sapen/apps/sapen-core/src/features/quick-analysis/QuickAnalysisView.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisTopBars.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisCanvasSurface.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSliceBrowser.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSemanticResultsRail.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSidebar.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisDetectionPanel.tsx
../sapen/apps/sapen-core/src/features/image-review/canvasToolbarStyles.ts
../sapen/apps/sapen-core/src/components/workspace
../sapen/apps/sapen-core/src/features/shell/AppShellLayout.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/packages/ui/src/styles/theme.css
```

Inspect these as Refine/Annotate editor references, but do not copy their business logic:

```text
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
../sapen/apps/sapen-refine/src/components/EditorToolsBar.tsx
../sapen/apps/sapen-refine/src/app/app/shell/annotationConfig.ts
../sapen/apps/sapen-refine/src/mask/labels.ts
../sapen/apps/sapen-refine/src/app/app/quick-analysis/corrections/new/QuickAnalysisCorrectionCanvasEditor.tsx
../sapen/apps/sapen-refine/src/app/app/corrections/new/CoreCorrectionCanvasEditor.tsx
```

Important known reference detail:
`../sapen/apps/sapen-refine/src/mask/labels.ts` already defines a background label (`Labels.BG`, `Background`) and `../sapen/apps/sapen-refine/src/app/app/shell/annotationConfig.ts` also exposes a `Background` annotation label. This supports the UX direction that “erasing” should be handled by painting/labeling Background rather than by a separate primary Eraser tool.


## Goal

Redesign the SaPen Annotate editor toolbar so that the tool hierarchy matches the real annotation workflow:

1. **Polygon is the primary tool.**
2. Brush is secondary.
3. A standalone primary Eraser tool should no longer be emphasized.
4. Deletion/clearing should be done by selecting the `Background` label and applying it with the same tools used for other labels.

This is a design/tool-surface ticket. It must not change mask storage contracts or introduce a new mask model.

## Important product decision

The Eraser should not be the main deletion concept.

Instead:

```text
Select label: Background
Use Polygon / Lasso / Brush to paint Background
```

This allows “erasing” with all available tools, including polygon and lasso, and keeps the model consistent: tools apply labels; Background is just the clearing label.

## Existing reference evidence

In the SaPen Refine reference repo, Background already exists:

```text
../sapen/apps/sapen-refine/src/mask/labels.ts
../sapen/apps/sapen-refine/src/app/app/shell/annotationConfig.ts
```

Known labels include:

```text
Labels.BG = 0
Background
```

Codex should check the local `sapen-annotate` label model. If a Background label already exists locally, surface it in the toolbar. If it does not exist locally but the underlying mask model has a background/clear value, expose it using that existing value.

Do not introduce a new label value unless it is already part of the mask contract.

## Required toolbar structure

Replace the current wide/debug-style toolbar with compact grouped controls.

### Tool group

Order:

```text
Polygon
Lasso
Brush
```

Polygon should be visually first and treated as the default/primary annotation tool where safe.

Brush should remain available for touch-up work but not visually dominate.

If a freehand lasso exists, keep it as a secondary shape tool.

### Label group

Show available labels as compact segmented buttons/chips.

Required conceptual labels where supported:

```text
Background
Sapwood
Heartwood
Cu
Support
Copper
Unknown
```

Only show labels that are valid for the active annotation family/mode.

`Background` should be clearly available in the label group and may have a muted/empty visual style.

### Remove/de-emphasize Eraser

- Remove Eraser as a primary tool button.
- If an Eraser implementation still exists internally, do not delete logic unless safe.
- If needed, keep it hidden, deprecated, or only as an alias to `Background + Brush`, but do not present it as the primary way to delete annotations.
- Do not break keyboard shortcuts if they exist; update labels/help text accordingly.

### Action groups

Keep compact groups:

```text
History:
Undo
Redo
Reload latest

Commit:
Commit mask
Save classification
```

### Control group

Keep compact sliders/controls:

```text
Brush size
Semantic opacity
Support opacity
Zoom
```

Disable brush size only when irrelevant, but avoid hiding controls in a way that causes layout jumping.

## Visual style

Mirror SaPen Core Quick Analysis toolbar style:

```text
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisTopBars.tsx
../sapen/apps/sapen-core/src/features/image-review/canvasToolbarStyles.ts
```

Use:

- compact dark buttons
- thin borders
- indigo/violet active states
- muted secondary labels
- amber only for warnings
- no large green background panel

## Functional boundary

This ticket may change default selected UI state if safe:

- Prefer default tool: `Polygon`
- Prefer default label: current workflow-specific label, or first valid non-background label if current behavior requires it

But it must not:

- rewrite fill algorithms
- rewrite mask patch logic
- change mask label IDs
- change storage format
- change autosave/commit contracts

## Acceptance criteria

- [ ] Toolbar is compact and grouped.
- [ ] Polygon is visually first and primary.
- [ ] Brush is still available but secondary.
- [ ] Background label is selectable if supported by existing model.
- [ ] Eraser is no longer presented as the main deletion tool.
- [ ] Applying Background can clear annotations using available tools where existing logic supports it.
- [ ] Existing save/commit behavior still works.
- [ ] No mask storage/serialization contract changes are introduced.

## Validation

Manual smoke test:

- select Polygon and draw/fill a label
- select Background and apply it over an existing annotation
- verify background clears/overwrites the annotation as expected
- use Brush for touch-up
- use Lasso if available
- undo/redo
- commit/save mask

Run local checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Codex prompt

```text
Implement DESIGN-003B in the sapen-annotate repository.

Use ../sapen as read-only reference. Inspect SaPen Core Quick Analysis toolbar styling and SaPen Refine label definitions.

Redesign the toolbar only:
- Polygon first and primary
- Lasso secondary
- Brush secondary
- Background available as a normal label
- Eraser no longer a primary tool concept
- group history, commit, and controls compactly

Do not change mask label IDs, storage contracts, canvas engine, or commit/autosave contracts. If Background is not supported by the local mask model, do not invent a new contract; document the limitation and create a follow-up.

Report files changed, how Background was mapped, and validation results.
```
