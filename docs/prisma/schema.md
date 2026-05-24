# Prisma Schema

## Purpose

This page summarizes the current persisted model in `prisma/schema.prisma`.

## Important Files

- `prisma/schema.prisma` - model definitions.
- `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql` - current development baseline migration.
- `prisma/migrations/20260519233000_review_classification_decisions/migration.sql` - RB-052 review decision target extension.
- `prisma/migrations/20260520134931_prediction_provenance_registry/migration.sql` - RB-056 model/prediction provenance registry extension.
- `prisma/migrations/20260520213000_prediction_analysis_exports/migration.sql` - RB-060 prediction-analysis export target and `ExportItem.predictionProvenanceId` extension.
- `prisma/migrations/20260520204932_prediction_import_batches/migration.sql` - RB-061 prediction import batch/job/item extension.
- `prisma/migrations/20260521103000_storage_retention_cleanup/migration.sql` - RB-066 batch staging purge markers.
- `prisma/migrations/20260522214000_slice_bbox_proposals/migration.sql` - RB-086 `SliceBoundingBoxVersion`, `SliceBoundingBoxStatus`, and `SOURCE_IMAGE_PIXEL` coordinate-space extension.
- `prisma/migrations/20260522223000_derived_slice_crops/migration.sql` - RB-087 `DerivedSliceCrop` and `CROP_PIXEL` coordinate-space extension.
- `prisma/migrations/20260523081500_crop_support_mask_lineage/migration.sql` - RB-088 `AnnotationArtifactVersion.derivedCropId` and `sliceInstanceId` links for crop support masks.
- `prisma/migrations/20260523110000_crop_semantic_mask_lineage/migration.sql` - RB-089 `AnnotationArtifactVersion.supportMaskVersionId` and `cropSemanticMode` links for crop semantic masks.
- `prisma/migrations/20260523123000_slice_classification_semantic_derivation/migration.sql` - RB-090 classification source, derivation reason, and crop semantic/support/crop lineage links.
- `prisma/migrations/20260523133000_crop_training_export_contract/migration.sql` - RB-091 `ExportTarget.CROP_TRAINING` and `ExportItem.derivedCropId` links for crop package provenance.
- `prisma/migrations/20260523153000_image_crop_workflow_state/migration.sql` - RB-094 `ImageCropWorkflowState` and `ImageCropBBoxSetStatus` for image-level BBox set confirmation.
- `prisma/migrations/20260524090000_review_export_integrity_constraints/migration.sql` - RB-109 DB check constraints for review decision targets and current export item role/reference shapes.
- `prisma/migrations/20260524113000_high_cost_rate_limit_buckets/migration.sql` - RB-111 high-cost write limiter bucket table.
- `prisma/migrations/20260524123000_async_export_jobs/migration.sql` - RB-112 async export job status, package columns, processor lease/retry fields, and indexes.
- `prisma/migrations/20260524124500_export_legacy_created_completed/migration.sql` - RB-112 compatibility migration that marks legacy generated `CREATED` exports with persisted package objects as `COMPLETED`.
- `prisma/seed.mjs` - active Prisma seed command from `prisma.config.ts`.
- `scripts/trial-bootstrap.mjs` - trial-safe role/label-schema bootstrap without shared demo credentials.
- `src/server/db.ts` - Prisma client setup.

## Current Model Summary

- `User`, `Role`, `UserGlobalRole`, `Session` - local identity, global roles, and sessions.
- `AnnotationProject`, `AnnotationProjectMember` - standalone annotation project and membership/access boundary.
- `LabelSchemaVersion`, `LabelDefinition` - versioned label definitions with stable machine-readable ids.
- `ImageAsset`, `ImageAcquisitionMetadata`, `SampleMetadata` - immutable image asset references plus RB-050 image-level acquisition/default sample metadata workflow storage.
- `AnnotationTask`, `AnnotationSession` - assignment/edit context baseline with priority, confidence/uncertainty, and model-source placeholders.
- `AnnotationArtifact`, `AnnotationArtifactVersion` - semantic/support/instance/prediction/derived artifact baseline; RB-051 uses semantic and default slice-support artifacts, RB-088 links crop support artifact versions to derived crops and slice instances, and RB-089 links crop semantic artifact versions to their exact support-mask constraint and semantic mode.
- `SliceInstance`, `SliceBoundingBoxVersion`, `ImageCropWorkflowState`, `DerivedSliceCrop`, `SliceClassificationVersion` - physical slice object, BBox proposal history, image-level BBox confirmation state, derived crop versions, classification baseline, and RB-090 manual/auto classification provenance; RB-051 uses one default slice instance per image, RB-086 creates BBox proposal slice instances, RB-094 records confirmed BBox set snapshots, and RB-087 creates crop versions from active BBox versions.
- `ReviewDecision` - review/approval decisions for artifact versions and slice classification versions.
- `ExportBatch`, `ExportItem` - RB-053 full-image training export, RB-091 crop training export, and RB-060/RB-112 prediction-analysis/export batch persistence, manifest/package metadata, async job status/lease/retry fields, warnings, actor attribution, exact exported version references, crop references, and optional prediction provenance references.
- `ModelRun` - model/training/checkpoint identity with task type, checkpoint, training dataset/export references, config hash, actor, warnings, and metadata.
- `PredictionRun` - project-scoped inference execution linked to a model run, source dataset/export/selection, inference id, status, counts, aggregate confidence/uncertainty, actor, warnings, and metadata.
- `PredictionArtifactProvenance` - per-image prediction proposal metadata linked to a prediction run, optional prediction artifact version, optional slice instance, target type, predicted class, confidence/uncertainty, per-class scores, output stats, and output checksum.
- `PredictionImportBatchJob`, `PredictionImportBatchItem` - RB-061/RB-066 DB-backed ZIP batch prediction import bookkeeping, item status/error/retry state, staging purge markers, and links to created prediction artifact/provenance rows.
- `AuditLog` - generic audit rows used by RB-055 upload, artifact, export events, RB-064 auth/project/review/provenance events, RB-065 batch runner events, and RB-066 storage cleanup events.
- `AuthLoginThrottle`, `HighCostRateLimitBucket` - hashed operational throttling buckets for login failures and RB-111 high-cost authenticated write limits.

## Invariants And Constraints

- `ImageAsset.storageKey` and `AnnotationArtifactVersion.storageKey` are unique.
- `AnnotationArtifactVersion` is versioned per `AnnotationArtifact`.
- `AnnotationArtifact` is unique by `(imageId, kind, scopeKey)` so the current editor has one default semantic mask artifact and one default slice-support artifact per image.
- Crop support masks use crop-specific scope keys and nullable `AnnotationArtifactVersion.derivedCropId` / `sliceInstanceId` links so each `CROP_PIXEL` support version is traceable to a derived crop and physical slice instance.
- Crop semantic masks use crop/mode-specific scope keys and nullable `AnnotationArtifactVersion.derivedCropId`, `sliceInstanceId`, `supportMaskVersionId`, and `cropSemanticMode` links so each `CROP_PIXEL` semantic version is traceable to the selected crop, physical slice instance, and exact support-mask constraint.
- Auto-derived crop classifications are `SliceClassificationVersion` rows with `source = AUTO_FROM_SEMANTIC_MASK`, a stable `derivationReason`, `reviewState = DRAFT`, and nullable links to `derivedFromSemanticMaskVersionId`, `derivedFromSupportMaskVersionId`, and `derivedFromCropId`. Manual overrides append separate rows with `source = MANUAL`.
- Every annotation artifact version references exactly one `LabelSchemaVersion`.
- `AnnotationArtifactKind.SEMANTIC_MASK` is separate from `SLICE_SUPPORT_MASK` and `INSTANCE_MASK`.
- Copper is a semantic label in the default label schema and is not support geometry.
- `SliceBoundingBoxVersion` records source-image proposal rectangles only. It uses `CoordinateSpace.SOURCE_IMAGE_PIXEL`, appends new versions for replacement/deletion, and does not make the BBox export-ready support geometry.
- `ImageCropWorkflowState` records image-level BBox set workflow state only. Confirming a BBox set snapshots active BBox version ids and records attribution; later BBox edits mark the set `NEEDS_UPDATE` without changing BBox history.
- `DerivedSliceCrop` records private PNG crop artifacts generated from exact active BBox versions. It uses `CoordinateSpace.CROP_PIXEL`, stores source-image checksum/dimensions, source rectangle, requested/applied padding, clipping state, transform metadata, storage checksum/size/content type, and version per slice instance. It is not a raw `ImageAsset` and does not define support geometry.
- Crop support masks are `SLICE_SUPPORT_MASK` artifact versions with `CoordinateSpace.CROP_PIXEL`, crop dimensions, support-only bytes, and explicit crop/slice lineage. They define support geometry for the selected crop; crop padding itself remains non-geometry.
- Crop semantic masks are `SEMANTIC_MASK` artifact versions with `CoordinateSpace.CROP_PIXEL`, crop dimensions, mode-specific semantic bytes, explicit crop/slice lineage, and exact support-mask lineage. They do not define support geometry.
- `ExportTarget.CROP_TRAINING` is the RB-091 ground-truth crop package target. `ExportItem.derivedCropId` links each original-image, derived-crop, crop support-mask, crop semantic-mask, and crop classification export row to the exact `DerivedSliceCrop`.
- `ReviewDecision` targets either an `AnnotationArtifactVersion` or a `SliceClassificationVersion`; `ReviewDecision_exactly_one_target_chk` enforces exactly one target at the database layer.
- `ExportItem` stores exact persisted package references. RB-109 adds DB checks for the current stable roles while leaving unknown future role strings unconstrained until they have an explicit contract.
- Current DB-enforced `ExportItem.role` matrix:

| Role(s) | Required references | Optional references | Forbidden references | Meaning |
| --- | --- | --- | --- | --- |
| `image` | `imageId` | `predictionProvenanceId` | `artifactVersionId`, `sliceClassificationVersionId`, `derivedCropId` | Full-image training input or prediction-analysis source image. |
| `semantic-mask`, `support-mask` | `imageId`, `artifactVersionId` | none | `sliceClassificationVersionId`, `predictionProvenanceId`, `derivedCropId` | Full-image approved training artifact. |
| `slice-classification` | `imageId`, `sliceClassificationVersionId` | none | `artifactVersionId`, `predictionProvenanceId`, `derivedCropId` | Full-image slice classification export row. |
| `original-image`, `derived-crop` | `imageId`, `derivedCropId` | none | `artifactVersionId`, `sliceClassificationVersionId`, `predictionProvenanceId` | Crop-training source image and generated crop asset rows. |
| `crop-semantic-mask`, `crop-support-mask` | `imageId`, `artifactVersionId`, `derivedCropId` | none | `sliceClassificationVersionId`, `predictionProvenanceId` | Crop-scoped approved artifact rows. |
| `crop-slice-classification` | `imageId`, `sliceClassificationVersionId`, `derivedCropId` | none | `artifactVersionId`, `predictionProvenanceId` | Crop-training classification row. |
| `prediction-proposal` | `imageId`, `predictionProvenanceId` | `artifactVersionId` | `sliceClassificationVersionId`, `derivedCropId` | Prediction-analysis proposal; classification proposals can be manifest-only without artifact bytes. |
| `human-correction-reference` | `imageId`, `artifactVersionId`, `predictionProvenanceId` | none | `sliceClassificationVersionId`, `derivedCropId` | Prediction-analysis human correction artifact reference. |
| `approved-ground-truth-reference` | `imageId`, exactly one of `artifactVersionId` or `sliceClassificationVersionId`, `predictionProvenanceId` | none | `derivedCropId` | Prediction-analysis approved human reference. |

- Export selection semantics, target compatibility, manifest fields, package paths, and cross-table lineage such as artifact kind or prediction target type remain enforced by `src/server/domain/exports.ts` and `src/server/domain/predictionAnalysisExports.ts`, not by DB checks.
- Current image writes persist `ImageValidationStatus.VALIDATED` only after server-side PNG/JPEG validation and object stat verification.
- Current mask writes persist `AnnotationArtifactVersion` checksum, byte size, dimensions, `u8raw-v1` format, and `IMAGE_PIXEL` coordinate space after validation.
- `PredictionRun` is project-scoped and references exactly one `ModelRun`.
- `PredictionArtifactProvenance` references exactly one `PredictionRun`, can link one optional `PREDICTION_MASK` `AnnotationArtifactVersion`, and stores prediction target/classification metadata outside human ground-truth rows.
- `PredictionImportBatchItem` never stores ground-truth state. Successful items link to `AnnotationArtifactVersion` and `PredictionArtifactProvenance` rows created by the RB-057 prediction import service. Staging keys are private and must not be serialized to browser clients. `stagingPurgedAt` means the temporary source object was deleted and the item cannot be retried without re-upload.
- `ExportTarget.PREDICTION_ANALYSIS` is reserved for RB-060/RB-067 QA/debug exports and must not be accepted by the training export target parser.
- `ExportTarget.CROP_TRAINING` is accepted only through the exclusive `crop_training` training export target and cannot be mixed with full-image export targets.
- `ExportItem.predictionProvenanceId` records exact prediction items for prediction-analysis exports without making those predictions ground truth. RB-067 QA metric summaries are export metadata, not schema-level labels.
- RB-112 export jobs use `PENDING` -> `PROCESSING` -> `COMPLETED`/`FAILED` state, `jobAttemptCount`/`jobMaxAttempts`, `processorId`/`processorRunId`, `leaseExpiresAt`, `nextRetryAt`, and terminal error fields on `ExportBatch`. Legacy already-generated `CREATED` rows with stored package objects are migrated to `COMPLETED`.
- `AnnotationTask.predictionRunId` and `AnnotationTask.predictionProvenanceId` are nullable links for future model-prediction correction queues; `modelSource` is not the reproducible source of truth.
- `HighCostRateLimitBucket` is operational state only. It stores route family plus a hashed user/scope key, request count, window start, and timestamps. It must not be used as audit history and must not persist raw user/project ids, request payloads, storage keys, or upload contents.

## Known Gaps

- Slice-specific metadata and multi-slice/multi-object support-mask editing remain deferred.
- One-default-slice support/classification workflows exist after RB-051. Source-image BBox proposals for multiple candidate slices exist after RB-086, derived crop generation exists after RB-087, per-crop support masks exist after RB-088, support-constrained per-crop semantic masks exist after RB-089, draft auto classification suggestions from crop semantic masks exist after RB-090, crop training export packages exist after RB-091, and image-level BBox set confirmation exists after RB-094.
- Review/approval is implemented as a minimal RB-052 workflow; reviewer dashboards and bulk review remain deferred.
- RB-053/RB-091/RB-112 implement owner-only async training/crop export jobs. RB-060/RB-067/RB-112 implement separate async owner/QA prediction-analysis export jobs with QA metrics. RB-061 implements DB-backed prediction import batches, RB-065 adds single-host worker leases/recovery, RB-066 adds temporary staging/orphan cleanup, and RB-111 adds trial caps/rate limits for high-cost writes. Advanced filters, export history UI, metrics dashboards, cleanup UI, streaming export packaging, and production-scale workers remain deferred.
- Checksum/dimension enforcement for current upload, mask, support-mask, and export paths is implemented by RB-055. RB-066 handles identifiable temporary/orphan cleanup, but committed artifact retention remains out of scope.
- RB-056 implements provenance persistence, RB-057 implements one-at-a-time prediction mask import, RB-058/RB-059 implement correction queues and assisted correction, RB-060 implements prediction-analysis exports, RB-061 implements ZIP-based batch prediction import jobs, RB-065 implements batch-runner hardening, RB-066 implements temporary staging purge markers, and RB-067 implements export-time QA metrics without schema changes.

## Related Tickets / Docs

- [README.md](README.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../known-gaps.md](../known-gaps.md)
