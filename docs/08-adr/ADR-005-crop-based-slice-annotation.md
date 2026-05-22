# ADR-005 - Crop-Based Slice Annotation

## Status

Accepted for RB-085 design. Runtime implementation is deferred to RB-086 through RB-092.

## Context

The current SaPen Annotate editor is a full-resolution image editor. RB-080 and RB-081 fixed the immediate large-mask upload blocker by sending exact `u8raw-v1` request bodies and by raising the Next proxy body limit. That keeps full-resolution trial annotation viable inside the documented bounds.

Large full-image masks still have important memory and request-size costs. An `8000x6000` image has 48,000,000 pixels. One `u8raw-v1` mask at that size is 48,000,000 bytes, and the editor can hold multiple working layers plus the decoded browser image. This is especially relevant for iPad Safari and lower-memory client devices.

The product therefore needs a crop-based workflow that preserves the original uploaded image as the immutable source of truth while allowing annotation work to happen on smaller derived slice crops.

## Decision

Adopt a support-first crop-based slice annotation workflow as the planned scalable path:

```text
Original image
-> BBox proposal
-> derived slice crop
-> pixel-perfect slice support mask in crop coordinates
-> semantic annotation constrained by support
-> auto-suggested slice classification
-> review/approval
-> export with crop and source-image coordinate provenance
```

The bounding box is an ergonomic proposal and crop seed. It is not instance ground truth. Final slice geometry comes from a pixel-perfect support mask.

Derived crops are versioned artifacts, not raw uploaded images. They must reference the source image id, source image checksum/version, BBox version, crop origin, crop dimensions, padding, creator, timestamp, and storage/checksum metadata when persisted.

Coordinate spaces are explicit:

- `SOURCE_IMAGE_PIXEL` names pixel coordinates on the immutable uploaded image.
- `CROP_PIXEL` names pixel coordinates inside a derived slice crop.

The base transform is:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

Padding is part of the crop artifact metadata. Implementations must clip padded crop regions at source-image boundaries and must document how out-of-source crop pixels are represented if they exist.

Every training-ready slice instance requires a support mask. Copper semantic masks remain material labels only and must never be treated as complete slice support geometry. Sapwood/heartwood workflows may use complement fill inside support, but unknown/review-required semantics must remain possible.

Slice classification can be auto-suggested from semantic content, but the suggestion must be auditable and overridable by a human reviewer. Auto-derived classifications do not silently become approved training labels unless a later implementation defines an explicit accepted-auto policy.

## Consequences

- Full-resolution editing remains the implemented MVP workflow and is not removed by RB-085.
- RB-086 through RB-092 can introduce BBox proposals, crop generation, crop support masks, crop-constrained semantics, auto classification, crop-aware export, and review integration without weakening existing ground-truth rules.
- Export manifests must preserve enough transform and provenance data to map crop masks back to source-image pixels.
- Review state must stay artifact-specific. A reviewed crop does not automatically approve its support mask, semantic mask, or classification.
- Export readiness must reject or flag stale lineage, such as a semantic mask derived from an older crop/support version than the selected training support mask.
- Current `IMAGE_PIXEL` mask coordinate-space behavior remains implemented. `SOURCE_IMAGE_PIXEL` and `CROP_PIXEL` are planned crop-workflow design terms until a later schema/API slice implements them.
- Prediction-analysis exports remain separate from ground-truth training exports; RB-085 does not add crop-aware model QA export semantics.

## Deferred Work

- RB-086: BBox slice proposal workflow.
- RB-087: Derived slice crop generation and persistence.
- RB-088: Crop support mask editor.
- RB-089: Crop-constrained semantic annotation.
- RB-090: Auto slice classification from semantic masks.
- RB-091: Crop/original-coordinate export contract implementation.
- RB-092: Crop workflow review/approval integration.
- Later: tiled/downscaled full-image editor, edit-session/multi-tab warnings, real iPad Safari validation, and production-scale dataset export jobs.

## Evidence

- Current editor docs: `docs/03-features/editor.md`
- Current mask/artifact docs: `docs/06-data/mask-and-artifact-versioning.md`
- Crop workflow design: `docs/06-data/crop-based-slice-annotation.md`
- Coordinate-space design: `docs/06-data/coordinate-spaces-and-transforms.md`
- Training export contract: `docs/06-data/training-export-contract.md`
- Current editor implementation: `src/features/editor/EditorClient.tsx`
- Current mask upload helper: `src/features/editor/editorMaskUpload.ts`
- Current server mask request reader: `src/server/uploads/maskRequest.ts`
