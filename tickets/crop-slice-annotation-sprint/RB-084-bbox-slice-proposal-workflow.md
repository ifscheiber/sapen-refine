# RB-084 — BBox Slice Proposal Workflow

## Status

Proposed / Depends on RB-083

## Priority

High

## Type

Editor / Slice Proposal / UI / Domain / Tests

## Goal

Allow users to create rough bounding-box proposals for slice instances on the original image.

The BBox defines a work/crop area. It is not the final pixel-perfect instance mask.

---

## Context

The crop-based annotation sprint uses BBoxes as a fast ergonomic first step:

```text
Original image
→ User draws BBox around each slice
→ System creates SliceInstance/BBox proposal
→ later derived crop is generated
```

---

## Non-Goals

Do **not** implement:

- crop generation,
- crop editor,
- semantic annotation,
- support mask editor,
- auto classification,
- export changes.

---

## Implementation Scope

### 1. Data model

Add or use versioned BBox concept:

```text
SliceBoundingBoxVersion
```

or equivalent.

Required fields/concepts:

- id,
- projectId,
- imageId,
- sliceInstanceId,
- x,
- y,
- width,
- height,
- version,
- createdBy,
- createdAt,
- status/review state if needed,
- provenance = HUMAN_ANNOTATION.

If schema can reuse existing `SliceInstance` bbox fields, document why versioning is sufficient or not.

### 2. UI

Add BBox proposal mode on original image.

User can:

- draw rectangular BBox,
- see BBox list,
- select BBox,
- rename/label slice if trivial,
- delete draft BBox if safe,
- save/reload.

### 3. Validation

- BBox inside image bounds,
- positive width/height,
- minimum size,
- belongs to image/project,
- actor attribution.

### 4. Routes/API

Add app-mediated API for BBox proposals.

No private storage keys.

### 5. Tests

- create BBox,
- invalid BBox rejected,
- save/reload,
- project access enforced,
- E2E simple BBox creation if stable.

---

## Acceptance Criteria

1. User can create BBox proposals for slices on original image.
2. BBox persists and reloads.
3. BBox does not claim to be instance ground truth.
4. BBox is linked to `SliceInstance`.
5. Validation and attribution exist.
6. Existing editor workflows remain green.
7. Docs updated.
8. Ticket moved to done.
9. Full validation gate passes.
