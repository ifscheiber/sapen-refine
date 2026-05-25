# DESIGN-003A — Align Annotate Editor Layout with SaPen Core Quick Analysis

## Status

Completed

## Implementation notes

- Replaced the normal crop editor page chrome with the Core-aligned `WorkspacePageLayout`, compact `WorkspacePageHeader`, metadata/context rows, and local workspace tabs.
- Kept the existing editor route and server data-loading path intact; missing-resource rendering still uses the prior app error surface.
- Reframed the canvas in a dark workspace surface with stable viewport-relative sizing so the annotation canvas remains the primary focus.
- Moved low-level crop details out of the main header and kept readiness issues as compact warnings/status text.

## Type

Design / UI layout ticket

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

Make the SaPen Annotate editor look and feel like the extended editor variant of SaPen Core Quick Analysis.

The current editor has too much debug/admin character:

- large green toolbar/status area
- verbose technical header
- heavy panel styling
- visually separate style from SaPen Core Quick Analysis

This ticket only addresses the editor-level layout, header, context rows, local tabs, and canvas framing. Tool hierarchy changes are handled in DESIGN-003B. Right rail changes are handled in DESIGN-003C.

## Reference target

Use SaPen Core Quick Analysis as visual reference:

```text
../sapen/apps/sapen-core/src/features/quick-analysis/QuickAnalysisView.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisTopBars.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisCanvasSurface.tsx
../sapen/apps/sapen-core/src/features/quick-analysis/components/QuickAnalysisSidebar.tsx
../sapen/apps/sapen-core/src/components/workspace
```

## Required UI changes

### 1. Compact editor header

Replace the current verbose header with a SaPen Core-like compact header.

Suggested title:

```text
Annotation Editor
```

Suggested metadata row:

```text
IMAGE  {filename}  ·  MODE  {active mode}  ·  SLICES  {slice count}  ·  EXPORT  {ready/not ready}
```

Avoid showing low-level crop coordinates in the main header. If useful, those can remain available in debug/dev-only details or future inspector UI, but not in the primary editor header.

### 2. Compact active image/context row

Replace the large green status/tool block with a compact context/status row.

Suggested structure:

```text
ACTIVE IMAGE  {filename}  |  FAMILY  {annotation family}  |  SLICES  {current/total}  |  EXPORT  {ready/not ready}
```

Blocking export/readiness issues should be shown as a slim amber warning bar, not as a large colored panel.

Example warning:

```text
Support mask required before export.
```

### 3. Editor local tabs

Introduce or restyle local editor tabs similar to Quick Analysis.

Suggested tabs:

```text
BBoxes
Semantic Masks
Support Mask
Classification
Export Readiness
```

If current routing/state names differ, preserve existing logic and only change presentation.

### 4. Canvas-centered workspace

The canvas must remain the main visual focus.

- Keep large central canvas.
- Use SaPen Core-like dark workspace surface.
- Avoid excessive panel backgrounds around the image.
- Keep canvas interaction unchanged.
- Improve layout/framing only.

### 5. Visual style

Use SaPen Core / Quick Analysis style:

- near-black app background
- dark panels
- thin muted borders
- compact spacing
- uppercase micro-labels
- muted blue-gray secondary text
- indigo/violet active states
- amber warning states
- no large green editor panel
- no heavy shadows

## Must preserve

- existing editor route
- existing auth/RBAC behavior
- existing canvas rendering
- existing pointer interaction behavior
- existing mask commit/save behavior
- existing classification save behavior
- existing export readiness behavior

## Acceptance criteria

- [ ] Editor visually aligns with SaPen Core Quick Analysis layout.
- [ ] Large green toolbar/status area is removed or restyled into compact dark rows.
- [ ] Header is compact and not overloaded with crop coordinates.
- [ ] Readiness warnings are visible but compact.
- [ ] Local editor tabs are styled like SaPen Core local tabs.
- [ ] Canvas remains central and functional.
- [ ] No canvas/mask/storage logic is changed.

## Validation

Run local checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If scripts differ, use the repo-appropriate commands.

Manual smoke test:

- open an existing image editor
- verify image canvas loads
- verify current annotation state still loads
- verify switching editor tabs/modes does not break the canvas
- verify save/commit buttons still call existing handlers

## Codex prompt

```text
Implement DESIGN-003A in the sapen-annotate repository.

Use ../sapen as read-only reference. Inspect SaPen Core Quick Analysis layout files and mirror their visual structure for the SaPen Annotate editor.

Only update layout/styling/presentation:
- compact editor header
- compact context/status row
- local editor tabs
- canvas framing
- warning presentation

Do not change canvas engine, mask semantics, storage contracts, autosave, commit logic, or handoff contracts.

Report files changed, reference patterns used, and validation results.
```
