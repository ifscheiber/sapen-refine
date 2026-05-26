# RB-091 — Crop / Original Coordinate Export Contract

## Status

Proposed / Depends on RB-085–RB-090

## Priority

High

## Type

Export / Manifest / Coordinate Transform / Training Data / Tests

## Goal

Extend export contracts so crop-based annotations can be used for training while remaining traceable to the original image.

---

## Context

Crop annotations are derived artifacts.

Training/export packages must preserve:

```text
crop data
original image reference
coordinate transform
slice instance
support mask
semantic mask
classification
review state
```

---

## Non-Goals

Do **not** implement:

- model training,
- external Core integration,
- dashboard,
- new prediction semantics.

---

## Export Requirements

Manifest entries must include:

```text
originalImageId
originalImageChecksum
sliceInstanceId
bboxVersionId
derivedCropId
cropX
cropY
cropWidth
cropHeight
paddingPx
coordinateTransform
supportMaskVersionId
semanticMaskVersionId
classificationVersionId
review/approval references
```

Package layout example:

```text
manifest.json
original-images/<imageId>.jpg
crops/<sliceInstanceId>.png
masks/support-crop/<sliceInstanceId>.u8raw
masks/semantic-crop/<sliceInstanceId>.u8raw
masks/support-original/<sliceInstanceId>.u8raw optional
```

---

## Implementation Scope

### 1. Export contract docs

Update the training export contract docs. Prediction-analysis export remains a separate proposal/QA workflow and should not be changed unless a later ADR explicitly designs crop-aware prediction analysis.

### 2. Ground-truth export integration

Add crop-aware export target or extend existing export manifest.

Must not break existing full-image export.
Must not change prediction-analysis export semantics.

### 3. Transform validation

Add tests ensuring crop mask can be mapped to original image.

### 4. Optional reprojected masks

If feasible, export reprojected full-image support/semantic masks.

If not, include enough transform metadata.

### 5. Lineage and review state

Export only crop artifacts that satisfy the review/readiness policy from RB-092. Manifest entries must show that selected support, semantic, and classification versions belong to the same crop/support lineage or explicitly mark the item not ready.

---

## Acceptance Criteria

1. Crop export manifest contract is documented.
2. Exports include original/crop coordinate provenance.
3. Support/semantic/classification versions are traceable.
4. Existing full-image export still works.
5. Tests cover transform metadata.
6. No private storage keys leak.
7. Docs updated.
8. Ticket moved to done.
9. Full validation gate passes.
