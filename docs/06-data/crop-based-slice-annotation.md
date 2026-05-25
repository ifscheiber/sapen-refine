# Crop-Based Slice Annotation

## Purpose

This page defines the crop-based slice annotation workflow for RB-086 through RB-092 and links it to the RB-093/RB-123 crop workflow UX orchestration work. RB-086 implements persistent source-image BBox proposals. RB-087 implements server-generated derived slice crops from active BBox versions. RB-088 implements crop-space support-mask editing. RB-089 implements crop-constrained semantic annotation. RB-090 implements auto classification suggestions from crop semantic masks. RB-091 implements crop training exports, RB-092 implements shared crop readiness plus review/approval UI integration, RB-093 defines the staged user-facing route/state model, RB-094 implements image-level BBox set confirmation, RB-095 implements whole-image slice navigation, RB-096 implemented the earlier selected crop workbench, and RB-123 implements the unified crop annotation editor plus annotation-family exclusivity guards.

The crop workflow is now the product annotation path for large images and iPad-constrained annotation work. RB-104 removed the legacy full-image editor route; the shared source-image canvas remains for BBox-stage planning and assisted correction.

## Workflow

The planned workflow is:

```text
Original image
-> BBox proposal
-> derived slice crop
-> selected-crop unified editor
-> mode-aware support/semantic annotation family
-> auto-suggested slice classification
-> review/approval
-> export with crop and source-image provenance
```

The RB-093 UX orchestration splits that technical flow into staged user routes:

```text
BBox stage
-> confirm BBox set
-> slice navigator
-> selected-crop unified editor
-> support or semantic target
-> classification/readiness
```

The planned route/state details live in `docs/workflows/crop-workflow-ux-orchestration.md` and `docs/08-adr/ADR-006-crop-workflow-ux-orchestration.md`.

The original uploaded image remains immutable and is the source of truth for provenance. BBox proposals, derived crops, support masks, semantic masks, classifications, reviews, and exports are derived artifacts or decisions that reference the source image.

## BBox Proposal Versus Support Mask

A BBox proposal is an ergonomic work-area proposal. It gives the system enough information to create a smaller crop around a candidate slice.

A support mask is the pixel-perfect physical slice geometry. It is the training target for support/instance segmentation.

RB-093 standardizes user-facing terminology: image-level BBox sets are confirmed, not approved. RB-094 persists that confirmation in `ImageCropWorkflowState`. Confirmation records that the current BBox set is the intended crop work plan. It does not make BBoxes ground-truth geometry and does not replace support-mask, semantic-mask, or classification review.

RB-094 BBox set states:

- `NO_BBOXES` - no active BBox proposals exist.
- `BBOX_DRAFT` - active BBoxes exist but the image-level set has not been confirmed.
- `BBOX_CONFIRMED` - the current active BBox version id set matches the confirmed snapshot.
- `BBOX_NEEDS_UPDATE` - a confirmed set was changed or no longer matches active BBox versions.

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

## Mode-Aware Support Policy

The crop workflow is mode-aware rather than universally support-first.

Sap/Heartwood crops may be semantically annotated without an explicit support mask. Their non-background semantic foreground is the support geometry source for readiness/export, and crop padding remains background unless explicitly labelled as foreground.

Copper crops may save supportless semantic drafts, but a Copper crop is not export-ready until an explicit crop support mask exists and is approved. Copper semantic pixels represent material staining/penetration and are never physical slice support geometry.

## Implemented Crop Semantic Mask Concept

Semantic masks classify material pixels. In the crop workflow, semantic editing is constrained by the support mask.

RB-089 persists crop semantic masks as crop-scoped `SEMANTIC_MASK` `AnnotationArtifact` / `AnnotationArtifactVersion` rows. The crop editor route is `/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/crops/[cropId]/semantic`, and the APIs live under `/api/slice-crops/[cropId]/semantic-mask`.

Each crop semantic mask version records or references:

- the source image artifact through `AnnotationArtifact.imageId`,
- the slice instance through `AnnotationArtifactVersion.sliceInstanceId`,
- the derived crop through `AnnotationArtifactVersion.derivedCropId`,
- the optional support mask version through `AnnotationArtifactVersion.supportMaskVersionId`,
- `coordinateSpace = CROP_PIXEL`,
- `cropSemanticMode = SAP_HEARTWOOD` or `COPPER`,
- crop width and height,
- `u8raw-v1` bytes stored privately under project-scoped crop semantic-mask keys,
- checksum, size, content type, creator, creation time, label schema version, and draft review state,
- a compact coordinate transform snapshot back to the source image.

Rules:

- Sap/Heartwood semantic save does not require an explicit support mask. Its non-background semantic foreground is the support geometry source for readiness/export.
- Copper semantic draft save does not require an explicit support mask, but Copper readiness/export requires an approved crop support mask for the same crop.
- When a Copper semantic save references support, the server loads that support mask version and rejects non-background semantic pixels outside support with `SEMANTIC_OUTSIDE_SUPPORT`.
- RB-123 allows only one active annotation family per crop: `Sapwood / Heartwood`, `Cu`, empty, or unresolved conflict. Support is selected as a Cu-family label while remaining a separate crop support artifact.
- The active family is derived from latest non-superseded mask bytes: Sapwood/Heartwood is occupied by sapwood or heartwood pixels; Cu is occupied by copper pixels or support-mask foreground pixels.
- Saving non-empty data in the opposite family is rejected with `CROP_ANNOTATION_FAMILY_CONFLICT`; all-background saves are allowed so users can clear the current family without deleting historical versions.
- Browser responses include app-mediated mask asset URLs and do not expose private storage keys.
- Export consumers must inspect `supportGeometrySource`: Sap/Heartwood may use `SEMANTIC_FOREGROUND`, while Copper uses `EXPLICIT_SUPPORT_MASK`.
- Semantic masks and support masks may share a crop coordinate space, but they remain separate artifact families.

Sapwood/heartwood workflow:

- Sapwood, heartwood, and `UNKNOWN` can be painted manually in crop space; non-background semantic pixels define support geometry.
- Complement fill is explicitly deferred; RB-089 does not silently auto-fill the other class.

Copper workflow:

- Copper semantic pixels represent penetrated or copper-stained material.
- The complete physical slice support is a separate support mask.
- Copper semantic annotation alone is never valid support geometry.
- Non-copper support area is represented as background/implicit negative inside support for RB-089, with `UNKNOWN` available where the label schema allows uncertainty.
- Outside-support Copper bytes are rejected on save and must not expand support geometry.

## Auto Slice Classification

RB-090 suggests slice classification from saved crop semantic-mask content:

```text
Copper pixels present      -> COPPER_SLICE
Sapwood/heartwood present  -> SAP_HEARTWOOD_SLICE
Insufficient semantics     -> UNKNOWN or REVIEW_REQUIRED
```

The implementation is save-time and uses the human user who saved the semantic mask as the attributable actor. It reads the saved semantic mask bytes, semantic mode, active label schema values, derived crop id, slice instance id, and optional support mask version id. It does not infer classification from BBoxes, crops alone, support masks alone, predictions, or Copper semantic masks as support geometry.

RB-090 classification persistence:

- `SliceClassificationVersion.source = AUTO_FROM_SEMANTIC_MASK` for generated suggestions,
- `SliceClassificationVersion.source = MANUAL` for user overrides,
- auto suggestions store `derivationReason`, `derivedFromSemanticMaskVersionId`, `derivedFromSupportMaskVersionId`, `derivedFromCropId`, and compact derivation metadata,
- auto suggestions start with `reviewState = DRAFT` and are not export-ready until the normal classification review flow approves them,
- manual overrides create new classification versions instead of mutating auto-derived rows.
- manual overrides remain allowed, but a manual class that contradicts the active semantic family adds `CLASSIFICATION_SEMANTIC_FAMILY_MISMATCH` and prevents crop export readiness.

The default threshold is one classifying pixel. Copper mode with a Copper pixel derives `COPPER_SLICE`. Sap/Heartwood mode with a Sapwood or Heartwood pixel derives `SAP_HEARTWOOD_SLICE`. Background-only masks derive `UNKNOWN`. Unknown-only masks and mode-label conflicts derive `REVIEW_REQUIRED`.

## Review And Approval

Review state is artifact-specific. RB-092 surfaces separate review decisions for:

- support mask,
- semantic mask,
- slice classification.

Approval of one artifact does not imply approval of the others. A training-ready slice instance needs the approved artifact set required by the selected export target.

Current default:

- BBox proposals and derived crops are lineage/provenance artifacts; review is optional unless later workflow policy makes them review targets.
- Support masks require approval for support/instance training targets and for Copper semantic workflows.
- Semantic masks require approval for semantic training targets.
- Slice classifications require approval. RB-090 auto-derived suggestions start as `DRAFT`; there is no accepted-auto export policy in RB-092.
- Approved manual classifications are eligible when they belong to the same project/image/slice and are current relative to the selected support and semantic versions. Manual rows with derived links must match those selected versions.
- If semantic or classification versions reference stale crop/support lineage, coordinate space, or dimensions, the crop is `REVIEW_REQUIRED` until regenerated, re-saved, or re-reviewed.
- If active Sap/Heartwood and Copper semantic versions coexist, the crop is `REVIEW_REQUIRED` with `SEMANTIC_FAMILY_CONFLICT` until an explicit family reset resolves it.

The central readiness resolver lives in `src/server/domain/cropReadiness.ts`. It returns per-crop `READY`, `PARTIAL`, `NOT_READY`, or `REVIEW_REQUIRED` status, stable reason codes, next-action hints, review-action permissions for the latest support/semantic/classification versions, and summary reason counts. The read-only API route is `GET /api/projects/[projectId]/crop-readiness` with optional `imageId` and `sliceInstanceId` filters. API responses are sanitized and do not expose private storage keys.

## Export Implications

RB-091/RB-092 crop-aware exports include:

- crop image bytes when crop images are persisted,
- crop-space support masks,
- crop-space semantic masks,
- slice classification,
- source image id, source checksum, and source image dimensions,
- crop origin, crop dimensions, padding, and coordinate transform,
- exact artifact version ids, actor attribution, review decisions, and checksums.

Exports must keep semantic segmentation, support/instance segmentation, slice classification, and combined manifest targets explicit. Copper semantic masks must not be exported as support geometry.

RB-091 does not emit source-image-space reprojected masks. The `sapen-annotate-crop-training-export-v1` manifest includes `transformToSource` metadata so downstream consumers can map crop pixels back to the immutable source image. RB-092 makes the export readiness path use the shared resolver from `src/server/domain/cropReadiness.ts`, so the project export panel, crop editors, readiness API, and crop export manifest all agree on skipped reasons.

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
- RB-089/RB-100 crop semantic masks in `CROP_PIXEL` linked to the source image, slice instance, derived crop, optional support mask version, and semantic mode,
- RB-090 draft slice classifications derived from crop semantic masks and manual crop workflow overrides linked to the slice instance,
- RB-091 crop training exports for ready crop candidates with approved support, semantic, and classification lineage,
- RB-092 crop readiness and review actions in the project export panel, BBox crop panel, crop support editor, and crop semantic editor,
- RB-095 slice navigator status derived from active BBoxes, current/stale crop versions, latest crop artifacts, classification versions, and crop readiness,
- RB-123 unified selected-crop editor with annotation-family controls, crop mask tools, status, readiness, review actions, and embedded whole-image slice navigation,
- historical/default full-image saved mask coordinate space is still `IMAGE_PIXEL`,
- large-image warnings for crop workflow source-image handling are documented in `docs/03-features/editor.md`.

Planned crop behavior:

- guided crop workflow routes for image-level BBox confirmation, whole-image slice navigation, selected-crop unified editing, and annotation-family conflict guards are implemented by RB-094 through RB-123,
- source-image-space reprojected crop-mask export remains deferred.

## Related Docs

- [coordinate-spaces-and-transforms.md](coordinate-spaces-and-transforms.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [../03-features/editor.md](../03-features/editor.md)
- [../08-adr/ADR-005-crop-based-slice-annotation.md](../08-adr/ADR-005-crop-based-slice-annotation.md)
