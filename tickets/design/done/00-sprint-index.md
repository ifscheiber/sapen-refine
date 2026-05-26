# DESIGN-003 Sprint — Align SaPen Annotate Editor with SaPen Core Quick Analysis Design

## Status

Completed

## Implementation notes

- Implemented the sprint as one cohesive editor redesign slice because the layout, toolbar, right rail, polygon UX, and smoke tests are tightly coupled.
- Reused local SaPen Annotate workspace shell components and design tokens while using `../sapen` Quick Analysis and Refine files only as read-only visual/interaction references.
- Preserved the existing editor routes, API contracts, mask serialization/storage contracts, commit handlers, and review/readiness domain logic.
- Updated editor design documentation in `docs/01-architecture/design-system.md`, `docs/03-features/editor.md`, `docs/05-design-system/components.md`, and `docs/src/components/editor.md`.
- Validation completed with targeted browser smokes, typecheck, lint, build, and design-hardcoding checks. Full `npm test` was attempted but remained blocked by local DB access and unrelated CLI stdout expectations documented in DESIGN-003E.

## Sprint goal

Redesign the SaPen Annotate image/crop annotation editor so that it visually and structurally aligns with the SaPen Core Quick Analysis editor, while preserving the existing annotation functionality.

The editor is logically far enough along, but currently looks too much like a grown debug/admin editor. The target is an extended SaPen Core Quick Analysis-style editor:

- compact SaPen workspace shell
- compact editor header and context/status rows
- grouped toolbars
- polygon-first annotation workflow
- Background label instead of a primary Eraser tool
- large canvas as the central focus
- compact right-side slice navigator
- no persistent heavy slice metadata cards

## Sprint tickets

Implement in this order:

1. `DESIGN-003A-editor-layout-quick-analysis-parity.md`
   - Align editor shell/header/context/tabs/canvas layout with SaPen Core Quick Analysis.

2. `DESIGN-003B-toolbar-polygon-first-background-label.md`
   - Redesign toolbar/tool hierarchy: Polygon primary, Background label instead of Eraser as the main deletion model.

3. `DESIGN-003C-right-rail-compact-slice-navigator.md`
   - Replace persistent slice metadata cards with compact slice navigation.

4. `DESIGN-003D-polygon-closed-shape-vertex-adjustment-ux.md`
   - Surface/enable closed-polygon vertex adjustment UX only if existing interaction support is available or trivially reusable.

5. `DESIGN-003E-editor-design-validation-and-smoke-tests.md`
   - Validation/smoke-test pass to ensure design changes did not break annotation behavior.

## Non-goals for the sprint

- No canvas engine rewrite.
- No mask storage/serialization changes.
- No Core handoff contract changes.
- No autosave/commit contract changes.
- No backend data-model changes.
- No new image processing logic.
- No migration of SaPen Core editor logic into SaPen Annotate.
- No implementation of persistent slice metadata inspector in this sprint.

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


## Desired implementation style

Codex should reuse existing `sapen-annotate` components and CSS tokens where possible. If a local component is missing, mirror the relevant SaPen Core visual pattern locally. Do not import from `../sapen/...` unless the repository is intentionally configured to do so.

## Suggested sprint commit structure

Prefer one focused commit per ticket:

```text
Design 003A: Align annotate editor layout with quick analysis
Design 003B: Redesign annotate toolbar for polygon-first labeling
Design 003C: Replace slice metadata cards with compact navigator
Design 003D: Surface polygon vertex adjustment UX
Design 003E: Add editor design validation coverage
```
