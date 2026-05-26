# DESIGN-003D — Surface Closed-Polygon Vertex Adjustment UX

## Status

Completed

## Implementation notes

- Implemented a closed editable polygon preview state without changing the mask storage or fill model.
- Users can close a polygon, drag existing vertices, apply the polygon, or cancel it before any mask mutation is committed.
- Applying the polygon still uses the existing fill/patch code path, including Background label clearing.
- Kept undo/redo behavior tied to the existing mask history because the mask only changes on apply.

## Type

Design / interaction-surface ticket

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

Improve the Polygon tool UX so that, after a polygon is closed, users can still adjust/move its fixed points before committing/filling — but only by surfacing or reusing existing interaction support.

Polygon is the most important annotation tool, so it must feel precise and editable.

## Important boundary

This ticket must not rewrite the canvas engine.

Codex should first inspect whether `sapen-annotate` already supports polygon preview handles / point dragging, or whether an equivalent implementation exists in local code that is just not surfaced cleanly.

The uploaded SaPen reference shows similar concepts in Refine editor code:

```text
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
```

That reference includes polygon/lasso state such as points, drag index, preview drawing, and point handles. Use this as a read-only reference only.

Do not port the whole editor.

## Desired UX

For polygon mode:

1. User clicks points.
2. User closes polygon.
3. Polygon remains in an editable preview state.
4. Vertices/fixpoints are visible.
5. User can drag vertices to adjust shape.
6. User confirms/fills/applies polygon.
7. Existing mask fill/patch logic is used.

Suggested UI labels:

```text
Polygon
Close polygon
Apply polygon
Cancel
```

If the current workflow closes and applies immediately, Codex may only change this if existing code already supports an intermediate editable preview state or if the change is very small and does not alter mask semantics.

## Design requirements

- Vertex handles should be visible but subtle.
- Active polygon outline should use SaPen Core-style indigo/violet.
- Hovered/dragged vertex should have clear feedback.
- Use compact helper text, e.g.:

```text
Click to add points · close polygon · drag points to refine · apply
```

- Do not clutter the toolbar.

## Fallback behavior

If local `sapen-annotate` does not support editable closed polygons and enabling it would require a real canvas-engine change:

- do not implement the behavior in this design sprint
- keep polygon visually primary
- add a clear follow-up ticket
- document what is missing

Do not fake the behavior visually if it does not work.

## Acceptance criteria

If implemented:

- [ ] Polygon can enter a closed editable preview state.
- [ ] Closed polygon vertices/fixpoints are visible.
- [ ] Vertices can be moved before apply/commit.
- [ ] Applying polygon uses existing fill/patch semantics.
- [ ] Cancel returns to previous state without unintended mask changes.
- [ ] Existing undo/redo remains correct.

If not implemented:

- [ ] Codex documents why it would require logic/canvas-engine work.
- [ ] Codex creates or proposes a follow-up implementation ticket.
- [ ] No partial/broken polygon UX is shipped.

## Validation

Manual smoke test if implemented:

- draw polygon
- close polygon
- drag at least two vertices
- apply/fill polygon
- undo
- redo
- apply polygon with Background label
- verify no incorrect mask artifacts

Run local checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Codex prompt

```text
Implement DESIGN-003D in the sapen-annotate repository only if existing/local polygon interaction support can be surfaced safely.

Use ../sapen SaPen Refine EditorClient polygon/lasso implementation as read-only reference, especially the concept of polygon points, preview handles, and drag index.

Do not port the whole editor and do not rewrite the canvas engine.

Goal:
- Polygon is primary.
- After closing polygon, allow moving fixpoints before applying/filling, if this can be achieved by surfacing existing behavior or making a very small UI/controller adjustment.
- Use existing fill/patch semantics.

If this requires substantial logic changes, do not implement in this design sprint. Document the limitation and create/propose a follow-up ticket.

Report whether implemented or deferred, files changed, and validation results.
```
