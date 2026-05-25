# PERF-017 — BBox Editor Zoom Semantics for Downscaled Preview

## Status

Ready for implementation

## Type

Performance / BBox editor / zoom UX ticket

## Target repository

Work in the `sapen-annotate` repository.

## Related tickets

This ticket refines and complements:

```text
PERF-016 — Use Downscaled Working Preview for BBox Editing with Original-Resolution Coordinate Mapping
DESIGN-010 — Tools-Only BBox Toolbar and Role-Based BBox Submission Semantics
```

## Background

In the BBox editor, source images are often very large. The editor therefore initially fits the image into the available canvas area at a low zoom level. After PERF-016, the BBox editor may also use a downscaled working preview instead of the full-resolution image.

The BBox toolbar needs a clear zoom model that is useful for large images and does not confuse users.

## Goal

Define and implement BBox editor zoom semantics so that:

- the image initially fits into the available BBox editing viewport
- the user can zoom in for precise BBox placement
- the zoom slider is bounded to a useful range
- no unnecessary upscaling beyond the working preview resolution occurs
- coordinate mapping to original image coordinates remains correct

## Product decision

For BBox editing, the zoom slider should be limited to:

```text
1% – 100%
```

where `100%` means:

```text
one preview image pixel is rendered as one screen/CSS pixel
```

not:

```text
one original image pixel is rendered as one screen/CSS pixel
```

This is important because the BBox editor may use a downscaled preview. The preview is the working display image; canonical BBox coordinates still map back to the original image.

## Zoom semantics

### Definitions

```text
original image = full-resolution source image
preview image  = BBox working preview, possibly downscaled
viewport       = visible BBox editing canvas area
fit zoom       = zoom needed to fit the whole preview image into the viewport
display zoom   = current zoom relative to preview image pixel size
```

### Slider value

The zoom slider represents `display zoom` relative to the preview image:

```text
1%   = preview image displayed at 0.01×
100% = preview image displayed at 1.00×
```

Do not allow zoom above 100% in the BBox editor by default.

Rationale:

- BBox placement does not require upscaling beyond preview-native resolution.
- >100% zoom only magnifies pixels and makes the image blurry.
- For more precision, the correct solution is a larger preview heuristic, not over-zooming.

### Initial zoom

Initial zoom should be:

```text
min(100%, fitZoom)
```

Typical large image:

```text
preview = 2000×1333
viewport = 1000×700
fitZoom ≈ 50%
initial zoom = 50%
```

Small image:

```text
preview = 800×600
viewport = 1200×800
fitZoom > 100%
initial zoom = 100%
```

Never upscale the preview just because the viewport is larger.

### Fit button

The BBox toolbar should include a `Fit` control.

Behavior:

```text
Fit → set zoom to min(100%, fitZoom)
```

If the image is already fully visible at fit zoom, Fit should simply restore the fitted view.

### Zoom slider min

Slider minimum:

```text
1%
```

But the UI should avoid making the image unusably tiny if possible.

Acceptable implementation:

- hard slider min: `1`
- optional practical min based on viewport, e.g. `max(1, floor(fitZoom * 0.25))`
- the exact lower bound can follow existing canvas conventions if present

### Zoom and panning

When zoom is greater than fit zoom:

- user must be able to pan/scroll the view if the image no longer fits
- existing canvas pan/scroll behavior should be preserved or reused
- if panning is not available, Codex must ensure zooming does not make parts of the image unreachable

Do not implement a large pan-system rewrite if one already exists. Inspect existing behavior first.

## Coordinate mapping

Zoom must not affect canonical BBox coordinates.

Coordinate chain:

```text
screen/client coordinates
→ preview image coordinates, considering zoom and pan
→ original image coordinates, using preview/original scale from PERF-016
```

Persisted coordinates remain original image coordinates.

Important:

- BBox storage must not depend on current zoom.
- Changing zoom must not change stored BBox coordinates.
- Drawing/moving/resizing at any zoom must produce the same original-coordinate result.

## Toolbar UI requirements

The BBox toolbar should include compact view controls:

```text
Zoom [slider] 48%  [Fit]
```

or:

```text
[-] [slider] [+] 48% [Fit]
```

Requirements:

- compact; no large vertical space
- tooltip or accessible label: `Zoom preview`
- percentage displayed relative to preview image
- Fit action clearly available
- no zoom > 100%
- no text explaining original/preview scaling in the main UI

Optional debug tooltip:

```text
Preview 2000×1333 from 6000×4000
```

Only include if useful and not noisy.

## Interaction requirements

- Zooming should keep the current viewport center stable where feasible.
- Zooming around cursor is nice-to-have, not required.
- If a BBox is selected, zooming should not deselect it.
- BBox handles should remain usable at different zooms.
- Hit testing must remain accurate.

## Required reference inspection

Inspect local BBox/canvas zoom behavior:

```text
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor
src/components
src/app/app/projects/[projectId]/images/[imageId]
```

Search local repo for:

```text
zoom
scale
fit
pan
viewport
clientX
clientY
naturalWidth
canvas
```

Inspect SaPen Core / Refine references only for zoom/fit UI conventions:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
```

Search reference repo for:

```text
zoom
fit
scale
viewport
pan
```

## Functional boundaries

Do not change:

- BBox storage coordinate contract
- preview/original coordinate mapping from PERF-016
- crop/slice generation
- semantic/support mask behavior
- Core handoff contracts
- auth/RBAC
- upload contracts

Do not introduce:

- zoom > 100% default BBox workflow
- preview-coordinate canonical storage
- crop generation from preview image

## Acceptance criteria

- [ ] BBox editor zoom slider ranges from 1% to 100%.
- [ ] 100% means preview-native display size, not original-image-native size.
- [ ] Initial zoom fits the preview into the viewport, capped at 100%.
- [ ] Fit button restores `min(100%, fitZoom)`.
- [ ] Small images are not upscaled above 100%.
- [ ] Large images can be zoomed in from fit zoom up to 100%.
- [ ] Zoom does not alter stored BBox coordinates.
- [ ] Hit testing/drawing/moving/resizing BBoxes works correctly at different zoom levels.
- [ ] If zoomed in beyond fit, the user can still reach relevant image areas.
- [ ] Toolbar remains compact.

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

Recommended tests:

- zoom bounds utility
- fit zoom calculation
- screen → preview → original coordinate mapping at multiple zoom values
- no BBox coordinate drift when changing zoom
- small image initial zoom = 100%
- large image initial zoom = fit zoom < 100%

Manual smoke checklist:

1. Open large image in BBox editor.
2. Verify image initially fits into editor viewport.
3. Verify zoom percentage is below 100% if the preview is larger than viewport.
4. Zoom to 100%.
5. Draw BBox and verify placement is accurate.
6. Move/resize BBox at 100%.
7. Press Fit and verify fitted view returns.
8. Open small image and verify it is not upscaled above 100%.
9. Verify crop/slice generation still uses original resolution.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement PERF-017: BBox Editor Zoom Semantics for Downscaled Preview.

This refines PERF-016 and DESIGN-010.

Goal:
The BBox toolbar zoom should be limited to 1–100%, where 100% means preview-native size, not original-image-native size.

Required:
1. Inspect existing BBox/canvas zoom/fit behavior.
2. Ensure initial zoom is min(100%, fitZoom).
3. Add/adjust compact toolbar zoom controls:
   - slider 1–100%
   - percentage display
   - Fit button
4. Ensure small images are not upscaled above 100%.
5. Ensure large images can zoom from fit zoom up to 100%.
6. Ensure coordinate mapping remains:
   screen → preview coords considering zoom/pan → original coords using preview/original scale.
7. Ensure changing zoom does not change stored BBox coordinates.
8. Ensure drawing/moving/resizing works correctly at different zoom levels.
9. If zoomed in, ensure relevant image areas remain reachable through existing pan/scroll behavior.

Do not change:
- persisted BBox coordinate contract
- crop/slice generation
- mask storage
- Core handoff contracts
- auth/RBAC
- upload contracts

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Zoom semantics implemented
D. Initial fit calculation
E. Coordinate mapping confirmation
F. Validation results
G. Follow-ups if pan/scroll needs improvement
```

## Suggested commit message

```text
Constrain BBox zoom to preview-native scale
```
