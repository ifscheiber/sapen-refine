# RB-088 — Crop Editor: Mandatory Pixel-Perfect Slice Support Mask

## Status

Done / Implemented

## Priority

High

## Type

Editor / Support Mask / Crop Annotation / Instance Segmentation / Tests

## Goal

Allow users to draw the pixel-perfect complete slice support mask inside a derived crop.

This support mask becomes the authoritative instance geometry for the slice.

---

## Context

BBox is only a proposal. The pixel-perfect support mask is required for training-ready slice instances.

For Copper workflows, support mask must exist before semantic Copper annotation.

---

## Non-Goals

Do **not** implement:

- semantic crop annotation,
- auto classification,
- export changes,
- multi-object crop editor beyond the current slice,
- advanced polygon tools unless already available.

---

## Implementation Scope

### 1. Crop editor route

Suggested route:

```text
/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crop/support
```

or similar.

### 2. Support mask in crop coordinate space

Create/save:

```text
SliceSupportMaskVersion
coordinateSpace = CROP_PIXEL
derivedFromCropId
sliceInstanceId
```

It must be reprojectable to original image coordinates.

### 3. Mandatory readiness

A slice is not semantic-annotation-ready until support mask exists.

Statuses:

```text
support missing
support draft
support submitted
support approved
```

Use existing review concepts where appropriate.

Approved crop support is required before the slice can be training-ready for support/instance targets or Copper semantic workflows. Draft/submitted support may enable local editing, but export readiness must require the review policy defined by RB-085/RB-092.

### 4. UI

- Show crop image.
- Draw support mask.
- Eraser works if RB-070 implemented.
- Save/reload support mask.
- Show readiness state.
- Preserve crop/source transform metadata with every saved crop-space support version.

### 5. Tests

- draw/save/reload support mask in crop,
- dimensions match crop,
- transform to original coordinate space tested,
- semantic annotation locked until support exists,
- no Copper semantic mask as support.

---

## Acceptance Criteria

1. User can create pixel-perfect support mask in crop.
2. Support mask is linked to slice instance and crop.
3. Support mask is versioned and attributable.
4. Support mask can be mapped to original image coordinates.
5. Support required before semantic crop annotation.
6. Existing full-image workflows remain green.
7. Docs updated.
8. Ticket moved to done.
9. Full validation gate passes.
