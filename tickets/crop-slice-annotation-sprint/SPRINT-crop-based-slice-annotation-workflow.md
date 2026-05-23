# Sprint — Crop-Based Slice Annotation Workflow

## Status

Proposed / Planning Sprint

## Project

`sapen-annotate`

## Sprint Theme

Support-first, crop-based slice annotation for scalable, iPad-friendly, full-traceable training-data creation.

---

## 1. Executive Summary

The current SaPen Annotate workflow supports full-resolution annotation on the original image. RB-081 fixed the immediate large-mask upload blocker and keeps full-resolution annotation viable for trial images.

However, full-resolution semantic annotation becomes increasingly expensive for large images such as 8000×6000. A single `u8raw-v1` mask at that size is 48,000,000 bytes. With multiple working layers such as semantic mask, support mask, prediction overlay, human correction and save/working copies, both browser/device memory and server request buffering can become significant.

The next product architecture should therefore move toward a **crop-based slice annotation workflow**.

The central design principle is:

```text
The original uploaded image remains the immutable source of truth.
BBox proposals, derived crops, support masks, semantic masks, classifications and exports remain versioned derived artifacts that can always be traced back to the original image and coordinate space.
```

---

## 2. Rationale

### 2.1 Performance and iPad usability

Full-image semantic masks are large:

```text
6000×4000 = 24,000,000 pixels ≈ 22.9 MiB per u8 mask
8000×6000 = 48,000,000 pixels ≈ 45.8 MiB per u8 mask
```

Worst-case editor memory can include:

```text
decoded image
canvas backing store
semantic mask
support mask
prediction overlay
human correction draft
save/working copy
```

On desktop this may be acceptable. On iPad Safari it may become fragile.

A crop-based workflow reduces the semantic annotation working area. A slice crop of 1200×800 is under 1 MiB per u8 mask, compared to tens of MiB for the full image.

### 2.2 Data quality

For training, the app needs distinct targets:

```text
Instance segmentation:
  complete physical slice geometry

Semantic segmentation:
  Sapwood / Heartwood / Copper / other relevant material classes

Slice classification:
  Copper slice vs Sap/Heartwood slice vs Unknown/Review required
```

Copper masks are especially important:

```text
Copper semantic mask = penetrated/copper-stained region
Slice support mask   = complete physical wood piece outline
```

A Copper semantic mask must never be treated as a complete instance mask.

### 2.3 Human workflow

A practical annotation workflow should minimize unnecessary full-image pixel editing.

Target user flow:

```text
1. On original image, draw rough bounding boxes around slices.
2. System creates derived slice crops.
3. In each crop, user draws the complete pixel-perfect slice support outline.
4. Only after support exists, user performs semantic annotation inside the support area.
5. Classification is auto-suggested from semantic labels and can be overridden.
6. Export can include crop masks and/or reprojected original-coordinate masks.
```

---

## 3. Key Design Decisions

### Decision 1 — BBox is a proposal, not ground truth

A bounding box is only a fast way to define a crop/work area. It is not the final instance segmentation target. Final instance geometry comes from the pixel-perfect `SliceSupportMaskVersion`.

### Decision 2 — Pixel-perfect support mask is mandatory

Every training-ready `SliceInstance` must have a pixel-perfect complete support mask. For Copper workflows, semantic annotation must be blocked or marked incomplete until a support mask exists.

### Decision 3 — Crops are derived artifacts

Derived slice crops are not raw uploaded images. They must record source image id/checksum, bbox version, crop dimensions, padding, transform, creator and timestamp.

### Decision 4 — Coordinate spaces are explicit

At minimum:

```text
SOURCE_IMAGE_PIXEL
CROP_PIXEL
```

Every crop mask must be mappable back to original image coordinates.

### Decision 5 — Semantic annotation is constrained by support

Once support exists, the semantic editor should show or allow editing primarily inside the support mask. Outside support is locked/transparent/ignored.

### Decision 6 — Sap/Heartwood can use complement fill

For Sapwood/Heartwood slices, the support area is expected to be partitioned into Sapwood and Heartwood. The app may support painting one class and filling the remaining support as the other class, while retaining `UNKNOWN` / `REVIEW_REQUIRED` options.

### Decision 7 — Copper requires explicit support

For Copper:

```text
Support mask = full wood piece
Copper mask  = penetrated/copper-stained pixels
Non-copper support area = negative / non-copper wood / unlabeled depending on export contract
```

Copper semantic annotation alone is never enough for instance segmentation.

### Decision 8 — Slice classification can be auto-derived

Classification can be suggested from semantic content:

```text
Copper pixels present       → COPPER_SLICE
Sapwood/Heartwood present   → SAP_HEARTWOOD_SLICE
Insufficient semantics      → UNKNOWN / REVIEW_REQUIRED
```

This saves a user click but must remain auditable and overridable.

### Decision 9 — Export must preserve provenance and transform

Exports must include enough metadata to reconstruct:

```text
crop pixel → original image pixel
derived artifact → source image and version
semantic/support/classification → slice instance
```

---

## 4. Sprint Tickets

```text
RB-085  Crop-Based Slice Annotation Workflow ADR / Design  [done]
RB-086  BBox Slice Proposal Workflow  [done]
RB-087  Derived Slice Crop Generation  [done]
RB-088  Crop Support Mask Editor
RB-089  Crop-Constrained Semantic Annotation
RB-090  Auto Slice Classification from Semantic Masks
RB-091  Crop / Original Coordinate Export Contract
RB-092  Crop Workflow Review / Approval Integration
```

---

## 5. Recommended Sequence

```text
Phase 1 — Design:
  RB-085 [done]

Phase 2 — Crop foundation:
  RB-086 [done]
  RB-087 [done]

Phase 3 — Support-first annotation:
  RB-088

Phase 4 — Semantics and classification:
  RB-089
  RB-090

Phase 5 — Export and review integration:
  RB-091
  RB-092
```

---

## 6. Non-Goals for This Sprint

This sprint should not introduce:

- SaPen Core integration,
- model inference execution,
- production-scale queue infrastructure,
- enterprise identity provider,
- multi-user concurrent editing locks unless separately scoped,
- tiled/downscaled full-image editor implementation unless a later ticket chooses it,
- ground-truth semantics that treat predictions or Copper masks as support geometry.

---

## 7. Relationship to Current Full-Resolution Editor

The existing full-resolution editor remains valid and useful. This sprint adds a more scalable workflow for large images and iPad workflows. It should not remove existing full-image editing unless a later migration decision explicitly does so.

Trial policy can remain:

```text
Full-resolution editing supported up to the documented trial bounds.
For larger or iPad-constrained workflows, use crop-based slice annotation.
```

---

## 8. Validation Principles

Every implementation ticket should preserve the full validation gate used by the repo, including db rebuild, Prisma generate, lint, typecheck, build, test, E2E, design hardcoding, handoff dry-run, and Compose config checks.

Where tickets introduce schema changes, they must include migrations and updated Prisma docs. Where tickets introduce coordinate transforms, they must include unit tests for round-trip mapping.

---

## 9. Expected Outcome

After the sprint, SaPen Annotate should support a scalable workflow:

```text
Original image
→ BBox proposal
→ derived crop
→ pixel-perfect slice support
→ constrained semantic annotation
→ auto classification
→ review/approval
→ export with crop and original-coordinate provenance
```

This creates better training data, reduces large-image editor memory pressure, and makes iPad annotation more realistic.
