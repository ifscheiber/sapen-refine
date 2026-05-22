# Editor Feature

The current editor is prototype-level but useful for drawing, saving, submitting, and approving MVP annotation artifacts. RB-045 established the browser/iPad trial baseline before domain expansion; RB-052 adds the first review/approval controls; RB-059 adds the first prediction-assisted correction entry.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/tasks/[taskId]/correct/page.tsx`
- `src/features/editor/EditImagePage.tsx`
- `src/features/editor/CorrectionTaskEditorPage.tsx`
- `src/features/editor/EditorClient.tsx`
- `src/features/editor/components/*`
- `src/features/editor/canvasGeometry.ts`
- `src/features/editor/editorApi.ts`
- `src/features/editor/editorFormatters.ts`
- `src/features/editor/editorMaskUpload.ts`
- `src/features/editor/editorPointer.ts`
- `src/features/editor/editorTypes.ts`
- `src/design/editorCanvas.ts`
- `src/mask/*`

## RB-068 Responsibility Inventory

Before decomposition, `src/features/editor/EditorClient.tsx` owns all client-side editor concerns:

- data loading for image URLs, latest semantic/support mask bytes, slice state, review state, and correction context;
- in-memory mask state, dirty flags, save revisions, autosave debounce, in-flight save queueing, and before-unload protection;
- canvas refs and rendering for base image, read-only prediction overlay, editable mask overlay, and lasso preview;
- pointer-event handling for brush, freehand lasso, polygon lasso, polygon-handle dragging, pointer capture, cancel behavior, and coordinate conversion;
- undo/redo patch history and keyboard shortcuts;
- semantic/support mode switching and label palette selection;
- toolbar controls for tools, brush size, opacity, fit/zoom, save, export, and status display;
- slice classification select/save workflow;
- review state cards, submit/approve/reject actions, comments, and export-readiness display;
- assisted correction panel, prediction overlay toggle, prediction-mask loading, and explicit prediction-to-editable-mask copy behavior.

RB-068 decomposes these concerns without changing editor routes, APIs, mask bytes, review semantics, assisted-correction semantics, or iPad pointer assumptions.

## RB-068 Module Structure

After RB-068, `EditorClient.tsx` remains the orchestration component for the current editor workflow. It still coordinates mask refs, drawing algorithms, autosave, undo/redo, image/mask loading, and review/correction side effects.

Extracted ownership:

- `src/features/editor/editorTypes.ts` owns editor-specific TypeScript contracts and slice-classification options.
- `src/features/editor/editorApi.ts` owns existing editor API route builders. Route contracts are unchanged.
- `src/features/editor/editorFormatters.ts` owns review/classification/correction display formatting.
- `src/features/editor/editorPointer.ts` owns pointer ignore/capture/release helpers.
- `src/features/editor/editorStyles.ts` owns shared editor button class constants based on existing design tokens.
- `src/features/editor/editorTools.ts` owns editor tool helpers such as brush-like tool detection and mode-specific eraser values.
- `src/features/editor/components/EditorToolbar.tsx` owns mode, tool, label, opacity, undo/redo, save, export, and zoom controls.
- `src/features/editor/components/EditorCanvasStack.tsx` owns the stacked canvas DOM and pointer-handler wiring.
- `src/features/editor/components/EditorReviewPanel.tsx` owns review/export-readiness display and submit/approve/reject controls.
- `src/features/editor/components/EditorSliceClassificationPanel.tsx` owns slice-classification selection and save controls.
- `src/features/editor/components/EditorAssistedCorrectionPanel.tsx` owns prediction proposal metadata, overlay toggle, and copy-to-editable-mask action controls.

RB-068 was a behavior-preserving decomposition. RB-070 then added the explicit eraser tool without changing mask serialization, server API semantics, review/export behavior, or prediction provenance.

## Current Entry Route

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Correction route: `/app/projects/[projectId]/tasks/[taskId]/correct`.
- Image metadata route before editing: `/app/projects/[projectId]/images/[imageId]`.
- Route wrapper: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`.
- Server composition/RBAC: `src/features/editor/EditImagePage.tsx`.
- Client editor surface: `src/features/editor/EditorClient.tsx`.

## Current Canvas And Input Model

- The editor loads the source image through `/api/images/[imageId]/view`.
- The standard editor stacks base image, editable mask overlay, and lasso preview canvases.
- The correction editor adds a read-only prediction proposal canvas between the base image and editable human mask.
- The mask coordinate space currently matches the image pixel dimensions.
- Pointer Events are the only drawing input layer; there is no parallel mouse/touch event system.
- The overlay canvas uses `touch-none`, so drawing on the canvas is intended not to scroll the page on touch devices.
- Pointer capture is already used for brush strokes, freehand lasso, and polygon-handle dragging.
- Coordinate conversion and fit/zoom sizing helpers live in `src/features/editor/canvasGeometry.ts` and are covered by unit tests.
- RB-045 ignores non-primary touch/stylus pointers and non-left mouse buttons for drawing.
- RB-045 handles `pointercancel` separately from `pointerup`: brush strokes are finalized, freehand lasso is cancelled instead of committed, and polygon dragging is safely released.
- The editor canvas container uses overscroll containment; touch scrolling should remain available outside the drawing surface.

## Current Save And History Model

- Brush, eraser, and lasso operations write to a `MaskBuffer` in memory.
- The eraser uses the same brush radius and pointer path as Brush. In semantic mode it writes `Labels.BG`; in slice-support mode it writes the current support background value.
- Painting the explicit `Background` label remains valid. The eraser is a discoverable shortcut for repeated annotation work.
- Undo/redo stores patch arrays in refs and applies patches back into the mask buffer.
- Autosave debounces dirty mask writes after edits.
- RB-045 exposes dirty/saving state in the editor toolbar and guards browser unload while unsaved edits exist.
- If edits happen while a save is in flight, the editor tracks dirty revisions and queues another save instead of clearing the newer dirty state.
- In `Semantic mask` mode, manual save uploads raw `u8raw-v1` bytes through `/api/images/[imageId]/mask/upload`.
- In `Slice support` mode, manual save uploads raw `u8raw-v1` bytes through `/api/images/[imageId]/support-mask/upload`.
- In correction mode, manual save uploads raw `u8raw-v1` bytes through `/api/correction-tasks/[taskId]/corrections`.
- Editor saves are app-mediated. The browser editor does not write to MinIO/S3 directly and does not require private storage keys or presigned upload URLs.
- RB-055 validates mask byte length, declared width/height, image-pixel coordinate space, checksum hints, and storage object metadata before recording a version.
- RB-080 adds `src/features/editor/editorMaskUpload.ts` as the single editor helper for semantic, support, and assisted-correction mask upload payloads. It validates `mask.data.byteLength === mask.width * mask.height` before `fetch()`, sends raw `Uint8Array` bytes instead of a `Blob`, and avoids sending a larger typed-array backing buffer by copying the exact view bytes.
- RB-081 adds `src/server/uploads/maskRequest.ts` as the shared server-side raw request reader for semantic, support, and assisted-correction mask save routes. It reads the request body once with `arrayBuffer()`, validates actual received bytes against `width * height`, and records safe diagnostics when an authenticated request is rejected.
- RB-080 also gates drawing, prediction-copy, keyboard edit actions, and saving until the image, canvas backing dimensions, and in-memory `MaskBuffer` are initialized consistently. Fetching the image URL alone is not enough to mark the editor ready.
- Manual save cancels any pending autosave and uses a save generation guard so stale save responses cannot clear newer dirty state.
- Editor uploads send `content-type: application/octet-stream`, `x-mask-format: u8raw-v1`, `x-mask-width`, `x-mask-height`, and diagnostic-only `x-mask-byte-length`. The server still validates the actual received request body length as the source of truth.
- Next.js proxy body buffering must be above the mask size. RB-081 sets `experimental.proxyClientMaxBodySize` through `NEXT_PROXY_CLIENT_MAX_BODY_SIZE`, default `120mb`, because the Next default is too small for a 6000x4000 raw mask.
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
- The correction editor opens `MODEL_PREDICTION_CORRECTION` tasks, loads prediction masks read-only, and saves separate human correction versions. It does not run inference, import predictions, manage batch queues, or implement multi-object support geometry.
- Copper is available only as a semantic material label. It is not a slice support mask and must not be used as a proxy for physical slice geometry.

## Stable Save Errors

Mask save APIs return stable sanitized error codes for integrity failures, including `UPLOAD_TOO_LARGE`, `WIDTH_REQUIRED`, `HEIGHT_REQUIRED`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `CHECKSUM_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.

Successful semantic saves record `SEMANTIC_MASK_COMMITTED`; successful support saves record `SUPPORT_MASK_COMMITTED`; validation failures record `ARTIFACT_VALIDATION_FAILED` where the request is authenticated.

For byte-length failures after RB-080/RB-081, authenticated audit details may include safe diagnostics: expected bytes, received bytes, declared client bytes, content length, width, height, and format. They do not include mask payload bytes, storage keys, private URLs, credentials, or tokens.

## Trial Full-Resolution Policy

The current editor is a full-resolution editor, not a tiled or downscaled workflow.

- Up to `6000x4000` / `24,000,000` pixels: normal trial path.
- Above that and up to `8000x6000` / `48,000,000` pixels: allowed, but the UI marks the image as large and warns about iPad/browser memory.
- Above `8000x6000`, above `48,000,000` pixels, or beyond an `8000` long edge / `6000` short edge: not supported by the trial editor.

At the upper bound, one `u8raw-v1` mask is `48,000,000` bytes, about 45.8 MiB. The editor memory budget must assume at least five mask or working-copy layers plus the decoded browser image; an `8000x6000` decoded RGBA image alone is about 192 MB. Real iPad Safari validation remains required before relying on the upper bound in a customer pilot.

The trial does not hard-block multiple editor tabs. Users should avoid opening multiple large editor tabs; a future edit-session or soft-lock workflow is tracked as backlog.

## Planned Crop-Based Slice Annotation

RB-085 defines the planned crop-based workflow for RB-086 through RB-092. This is not current editor behavior.

The intended future flow is:

```text
Original image
-> BBox proposal
-> derived slice crop
-> pixel-perfect crop support mask
-> semantic annotation constrained by support
-> auto-suggested slice classification
-> review/approval
-> export with crop/source-image provenance
```

The current full-resolution editor remains valid and should not be removed by the crop sprint. The crop workflow is the preferred scalable path for large images and iPad-constrained annotation because it reduces the working mask area while preserving traceability to the immutable source image.

Editor-specific crop rules:

- BBox drawing is a proposal workflow, not ground-truth instance annotation.
- Support-mask editing remains the source of physical slice geometry.
- Semantic editing should be constrained to support once support exists.
- Copper semantic pixels remain material labels and must not be treated as support geometry.
- Sapwood/heartwood workflows may support complement fill inside support while preserving `UNKNOWN` or review-required options.
- Crop-aware saves must carry explicit coordinate-space metadata and transforms rather than pretending crop masks are full-image masks.
- Auto-suggested slice classifications must be shown as provenance-bearing suggestions until a human review/approval or accepted-auto policy makes them export-ready.

## Prediction-Assisted Correction

RB-059 implements the first assisted correction path:

- `/app/projects/[projectId]/tasks/[taskId]/correct` is deep-linkable from the task queue.
- `GET /api/correction-tasks/[taskId]/correction-context` loads sanitized task, model/run, source prediction, and target-mode context.
- `GET /api/correction-tasks/[taskId]/prediction-mask` streams prediction bytes through the app without exposing object storage keys.
- The prediction layer is read-only and visually separate from the editable human mask.
- `Use prediction as starting mask` explicitly copies prediction bytes into the local editable human buffer; opening the task does not create ground truth.
- `Save correction draft` creates a new `AnnotationArtifactVersion` with `ArtifactProvenance.HUMAN_CORRECTION`, `parentVersionId` pointing to the prediction artifact version, and `taskId` pointing to the correction task.
- Semantic prediction corrections save to `SEMANTIC_MASK`; support prediction corrections save to `SLICE_SUPPORT_MASK`.
- Submit/approve/reject uses the existing RB-052 review controls. Prediction artifacts remain immutable and excluded from ground-truth export.

Slice-classification prediction correction is deferred because RB-057 imports mask predictions only.

## Default Slice Baseline

- RB-051 implements one default `SliceInstance` per image as the MVP workflow.
- Multi-slice and multi-object editing remain deferred.
- Image-level/default `SampleMetadata` from RB-050 remains image-level/default metadata; it is not true per-slice sample metadata.

## Desktop Browser Smoke Scope

- The supported MVP smoke path is: upload an image, add image-level T-number/acquisition metadata, open editor, draw/erase/save a semantic mask, switch to slice support, draw/erase/save a support mask, set slice classification, submit/approve all three reviewable units, reload, and confirm masks, classification, and approved review state persist.
- RB-047 browser automation should keep this path small and avoid asserting unstable visual details.

## RB-045 Start Limitations

- Hook dependency warnings in `src/features/editor/EditorClient.tsx` were resolved during RB-045.
- RB-045 increased core tool/action/label touch targets for iPad browser use.
- Advanced iPad gestures such as two-finger zoom/pan are not part of the current editor model.
- Real iPad Safari validation is deferred in RB-047 until deployment/device access is available.

Editor ownership remains under `src/features/editor` without a full editor rewrite. Future tool work should extend the extracted toolbar/canvas/tool-helper structure rather than adding more panel markup back into `EditorClient.tsx`.
