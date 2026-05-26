# DESIGN-022 — Per-Label Semantic Opacity and Simplified Editor State Panel

## Status

Done

## Type

Editor UX / mask visualization / right-rail cleanup ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout reference. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## Background

The current Annotation Editor still has several visualization and layout issues:

1. Semantic mask opacity is global.
   - This makes it difficult to tune Sapwood, Heartwood, Cu, Background/Unknown visualization independently.
   - In practice, different mask colors need different opacity to remain readable over the original image.

2. Support mask visualization should not be a filled overlay.
   - Support mask should be displayed as a line/contour only.
   - The original image should remain clearly visible.
   - A support opacity slider is therefore unnecessary.

3. The right-side annotation information area is too verbose.
   - The `ANNOTATION STATE` section currently consumes too much vertical space.
   - The yellow warning/info box is too dominant.
   - Some of the text duplicates information already expressed by disabled labels/tabs/readiness states.
   - For the normal editing workflow, this information should be removed or greatly reduced.

## Goal

Improve mask visualization and reduce editor UI noise:

- add per-label semantic opacity controls
- render support mask as contour/line only, not as filled area
- remove the support opacity slider
- remove the overly dominant yellow info/warning box and excessive annotation state text
- preserve all existing mask data and editor behavior

## Required reference inspection

Inspect local editor/mask rendering files:

```text
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/features/editor
src/app/app/projects/[projectId]/images/[imageId]
src/lib/projectsClient.ts
```

Search local repo for:

```text
opacity
semantic opacity
support opacity
support mask
semantic mask
overlay
canvas
drawImage
label color
Sapwood
Heartwood
Cu
Copper
Background
Unknown
annotation state
yellow
warning
Support geometry derives
```

Inspect SaPen Core/Refine only as read-only reference for mask overlay/opacity patterns:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
../sapen/apps/sapen-refine/src/mask
```

Search reference repo for:

```text
opacity
overlay
maskOpacity
semanticOpacity
support
contour
outline
label color
```

## Required changes

### 1. Per-label semantic opacity

Replace the single global semantic opacity behavior with per-label opacity settings.

Semantic labels should be independently adjustable where relevant.

Suggested labels:

```text
Sapwood
Heartwood
Cu / Copper
Background
Unknown
```

Only show controls for labels relevant to the current active annotation family/mode.

Examples:

#### Sapwood / Heartwood family

```text
Sapwood opacity
Heartwood opacity
```

#### Cu family

```text
Cu opacity
```

If `Background` is only used as a clearing label, it usually does not need a visible opacity control.

#### Unknown

Only show `Unknown opacity` if Unknown is actually rendered as a visible overlay.

### 2. Compact opacity UI

Avoid adding a large panel.

Use one of these patterns:

#### Preferred compact toolbar/popover

A compact `Opacity` or layer/settings button opens a small popover:

```text
Opacity
Sapwood     [slider] 45%
Heartwood   [slider] 55%
Cu          [slider] 50%
```

#### Acceptable compact right rail section

A small collapsed/compact `Display` section in the right rail:

```text
DISPLAY
Sapwood 45%
Heartwood 55%
```

Do not consume a large amount of vertical editor space.

### 3. Persistence of display settings

Opacity settings are display preferences, not annotation data.

Preferred:

- local component state
- localStorage/user preference if a pattern already exists
- URL/session state if already used

Do not persist opacity settings into mask data or mask versions.

### 4. Support mask as contour/line only

Support mask must be displayed as a contour/line, not as a filled overlay.

Requirements:

- support mask is outlined with a clear visible line
- default support line opacity should be around `40–50%`
- original image remains visible
- line color should be distinct and readable
- active/selected support shape may use stronger outline if needed
- support area should not be filled as a semi-transparent area by default

For Sapwood/Heartwood-derived support:

```text
supportContour = outline(sapwoodMask OR heartwoodMask)
```

For Cu support:

- use the explicit support mask if it exists
- render contour/line only

### 5. Remove support opacity slider

Since support is shown as a line/contour only, remove the `Support opacity` slider.

The support contour opacity should be defaulted to around `40–50%`.

If a display setting is still needed, it can be a small advanced/display preference later, but not a main visible slider in the editor.

### 6. Remove excessive annotation state text

Remove the large/verbose right-rail annotation state block.

Specifically remove or greatly reduce:

```text
ANNOTATION STATE
Family
Label
Tool
Save
...
No explicit support mask
draft Sap/Heartwood v1
Classification: ...
Export readiness: ...
```

This information currently takes too much space and duplicates state already available elsewhere.

Keep only truly useful compact state if needed, for example:

```text
STATE
Draft saved
Export not ready
```

But prefer removing the section entirely if the information is not directly actionable.

### 7. Remove dominant yellow info box

Remove the yellow warning/info box shown in the right rail.

Example text to remove:

```text
Cu is unavailable because this crop already contains Sapwood / Heartwood annotation.
Remove that annotation to switch families.
```

Reason:

- It is too dominant.
- It takes too much space.
- The disabled Cu label/button and compact tooltip should communicate this instead.

Replacement behavior:

- Disabled label/family buttons can have tooltip/explanation.
- Export/readiness issues can be shown in compact warning/status strip only when necessary.
- Do not show a persistent large yellow box in the right rail.

### 8. Tooltips for unavailable labels/actions

For unavailable family/label actions such as Cu disabled because Sap/Heartwood already exists:

- keep the control disabled
- add tooltip/aria-label with explanation
- do not show persistent warning box

Example tooltip:

```text
Cu unavailable: this crop already contains Sapwood/Heartwood annotation.
```

## Visual style

Follow established SaPen Core / Annotate dark editor style:

- compact controls
- thin muted borders
- no large warning blocks unless truly blocking and immediate
- muted secondary text
- amber only for actual blocking warning strips
- no dominant yellow info panel
- no unnecessary right rail text
- canvas remains the primary focus

## Functional boundaries

Do not change:

- mask storage format
- label IDs
- semantic mask semantics
- support mask semantics/storage
- Core handoff contracts
- autosave/commit contracts
- BBox logic
- image upload/project APIs
- auth/RBAC

This is display/visualization and UI cleanup, not a data-model change.

## Acceptance criteria

### Per-label opacity

- [ ] Semantic mask opacity can be adjusted per relevant label.
- [ ] Sapwood and Heartwood can have different opacity values.
- [ ] Cu/Copper can have its own opacity value.
- [ ] The opacity UI is compact and does not consume excessive vertical space.
- [ ] Opacity settings do not alter persisted mask data.

### Support visualization

- [ ] Support mask is displayed as a contour/line only.
- [ ] Support mask is not displayed as filled semi-transparent area.
- [ ] Support line default opacity is around `40–50%`.
- [ ] Original image remains visible under support contour.
- [ ] Support opacity slider is removed from the main editor UI.

### Right rail cleanup

- [ ] Large `ANNOTATION STATE` information block is removed or reduced to minimal actionable state.
- [ ] Dominant yellow info/warning box is removed.
- [ ] Disabled family/label explanations are provided via tooltip or compact non-persistent UI.
- [ ] Right rail is visually quieter and uses less vertical space.

### Regression

- [ ] Semantic mask rendering still works.
- [ ] Support mask rendering still works.
- [ ] Existing save/autosave/commit behavior is unchanged.
- [ ] Navigator overlays continue to work.
- [ ] No mask storage/API/handoff behavior changes.

## Validation

Run repo-appropriate checks from `sapen-annotate`.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm run build
```

Run tests if relevant and feasible:

```bash
npm test
```

Manual smoke checklist:

1. Open Sapwood/Heartwood semantic editor.
2. Adjust Sapwood opacity.
3. Adjust Heartwood opacity differently.
4. Verify both overlays render with different opacity.
5. Open Cu/Copper annotation.
6. Verify Cu opacity is independent.
7. Create/show support mask.
8. Verify support appears as line/contour only.
9. Verify support is not filled.
10. Verify support opacity slider is gone.
11. Verify right rail no longer shows large annotation state block.
12. Verify yellow info box is gone.
13. Hover disabled Cu/family control and verify tooltip/explanation if applicable.
14. Save/commit mask and verify data unchanged.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-022: Per-Label Semantic Opacity and Simplified Editor State Panel.

Goals:
1. Replace global semantic opacity with per-label semantic opacity settings.
2. Support mask should always render as a contour/line only, not as a filled overlay.
3. Remove the main Support opacity slider.
4. Remove the overly verbose right-rail annotation state information.
5. Remove the dominant yellow warning/info box.
6. Use compact tooltips for disabled family/label explanations.

Details:
- Sapwood and Heartwood should be adjustable independently.
- Cu/Copper should have its own opacity.
- Only show opacity controls relevant to the current active family/mode.
- Keep opacity controls compact, preferably in a popover or small Display section.
- Opacity settings are display preferences only; do not persist them into mask data.
- Support line default opacity should be around 40–50%.
- If support contour is derived from Sapwood/Heartwood, use outline(sapwood OR heartwood).
- Preserve semantic exclusivity and all existing mask storage semantics.

Do not change:
- mask storage format
- label IDs
- Core handoff contracts
- autosave/commit contracts
- BBox logic
- image/project APIs
- auth/RBAC

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. How per-label opacity is represented
D. How support contour rendering works
E. What right-rail info was removed
F. Validation results
G. Follow-ups
```

## Suggested commit message

```text
Add per-label opacity and simplify editor state rail
```
