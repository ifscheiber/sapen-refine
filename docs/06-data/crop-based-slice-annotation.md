# Crop-Based Slice Annotation

## Purpose

This page defines the crop-based slice annotation workflow for RB-086 through RB-092. RB-086 implements persistent source-image BBox proposals. RB-087 implements server-generated derived slice crops from active BBox versions. RB-088 implements crop-space support-mask editing. Crop-constrained semantic annotation, auto classification, review integration, and crop-aware export remain planned until later tickets land.

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

`SliceInstance.boundingBox` stores a denormalized current summary for UI convenience. The version rows remain the history source of truth, and derived crops reference a specific BBox version id.

## Implemented DerivedSliceCrop Concept

RB-087 persists derived crop rows as `DerivedSliceCrop` in `prisma/schema.prisma` and generates private PNG bytes through `src/server/domain/sliceCrops.ts`. A crop is a derived artifact, not a raw uploaded image.

Each crop records:

- source image id,
- source image checksum,
- source image dimensions,
- slice instance id,
- BBox proposal/version reference,
- crop origin in `SOURCE_IMAGE_PIXEL`,
- resolved crop width and height,
- requested padding and applied padding per side,
- whether the requested padding was clipped by source-image bounds,
- crop dimensions in `CROP_PIXEL`,
- transform metadata back to `SOURCE_IMAGE_PIXEL`,
- createdBy and createdAt,
- storage key, byte size, checksum, content type, and PNG format.

The crop service uses a default `paddingRequestedPx` of `32`, configurable with `SLICE_CROP_DEFAULT_PADDING_PX`. The accepted runtime/API presets are `0`, `16`, `32`, and `64`. Padding is clamped to source-image bounds and recorded separately as `paddingAppliedLeftPx`, `paddingAppliedTopPx`, `paddingAppliedRightPx`, and `paddingAppliedBottomPx`.

The padding area is visual/context workspace only. It is never support geometry. The pixel-perfect support mask remains the source of truth for physical slice geometry.

Crop image bytes are stored privately under:

```text
projects/{projectId}/derived-crops/{imageId}/{sliceInstanceId}/{uuid}.png
```

Browser clients receive sanitized metadata and app-mediated asset URLs such as `/api/slice-crops/[cropId]/asset`; private storage keys are not serialized.

## Implemented Crop Support Mask Concept

RB-088 persists crop support masks as `SLICE_SUPPORT_MASK` `AnnotationArtifact` / `AnnotationArtifactVersion` rows rather than a parallel mask table. The crop editor route is `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/support`, and the APIs live under `/api/slice-crops/[cropId]/support-mask`.

Each crop support mask version records or references:

- the source image artifact through `AnnotationArtifact.imageId`,
- the slice instance through `AnnotationArtifactVersion.sliceInstanceId`,
- the derived crop through `AnnotationArtifactVersion.derivedCropId`,
- `coordinateSpace = CROP_PIXEL`,
- crop width and height,
- `u8raw-v1` bytes stored privately under project-scoped crop support-mask keys,
- checksum, size, content type, creator, creation time, label schema version, and draft review state,
- a compact coordinate transform snapshot back to the source image.

The crop support editor displays the private crop PNG through `/api/slice-crops/[cropId]/asset`, edits only background/support bytes, and saves through `POST /api/slice-crops/[cropId]/support-mask/upload`. Uploaded support masks must match the selected crop dimensions exactly and may contain only `0` plus the active `slice_support` label byte. Copper semantic bytes are rejected as support geometry.

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
- RB-087 derived crop PNGs generated from active/current BBox versions,
- crop records in `CROP_PIXEL` with integer translation transforms back to source pixels,
- RB-088 crop support masks in `CROP_PIXEL` linked to the source image, slice instance, and derived crop,
- default full-image saved mask coordinate space is still `IMAGE_PIXEL`,
- full-resolution trial bounds and large-image warnings are documented in `docs/03-features/editor.md`.

Planned crop behavior:

- crop semantic masks use `CROP_PIXEL` and stay constrained by support,
- crop exports preserve both crop-space artifacts and source-image provenance.

## Related Docs

- [coordinate-spaces-and-transforms.md](coordinate-spaces-and-transforms.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [../03-features/editor.md](../03-features/editor.md)
- [../08-adr/ADR-005-crop-based-slice-annotation.md](../08-adr/ADR-005-crop-based-slice-annotation.md)
