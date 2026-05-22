# Training Export Contract

## Purpose

This page defines the implemented RB-053 export contract for reproducible SaPen Annotate training datasets.

Exports are generated from stored image assets, latest approved artifact/classification versions, label schema versions, metadata, attribution, review decisions, and the manifest. The current implementation is a synchronous, trial-sized project export that stores a manifest and ZIP package in MinIO and serves downloads through app routes.

## Current Implementation

Important files:

- `src/server/domain/exports.ts` - readiness, manifest generation, ZIP packaging, export persistence, and download authorization.
- `src/app/api/projects/[projectId]/export/readiness/route.ts` - project export readiness.
- `src/app/api/projects/[projectId]/exports/route.ts` - export creation.
- `src/app/api/exports/[exportId]/route.ts` - export summary.
- `src/app/api/exports/[exportId]/download/route.ts` - manifest/package download through the app.
- `src/features/projects/ProjectExportPanel.tsx` - project exports route UI mounted by `src/features/projects/ProjectExportsPage.tsx`.

API target strings:

- `semantic_segmentation`
- `support_segmentation`
- `slice_classification`
- `combined`

The persisted `ExportBatch.target` maps single-target training exports to the existing Prisma enum values and maps multi-target or combined selections to `COMBINED_MANIFEST`. RB-060 adds `ExportTarget.PREDICTION_ANALYSIS`, but that value is not accepted by the RB-053 training export API.

## Export Targets

### Semantic Segmentation Export

Purpose: train/evaluate material segmentation models.

Includes:

- immutable raw image bytes,
- latest approved `SEMANTIC_MASK` artifact version for each included image,
- label schema version and byte-value definitions,
- semantic label meanings,
- mask dimensions and coordinate space,
- creator and approval attribution,
- review decision metadata where available.

Copper semantic masks are included here as material masks, not support masks.

### Support Segmentation Export

Purpose: train/evaluate physical slice/object support geometry models.

Includes:

- immutable raw image bytes,
- latest approved `SLICE_SUPPORT_MASK` artifact version for each included image,
- support label schema/version,
- coordinate-space metadata,
- creator and approval attribution.

Copper semantic material masks are never exported as support geometry. A support segmentation export requires a separate approved `SLICE_SUPPORT_MASK` artifact version.

### Slice Classification Export

Purpose: train/evaluate image or slice-level classifiers.

Includes:

- image ids and raw image bytes,
- latest approved `SliceClassificationVersion`,
- class labels such as `SAP_HEARTWOOD_SLICE`, `COPPER_SLICE`, `UNKNOWN`, or `REVIEW_REQUIRED`,
- label schema version,
- image-level sample/acquisition metadata where available,
- creator and approval attribution.

Classification data is stored in the manifest; no separate classification file is emitted in the MVP ZIP package.

### Combined Manifest Export

Purpose: provide one reproducible bundle for downstream training pipelines that need images, semantic masks, support masks, classifications, metadata, and provenance.

Combined exports keep each target type explicit. They include any approved selected components that exist for an image and add warnings for missing approved components. Consumers must not infer support geometry from copper semantic masks.

## Planned Crop-Aware Export Extension

RB-085 defines a planned crop-based slice annotation workflow. The current RB-053 export implementation remains image-level/full-resolution and does not yet emit crop-aware manifest entries.

For RB-091 and later, crop-aware exports must keep the existing target separation:

- Semantic segmentation exports may include crop-space semantic masks and optional source-image-space reprojected semantic masks.
- Support/instance segmentation exports may include crop-space support masks and optional source-image-space reprojected support masks.
- Slice classification exports may classify each slice instance and must preserve auto-derived versus human-overridden provenance.
- Combined manifest exports may bundle crop images, support masks, semantic masks, classifications, source-image references, transforms, and checksums without conflating target types.

Crop-aware training exports must only include versions that satisfy the selected target readiness policy. For the recommended RB-085 default, support masks and semantic masks require approved versions, and classifications require approved versions or an explicit accepted-auto policy.

Each crop-aware item must include enough metadata to map every crop artifact back to the immutable source image:

- source image id, checksum, dimensions, and package path,
- derived crop artifact/version id when persisted,
- BBox proposal/version reference when persisted,
- crop origin, crop dimensions, and padding metadata,
- declared coordinate spaces such as `SOURCE_IMAGE_PIXEL` and `CROP_PIXEL`,
- transform version or formula,
- exact support mask, semantic mask, and classification version ids,
- review decisions and actor attribution,
- lineage status proving that the semantic mask and classification reference the selected crop/support lineage.

Copper-specific export rule:

Copper semantic masks remain semantic material targets. They are not slice support geometry. A crop-aware support/instance export for a Copper slice requires an approved support mask for the complete physical slice.

Prediction-analysis exports remain separate from ground-truth training exports. RB-085 does not add crop-aware model QA package semantics; that must be designed explicitly if a later crop-prediction workflow needs it.

## Manifest Shape

Current manifest version:

```text
sapen-annotate-training-export-v1
```

Top-level sections:

- `manifestVersion`
- `exportId`
- `exportedAt`
- `exportedBy`
- `project`
- `selection`
- `labelSchemas`
- `items`
- `skippedImages`
- `warnings`
- `summary`

Each item contains:

- `image` with id, filename, relative package path, content type, size, validated dimensions, canonical checksum, and upload timestamp.
- `acquisitionMetadata` and `sampleMetadata` when available.
- `semanticMask` with exact artifact version id, version number, relative package path, checksum, size, dimensions, format, coordinate space, label schema version id, createdBy, and createdAt.
- `supportMask` with the same exact artifact-version fields when selected and approved.
- `classification` with exact classification version id, version, class, slice instance id, label schema version id, createdBy, and createdAt.
- `review` with approval decision ids, approvedBy, and approvedAt for included components where available.
- `eligibleTargets` and `warnings`.

API responses intentionally omit private MinIO storage keys. Manifest package paths are relative export paths, not public object-store URLs.

## Package Layout

The ZIP package is transport around the manifest:

```text
manifest.json
images/<imageId>.<ext>
masks/semantic/<imageId>.u8raw
masks/support/<imageId>.u8raw
```

Raw images and mask bytes are copied from private object storage into the ZIP. Classification records remain in `manifest.json`.

The server stores generated artifacts under:

```text
projects/<projectId>/exports/<exportId>/manifest.json
projects/<projectId>/exports/<exportId>/package.zip
```

These storage keys remain server-private. Browser downloads use `/api/exports/[exportId]/download?file=manifest` and `/api/exports/[exportId]/download?file=package`.

## Export Eligibility

The MVP exports approved ground-truth components only:

- latest approved semantic mask version,
- latest approved support mask version,
- latest approved slice classification version.

Draft, submitted, rejected, and superseded versions are not exported as training targets.

Model prediction artifacts are also excluded from default training exports. RB-059 human corrections based on predictions may be exported only after they are saved as separate human semantic/support versions and approved. Prediction bytes are not ground-truth labels.

RB-056 adds `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance`, and RB-057 imports `PREDICTION_MASK` artifact versions with `MODEL_PREDICTION` provenance. RB-059 correction saves create `HUMAN_CORRECTION` semantic/support artifact versions linked to the source prediction. Prediction records remain proposals only. They do not change training export eligibility, do not mark prediction artifact versions as ground truth, and do not create slice-classification labels. RB-060 implements prediction-analysis exports through `src/server/domain/predictionAnalysisExports.ts` and `/api/prediction-analysis-exports/*`; those exports have their own manifest version and package layout. RB-067 adds QA metrics only to prediction-analysis manifests; `qaMetrics` is not part of `sapen-annotate-training-export-v1`.

Images with no approved data for the requested targets are skipped with `NO_REQUESTED_APPROVED_DATA`. Images missing a selected component are included only for the approved components they do have and receive warnings such as `MISSING_APPROVED_SEMANTIC_MASK`, `MISSING_APPROVED_SUPPORT_MASK`, or `MISSING_APPROVED_SLICE_CLASSIFICATION`. Missing T-number and acquisition metadata are warning conditions, not hard blockers.

RB-055 makes integrity metadata blocking for selected/included training inputs. Export creation fails with `EXPORT_INTEGRITY_METADATA_MISSING` when a selected candidate would require an image or approved mask that lacks a normalized checksum or positive dimensions. Readiness still reports these as explicit warnings:

- `MISSING_IMAGE_CHECKSUM`
- `MISSING_IMAGE_DIMENSIONS`
- `MISSING_SEMANTIC_MASK_INTEGRITY_METADATA`
- `MISSING_SUPPORT_MASK_INTEGRITY_METADATA`

## Persistence And Checksums

`ExportBatch` records:

- project id,
- export target,
- status,
- manifest format version,
- selection criteria,
- exportedBy/exportedAt,
- manifest storage key and checksum,
- warnings,
- metadata summary with package storage key, package checksum, package size, item count, skipped image count, and warning count.

`ExportItem` rows reference the included image, semantic/support artifact versions, and slice classification versions with role-specific rows. These references are the database audit trail for exact immutable export inputs.

Current checksums use validated stored image/mask checksums and calculate manifest/package checksums at export time. Manifests and ZIP packages never expose private MinIO/S3 storage keys.

RB-055 adds `EXPORT_CREATED` audit events when export generation completes and `EXPORT_DOWNLOADED` audit events when owners download manifest or package files.

## Access

Current MVP access:

- Any authenticated project member can inspect export readiness.
- `OWNER` can create export batches and download generated export files.
- `QA`, `LABELER`, and `VIEWER` cannot create or download exports in RB-053.

Prediction-analysis exports are a separate RB-060 mode. Project `OWNER` and `QA` can create/download those QA packages, while `LABELER` and `VIEWER` cannot.

All export creation records the authenticated actor. Future project policy may allow QA export access, but that is deferred.

## MVP Limits

- Export generation is synchronous and intended for trial-sized datasets.
- There is no background job queue, retry dashboard, or large dataset sharding.
- There is no advanced filtering by T-number, label, date, annotator, reviewer, or metadata completeness.
- The UI exposes only the most recent created export result in the project exports panel; there is no export history page.
- Only one default support geometry and one default slice classification per image are implemented.
- Export generation is blocked rather than partially generated when selected approved artifacts are missing checksum or dimension metadata.
- Prediction-analysis QA metrics exist in the separate prediction-analysis export manifest after RB-067; dashboard UI, model comparison reports, and large async analysis jobs remain deferred.

## Related Docs

- [annotation-domain-model.md](annotation-domain-model.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [model-prediction-contract.md](model-prediction-contract.md)
- [prediction-analysis-export-contract.md](prediction-analysis-export-contract.md)
- [prediction-qa-metrics-contract.md](prediction-qa-metrics-contract.md)
