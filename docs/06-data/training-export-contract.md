# Training Export Contract

## Purpose

This page defines the implemented RB-053 export contract for reproducible SaPen Annotate training datasets.

Exports are generated from stored image assets, approved artifact/classification versions, label schema versions, metadata, attribution, review decisions, and the manifest. RB-112 makes creation asynchronous: the create request snapshots exact selected references and returns a pending `ExportBatch`; a single-host worker later verifies source object bytes, writes the manifest and ZIP package to MinIO, and enables app-mediated downloads after completion.

## Current Implementation

Important files:

- `src/server/domain/exports.ts` - readiness, exact snapshot creation, manifest generation, async package processing, export persistence, and download authorization.
- `src/server/domain/exportJobs.ts` - due-job processing, atomic claim, bounded retry, and stale lease recovery for export jobs.
- `src/server/domain/exportPackageWriter.ts` - current verified JSZip package-writer boundary.
- `src/app/api/projects/[projectId]/export/readiness/route.ts` - project export readiness.
- `src/app/api/projects/[projectId]/exports/route.ts` - export creation.
- `src/app/api/export-jobs/process-due/route.ts` - worker-oriented due export job processing.
- `src/app/api/exports/[exportId]/route.ts` - export summary.
- `src/app/api/exports/[exportId]/download/route.ts` - manifest/package download through the app.
- `src/features/projects/ProjectExportPanel.tsx` - project exports route UI mounted by `src/features/projects/ProjectExportsPage.tsx`.

API target strings:

- `semantic_segmentation`
- `support_segmentation`
- `slice_classification`
- `combined`
- `crop_training`

The persisted `ExportBatch.target` maps single-target training exports to the existing Prisma enum values, maps multi-target or combined full-image selections to `COMBINED_MANIFEST`, and maps crop packages to `CROP_TRAINING`. `crop_training` is intentionally exclusive and cannot be mixed with full-image target strings in one request. RB-060 adds `ExportTarget.PREDICTION_ANALYSIS`, but that value is not accepted by the training export API.

Create endpoints return `202 Accepted` with `status = PENDING` and no download links. Status reads expose `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED`; downloads are available only when the batch is `COMPLETED`. Failed jobs store stable `errorCode`/`errorMessage` values without exposing private storage keys.

The RB-112 processor is single-host safe. It atomically claims pending or stale `PROCESSING` `ExportBatch` rows, increments `jobAttemptCount`, sets `processorId`/`processorRunId`/`leaseExpiresAt`, and writes package metadata only after source bytes pass checksum/size verification. Retryable failures return to `PENDING` until `jobMaxAttempts`; integrity and cap failures become terminal `FAILED` jobs. Run it through:

```bash
npm run exports:process -- --loop
```

The package writer still uses JSZip, but only after RB-111 item/byte caps pass. The `src/server/domain/exportPackageWriter.ts` boundary is intentionally small so a streaming writer can replace JSZip later.

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

### Crop Training Export

Purpose: provide reviewed crop-space ground-truth items while preserving original-image provenance and crop-to-source transforms.

Includes one manifest `cropItems[]` entry per ready derived crop:

- immutable original image reference and relative package path,
- `DerivedSliceCrop` id/version, private crop PNG copied into the package, checksum, dimensions, requested/applied padding, clipping state, and `transformToSource`,
- exact source-image BBox version reference,
- approved crop-space `SLICE_SUPPORT_MASK` version in `CROP_PIXEL`,
- approved crop-space `SEMANTIC_MASK` version in `CROP_PIXEL`,
- approved `SliceClassificationVersion` with semantic/support/crop derivation links,
- label schema definitions, review attribution, and actor attribution where available.

RB-091 does not generate source-image-space reprojected masks. Consumers can reproject from `CROP_PIXEL` to `SOURCE_IMAGE_PIXEL` using the manifest transform metadata. Future exports may add optional reprojected masks without changing the source-of-truth crop artifacts.

Crop candidates are classified as:

- `READY` - crop, support mask, semantic mask, classification, coordinate spaces, dimensions, checksums, and lineage are exportable.
- `PARTIAL` - some crop work exists but selected approved versions are missing, unapproved, mismatched, or incomplete.
- `NOT_READY` - no exportable crop annotation components exist for the crop.

Readiness reasons include `MISSING_SUPPORT_MASK`, `MISSING_SEMANTIC_MASK`, `MISSING_CLASSIFICATION`, `SUPPORT_NOT_APPROVED`, `SEMANTIC_NOT_APPROVED`, `CLASSIFICATION_NOT_APPROVED`, `SEMANTIC_FAMILY_CONFLICT`, `CLASSIFICATION_SEMANTIC_FAMILY_MISMATCH`, `LINEAGE_MISMATCH`, `COORDINATE_SPACE_MISMATCH`, and integrity metadata warnings such as missing checksums or dimensions. `MISSING_SUPPORT_MASK` applies to Copper crop candidates, not supportless Sap/Heartwood candidates. Only `READY` crop candidates are included as ground truth. `PARTIAL` and `NOT_READY` candidates are listed in `skippedCropItems`; semantic-family conflicts and family/classification mismatches are `REVIEW_REQUIRED` and are skipped.

Copper-specific export rule: Copper semantic masks remain semantic material targets. They are not slice support geometry. A crop training item for a Copper slice still requires an approved support mask for the complete physical slice crop.

Sap/Heartwood-specific export rule: Supportless Sap/Heartwood crop items record `supportGeometrySource = SEMANTIC_FOREGROUND`. Non-background Sap/Heartwood semantic pixels define the support geometry; background crop padding is not support.

Prediction-analysis exports remain separate from ground-truth training exports. RB-085 does not add crop-aware model QA package semantics; that must be designed explicitly if a later crop-prediction workflow needs it.

## Manifest Shape

Current manifest version:

```text
sapen-annotate-training-export-v1
```

Crop manifest version:

```text
sapen-annotate-crop-training-export-v1
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

Crop manifests use `cropItems`, `skippedCropItems`, `warnings`, and `summary` instead of full-image `items`/`skippedImages`. Each crop item includes `originalImage`, `sliceBoundingBox`, `derivedCrop`, `supportMask`, `semanticMask`, `classification`, `readinessStatus`, and `readinessReasons`. Private storage keys are omitted; all file references are relative package paths.

## Package Layout

The ZIP package is transport around the manifest:

```text
manifest.json
images/<imageId>.<ext>
masks/semantic/<imageId>.u8raw
masks/support/<imageId>.u8raw
```

Crop training ZIP packages use:

```text
manifest.json
original-images/<imageId>.<ext>
crops/<derivedCropId>.png
masks/support-crop/<sliceInstanceId>_<supportVersionId>.u8raw
masks/semantic-crop/<sliceInstanceId>_<semanticVersionId>.u8raw
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

Crop training exports require the full ready crop set: a derived crop, approved crop support mask when required by the semantic family, approved crop semantic mask, and approved classification whose lineage matches the selected semantic/support/crop versions. RB-090 auto-derived classification rows start as `DRAFT`; they are not export-ready until approved. RB-092 accepts approved manual override rows when they belong to the same project/image/slice and are current relative to the selected support and semantic mask versions; any manual derived links that are present must match the selected crop/support/semantic lineage. RB-097 additionally requires one active semantic family per crop and rejects approved manual classes that contradict the active family.

Crop readiness is resolved centrally by `src/server/domain/cropReadiness.ts` and exposed through `GET /api/projects/[projectId]/crop-readiness`. The resolver returns `READY`, `PARTIAL`, `NOT_READY`, or `REVIEW_REQUIRED`, stable reason codes, and summary reason counts. `REVIEW_REQUIRED` is used for stale lineage, coordinate-space/dimension mismatch, or stale manual classification cases that should not silently export. Crop export creation includes only `READY` candidates and records every skipped crop with its readiness status and reasons.

The RB-096 crop workbench is a UI orchestration surface for this existing readiness contract. It shows the same crop readiness, next-action, support, semantic, and classification status used by export readiness; it does not add a new export target or change the crop training manifest format.

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

`ExportItem` rows reference the included image, semantic/support artifact versions, slice classification versions, and, for crop packages, `DerivedSliceCrop` through `derivedCropId` with role-specific rows. These references are the database audit trail for exact immutable export inputs.

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

- Export generation is async and intended for trial-sized datasets behind RB-111 caps.
- There is no retry dashboard, streaming package writer, production queue, or large dataset sharding.
- There is no advanced filtering by T-number, label, date, annotator, reviewer, or metadata completeness.
- The UI exposes only the most recent created export result in the project exports panel; there is no export history page.
- Only one default support geometry and one default slice classification per image are implemented.
- Export generation is blocked rather than partially generated when selected approved artifacts are missing checksum or dimension metadata.
- RB-091 crop exports do not emit source-image-space reprojected masks; the crop-to-source transform metadata is the contract for downstream reprojection.
- Prediction-analysis QA metrics exist in the separate prediction-analysis export manifest after RB-067 and are generated by the RB-112 worker; dashboard UI, model comparison reports, and large production-scale analysis jobs remain deferred.

## Related Docs

- [annotation-domain-model.md](annotation-domain-model.md)
- [annotation-label-schema.md](annotation-label-schema.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [model-prediction-contract.md](model-prediction-contract.md)
- [prediction-analysis-export-contract.md](prediction-analysis-export-contract.md)
- [prediction-qa-metrics-contract.md](prediction-qa-metrics-contract.md)
