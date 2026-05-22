# Mask And Artifact Versioning

## Purpose

This page defines the distinction between semantic masks, support/instance masks, prediction artifacts, reviewed ground-truth artifacts, and the planned crop-derived artifact model.

Current mask code lives in `src/mask/*`, semantic mask APIs live in `src/app/api/images/[imageId]/mask/*`, support-mask APIs live in `src/app/api/images/[imageId]/support-mask/*`, and persisted mask artifacts are `AnnotationArtifact`/`AnnotationArtifactVersion` in `prisma/schema.prisma`.

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

### Slice Support / Instance Masks

Support or instance masks describe physical slice/object geometry.

They answer a different question from semantic material masks:

- support mask: which pixels belong to the physical slice/object,
- instance mask: which pixels belong to which slice/object instance.

Copper-specific rule:

A copper semantic mask is not a support mask. Copper regions may be smaller than the physical slice, especially for copper penetration/staining workflows.

RB-051 support masks are draft `SLICE_SUPPORT_MASK` artifact versions with default `scopeKey = "default"`. The first workflow supports one default support geometry per image; multi-object instance masks remain deferred.

RB-085 defines the crop-based workflow for later sprint slices. RB-086 implements BBox proposals as append-only `SliceBoundingBoxVersion` rows linked to `SliceInstance`. A BBox proposal is only an ergonomic crop seed. The pixel-perfect support mask remains the physical slice geometry and an approved support mask is mandatory for a training-ready slice instance.

### Derived Slice Crop Artifacts

Derived slice crops are planned artifacts for RB-087 and later. They are not raw uploaded images.

Expected derived crop metadata includes:

- source image id and checksum/version,
- slice instance id,
- BBox proposal/version reference,
- crop origin and dimensions,
- padding metadata,
- coordinate transform back to the source image,
- creator and timestamp,
- storage key, checksum, size, content type, and dimensions if persisted.

Crop masks in future implementation should be versioned like other artifacts. They must remain traceable to the immutable source image and to the crop transform that produced their coordinate space. Semantic mask and classification versions created from a crop should also record enough lineage to detect stale references when a BBox, crop, or support mask is superseded.

### Slice Classification Artifacts

Slice classification records classify a slice instance or image context.

Expected classes include:

- `SAP_HEARTWOOD_SLICE`
- `COPPER_SLICE`
- `UNKNOWN`
- `REVIEW_REQUIRED`

Classification versions reference the relevant image, default slice instance, actor, and label schema version. RB-051 writes draft `SliceClassificationVersion` rows; RB-052 adds submit/approve/reject state transitions for those versions.

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
- Future crop-derived versions must also record or reference their source image, crop artifact, crop transform, and source-image checksum.
- RB-055 records canonical SHA-256 checksums as `sha256:<hex>` for current image and mask write paths. Existing raw hex input hints are normalized before comparison.
- Versions may reference a parent/source artifact version to explain derivation.
- Human correction versions from RB-059 use `parentVersionId` for the source prediction and keep prediction bytes immutable.
- Approved versions remain immutable. RB-052 keeps the latest approved version export-ready until a newer approved version exists; creating a new draft does not mutate approved history.
- RB-053 training exports consume latest approved versions only and record exact artifact version ids in the manifest and `ExportItem` rows.
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

The current runtime accepts only `IMAGE_PIXEL` mask coordinate space. Semantic and support masks are rejected when declared dimensions do not match the target image dimensions.

Crop workflow terms:

- `SOURCE_IMAGE_PIXEL` - source-image pixel coordinates on the immutable upload. RB-086 persists this value for `SliceBoundingBoxVersion`.
- `CROP_PIXEL` - pixel coordinates inside a derived slice crop. This remains planned for RB-087+ crop masks/artifacts.

The planned crop transform is:

```text
sourceX = cropX + cropOriginX
sourceY = cropY + cropOriginY
```

Current saved semantic/support masks remain image-sized `IMAGE_PIXEL` artifacts.

Exports must include coordinate-space metadata.

RB-053 includes each exported mask's format, width, height, coordinate space, label schema version id, and relative package path in the manifest.

## Format Compatibility

Current `u8raw-v1` raw byte artifacts remain the browser editor artifact format after RB-051 for both semantic masks and support masks. The current editor upload body has no `MSK1` header: it is exactly `width * height` bytes, one byte per image pixel in image-pixel coordinate space. `src/mask/serialize.ts` is a legacy/test helper for the older headered format and is not the current upload/persistence contract.

RB-051 support-mask values are resolved through the active label schema where practical:

- `0` remains background,
- `slice_support` comes from the label schema byte value, currently `10` in the seed schema.

RB-055 enforces `u8raw-v1` byte length as `width * height`, verifies optional checksum hints, and checks the stored object length after upload. RB-080 adds client-side exact-byte upload construction and diagnostic-only `x-mask-byte-length`; the server still validates the actual received request body length. RB-081 routes semantic masks, support masks, and assisted corrections through `src/server/uploads/maskRequest.ts`, which reads the raw request body once and rejects truncated bodies with `MASK_BYTE_LENGTH_MISMATCH`. `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` must remain above the mask limit so Next.js proxy buffering does not truncate large masks before the route handler. RB-057 applies the same image-sized `u8raw-v1` and `IMAGE_PIXEL` assumptions to prediction mask imports. RB-059 applies the same validation to assisted human corrections and additionally validates semantic correction bytes against active semantic label byte values. Support masks, support predictions, and support corrections are restricted to `0` and the active `slice_support` byte. Semantic Copper label bytes are not valid support-mask geometry or support predictions.

Future format work should decide:

- how to represent instance ids,
- how to preserve old MVP artifacts after schema reset or migration.

## Related Docs

- [mask-format.md](mask-format.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [training-export-contract.md](training-export-contract.md)
- [model-prediction-contract.md](model-prediction-contract.md)
