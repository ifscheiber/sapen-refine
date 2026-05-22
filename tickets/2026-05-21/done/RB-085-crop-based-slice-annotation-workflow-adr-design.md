# RB-085 — Crop-Based Slice Annotation Workflow ADR / Design

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Architecture / ADR / Domain Design / Coordinate Spaces / Export Contract

## Depends on

- RB-081 — Mask Upload Byte-Length Mismatch Follow-up Hotfix
- Current annotation domain, support-mask and export architecture

## Goal

Design the crop-based slice annotation workflow before implementation.

This ticket must produce a clear ADR and design docs for:

- BBox proposals,
- derived slice crops,
- pixel-perfect support masks,
- crop-constrained semantic annotation,
- automatic slice classification,
- crop/original coordinate transforms,
- export and review implications.

No runtime implementation should be done in this ticket.

---

## Context

Full-resolution annotation is now supported, but large images make full-image semantic editing expensive in browser memory and server request size.

A crop-based workflow is needed:

```text
Original image
→ BBox around slice
→ derived crop
→ pixel-perfect support mask in crop
→ semantic annotation constrained to support
→ auto classification
→ export with original coordinate traceability
```

The original image remains the immutable source of truth. Crops and masks are derived artifacts.

---

## Non-Goals

Do **not** implement:

- Prisma migrations,
- UI,
- routes,
- crop generation,
- editor changes,
- export changes,
- review changes.

Do not change current full-resolution editor behavior.

---

## Design Questions to Answer

### 1. BBox vs support mask

Define:

```text
BBox = ergonomic crop proposal
Support mask = pixel-perfect physical slice geometry
```

Clarify that BBox is not instance ground truth.

### 2. Derived crop model

Define the conceptual entity:

```text
DerivedSliceCrop
```

Required concepts:

- sourceImageId,
- source image checksum/version,
- sliceInstanceId,
- bbox version reference,
- crop x/y/width/height,
- padding,
- crop width/height,
- transform to source coordinates,
- createdBy/createdAt,
- storage/artifact info if persisted.

### 3. Coordinate spaces

Define at least:

```text
SOURCE_IMAGE_PIXEL
CROP_PIXEL
```

Specify transform:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

Include padding behavior.

### 4. Mandatory support mask

Define rule:

```text
Every training-ready SliceInstance requires a pixel-perfect support mask.
```

Copper semantic annotation requires support mask first.

### 5. Semantic annotation inside support

Define:

- outside support is locked/ignored,
- Sap/Heartwood complement fill behavior,
- Copper positive/negative/unknown semantics.

### 6. Auto classification

Define classification derivation:

```text
Copper pixels present      → COPPER_SLICE
Sap/Heartwood present      → SAP_HEARTWOOD_SLICE
insufficient semantics     → UNKNOWN / REVIEW_REQUIRED
```

Define override and provenance.

### 7. Review/approval

Define which artifacts require review:

- BBox?
- crop?
- support mask?
- semantic mask?
- auto classification?

### 8. Export

Define export requirements:

- crop image,
- crop support mask,
- crop semantic mask,
- optional reprojected original-coordinate masks,
- manifest with transform and source references.

---

## Required Docs

Create/update:

```text
docs/06-data/crop-based-slice-annotation.md
docs/06-data/coordinate-spaces-and-transforms.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/03-features/editor.md
docs/08-adr/ADR-005-crop-based-slice-annotation.md
docs/adr/README.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
docs/testing/README.md
```

ADR-005 is the next available ADR number.

---

## Acceptance Criteria

1. Crop-based workflow ADR exists.
2. Derived artifact model is defined.
3. Coordinate spaces and transforms are defined.
4. Mandatory support-mask rule is documented.
5. Copper-specific support requirement is explicit.
6. Sap/Heartwood complement-fill decision is documented.
7. Auto-classification decision is documented.
8. Export/review implications are documented.
9. Follow-up tickets RB-086 to RB-092 are aligned or updated.
10. No runtime behavior changes.
11. Ticket is moved to `tickets/2026-05-21/done/`.
12. Full validation gate passes.
