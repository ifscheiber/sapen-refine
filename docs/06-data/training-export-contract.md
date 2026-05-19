# Training Export Contract

## Purpose

This page defines the planned export contract for reproducible SaPen Annotate training datasets. Admin export is not implemented in the current MVP.

Exports must be reproducible from stored image assets, artifact versions, label schema versions, metadata, attribution, and the manifest.

## Common Export Metadata

Every export batch should record:

- export id,
- export target,
- manifest format version,
- project id and project name at export time,
- exportedBy,
- exportedAt,
- selection/filter criteria,
- included image ids,
- included artifact version ids,
- label schema id/version,
- object keys and checksums,
- application/schema version context,
- warnings such as missing metadata or missing support masks.

## Export Targets

### Semantic Segmentation Export

Purpose: train/evaluate material segmentation models.

Includes:

- immutable raw images,
- approved semantic material mask versions,
- label schema version,
- byte-value mapping,
- semantic label meanings,
- mask dimensions and coordinate space,
- creator/reviewer attribution,
- review state.

Copper semantic masks are included here as material masks, not support masks.

### Instance / Support Segmentation Export

Purpose: train/evaluate slice/object support or instance geometry models.

Includes:

- immutable raw images,
- approved support/instance mask versions,
- slice instance ids,
- bounding boxes or geometry summaries when available,
- support label schema/version,
- coordinate-space metadata,
- review attribution.

Copper semantic material masks must not be exported as support geometry unless an explicit derived support artifact exists and records its derivation rule.

### Slice Classification Export

Purpose: train/evaluate image or slice-level classifiers.

Includes:

- image ids and optional slice instance ids,
- class labels such as `SAP_HEARTWOOD_SLICE`, `COPPER_SLICE`, `UNKNOWN`, or `REVIEW_REQUIRED`,
- class schema/label schema version,
- sample/specimen metadata,
- reviewer attribution,
- selection criteria.

Classification exports may include image references without mask artifacts when the target model does not consume masks.

### Combined Manifest Export

Purpose: provide a single reproducible bundle for downstream training pipelines that need images, semantic masks, support masks, classifications, metadata, and provenance.

Includes:

- all included image assets,
- semantic mask version references,
- support/instance mask version references,
- slice classification records,
- sample/acquisition metadata,
- label schema versions,
- review records,
- export warnings and completeness flags.

Combined exports must keep each target type explicit. A consumer should not infer support geometry from copper semantic masks.

## Manifest Shape

The exact JSON schema belongs to the export implementation ticket, but the manifest must contain these top-level sections:

- `export`
- `project`
- `labelSchemas`
- `images`
- `semanticMasks`
- `supportMasks`
- `sliceClassifications`
- `metadata`
- `reviews`
- `warnings`

Each artifact entry must include:

- immutable artifact version id,
- storage key or relative export path,
- checksum,
- dimensions,
- format,
- label schema version,
- createdBy and createdAt,
- review status and reviewedBy when approved/rejected.

## Export Eligibility

Default MVP export behavior should include approved artifacts only.

Images or artifacts that are draft, submitted, rejected, or missing required metadata should either be excluded or included with explicit warnings depending on the export target and admin selection.

## Access

Export creation is an administrative action.

Planned default:

- `OWNER` can create export batches.
- `QA` may create export batches only when project policy allows it.
- `LABELER` and `VIEWER` cannot create export batches.

All export actions must be attributable to the authenticated actor.

## Related Docs

- [annotation-domain-model.md](annotation-domain-model.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
