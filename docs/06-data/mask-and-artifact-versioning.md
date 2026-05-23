# Mask And Artifact Versioning

## Purpose

This page defines the distinction between semantic masks, support/instance masks, prediction artifacts, reviewed ground-truth artifacts, and the implemented crop-derived artifact model.

Current mask code lives in `src/mask/*`, semantic mask APIs live in `src/app/api/images/[imageId]/mask/*`, default image-sized support-mask APIs live in `src/app/api/images/[imageId]/support-mask/*`, crop support-mask APIs live in `src/app/api/slice-crops/[cropId]/support-mask/*`, crop semantic-mask APIs live in `src/app/api/slice-crops/[cropId]/semantic-mask/*`, and persisted mask artifacts are `AnnotationArtifact`/`AnnotationArtifactVersion` in `prisma/schema.prisma`.

## Artifact Families

### Semantic Material Masks

Semantic masks classify pixels by material label.

Relevant labels include:

- background,
- unknown/review-required,
- sapwood,
- heartwood,
- copper.

Semantic masks must reference one label schema version. The current editor save path writes `AnnotationArtifact.kind = SEMANTIC_MASK` and appends `AnnotationArtifactVersion` rows with `reviewState = DRAFT`.

RB-089 adds crop semantic masks as crop-scoped `SEMANTIC_MASK` artifact versions with `scopeKey = "crop-semantic:{cropId}:{semanticMode}"`, `coordinateSpace = CROP_PIXEL`, `AnnotationArtifactVersion.derivedCropId`, `sliceInstanceId`, `supportMaskVersionId`, and `cropSemanticMode`. The exact support-mask version is the constraint source; saves reject non-background semantic pixels outside that support with `SEMANTIC_OUTSIDE_SUPPORT`. RB-090 uses successful crop semantic saves to append draft `SliceClassificationVersion` suggestions with source/reason and links back to the semantic mask, support mask, and crop.

### Slice Support / Instance Masks

Support or instance masks describe physical slice/object geometry.

They answer a different question from semantic material masks:

- support mask: which pixels belong to the physical slice/object,
- instance mask: which pixels belong to which slice/object instance.

Copper-specific rule:

A copper semantic mask is not a support mask. Copper regions may be smaller than the physical slice, especially for copper penetration/staining workflows.

RB-051 support masks are draft `SLICE_SUPPORT_MASK` artifact versions with default `scopeKey = "default"`. The first workflow supports one default support geometry per image.

RB-088 adds crop support masks as crop-scoped `SLICE_SUPPORT_MASK` artifact versions with `scopeKey = "crop-support:{cropId}"`, `coordinateSpace = CROP_PIXEL`, `AnnotationArtifactVersion.derivedCropId`, and `AnnotationArtifactVersion.sliceInstanceId`. They are the pixel-perfect physical slice geometry for the selected derived crop. Multi-object instance masks remain deferred.

RB-085 defines the crop-based workflow for later sprint slices. RB-086 implements BBox proposals as append-only `SliceBoundingBoxVersion` rows linked to `SliceInstance`. A BBox proposal is only an ergonomic crop seed. The pixel-perfect support mask remains the physical slice geometry and an approved support mask is mandatory for a training-ready slice instance.

### Derived Slice Crop Artifacts

RB-087 implements derived slice crops as `DerivedSliceCrop` rows and private PNG objects generated from active/current `SliceBoundingBoxVersion` rows. They are not raw uploaded images and they are not support masks.

Derived crop metadata includes:

- source image id and checksum/version,
- source image dimensions,
- slice instance id,
- BBox proposal/version reference,
- crop origin and dimensions in source-image pixels,
- requested padding, applied padding per side, and padding-clipped flag,
- `CROP_PIXEL` crop dimensions,
- coordinate transform back to the source image,
- creator and timestamp,
- storage key, checksum, byte size, content type, and PNG format.

RB-088 crop support masks are versioned like other artifacts. They remain traceable to the immutable source image and to the crop transform that produced their coordinate space. RB-089 crop semantic masks now record the exact support mask version and semantic mode used for the crop edit so stale support references can be detected when a BBox, crop, or support mask is superseded.

The 32 px default crop padding is an editing workspace only. Padding pixels must never be interpreted as physical slice support; future support masks remain the pixel-perfect source of truth.

### Slice Classification Artifacts

Slice classification records classify a slice instance or image context.

Expected classes include:

- `SAP_HEARTWOOD_SLICE`
- `COPPER_SLICE`
- `UNKNOWN`
- `REVIEW_REQUIRED`

Classification versions reference the relevant image, slice instance, actor, and label schema version. RB-051 writes draft `SliceClassificationVersion` rows for the default slice instance; RB-052 adds submit/approve/reject state transitions for those versions. RB-090 adds `source`, `derivationReason`, optional derivation metadata, and optional semantic/support/crop lineage links so auto-derived crop suggestions and manual overrides remain auditable separate versions. RB-092 allows approved manual crop classifications without derivation links when they are current relative to the selected approved crop support and semantic mask versions; manual rows that do contain derivation links must match the selected crop/support/semantic lineage.

### Prediction Artifacts

Prediction artifacts are model-generated proposals.

RB-049 provides `AnnotationArtifactKind.PREDICTION_MASK` and task/persistence placeholders. RB-056 adds `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance`; RB-057 imports the first prediction mask proposal artifacts and records:

- model source,
- checkpoint/run/config where available,
- confidence or uncertainty,
- generatedAt,
- generatedBy system actor,
- target image/task,
- artifact storage key when a mask file exists.

Prediction artifacts must never overwrite human ground-truth versions.

RB-056 stores the explicit prediction target in `PredictionArtifactProvenance.targetType` rather than adding separate prediction artifact kinds. RB-057 creates `PREDICTION_MASK` artifact versions for imported semantic/support prediction mask bytes and links them through `PredictionArtifactProvenance.artifactVersionId`. RB-059 creates separate human correction artifact versions with `ArtifactProvenance.HUMAN_CORRECTION`, `parentVersionId` pointing to the prediction version, and `taskId` pointing to the correction task.

## Version Rules

- Every saved artifact version is immutable after commit.
- New edits create a new version rather than overwriting prior versions.
- Versions record actor, timestamp, format, dimensions, coordinate space, artifact storage key, and label schema version.
- RB-086 BBox proposal edits are also append-only: replacement appends the next active `SliceBoundingBoxVersion`, and deletion appends a `DELETED` version rather than erasing proposal history.
- RB-087 crop-derived versions record their source image, BBox version, crop transform, and source-image checksum. RB-088 crop support masks reference a specific crop version rather than infer coordinates from the latest crop. RB-089 crop semantic masks additionally reference the exact crop support-mask version used as the constraint. RB-090 auto classifications reference the semantic mask, support mask, and crop that produced the suggestion.
- RB-055 records canonical SHA-256 checksums as `sha256:<hex>` for current image and mask write paths. Existing raw hex input hints are normalized before comparison.
- Versions may reference a parent/source artifact version to explain derivation.
- Human correction versions from RB-059 use `parentVersionId` for the source prediction and keep prediction bytes immutable.
- Approved versions remain immutable. RB-052 keeps the latest approved version export-ready until a newer approved version exists; creating a new draft does not mutate approved history.
- RB-053 training exports consume latest approved versions only and record exact artifact version ids in the manifest and `ExportItem` rows.
- RB-092 centralizes crop readiness in `src/server/domain/cropReadiness.ts`; crop support masks, crop semantic masks, and crop classifications must be approved and current before a crop can be exported as ground truth.
- Model prediction versions and `PredictionArtifactProvenance` rows are not export-ready ground truth. Future exports may reference prediction ids only as provenance of approved human corrections.

## Review State

Artifact review state is part of ground-truth integrity.

Required states:

- `draft` - created or edited but not ready for review.
- `submitted` - ready for reviewer decision.
- `approved` - accepted for ground-truth use.
- `rejected` - not accepted; reason/comment required.
- `superseded` - replaced by a newer version without deleting history.

RB-052 implements review decisions as separate records so history is attributable and auditable. Decisions can target either an `AnnotationArtifactVersion` or a `SliceClassificationVersion`; the review domain service enforces that exactly one target is set.

## Coordinate Space

The current MVP assumes mask dimensions match the source image dimensions. RB-085 defines crop coordinate vocabulary in [coordinate-spaces-and-transforms.md](coordinate-spaces-and-transforms.md), and RB-086 implements the source-image coordinate term for BBox proposal versions.

Each mask artifact records either:

- image pixel coordinate space with matching width/height, or
- a declared transform to the image coordinate space.

The default full-image runtime accepts `IMAGE_PIXEL` mask coordinate space. Full-image semantic and support masks are rejected when declared dimensions do not match the target image dimensions. RB-088 crop support masks accept `CROP_PIXEL` only when declared dimensions match the selected `DerivedSliceCrop.cropWidth` and `DerivedSliceCrop.cropHeight`.

Crop workflow terms:

- `SOURCE_IMAGE_PIXEL` - source-image pixel coordinates on the immutable upload. RB-086 persists this value for `SliceBoundingBoxVersion`.
- `CROP_PIXEL` - pixel coordinates inside a derived slice crop. RB-087 persists this value for `DerivedSliceCrop`; RB-088 crop support-mask artifacts and RB-089 crop semantic-mask artifacts must match the selected crop dimensions.

The planned crop transform is:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

Default full-image semantic/support masks remain image-sized `IMAGE_PIXEL` artifacts. Crop support masks are crop-sized `CROP_PIXEL` artifacts linked to both `SliceInstance` and `DerivedSliceCrop`. Crop semantic masks are crop-sized `CROP_PIXEL` artifacts linked to `SliceInstance`, `DerivedSliceCrop`, and the exact support-mask version.

Exports must include coordinate-space metadata.

RB-053 includes each exported mask's format, width, height, coordinate space, label schema version id, and relative package path in the manifest.

## Format Compatibility

Current `u8raw-v1` raw byte artifacts remain the browser editor artifact format after RB-051 for both semantic masks and support masks. The current editor upload body has no `MSK1` header: it is exactly `width * height` bytes, one byte per image pixel in image-pixel coordinate space. `src/mask/serialize.ts` is a legacy/test helper for the older headered format and is not the current upload/persistence contract.

RB-051 support-mask values are resolved through the active label schema where practical:

- `0` remains background,
- `slice_support` comes from the label schema byte value, currently `10` in the seed schema.

RB-055 enforces `u8raw-v1` byte length as `width * height`, verifies optional checksum hints, and checks the stored object length after upload. RB-080 adds client-side exact-byte upload construction and diagnostic-only `x-mask-byte-length`; the server still validates the actual received request body length. RB-081 routes semantic masks, support masks, and assisted corrections through `src/server/uploads/maskRequest.ts`, which reads the raw request body once and rejects truncated bodies with `MASK_BYTE_LENGTH_MISMATCH`. RB-088 routes crop support-mask uploads through the same raw reader, but validates against crop dimensions instead of source-image dimensions. RB-089 routes crop semantic-mask uploads through the same raw reader, validates against crop dimensions, validates mode-specific semantic label bytes, and rejects semantic foreground outside the referenced support mask. `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` must remain above the mask limit so Next.js proxy buffering does not truncate large masks before the route handler. RB-057 applies the same image-sized `u8raw-v1` and `IMAGE_PIXEL` assumptions to prediction mask imports. RB-059 applies the same validation to assisted human corrections and additionally validates semantic correction bytes against active semantic label byte values. Support masks, support predictions, support corrections, and crop support masks are restricted to `0` and the active `slice_support` byte. Semantic Copper label bytes are not valid support-mask geometry or support predictions.

Future format work should decide:

- how to represent instance ids,
- how to preserve old MVP artifacts after schema reset or migration.

## Related Docs

- [mask-format.md](mask-format.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [training-export-contract.md](training-export-contract.md)
- [model-prediction-contract.md](model-prediction-contract.md)
