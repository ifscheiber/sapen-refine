# Mask And Artifact Versioning

## Purpose

This page defines the planned distinction between semantic masks, support/instance masks, prediction artifacts, and reviewed ground-truth artifacts.

Current MVP mask code lives in `src/mask/*`, current mask APIs live in `src/app/api/images/[imageId]/mask/*`, and the current persisted model is `Mask`/`MaskVersion` in `prisma/schema.prisma`.

## Artifact Families

### Semantic Material Masks

Semantic masks classify pixels by material label.

Relevant labels include:

- background,
- unknown/review-required,
- sapwood,
- heartwood,
- copper.

Semantic masks must reference one label schema version.

### Slice Support / Instance Masks

Support or instance masks describe physical slice/object geometry.

They answer a different question from semantic material masks:

- support mask: which pixels belong to the physical slice/object,
- instance mask: which pixels belong to which slice/object instance.

Copper-specific rule:

A copper semantic mask is not a support mask. Copper regions may be smaller than the physical slice, especially for copper penetration/staining workflows.

### Slice Classification Artifacts

Slice classification records classify a slice instance or image context.

Expected classes include:

- `SAP_HEARTWOOD_SLICE`
- `COPPER_SLICE`
- `UNKNOWN`
- `REVIEW_REQUIRED`

Classification artifacts should reference the relevant image, optional slice instance, actor, and label schema/class schema version.

### Prediction Artifacts

Prediction artifacts are model-generated proposals.

They must record:

- model source,
- checkpoint/run/config where available,
- confidence or uncertainty,
- generatedAt,
- generatedBy system actor,
- target image/task,
- artifact storage key when a mask file exists.

Prediction artifacts must never overwrite human ground-truth versions.

## Version Rules

- Every saved artifact version is immutable after commit.
- New edits create a new version rather than overwriting prior versions.
- Versions record actor, timestamp, format, dimensions, coordinate space, artifact storage key, and label schema version.
- Versions may reference a parent/source artifact version to explain derivation.
- Approved versions remain exportable even after a newer version supersedes them.

## Review State

Artifact review state is part of ground-truth integrity.

Required states:

- `draft` - created or edited but not ready for review.
- `submitted` - ready for reviewer decision.
- `approved` - accepted for ground-truth use.
- `rejected` - not accepted; reason/comment required.
- `superseded` - replaced by a newer version without deleting history.

Review decisions should be separate records so history is attributable and auditable.

## Coordinate Space

The current MVP assumes mask dimensions match the source image dimensions. Future versions must make that assumption explicit.

Each mask artifact should record either:

- image pixel coordinate space with matching width/height, or
- a declared transform to the image coordinate space.

Exports must include coordinate-space metadata.

## Format Compatibility

Current `u8raw-v1`/`MSK1` artifacts may remain readable during migration.

Future format work should decide:

- whether semantic and support masks share one binary container format,
- where byte-value-to-label mapping lives,
- how to represent instance ids,
- how to preserve old MVP artifacts after schema reset or migration.

## Related Docs

- [mask-format.md](mask-format.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [training-export-contract.md](training-export-contract.md)
