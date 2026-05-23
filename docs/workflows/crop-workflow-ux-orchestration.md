# Crop Workflow UX Orchestration

## Purpose

This page defines the staged user-facing crop workflow selected by RB-093. RB-094 implements the image-level BBox stage and BBox set confirmation portion of this workflow. RB-095 implements the whole-image slice navigator and per-slice status badges.

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

## Browser Routes

- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry route. It resolves persisted workflow state and sends the user to the right stage.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - implemented image-level "Step 1: mark slice work areas" stage.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - implemented slice navigator entry. It requires a confirmed BBox set and redirects to the first selected slice when active slices exist.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - implemented whole-image slice navigator with selected-slice status, crop generation/regeneration action, and links to current support/semantic crop editors.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - planned selected crop workbench.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - planned support mask tool mode.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - planned semantic mask tool mode.

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

The slice navigator keeps the original image visible as orientation context. It shows active BBoxes, highlights the selected slice, and summarizes crop, support, semantic, classification, and readiness state for each slice.

Clicking a slice opens `/crop/slices/[sliceInstanceId]`. The selected slice panel can generate or regenerate the current crop from the active BBox version, then links to the existing support and semantic crop editor compatibility routes. Crop status is derived as `missing`, `current`, or `stale`; stale means the latest crop was generated from an older BBox version.

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
- `src/features/editor/ImageCropSlicesPage.tsx` and `src/features/editor/ImageCropSliceNavigatorClient.tsx` for the whole-image slice navigator route.
- `src/server/domain/imageCropWorkflow.ts` for persisted BBox set confirmation state and status resolution.
- `src/server/domain/cropSliceNavigator.ts` for per-slice navigator status composition from active BBoxes, crop versions, and crop readiness.
- `src/features/editor/CropSupportEditorPage.tsx` for crop support editing.
- `src/features/editor/CropSemanticEditorPage.tsx` for crop semantic editing and classification override controls.
- `GET /api/projects/[projectId]/crop-readiness` for crop readiness summaries.

The unified selected-slice crop workbench and final workflow polish are owned by RB-096 through RB-098.
