# PERF-016 — Use Downscaled Working Preview for BBox Editing with Original-Resolution Coordinate Mapping

## Status

Ready for implementation

## Type

Performance / BBox editor / image rendering optimization ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only reference. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## Background

The current BBox editor loads the full original image for selecting and drawing BBoxes.

For large images this has two problems:

1. The BBox editor takes too long to load.
2. Drawing and moving BBoxes can feel slower because the browser is rendering and interacting with a very large image.

For BBox editing, the user does **not** need the full original resolution. BBox drawing is only used to define rough slice work areas. The actual crop/slice images that are later semantically annotated must still be produced from the **original-resolution image**.

Therefore, the BBox editor should work on a downscaled preview image, while all persisted BBox coordinates remain mapped back to original image coordinates.

## Goal

Use a downscaled working preview for BBox editing while preserving original-resolution slice/crop generation.

The BBox editor should:

- load a smaller working image when the source image is large
- draw/edit BBoxes in preview/display space
- convert BBox coordinates back to original image coordinate space before persisting
- generate all crop/slice images from the original image bytes/resolution
- preserve existing crop/mask/storage contracts

## Key invariant

Persisted BBox coordinates must remain in original image coordinate space.

```text
storedBBox = originalImageCoordinates
```

The preview image is only a rendering/editing optimization.

The semantic/crop images must always be generated from the original image:

```text
original image + stored original-coordinate BBox → original-resolution crop/slice image
```

Do not store preview-resolution BBoxes as canonical coordinates.

## Required reference inspection

Inspect local SaPen Annotate image/BBox/crop code:

```text
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/app/app/projects/[projectId]/images/[imageId]/bbox
src/app/app/projects/[projectId]/images/ui.tsx
src/lib/projectsClient.ts
src/app/api
```

If paths differ, locate equivalent files.

Search local repo for:

```text
image view
imageViewUrl
apiGetImageViewUrl
bbox
BBox
crop
crop image
slice
naturalWidth
naturalHeight
width
height
canvas
drawImage
```

Inspect SaPen Core / Refine references only for existing image preview, thumbnail, resize, or fit-to-canvas patterns:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
```

Search reference repo for:

```text
thumbnail
preview
resize
downscale
image view
naturalWidth
naturalHeight
canvas transform
```

## Required behavior

### 1. Introduce BBox working preview image

For BBox editing only, load a downscaled preview image when the original image is large.

Do **not** use the downscaled preview for semantic mask editing or crop/slice generation unless explicitly safe and only for display.

### 2. Heuristic for preview resolution

Codex should inspect current typical image sizes and choose a sensible heuristic.

Recommended initial heuristic:

```text
If originalWidth * originalHeight <= 4_000_000
and max(originalWidth, originalHeight) <= 2400:
    use original image for BBox editor

Otherwise:
    create/use preview image with:
        maxLongEdge = 2000 px
        maxPixels ≈ 3_000_000
        preserve aspect ratio
        never upscale
```

Alternative acceptable heuristic:

```text
targetLongEdge = 1800–2200 px
targetPixels = 2.5–4 MP
```

Design rationale:

- BBoxes are rough slice work areas, not pixel-perfect masks.
- A 1800–2200 px long edge is usually precise enough for BBox placement.
- This keeps browser memory/rendering load much lower for 6000×4000 or similar images.
- Original-resolution crops are still generated later.

If the repo already has an image-preview/thumbnail size convention, prefer that convention and document it.

### 3. Server-side or cached preview preferred

To reduce load time, avoid loading the full original image just to downscale it in the browser.

Preferred implementation:

- add or reuse a preview image endpoint/storage object
- generate downscaled preview on demand or at upload/commit time
- cache the preview using a stable storage key or HTTP caching
- return preview dimensions and original dimensions

Possible endpoint shape, if compatible with existing conventions:

```text
GET /api/projects/{projectId}/images/{imageId}/bbox-preview
```

or extend existing image view URL helper with a variant:

```text
apiGetImageViewUrl(projectId, imageId, { variant: "bbox-preview" })
```

If server-side preview generation is too large for this ticket:

- implement the coordinate mapping abstraction first
- use existing thumbnail/preview if available
- document follow-up for server-side cached preview

But do not make the final design depend on always loading the full original image.

### 4. Coordinate mapping

The editor must track both coordinate spaces:

```text
originalWidth
originalHeight
previewWidth
previewHeight
scaleX = originalWidth / previewWidth
scaleY = originalHeight / previewHeight
```

When rendering stored BBoxes on preview:

```text
previewX = originalX / scaleX
previewY = originalY / scaleY
previewW = originalW / scaleX
previewH = originalH / scaleY
```

When user creates/moves/resizes BBox on preview:

```text
originalX = round(previewX * scaleX)
originalY = round(previewY * scaleY)
originalW = round(previewW * scaleX)
originalH = round(previewH * scaleY)
```

Clamp to original image bounds before persisting:

```text
0 <= x < originalWidth
0 <= y < originalHeight
x + width <= originalWidth
y + height <= originalHeight
```

Important:

- Always persist original-coordinate boxes.
- Avoid cumulative rounding drift by keeping canonical state in original coordinates and only deriving preview/display coordinates for rendering.
- On drag/resize, convert final interaction result to original coords once, or keep a temporary preview state but commit original coords.

### 5. Existing overlap/lock/protection rules still apply

Overlap validation and protected-BBox rules from previous tickets must run in original coordinate space.

Required:

- overlap checks use original-coordinate BBoxes
- protected/locked BBox deletion rules still work
- invalid/overlap warnings still show
- any BBox edited in preview is converted to original coords before validation

### 6. Original-resolution crop/slice generation

When BBoxes are used to generate crop/slice images:

- use the original image
- use original-coordinate BBoxes
- produce original-resolution crop/slice images
- do not produce crops from the downscaled preview

This is the core correctness requirement.

### 7. UI indication

The UI should not overwhelm the user with technical details, but the implementation should make debugging possible.

Optional compact tooltip/debug text:

```text
BBox preview: 2000×1333 from 6000×4000
```

This can be hidden or shown in dev/debug only.

No large UI panel is needed.

## Performance expectations

For large images, BBox editor should:

- load faster
- use less memory
- render more smoothly
- drag/resize BBoxes more responsively

If exact performance measurement is available, record before/after rough timings. If not, provide qualitative validation.

## Functional boundaries

Do not change:

- persisted BBox coordinate contract
- crop/slice output resolution
- semantic/support mask resolution
- mask storage format
- label IDs
- Core handoff contracts
- auth/RBAC
- project/image upload contracts unless adding a safe read-only preview endpoint
- BBox overlap/protection rules

Do not introduce:

- preview-coordinate canonical storage
- downscaled semantic/crop output
- lossy crop generation
- incompatible API responses

## Edge cases

Handle:

- no original dimensions known
- preview generation failure
- preview image not available
- original image already small
- non-integer scale factors
- very wide/tall images
- BBox at image edges
- BBox with tiny dimensions after scaling
- legacy BBoxes stored before this change
- browser image load errors

Fallback:

- if preview cannot be loaded/generated, fall back to original image with a warning/log
- never block editing entirely just because preview generation fails, unless original also fails

## Acceptance criteria

### Preview loading

- [ ] Large images use a downscaled BBox working preview.
- [ ] Small images may continue using original image.
- [ ] Preview preserves aspect ratio.
- [ ] Preview is not upscaled.
- [ ] Preview generation/loading is cached or designed to avoid redoing expensive work unnecessarily.

### Coordinate correctness

- [ ] Persisted BBoxes remain in original image coordinates.
- [ ] Existing original-coordinate BBoxes render correctly on the preview.
- [ ] New BBoxes drawn on preview are saved in original coordinates.
- [ ] Moved/resized BBoxes are saved in original coordinates.
- [ ] Coordinates are clamped to original image bounds.
- [ ] No cumulative scaling/rounding drift is introduced.

### Crop correctness

- [ ] Slice/crop images are still generated from original image resolution.
- [ ] No crop/slice is generated from the downscaled preview.
- [ ] Existing crop workflow output remains original-resolution.

### Validation/safety

- [ ] Overlap validation still works.
- [ ] Protected BBox rules still work.
- [ ] Locked/dependent BBoxes remain protected.
- [ ] Existing BBox tests are updated/extended where needed.

### Performance

- [ ] Large-image BBox editor load is improved or at least no longer requires full-resolution rendering in the BBox editor.
- [ ] Drawing/moving/resizing BBoxes remains responsive.

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

Recommended targeted tests:

- coordinate scaling utility tests
- render existing original-coordinate BBox on preview
- create preview-coordinate BBox and assert original-coordinate persistence
- crop generation still uses original coordinates/resolution
- overlap validation uses original coordinates

Manual smoke checklist:

1. Upload/open a large image, e.g. around 6000×4000.
2. Open BBox editor.
3. Verify BBox editor uses downscaled preview.
4. Draw a BBox.
5. Save/re-confirm as appropriate.
6. Verify stored BBox coordinates map to original image.
7. Generate/open crop/slice.
8. Verify crop/slice resolution corresponds to original source region, not preview resolution.
9. Move/resize BBox and verify crop remains correct.
10. Try overlap case and verify validation still works.
11. Open a small image and verify no unnecessary downscale/upscale.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement PERF-016: Use Downscaled Working Preview for BBox Editing with Original-Resolution Coordinate Mapping.

Current problem:
The BBox editor loads full-resolution images. Large images load slowly and may slow down BBox drawing.

Goal:
For BBox editing only, use a downscaled working preview for large images while keeping all persisted BBoxes in original image coordinates and generating all crop/slice outputs from the original-resolution image.

Required:
1. Inspect existing image view / BBox / crop code.
2. Add or reuse a BBox preview image source for large images.
3. Use a heuristic such as:
   - if image <= 4 MP and max edge <= 2400, use original
   - otherwise preview max long edge around 2000 px and max pixels around 3 MP
   - preserve aspect ratio and never upscale
4. Prefer server-side/cached preview so the browser does not need to download the full original just to downscale.
5. Track originalWidth/originalHeight and previewWidth/previewHeight.
6. Convert original-coordinate BBoxes to preview coordinates for rendering.
7. Convert preview-created/edited BBoxes back to original coordinates before persisting.
8. Keep canonical BBox state in original coordinates to avoid rounding drift.
9. Ensure crop/slice generation still uses original image bytes/resolution and original-coordinate BBoxes.
10. Keep overlap/protected-BBox validation in original coordinate space.

Do not change:
- BBox storage coordinate contract
- crop/slice resolution
- mask storage format
- semantic/support mask behavior
- Core handoff contracts
- auth/RBAC
- upload contracts except for a safe read-only preview endpoint if needed

Run validation:
- typecheck
- lint
- build
- tests
- coordinate mapping tests if feasible

Report:
A. What changed
B. Files changed
C. Preview heuristic used
D. Whether preview is server-side/cached or client-side fallback
E. Coordinate mapping details
F. How original-resolution crop generation is preserved
G. Validation results
H. Follow-ups if cached preview generation remains incomplete
```

## Suggested commit message

```text
Use downscaled preview for BBox editing
```
