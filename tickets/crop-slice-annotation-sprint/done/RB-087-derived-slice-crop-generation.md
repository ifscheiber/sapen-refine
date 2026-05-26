# RB-087 — Derived Slice Crop Generation

## Status

Done / Superseded by optimized ticket implementation

## Priority

High

## Type

Derived Artifacts / Crop Generation / Storage / Coordinates / Tests

## Goal

Generate derived slice crops from saved BBox proposals.

A crop is a derived artifact, not a raw uploaded image.

---

## Context

After BBox creation, the app should generate a smaller slice crop for support and semantic annotation.

The crop must remain traceable to the original image.

---

## Non-Goals

Do **not** implement:

- support mask drawing,
- semantic annotation,
- auto classification,
- export changes beyond docs,
- model inference.

---

## Implementation Scope

### 1. Crop artifact model

Add or use:

```text
DerivedSliceCrop
```

Required:

- sourceImageId,
- source image checksum,
- sliceInstanceId,
- bboxVersionId,
- cropX/Y/W/H,
- paddingPx,
- cropWidth/Height,
- coordinateSpace = CROP_PIXEL,
- integer offset transform to source,
- whether requested padding was clipped by source-image bounds,
- storage key / checksum / content type / size,
- createdBy / createdAt.

### 2. Crop generation service

Server-side service:

```text
generateCropForSliceBBox(...)
```

Requirements:

- reads source image server-side,
- extracts crop with optional padding,
- clamps first-implementation crops to source-image bounds,
- stores crop privately,
- records checksum/dimensions,
- no private URLs in client response.

### 3. Crop read route

App-mediated crop preview/read route.

### 4. Regeneration behavior

Define behavior when BBox changes:

- create new crop version,
- old crop remains historical,
- downstream masks reference crop version.

### 5. Tests

- crop coordinates correct,
- padding clamped to image bounds,
- transform maps crop pixels to source pixels,
- storage read route does not leak keys,
- stale BBox/crop version behavior documented.

---

## Acceptance Criteria

1. Derived crop can be generated from BBox.
2. Crop is traceable to original image and BBox version.
3. Coordinate transform is stored and tested.
4. Crop is app-mediated for browser access.
5. No raw image semantics confusion.
6. Docs updated.
7. Ticket moved to done.
8. Full validation gate passes.
