# Editor Feature

The current editor is prototype-level but useful for drawing, saving, submitting, and approving MVP annotation artifacts. RB-045 established the browser/iPad trial baseline before domain expansion; RB-052 adds the first review/approval controls; RB-059 adds the first prediction-assisted correction entry.

Important files:

- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic/page.tsx`
- `src/app/(workspace)/app/projects/[projectId]/tasks/[taskId]/correct/page.tsx`
- `src/features/editor/EditImagePage.tsx`
- `src/features/editor/CropSupportEditorPage.tsx`
- `src/features/editor/CropSupportEditorClient.tsx`
- `src/features/editor/CropSemanticEditorPage.tsx`
- `src/features/editor/CropSemanticEditorClient.tsx`
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
- `src/features/editor/components/EditorBBoxPanel.tsx` owns RB-086/RB-087 slice BBox proposal list, selection, replacement/delete controls, derived crop generation, and crop preview metadata.

RB-068 was a behavior-preserving decomposition. RB-070 then added the explicit eraser tool without changing mask serialization, server API semantics, review/export behavior, or prediction provenance.

## Current Entry Route

- Browser route: `/app/projects/[projectId]/images/[imageId]/edit`.
- Crop support route: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`.
- Crop semantic route: `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`.
- Crop workflow entry route: `/app/projects/[projectId]/images/[imageId]/crop`.
- BBox stage route: `/app/projects/[projectId]/images/[imageId]/crop/bboxes`.
- Slice navigator entry route: `/app/projects/[projectId]/images/[imageId]/crop/slices`.
- Selected-slice navigator route: `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]`.
- Correction route: `/app/projects/[projectId]/tasks/[taskId]/correct`.
- Image metadata route before editing: `/app/projects/[projectId]/images/[imageId]`.
- Route wrapper: `src/app/(workspace)/app/projects/[projectId]/images/[imageId]/edit/page.tsx`.
- Server composition/RBAC: `src/features/editor/EditImagePage.tsx`.
- Client editor surface: `src/features/editor/EditorClient.tsx`.

RB-094 implements the crop workflow entry route and BBox stage route. RB-095 implements the slice navigator route and selected-slice URL state. The existing crop support and semantic routes remain compatibility deep links while the guided workbench route family is introduced.

## Current Canvas And Input Model

- The editor loads the source image through `/api/images/[imageId]/view`.
- The standard editor stacks base image, editable mask overlay, BBox proposal overlay, and lasso/BBox preview canvases.
- The correction editor adds a read-only prediction proposal canvas between the base image and editable human mask.
- The mask coordinate space currently matches the image pixel dimensions.
- RB-086 BBox proposals use source-image pixel coordinates and are drawn with Pointer Events on the original-image editor canvas.
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
- BBox proposal state is loaded from `GET /api/images/[imageId]/slice-bboxes`.
- Derived crop state is loaded from `GET /api/images/[imageId]/slice-crops`.
- Crop readiness for the selected image is loaded from `GET /api/projects/[projectId]/crop-readiness?imageId=[imageId]` and shown alongside the selected BBox/crop preview.
- Creating a BBox proposal posts source-image integer geometry to `POST /api/images/[imageId]/slice-bboxes`.
- Replacing or deleting the current BBox proposal version calls `PATCH /api/slice-bboxes/[bboxVersionId]` or `DELETE /api/slice-bboxes/[bboxVersionId]`. RB-086 uses an append-only rule: replacement creates the next active `SliceBoundingBoxVersion`, and deletion creates the next `DELETED` version instead of erasing history.
- Generating a derived crop calls `POST /api/slice-bboxes/[bboxVersionId]/crop`. The response contains sanitized metadata and an app-mediated preview URL; it does not expose private object storage keys.
- Crop support-mask state is loaded from `GET /api/slice-crops/[cropId]/support-mask`.
- Crop support-mask saves upload raw `u8raw-v1` bytes to `POST /api/slice-crops/[cropId]/support-mask/upload`.
- Crop semantic-mask state is loaded from `GET /api/slice-crops/[cropId]/semantic-mask`.
- Crop semantic-mask saves upload raw `u8raw-v1` bytes to `POST /api/slice-crops/[cropId]/semantic-mask/upload` with `x-semantic-mode` and optional `x-support-mask-version-id`. Sap/Heartwood can save without support and derives support from semantic foreground. Copper can save supportless drafts, but Copper readiness/export requires approved explicit support.
- Crop support and semantic editors surface submit/approve/reject actions for the latest crop support mask, active crop semantic mask, and latest slice classification through the existing review APIs.

## Current Domain Model

- The editor now has two explicit modes: `Semantic mask` and `Slice support`.
- Semantic mode edits one semantic byte mask for the image.
- Slice support mode edits one default physical slice support mask for the image.
- The active browser label sets come from `src/mask/labels.ts`; persisted mask versions still reference the project label schema version.
- Current saves create `AnnotationArtifactVersion` rows under a default `AnnotationArtifact` with `AnnotationArtifactKind.SEMANTIC_MASK`.
- Slice support saves create `AnnotationArtifactVersion` rows under a default `AnnotationArtifact` with `AnnotationArtifactKind.SLICE_SUPPORT_MASK` and link the default `SliceInstance.supportArtifactVersionId`.
- Saved mask versions record canonical SHA-256 checksum, byte size, width, height, `u8raw-v1` format, `IMAGE_PIXEL` coordinate space, creator, and label schema version.
- Slice classification is set from the editor and persisted as `SliceClassificationVersion`.
- BBox proposal mode creates one `SliceInstance` per new slice proposal and appends `SliceBoundingBoxVersion` rows in `SOURCE_IMAGE_PIXEL` coordinate space.
- `SliceInstance.boundingBox` is a denormalized current summary only; `SliceBoundingBoxVersion` is the proposal history source of truth.
- BBox proposals are crop planning/provenance artifacts, not support masks and not export-ready ground truth.
- Derived slice crops are persisted as `DerivedSliceCrop` rows in `CROP_PIXEL` coordinate space. They reference the immutable source image, source checksum, slice instance, and exact BBox version. Crop PNG bytes are private derived artifacts and are read through `/api/slice-crops/[cropId]/asset`.
- Crop support masks are persisted as crop-scoped `SLICE_SUPPORT_MASK` artifact versions in `CROP_PIXEL`. They link to the source image through `AnnotationArtifact.imageId`, to the slice through `AnnotationArtifactVersion.sliceInstanceId`, and to the crop through `AnnotationArtifactVersion.derivedCropId`.
- Crop semantic masks are persisted as crop-scoped `SEMANTIC_MASK` artifact versions in `CROP_PIXEL`. They link to the source image, slice instance, derived crop, optional support mask version, and semantic mode. The editor exposes Sap/Heartwood and Copper modes.
- `MaskKind.REFINED` is removed from the schema; current browser saves are draft human semantic annotation artifacts.
- The editor shows draft/submitted/approved/rejected state for semantic masks, support masks, and slice classifications.
- `OWNER`/`QA` users can approve/reject submitted versions from the editor; `OWNER`/`QA`/`LABELER` users can submit draft versions.
- The editor shows a simple export-readiness summary based on approved versions only.
- Crop editors show crop-specific readiness from `src/server/domain/cropReadiness.ts`; BBox/crop panels show selected-crop next actions and the project export panel uses the same resolver summary.
- The correction editor opens `MODEL_PREDICTION_CORRECTION` tasks, loads prediction masks read-only, and saves separate human correction versions. It does not run inference, import predictions, manage batch queues, or implement multi-object support geometry.
- Copper is available only as a semantic material label. It is not a slice support mask and must not be used as a proxy for physical slice geometry.

## Stable Save Errors

Mask save APIs return stable sanitized error codes for integrity failures, including `UPLOAD_TOO_LARGE`, `WIDTH_REQUIRED`, `HEIGHT_REQUIRED`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `CHECKSUM_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.

Successful semantic saves record `SEMANTIC_MASK_COMMITTED`; successful default support saves record `SUPPORT_MASK_COMMITTED`; successful crop support saves record `CROP_SUPPORT_MASK_COMMITTED`; successful crop semantic saves record `CROP_SEMANTIC_MASK_COMMITTED`; RB-090 classification derivation records `SLICE_CLASSIFICATION_DERIVED_FROM_SEMANTIC_MASK` or `SLICE_CLASSIFICATION_DERIVATION_FAILED`; validation failures record `ARTIFACT_VALIDATION_FAILED` where the request is authenticated.

For byte-length failures after RB-080/RB-081, authenticated audit details may include safe diagnostics: expected bytes, received bytes, declared client bytes, content length, width, height, and format. They do not include mask payload bytes, storage keys, private URLs, credentials, or tokens.

## Trial Full-Resolution Policy

The current editor is a full-resolution editor, not a tiled or downscaled workflow.

- Up to `6000x4000` / `24,000,000` pixels: normal trial path.
- Above that and up to `8000x6000` / `48,000,000` pixels: allowed, but the UI marks the image as large and warns about iPad/browser memory.
- Above `8000x6000`, above `48,000,000` pixels, or beyond an `8000` long edge / `6000` short edge: not supported by the trial editor.

At the upper bound, one `u8raw-v1` mask is `48,000,000` bytes, about 45.8 MiB. The editor memory budget must assume at least five mask or working-copy layers plus the decoded browser image; an `8000x6000` decoded RGBA image alone is about 192 MB. Real iPad Safari validation remains required before relying on the upper bound in a customer pilot.

The trial does not hard-block multiple editor tabs. Users should avoid opening multiple large editor tabs; a future edit-session or soft-lock workflow is tracked as backlog.

## Crop-Based Slice Annotation

RB-085 defines the crop-based workflow for RB-086 through RB-092. RB-086 implements source-image BBox proposals in the existing editor; RB-087 adds derived crop generation and preview from those proposals.

The overall target flow is:

```text
Original image
-> BBox proposal
-> derived slice crop
-> pixel-perfect crop support mask
-> semantic annotation with mode-aware support policy
-> auto-suggested slice classification
-> review/approval
-> export with crop/source-image provenance
```

RB-093 adds the planned user-facing orchestration for the next sprint:

```text
Image-level BBox stage
-> confirm BBox set
-> slice navigator with whole-image context
-> selected-slice crop workbench
-> support mask
-> semantic mask
-> classification/readiness
```

The planned crop workflow uses `confirm` wording for BBox sets. BBox confirmation is a workflow planning state, not artifact review or ground-truth approval. Pixel-perfect support masks, semantic masks, and slice classifications keep their existing artifact-specific review states.

Current RB-086 behavior:

- `BBox proposal` mode is available in the existing editor toolbar.
- Users can draw source-image rectangles, select a slice proposal, replace its geometry by drawing again, delete the current proposal, and reload persisted proposals.
- Server validation uses persisted `ImageAsset.width` and `ImageAsset.height`, not browser display size.
- Viewer roles can list proposals but cannot mutate them.

Current RB-094 behavior:

- Image list and image metadata routes link to `/app/projects/[projectId]/images/[imageId]/crop`.
- `/crop` redirects to `/crop/bboxes` unless the active BBox set is confirmed, then redirects to `/crop/slices`.
- `/crop/bboxes` uses the editor canvas in BBox-stage mode: full-image semantic/support/classification/review controls are hidden, BBox drawing is selected by default, and the panel uses "Step 1: Mark slice work areas" wording.
- `POST /api/images/[imageId]/slice-bboxes/confirm` persists image-level BBox set confirmation in `ImageCropWorkflowState`.
- Creating, replacing, or deleting a BBox after confirmation keeps append-only BBox history and marks the image-level BBox set as `BBOX_NEEDS_UPDATE`.

Current RB-095 behavior:

- `/crop/slices` redirects to the first selected-slice navigator route when the BBox set is confirmed, and redirects back to `/crop/bboxes` if the BBox set is not confirmed.
- `/crop/slices/[sliceInstanceId]` shows the source image with clickable BBox overlays, highlights the selected slice, and lists per-slice crop/support/semantic/classification/readiness badges.
- `src/server/domain/cropSliceNavigator.ts` composes navigator state from active BBoxes, derived crop versions, and `src/server/domain/cropReadiness.ts`.
- The selected-slice panel can generate or regenerate the current derived crop through the existing `POST /api/slice-bboxes/[bboxVersionId]/crop` API, then links to the current compatibility support and semantic crop editor routes.

Current RB-087 behavior:

- Editable roles can generate a derived crop from the currently selected active BBox proposal.
- The editor shows the latest crop for the selected BBox version with dimensions, requested padding, clipping state, and a private app-mediated preview image.
- The default requested padding is 32 px. Runtime/API presets are `0`, `16`, `32`, and `64`, but the current editor button uses the runtime default.
- Replacing a BBox does not mutate existing crops; it creates a new BBox version, and generating again creates the next crop version for the same slice instance.

Current RB-088 behavior:

- The selected derived crop links to a deep-linkable crop support editor.
- The crop support editor displays the private crop PNG in crop coordinates and edits a crop-sized support mask.
- Brush and eraser tools write only background or the active `slice_support` byte.
- Saving creates a new draft `SLICE_SUPPORT_MASK` artifact version with `coordinateSpace = CROP_PIXEL`.
- The saved version is linked to the source image, slice instance, and derived crop, and can be reloaded from the crop editor.
- Crop support-mask saves validate exact crop dimensions and reject Copper semantic bytes as support geometry.

Current RB-089 behavior:

- The selected derived crop links to a deep-linkable crop semantic editor.
- The crop semantic editor no longer soft-blocks when support is missing. Sap/Heartwood support is derived from semantic foreground; Copper drafts can save before support exists but remain not export-ready until support is approved.
- The editor displays the crop PNG with a read-only support overlay and editable semantic overlay.
- Sap/Heartwood mode allows manual Sapwood, Heartwood, and Unknown painting inside support. Complement fill is deferred.
- Copper mode allows Copper and Unknown painting inside support; background inside support is the implicit non-copper negative.
- Saving creates a new draft `SEMANTIC_MASK` artifact version with `coordinateSpace = CROP_PIXEL`, the selected semantic mode, and optional support-mask version id.
- Copper edits are constrained to support when support is present; Sap/Heartwood foreground is allowed to define support geometry directly.

Current RB-090 behavior:

- Successful crop semantic saves append a draft slice-classification suggestion derived from the saved semantic bytes.
- Copper mode with Copper pixels suggests `COPPER_SLICE`; Sap/Heartwood mode with Sapwood or Heartwood pixels suggests `SAP_HEARTWOOD_SLICE`; empty/ambiguous masks produce `UNKNOWN` or `REVIEW_REQUIRED` according to the stored derivation reason.
- The crop semantic editor shows the latest classification source/reason and lets editable users append a manual override for the same slice instance.
- Auto suggestions and manual overrides are separate `SliceClassificationVersion` rows. Auto suggestions remain draft and are not export-ready until reviewed through the classification review flow.

The current full-resolution editor remains valid and should not be removed by the crop sprint. The crop workflow is the preferred scalable path for large images and iPad-constrained annotation because it reduces the working mask area while preserving traceability to the immutable source image.

Editor-specific crop rules:

- BBox drawing is a proposal workflow, not ground-truth instance annotation.
- Derived crop padding is visual workspace and must not be treated as support geometry.
- Crop support-mask editing is the source of physical slice geometry for crop workflows.
- Semantic editing is constrained to support once support exists.
- Copper semantic pixels remain material labels and must not be treated as support geometry.
- Sapwood/heartwood workflows may support complement fill inside support while preserving `UNKNOWN` or review-required options.
- Crop-aware saves must carry explicit coordinate-space metadata and transforms rather than pretending crop masks are full-image masks.
- Auto-suggested slice classifications are provenance-bearing draft suggestions until a human review/approval or accepted-auto policy makes them export-ready.

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
