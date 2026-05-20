# Mask And Artifact Versioning

## Purpose

This page defines the planned distinction between semantic masks, support/instance masks, prediction artifacts, and reviewed ground-truth artifacts.

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

RB-049 provides `AnnotationArtifactKind.PREDICTION_MASK` and task/persistence placeholders. Future prediction import must record:

- model source,
- checkpoint/run/config where available,
- confidence or uncertainty,
- generatedAt,
- generatedBy system actor,
- target image/task,
- artifact storage key when a mask file exists.

Prediction artifacts must never overwrite human ground-truth versions.

RB-054 decides that the first prediction import should use `PREDICTION_MASK` for mask predictions and store the target type, such as semantic, support, or instance prediction, in explicit prediction metadata. A human correction must create a separate human artifact version with `ArtifactProvenance.HUMAN_CORRECTION` and should link to the prediction through `parentVersionId`.

## Version Rules

- Every saved artifact version is immutable after commit.
- New edits create a new version rather than overwriting prior versions.
- Versions record actor, timestamp, format, dimensions, coordinate space, artifact storage key, and label schema version.
- RB-055 records canonical SHA-256 checksums as `sha256:<hex>` for current image and mask write paths. Existing raw hex input hints are normalized before comparison.
- Versions may reference a parent/source artifact version to explain derivation.
- Approved versions remain immutable. RB-052 keeps the latest approved version export-ready until a newer approved version exists; creating a new draft does not mutate approved history.
- RB-053 training exports consume latest approved versions only and record exact artifact version ids in the manifest and `ExportItem` rows.
- Model prediction versions are not export-ready ground truth. Future exports may reference prediction ids only as provenance of approved human corrections.

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

The current MVP assumes mask dimensions match the source image dimensions. Future versions must make that assumption explicit.

Each mask artifact records either:

- image pixel coordinate space with matching width/height, or
- a declared transform to the image coordinate space.

The current runtime accepts only `IMAGE_PIXEL` mask coordinate space. Semantic and support masks are rejected when declared dimensions do not match the target image dimensions.

Exports must include coordinate-space metadata.

RB-053 includes each exported mask's format, width, height, coordinate space, label schema version id, and relative package path in the manifest.

## Format Compatibility

Current `u8raw-v1` raw byte artifacts remain the browser editor artifact format after RB-051 for both semantic masks and support masks.

RB-051 support-mask values are resolved through the active label schema where practical:

- `0` remains background,
- `slice_support` comes from the label schema byte value, currently `10` in the seed schema.

RB-055 enforces `u8raw-v1` byte length as `width * height`, verifies optional checksum hints, and checks the stored object length after upload. Support masks are additionally restricted to `0` and the active `slice_support` byte. Semantic Copper label bytes are not valid support-mask geometry.

Future format work should decide:

- how to represent instance ids,
- how to preserve old MVP artifacts after schema reset or migration.

## Related Docs

- [mask-format.md](mask-format.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [training-export-contract.md](training-export-contract.md)
- [model-prediction-contract.md](model-prediction-contract.md)
