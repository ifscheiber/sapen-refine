# Crop-Based Slice Annotation

## Purpose

This page defines the crop-based slice annotation workflow for RB-086 through RB-092. RB-086 implements the first runtime slice: persistent source-image BBox proposals. Later crop, support-mask, semantic, classification, review, and export steps remain planned until their tickets land.

The current implemented editor remains the full-resolution editor documented in `docs/03-features/editor.md`. The crop workflow is the planned scalable path for large images and iPad-constrained annotation work after RB-081 fixed the immediate full-resolution mask upload blocker.

## Workflow

The planned workflow is:

```text
Original image
-> BBox proposal
-> derived slice crop
-> pixel-perfect support mask
-> support-constrained semantic mask
-> auto-suggested slice classification
-> review/approval
-> export with crop and source-image provenance
```

The original uploaded image remains immutable and is the source of truth for provenance. BBox proposals, derived crops, support masks, semantic masks, classifications, reviews, and exports are derived artifacts or decisions that reference the source image.

## BBox Proposal Versus Support Mask

A BBox proposal is an ergonomic work-area proposal. It gives the system enough information to create a smaller crop around a candidate slice.

A support mask is the pixel-perfect physical slice geometry. It is the training target for support/instance segmentation.

RB-086 persists BBox proposals as append-only `SliceBoundingBoxVersion` rows linked to `SliceInstance`. Each saved BBox uses integer `SOURCE_IMAGE_PIXEL` coordinates validated against `ImageAsset.width` and `ImageAsset.height`.

Rules:

- BBox proposals are not instance ground truth.
- A training-ready slice instance requires an approved support mask.
- Crops may be regenerated or superseded if the BBox, padding, or source image version changes.
- Support masks must remain separate from semantic material masks.
- Deleting a BBox proposal appends a `DELETED` version; it does not delete historical proposal versions.

## Implemented SliceBoundingBoxVersion Concept

`SliceBoundingBoxVersion` records the current RB-086 BBox proposal history:

- project id,
- image id,
- slice instance id,
- monotonically increasing version per slice instance,
- active/deleted status,
- source-image integer `x`, `y`, `width`, and `height`,
- `coordinateSpace = SOURCE_IMAGE_PIXEL`,
- provenance, creator, and creation time,
- optional metadata JSON for replacement/deletion lineage.

`SliceInstance.boundingBox` stores a denormalized current summary for UI convenience. The version rows remain the history source of truth, and downstream RB-087 crops should reference a specific BBox version id.

## Planned DerivedSliceCrop Concept

`DerivedSliceCrop` is the planned conceptual artifact for RB-087. It should record at minimum:

- source image id,
- source image checksum or source artifact version,
- slice instance id,
- BBox proposal/version reference,
- crop origin in `SOURCE_IMAGE_PIXEL`,
- resolved crop width and height,
- requested padding and resolved padding,
- crop dimensions in `CROP_PIXEL`,
- transform metadata back to `SOURCE_IMAGE_PIXEL`,
- createdBy and createdAt,
- storage key, byte size, checksum, content type, and dimensions if the crop image is persisted.

The derived crop is not a raw upload. It must be reproducible or auditable from its recorded source image and transform metadata. If a later implementation stores crop image bytes, the bytes are derived data and remain subordinate to the immutable source image plus recorded transform.

## Mandatory Support-First Rule

Every training-ready slice instance requires a pixel-perfect support mask.

Semantic annotation for a crop should be blocked, marked incomplete, or exported with a clear warning until the support mask exists. The intended editor behavior is support-first:

1. Create or choose a crop.
2. Draw the complete support mask for the physical slice.
3. Annotate material semantics inside that support.
4. Classify the slice from semantic content, with human override.

## Semantic Annotation Inside Support

Semantic masks classify material pixels. In the crop workflow, semantic editing is constrained by the support mask.

Planned rules:

- Pixels outside support are locked, transparent, ignored, or forced to background depending on the editor/export context.
- Export consumers must not treat outside-support semantic bytes as meaningful slice material.
- Semantic masks and support masks may share a crop coordinate space, but they remain separate artifact families.

Sapwood/heartwood workflow:

- Sapwood and heartwood should partition the support area when the slice is ready.
- The editor may support complement fill, for example painting one class and filling the remaining support with the other class.
- `UNKNOWN` or `REVIEW_REQUIRED` must remain available for ambiguous areas.

Copper workflow:

- Copper semantic pixels represent penetrated or copper-stained material.
- The complete physical slice support is a separate support mask.
- Copper semantic annotation alone is never valid support geometry.
- Non-copper support area should remain explicit in the selected export contract: either background/negative non-copper wood inside support, or unknown where the label schema allows uncertainty.
- Outside-support Copper bytes must be ignored or rejected by crop-aware save/export code; they must not expand the support geometry.

## Auto Slice Classification

Slice classification may be suggested from semantic content:

```text
Copper pixels present      -> COPPER_SLICE
Sapwood/heartwood present  -> SAP_HEARTWOOD_SLICE
Insufficient semantics     -> UNKNOWN or REVIEW_REQUIRED
```

The suggestion must be attributable to a system actor or derivation rule. Human override must preserve provenance, including who overrode the class, when, and from which suggested value.

Recommended default for RB-090:

- auto-derived classifications start as draft or submitted suggestions,
- a human review/approval decision or an explicit accepted-auto policy is required before export readiness,
- manual overrides create new classification versions instead of mutating the auto-derived version.

## Review And Approval

Review state is artifact-specific. The planned crop workflow should allow separate review decisions for:

- BBox proposal if it is persisted as a versioned planning artifact,
- derived crop metadata if crop generation is persisted,
- support mask,
- semantic mask,
- slice classification.

Approval of one artifact does not imply approval of the others. A training-ready slice instance needs the approved artifact set required by the selected export target.

Recommended default:

- BBox proposals and derived crops are lineage/provenance artifacts; review is optional unless later workflow policy makes them review targets.
- Support masks require approval for support/instance training targets and for Copper semantic workflows.
- Semantic masks require approval for semantic training targets.
- Slice classifications require approval, or an explicit accepted-auto policy, before classification export readiness.
- If semantic or classification versions reference a stale crop/support lineage, the slice is `REVIEW_REQUIRED` until regenerated, re-saved, or re-reviewed.

## Export Implications

Crop-aware exports should include:

- crop image bytes when crop images are persisted,
- crop-space support masks,
- crop-space semantic masks,
- slice classification,
- source image id, source checksum, and source image dimensions,
- crop origin, crop dimensions, padding, and coordinate transform,
- optional source-image-space reprojected masks,
- exact artifact version ids, actor attribution, review decisions, and checksums.

Exports must keep semantic segmentation, support/instance segmentation, slice classification, and combined manifest targets explicit. Copper semantic masks must not be exported as support geometry.

Crop-aware exports must not change prediction-analysis export semantics. Model predictions and QA exports remain separate proposal workflows unless a later ADR explicitly designs crop-aware prediction analysis.

## Current Versus Planned Behavior

Current implemented behavior:

- one default `SliceInstance` per image,
- full-resolution semantic and support masks,
- one or more RB-086 BBox proposal slice instances per image,
- BBox proposal versions in `SOURCE_IMAGE_PIXEL`,
- current saved mask coordinate space is `IMAGE_PIXEL`,
- full-resolution trial bounds and large-image warnings are documented in `docs/03-features/editor.md`.

Planned crop behavior:

- saved BBox proposal versions seed derived crops,
- crop masks use `CROP_PIXEL`,
- each crop carries a transform to `SOURCE_IMAGE_PIXEL`,
- crop exports preserve both crop-space artifacts and source-image provenance.

## Related Docs

- [coordinate-spaces-and-transforms.md](coordinate-spaces-and-transforms.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [../03-features/editor.md](../03-features/editor.md)
- [../08-adr/ADR-005-crop-based-slice-annotation.md](../08-adr/ADR-005-crop-based-slice-annotation.md)
