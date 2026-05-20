# Editor Feature

The current editor is prototype-level but useful for drawing, saving, submitting, and approving MVP annotation artifacts. RB-045 established the browser/iPad trial baseline before domain expansion; RB-052 adds the first review/approval controls.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- `src/features/editor/EditImagePage.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/features/editor/canvasGeometry.ts`
- `src/design/editorCanvas.ts`
- `src/mask/*`

## Current Entry Route

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Image metadata route before editing: `/app/projects/[projectId]/images/[imageId]`.
- Route wrapper: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`.
- Server composition/RBAC: `src/features/editor/EditImagePage.tsx`.
- Client editor surface: `src/features/editor/EditorClient.tsx`.

## Current Canvas And Input Model

- The editor loads the source image through `/api/images/[imageId]/view`.
- Three canvases are stacked: base image, mask overlay, and lasso preview.
- The mask coordinate space currently matches the image pixel dimensions.
- Pointer Events are the only drawing input layer; there is no parallel mouse/touch event system.
- The overlay canvas uses `touch-none`, so drawing on the canvas is intended not to scroll the page on touch devices.
- Pointer capture is already used for brush strokes, freehand lasso, and polygon-handle dragging.
- Coordinate conversion and fit/zoom sizing helpers live in `src/features/editor/canvasGeometry.ts` and are covered by unit tests.
- RB-045 ignores non-primary touch/stylus pointers and non-left mouse buttons for drawing.
- RB-045 handles `pointercancel` separately from `pointerup`: brush strokes are finalized, freehand lasso is cancelled instead of committed, and polygon dragging is safely released.
- The editor canvas container uses overscroll containment; touch scrolling should remain available outside the drawing surface.

## Current Save And History Model

- Brush and lasso operations write to a `MaskBuffer` in memory.
- Undo/redo stores patch arrays in refs and applies patches back into the mask buffer.
- Autosave debounces dirty mask writes after edits.
- RB-045 exposes dirty/saving state in the editor toolbar and guards browser unload while unsaved edits exist.
- If edits happen while a save is in flight, the editor tracks dirty revisions and queues another save instead of clearing the newer dirty state.
- In `Semantic mask` mode, manual save uploads raw `u8raw-v1` bytes through `/api/images/[imageId]/mask/upload`.
- In `Slice support` mode, manual save uploads raw `u8raw-v1` bytes through `/api/images/[imageId]/support-mask/upload`.
- RB-055 validates mask byte length, declared width/height, image-pixel coordinate space, checksum hints, and storage object metadata before recording a version.
- Support-mask saves additionally require binary support values: `0` or the active label schema's `slice_support` byte value. Copper semantic bytes are rejected as support geometry.
- Latest semantic mask metadata is loaded from `/api/images/[imageId]/mask/latest`; latest support mask metadata is loaded from `/api/images/[imageId]/support-mask/latest`.
- Review/export-readiness state is loaded from `/api/images/[imageId]/review-state`.
- Mask bytes are fetched through app-mediated version asset URLs.

## Current Domain Model

- The editor now has two explicit modes: `Semantic mask` and `Slice support`.
- Semantic mode edits one semantic byte mask for the image.
- Slice support mode edits one default physical slice support mask for the image.
- The active browser label sets come from `src/mask/labels.ts`; persisted mask versions still reference the project label schema version.
- Current saves create `AnnotationArtifactVersion` rows under a default `AnnotationArtifact` with `AnnotationArtifactKind.SEMANTIC_MASK`.
- Slice support saves create `AnnotationArtifactVersion` rows under a default `AnnotationArtifact` with `AnnotationArtifactKind.SLICE_SUPPORT_MASK` and link the default `SliceInstance.supportArtifactVersionId`.
- Saved mask versions record canonical SHA-256 checksum, byte size, width, height, `u8raw-v1` format, `IMAGE_PIXEL` coordinate space, creator, and label schema version.
- Slice classification is set from the editor and persisted as `SliceClassificationVersion`.
- `MaskKind.REFINED` is removed from the schema; current browser saves are draft human semantic annotation artifacts.
- The editor shows draft/submitted/approved/rejected state for semantic masks, support masks, and slice classifications.
- `OWNER`/`QA` users can approve/reject submitted versions from the editor; `OWNER`/`QA`/`LABELER` users can submit draft versions.
- The editor shows a simple export-readiness summary based on approved versions only.
- The editor does not yet manage annotation tasks, prediction overlays, multi-object support geometry, bulk review, or export generation.
- Copper is available only as a semantic material label. It is not a slice support mask and must not be used as a proxy for physical slice geometry.

## Stable Save Errors

Mask save APIs return stable sanitized error codes for integrity failures, including `UPLOAD_TOO_LARGE`, `WIDTH_REQUIRED`, `HEIGHT_REQUIRED`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `CHECKSUM_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.

Successful semantic saves record `SEMANTIC_MASK_COMMITTED`; successful support saves record `SUPPORT_MASK_COMMITTED`; validation failures record `ARTIFACT_VALIDATION_FAILED` where the request is authenticated.

## Future Prediction-Assisted Correction

RB-054 designs this future workflow only. A correction task should load a model prediction as a read-only overlay or as an explicit starting mask, keep the editable human layer separate, show model confidence/uncertainty/task reason, and save corrected work as a new human artifact version. Prediction artifacts must remain immutable and visually distinct from human annotation. The future route must remain usable on iPad-sized screens.

## Default Slice Baseline

- RB-051 implements one default `SliceInstance` per image as the MVP workflow.
- Multi-slice and multi-object editing remain deferred.
- Image-level/default `SampleMetadata` from RB-050 remains image-level/default metadata; it is not true per-slice sample metadata.

## Desktop Browser Smoke Scope

- The supported MVP smoke path is: upload an image, add image-level T-number/acquisition metadata, open editor, draw/save a semantic mask, switch to slice support, draw/save a support mask, set slice classification, submit/approve all three reviewable units, reload, and confirm masks, classification, and approved review state persist.
- RB-047 browser automation should keep this path small and avoid asserting unstable visual details.

## RB-045 Start Limitations

- Hook dependency warnings in `src/features/editor/EditorClient.tsx` were resolved during RB-045.
- RB-045 increased core tool/action/label touch targets for iPad browser use.
- Advanced iPad gestures such as two-finger zoom/pan are not part of the current editor model.
- Real iPad Safari validation is deferred in RB-047 until deployment/device access is available.

Editor ownership remains under `src/features/editor` without a full editor rewrite.
