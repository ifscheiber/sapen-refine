# DESIGN-003C — Replace Persistent Slice Metadata Cards with Compact Slice Navigator

## Status

Completed

## Implementation notes

- Replaced persistent per-slice metadata cards with a compact right rail showing slice counts, a small overview, `Edit BBoxes`, and compact slice buttons.
- Preserved the existing slice-opening and crop-generation fallback behavior.
- Reduced always-visible metadata to minimal readiness labels such as `Ready`, `Review required`, `Update crop`, and `Missing crop`.
- Did not change bbox, readiness, crop, or API logic.

## Type

Design / right-rail UX ticket

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

Redesign the editor right rail to match the compact SaPen Core Quick Analysis slice navigation pattern.

The current persistent slice metadata cards are useful diagnostically but too heavy during editing. They consume too much space and distract from the canvas and tools.

## Product decision

Detailed slice metadata should not be persistently shown while editing.

Remove the persistent cards showing details such as:

- x/y coordinates
- width/height
- bbox/crop/support/semantic/class badges
- ready/not-ready badge groups
- detailed per-slice state blocks

Instead, show a compact navigator for selecting and reviewing slices.

## Reference target

Use SaPen Core Quick Analysis right-side slice browser:

```text
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSliceBrowser.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSemanticResultsRail.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisDetectionPanel.tsx
```

## Required right rail

### Header

Suggested:

```text
SLICES
7 slices · 7 current · 0 ready
```

Use real counts where available.

### Optional overview preview

If already available and low-risk:

- show one small image overview thumbnail
- show bbox/slice labels
- keep it compact

If not available, omit rather than building new logic.

### Primary action

Keep `Edit BBoxes` if currently supported.

Place it compactly near the top of the rail.

### Slice list

Show compact items/buttons:

```text
#1  Current
#2  Current
#3  Review required
#4  Current
```

Each item should:

- select/focus the slice using existing selection behavior
- show minimal status
- use amber only for review-required/warning states
- use active/selected styling consistent with SaPen Core

## Metadata details

If detailed slice metadata remains useful, move it to one of these patterns only if low-risk:

- tooltip
- expandable details per selected slice
- future inspector panel

Do not show all slice metadata cards persistently by default.

## Must preserve

- existing slice selection behavior
- existing bbox edit flow
- existing canvas focus/preview behavior
- existing readiness status logic
- existing API contracts

## Acceptance criteria

- [ ] Persistent detailed slice metadata cards are removed from default editor rail.
- [ ] Right rail shows compact slice navigation.
- [ ] Slice selection still works.
- [ ] Edit BBoxes remains available if currently available.
- [ ] Important review/readiness statuses remain visible in compact form.
- [ ] Canvas remains the focus of the editor.
- [ ] No slice readiness or bbox logic is changed.

## Validation

Manual smoke test:

- open editor with multiple slices
- use right rail to select slices
- verify canvas/selection updates as before
- open bbox edit mode
- verify readiness warning remains visible somewhere compact
- verify no detailed metadata cards persist by default

Run local checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Codex prompt

```text
Implement DESIGN-003C in the sapen-annotate repository.

Use ../sapen SaPen Core Quick Analysis slice browser/rail components as read-only visual reference.

Replace persistent detailed slice metadata cards with a compact slice navigator:
- header counts
- optional compact overview preview
- Edit BBoxes action if existing
- compact slice buttons/list with minimal status

Do not change slice selection logic, bbox logic, readiness logic, API contracts, or canvas behavior.

Report files changed, what metadata was removed from persistent display, and validation results.
```
