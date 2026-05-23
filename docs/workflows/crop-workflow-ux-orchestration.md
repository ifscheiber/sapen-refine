# Crop Workflow UX Orchestration

## Purpose

This page defines the staged user-facing crop workflow selected by RB-093. RB-094 implements the image-level BBox stage and BBox set confirmation portion of this workflow. RB-095 implements the whole-image slice navigator and per-slice status badges. RB-103 implements BBox-stage re-entry from crop editors. RB-104 removes the legacy full-image editor surface.

The crop workflow is a route-addressable staged workflow, not a hidden client-only state machine.

## Planned User Flow

```text
Open crop workflow for an image
-> mark slice work areas on the source image
-> confirm the BBox set
-> navigate slices with whole-image context
-> open the selected slice crop workbench
-> draw or verify support mask
-> draw semantic mask with mode-aware support policy
-> derive or review classification
-> review readiness and export eligibility
```

The BBox stage uses planning language. BBoxes are rough crop work areas and must not be described as support masks, instance masks, or approved ground truth.

## Browser Routes

- `/app/projects/[projectId]/images/[imageId]/crop` - crop workflow entry route. It resolves persisted workflow state and sends the user to the right stage.
- `/app/projects/[projectId]/images/[imageId]/crop/bboxes` - implemented image-level "Step 1: mark slice work areas" stage.
- `/app/projects/[projectId]/images/[imageId]/crop/slices` - implemented slice navigator entry. It requires a confirmed BBox set and redirects to the first selected slice when active slices exist.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]` - implemented compatibility selected-slice route. It redirects to the current crop workbench when a current crop exists.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]` - implemented selected crop workbench with mode-aware guidance, crop preview, status, readiness, and embedded slice navigation.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/support` - implemented crop workflow support mask tool route.
- `/app/projects/[projectId]/images/[imageId]/crop/slices/[sliceInstanceId]/crops/[cropId]/semantic` - implemented crop workflow semantic mask tool route.

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

The BBox stage is the first workflow stage. It shows the source image, allows source-image BBox proposal drawing, and provides a clear `Confirm BBox set` action once active BBoxes exist.

Confirming a BBox set records workflow intent only. It does not approve BBoxes as review artifacts and does not make a slice training-ready.

RB-094 stores confirmation in `ImageCropWorkflowState`. BBox creation, replacement, and deletion remain append-only through `SliceBoundingBoxVersion`; when they happen after confirmation, the image-level workflow state becomes `BBOX_NEEDS_UPDATE` until the set is confirmed again.

RB-103 makes this edit/re-confirm loop reachable from crop semantic and support editors. Opening `/crop/bboxes` after confirmation shows the confirmed BBoxes but keeps mutation controls locked until the user clicks `Edit BBoxes`. Navigation-only re-entry keeps the workflow in `BBOX_CONFIRMED`; replacing or deleting BBoxes after the explicit unlock marks the set `BBOX_NEEDS_UPDATE` and requires `Re-confirm BBox set` before continuing.

### Slice Navigator

The slice navigator keeps the original image visible as orientation context. It shows active BBoxes, highlights the selected slice, and summarizes crop, support, semantic, classification, and readiness state for each slice. RB-101 embeds this navigator as the right rail of the crop support and semantic editors. RB-103 adds an `Edit BBoxes` action to that rail so users can return to the image-level BBox stage without leaving the crop workflow.

Clicking a slice in the editor rail opens the same editor mode for that slice. If the current crop is missing, the rail defensively calls the ensure-current-crops API and then navigates to the created crop. The `/crop/slices/[sliceInstanceId]` route remains a compatibility entry and redirects to the selected crop workbench when a current crop exists.

### Crop Workbench

The crop workbench is the main annotation landing surface for a selected slice crop. RB-096 implements it at `/crop/slices/[sliceInstanceId]/crops/[cropId]` as an orchestration layer around existing support and semantic crop editors. It shows the selected crop preview, semantic family/status, support status, semantic status, classification status, readiness reasons, next action guidance, and the embedded whole-image slice navigator.

Crop support and semantic editors remain deep-linkable tool surfaces and expose the full crop mask tool palette: Brush, Eraser, freehand lasso, polygon lasso, undo/redo, opacity, fit, zoom, reload, and save. BBox proposal drawing remains in the image-level planning stage and is not a crop editor tool.

Semantic annotation follows the mode-aware support policy. Sap/Heartwood can be edited without an explicit support mask and derives support geometry from semantic foreground. Copper can be drafted before support exists, but approved explicit support is required before Copper readiness/export; when support exists, Copper brush and lasso edits are clipped to support.

### Semantic Family And Classification

One slice should use exactly one semantic family for active crop semantic annotation:

- Sap/Heartwood mode for sapwood, heartwood, and optional unknown labels.
- Copper mode for copper and optional unknown labels.

RB-097 implements explicit family reset. Switching from an active Sap/Heartwood family to Copper, or from Copper to Sap/Heartwood, requires confirmation and the next save sends `x-semantic-family-reset: true`. Opposite-family active semantic versions and their auto-derived classifications become `SUPERSEDED`; historical bytes remain. Conflicting legacy active data surfaces as `CONFLICT` and readiness `REVIEW_REQUIRED` until reset.

Classification follows semantic content. Auto-derived classifications are attributable draft suggestions unless reviewed or manually overridden through the existing classification versioning model. Manual overrides remain allowed, but an override that contradicts the active semantic family produces `CLASSIFICATION_SEMANTIC_FAMILY_MISMATCH` and is not export-ready.

## Current Implementation Boundary

Current runtime ownership:

- `src/features/editor/EditorClient.tsx` for BBox-stage source-image controls and assisted correction.
- `src/features/editor/ImageCropBBoxesPage.tsx` for the staged image-level BBox workflow route.
- `src/features/editor/ImageCropSlicesPage.tsx` and `src/features/editor/ImageCropSliceNavigatorClient.tsx` for the whole-image slice navigator route.
- `src/features/editor/CropWorkbenchPage.tsx` for the selected crop workbench route.
- `src/server/domain/imageCropWorkflow.ts` for persisted BBox set confirmation state and status resolution.
- `src/server/domain/cropSliceNavigator.ts` for per-slice navigator status composition from active BBoxes, crop versions, and crop readiness.
- `src/features/editor/CropSupportEditorPage.tsx` for crop support editing.
- `src/features/editor/CropSemanticEditorPage.tsx` for crop semantic editing and classification override controls.
- `GET /api/projects/[projectId]/crop-readiness` for crop readiness summaries.

The unified selected-slice crop workbench and semantic-family guardrails are owned by RB-096 and RB-097. RB-103 owns explicit navigation from crop editors back to the BBox stage and smoke coverage for editing/re-confirming BBoxes after crop inspection. RB-104 owns removal of the legacy full-image editor route while preserving BBox-stage drawing and assisted correction through non-legacy surfaces. Final smoke/closeout is owned by RB-098.
