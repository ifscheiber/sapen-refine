# Crop Workflow UX Orchestration

## Purpose

This page defines the staged user-facing crop workflow selected by RB-093. RB-094 implements the image-level BBox stage and BBox set confirmation portion of this workflow. RB-095 implements the whole-image slice navigator and per-slice status badges. RB-098 closes the adjusted sprint with browser smoke coverage for Copper readiness, annotation-family locking, BBox re-entry, and legacy editor removal. RB-103 implements BBox-stage re-entry from crop editors. RB-104 removes the legacy full-image editor surface. RB-123 removes the intermediate crop workbench and makes the unified crop annotation editor the selected-crop surface.

The crop workflow is a route-addressable staged workflow, not a hidden client-only state machine.

## Planned User Flow

```text
Open crop workflow for an image
-> mark slice work areas on the source image
-> confirm the BBox set
-> navigate slices with whole-image context
-> open the unified crop annotation editor for the selected crop
-> choose Sapwood / Heartwood or Cu
-> draw the selected family with mode-aware support policy
-> derive or review classification
-> review readiness and export eligibility
```

The BBox stage uses planning language. BBoxes are rough crop work areas and must not be described as support masks, instance masks, or approved ground truth.

## Browser Routes

- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry route. It resolves persisted workflow state and sends the user to the right stage.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - implemented image-level "Step 1: mark slice work areas" stage.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - implemented slice navigator entry. It requires a confirmed BBox set and redirects to the first selected slice when active slices exist.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - implemented compatibility selected-slice route. It redirects to the current crop editor when a current crop exists.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - canonical unified crop annotation editor with family selector, crop mask tools, status/readiness, derived classification review controls, and embedded slice navigation.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - compatibility alias that redirects to the unified editor with the support target selected.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - compatibility alias that redirects to the unified editor with the semantic target selected.

Compatibility crop routes remain deep-linkable:

- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`

RB-103 replaces crop-editor escape hatches to the old full-image editor with an explicit `Edit BBoxes` action that returns to `/crop/bboxes`. RB-104 removes `/app/projects/[projectId]/images/[imageId]/edit` as a user-facing product route.

## State Model

Image-level crop workflow state:

| State | Meaning | Primary route |
| --- | --- | --- |
| `NO_BBOXES` | No active BBox proposals exist. | `/crop/bboxes` |
| `BBOX_DRAFT` | Active BBoxes exist, but the set is not confirmed. | `/crop/bboxes` |
| `BBOX_CONFIRMED` | The current BBox set was intentionally confirmed. | `/crop/slices` |
| `BBOX_NEEDS_UPDATE` | A confirmed set changed or became stale. | `/crop/bboxes` |

Per-slice status is composed from existing persisted data:

| Area | States |
| --- | --- |
| BBox | missing, draft, confirmed, needs update |
| Crop | missing, current, stale |
| Support mask | missing or artifact review state |
| Semantic mask | missing or artifact review state |
| Semantic family | unset, Sap/Heartwood, Copper, conflict |
| Classification | missing, auto-derived, manual override, review-required |
| Readiness | ready, partial, not ready, review required |

The current readiness values and reason codes remain owned by `src/server/domain/cropReadiness.ts`.

## Stage Behavior

### BBox Stage

The BBox stage is the first workflow stage. It shows the source image, provides a tools-only BBox toolbar for source-image BBox proposal drawing, canvas selection, safe move/resize, safe deletion, zoom, and fit. BBox counts, protection, and workflow state are shown outside the tool row in compact status/workflow strips.

Preparing slices records the existing image-level BBox confirmation workflow intent. It does not approve BBoxes as review artifacts and does not make a slice training-ready.

RB-094 stores confirmation in `ImageCropWorkflowState`. BBox creation, replacement, and deletion remain append-only through `SliceBoundingBoxVersion`; when they happen after confirmation, the image-level workflow state becomes `BBOX_NEEDS_UPDATE` until the set is confirmed again.

RB-103 makes this edit/re-prepare loop reachable from crop annotation editors. Opening `/crop/bboxes` after confirmation shows the confirmed BBoxes but keeps mutation controls locked until the user clicks `Unlock BBox editing`. Navigation-only re-entry keeps the workflow in `BBOX_CONFIRMED`; replacing or deleting BBoxes after the explicit unlock marks the set `BBOX_NEEDS_UPDATE` and requires `Prepare slices` before `Open slice annotation` is available again.

DESIGN-006 adds BBox-stage safety guardrails. Active BBoxes must not overlap; overlap issues are shown in the compact status strip and block slice preparation/opening. BBoxes with semantic mask, support/instance mask, or classification versions are locked against deletion and geometry mutation unless a future explicit destructive dependency-removal flow is implemented. Existing derived crops alone do not block BBox replacement because crop history is append-only and stale/current crop state is already represented separately.

### Slice Navigator

The slice navigator keeps the original image visible as orientation context. It shows active BBoxes, highlights the selected slice, and summarizes crop, support, semantic, classification, and readiness state for each slice. RB-101 embeds this navigator as the right rail of the unified crop annotation editor. RB-103 adds an `Edit BBoxes` action to that rail so users can return to the image-level BBox stage without leaving the crop workflow.

Clicking a slice in the editor rail opens the unified editor for that slice. If the current crop is missing, the rail defensively calls the ensure-current-crops API and then navigates to the created crop. The `/crop/slices/[sliceInstanceId]` route remains a compatibility entry and redirects to the selected crop editor when a current crop exists.

### Unified Crop Annotation Editor

The unified crop annotation editor is the main annotation surface for a selected slice crop. RB-123 implements it at `/crop/slices/[sliceInstanceId]/crops/[cropId]` by reusing the crop semantic canvas and integrating support-mask editing into the same route. It shows the crop canvas, annotation family selector, support/semantic/classification status, readiness reasons, review controls, and embedded whole-image slice navigator.

The old support and semantic editor routes remain deep-linkable compatibility aliases but redirect to the unified editor with `target=support` or `target=semantic`. The editor exposes Brush for semantic labels, freehand lasso, polygon lasso, undo/redo, opacity, fit, zoom, reload, and save. Support is selected as a Cu-family label and uses Polygon/Lasso only. BBox proposal drawing remains in the image-level planning stage and is not a crop editor tool.

Semantic annotation follows the mode-aware support policy. Sap/Heartwood can be edited without an explicit support mask and derives support geometry from semantic foreground. Copper can be drafted before support exists, but approved explicit support is required before Copper readiness/export. Support must contain all Copper pixels; when support exists, Copper brush and lasso edits are clipped to support.

### Annotation Family And Classification

One crop should use exactly one active annotation family:

- Sapwood / Heartwood for sapwood and heartwood semantic labels.
- Cu for copper semantic labels and explicit physical support masks; Support appears as a Cu-family label, not as a separate local tab.

RB-123 replaces explicit semantic-family reset with byte-derived annotation-family locking. The active family is derived from latest non-superseded mask bytes: Sapwood/Heartwood is occupied by sapwood or heartwood pixels; Cu is occupied by copper pixels or support-mask foreground pixels. Saving non-empty data in the opposite family fails with `CROP_ANNOTATION_FAMILY_CONFLICT`. Saving an all-background version for the occupied family is allowed and unlocks the other family without deleting historical versions. Conflicting legacy active data surfaces as `CONFLICT` and readiness `REVIEW_REQUIRED` until one family is cleared.

Classification follows semantic content. Auto-derived classifications are attributable draft suggestions unless reviewed through the existing classification review model. DESIGN-014 removes the separate Classification tab and manual crop-editor override controls; lower-level manual classification APIs remain part of the compatibility model, and any manual override that contradicts the active semantic family produces `CLASSIFICATION_SEMANTIC_FAMILY_MISMATCH` and is not export-ready.

## Current Implementation Boundary

Current runtime ownership:

- `src/features/editor/EditorClient.tsx` for BBox-stage source-image controls and assisted correction.
- `src/features/editor/ImageCropBBoxesPage.tsx` for the staged image-level BBox workflow route.
- `src/features/editor/ImageCropSlicesPage.tsx` and `src/features/editor/ImageCropSliceNavigatorClient.tsx` for the whole-image slice navigator route.
- `src/features/editor/CropSemanticEditorPage.tsx` for the selected crop unified editor route.
- `src/server/domain/imageCropWorkflow.ts` for persisted BBox set confirmation state and status resolution.
- `src/server/domain/cropSliceNavigator.ts` for per-slice navigator status composition from active BBoxes, crop versions, and crop readiness.
- `src/features/editor/CropSemanticEditorClient.tsx` for support-mask editing, semantic-mask editing, derived classification status/review controls, and crop artifact review controls.
- `src/server/domain/cropAnnotationFamilies.ts` for byte-derived annotation-family state and save-time conflict enforcement.
- `GET /api/projects/[projectId]/crop-readiness` for crop readiness summaries.

The selected-crop editor and annotation-family guardrails are owned by RB-123, building on RB-096/RB-097. RB-103 owns explicit navigation from crop editors back to the BBox stage and smoke coverage for editing/re-confirming BBoxes after crop inspection. RB-104 owns removal of the legacy full-image editor route while preserving BBox-stage drawing and assisted correction through non-legacy surfaces. Final smoke/closeout is owned by RB-098.
