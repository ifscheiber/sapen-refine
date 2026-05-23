# Crop Workflow UX Orchestration

## Purpose

This page defines the staged user-facing crop workflow selected by RB-093. RB-094 implements the image-level BBox stage and BBox set confirmation portion of this workflow.

The crop workflow is a route-addressable staged workflow, not a hidden client-only state machine.

## Planned User Flow

```text
Open crop workflow for an image
-> mark slice work areas on the source image
-> confirm the BBox set
-> navigate slices with whole-image context
-> open the selected slice crop workbench
-> draw or verify support mask
-> draw semantic mask after support exists
-> derive or review classification
-> review readiness and export eligibility
```

The BBox stage uses planning language. BBoxes are rough crop work areas and must not be described as support masks, instance masks, or approved ground truth.

## Planned Browser Routes

- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry route. It resolves persisted workflow state and sends the user to the right stage.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - implemented image-level "Step 1: mark slice work areas" stage.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - implemented confirmed BBox-set workspace scaffold; RB-095 replaces it with the whole-image slice navigator.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - selected-slice workbench with crop status, support status, semantic status, classification status, and next action.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - selected crop workbench.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - support mask tool mode.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - semantic mask tool mode.

Current compatibility routes remain deep-linkable until later tickets replace or redirect them:

- `/app/projects/[projectId]/images/[imageId]/edit`
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`
- `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`

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

The BBox stage is the first workflow stage. It shows the source image, allows source-image BBox proposal drawing, and provides a clear `Confirm BBox set` action once active BBoxes exist.

Confirming a BBox set records workflow intent only. It does not approve BBoxes as review artifacts and does not make a slice training-ready.

RB-094 stores confirmation in `ImageCropWorkflowState`. BBox creation, replacement, and deletion remain append-only through `SliceBoundingBoxVersion`; when they happen after confirmation, the image-level workflow state becomes `BBOX_NEEDS_UPDATE` until the set is confirmed again.

### Slice Navigator

The slice navigator keeps the original image visible as orientation context. It should show active BBoxes, highlight the selected slice, and summarize crop, support, semantic, classification, and readiness state for each slice.

Clicking a slice should open the selected-slice workbench or the current next action route.

### Crop Workbench

The crop workbench is the main annotation surface for crop workflow pixel work. It should guide annotators through support first, then semantic annotation, then classification/readiness.

Semantic annotation is presented only after a current support mask exists for the crop. The server-side support-first and outside-support validation rules remain the source of truth.

### Semantic Family And Classification

One slice should use exactly one semantic family for active crop semantic annotation:

- Sap/Heartwood mode for sapwood, heartwood, and optional unknown labels.
- Copper mode for copper and optional unknown labels.

Switching families after semantic annotation exists requires an explicit reset or replacement flow in a later ticket. Conflicting historical data should surface as `CONFLICT` or readiness `REVIEW_REQUIRED` rather than silently becoming ready.

Classification follows semantic content. Auto-derived classifications are attributable draft suggestions unless reviewed or manually overridden through the existing classification versioning model.

## Current Implementation Boundary

Current runtime ownership:

- `src/features/editor/EditorClient.tsx` for the full-image editor and BBox primitive controls.
- `src/features/editor/ImageCropBBoxesPage.tsx` for the staged image-level BBox workflow route.
- `src/server/domain/imageCropWorkflow.ts` for persisted BBox set confirmation state and status resolution.
- `src/features/editor/CropSupportEditorPage.tsx` for crop support editing.
- `src/features/editor/CropSemanticEditorPage.tsx` for crop semantic editing and classification override controls.
- `GET /api/projects/[projectId]/crop-readiness` for crop readiness summaries.

Slice navigator and crop workbench runtime changes are owned by RB-095 through RB-098.
