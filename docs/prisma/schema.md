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
- `prisma/seed.mjs` - active Prisma seed command from `prisma.config.ts`.
- `scripts/trial-bootstrap.mjs` - trial-safe role/label-schema bootstrap without shared demo credentials.
- `src/server/db.ts` - Prisma client setup.

## Current Model Summary

- `User`, `Role`, `UserGlobalRole`, `Session` - local identity, global roles, and sessions.
- `AnnotationProject`, `AnnotationProjectMember` - standalone annotation project and membership/access boundary.
- `LabelSchemaVersion`, `LabelDefinition` - versioned label definitions with stable machine-readable ids.
- `ImageAsset`, `ImageAcquisitionMetadata`, `SampleMetadata` - immutable image asset references plus RB-050 image-level acquisition/default sample metadata workflow storage.
- `AnnotationTask`, `AnnotationSession` - assignment/edit context baseline with priority, confidence/uncertainty, and model-source placeholders.
- `AnnotationArtifact`, `AnnotationArtifactVersion` - semantic/support/instance/prediction/derived artifact baseline; RB-051 uses semantic and default slice-support artifacts.
- `SliceInstance`, `SliceBoundingBoxVersion`, `DerivedSliceCrop`, `SliceClassificationVersion` - physical slice object, BBox proposal history, derived crop versions, and classification baseline; RB-051 uses one default slice instance per image, RB-086 creates BBox proposal slice instances, and RB-087 creates crop versions from active BBox versions.
- `ReviewDecision` - review/approval decisions for artifact versions and slice classification versions.
- `ExportBatch`, `ExportItem` - RB-053 training export and RB-060 prediction-analysis export batch persistence, manifest/package metadata, warnings, actor attribution, exact exported version references, and optional prediction provenance references.
- `ModelRun` - model/training/checkpoint identity with task type, checkpoint, training dataset/export references, config hash, actor, warnings, and metadata.
- `PredictionRun` - project-scoped inference execution linked to a model run, source dataset/export/selection, inference id, status, counts, aggregate confidence/uncertainty, actor, warnings, and metadata.
- `PredictionArtifactProvenance` - per-image prediction proposal metadata linked to a prediction run, optional prediction artifact version, optional slice instance, target type, predicted class, confidence/uncertainty, per-class scores, output stats, and output checksum.
- `PredictionImportBatchJob`, `PredictionImportBatchItem` - RB-061/RB-066 DB-backed ZIP batch prediction import bookkeeping, item status/error/retry state, staging purge markers, and links to created prediction artifact/provenance rows.
- `AuditLog` - generic audit rows used by RB-055 upload, artifact, export events, RB-064 auth/project/review/provenance events, RB-065 batch runner events, and RB-066 storage cleanup events.

## Invariants And Constraints

- `ImageAsset.storageKey` and `AnnotationArtifactVersion.storageKey` are unique.
- `AnnotationArtifactVersion` is versioned per `AnnotationArtifact`.
- `AnnotationArtifact` is unique by `(imageId, kind, scopeKey)` so the current editor has one default semantic mask artifact and one default slice-support artifact per image.
- Every annotation artifact version references exactly one `LabelSchemaVersion`.
- `AnnotationArtifactKind.SEMANTIC_MASK` is separate from `SLICE_SUPPORT_MASK` and `INSTANCE_MASK`.
- Copper is a semantic label in the default label schema and is not support geometry.
- `SliceBoundingBoxVersion` records source-image proposal rectangles only. It uses `CoordinateSpace.SOURCE_IMAGE_PIXEL`, appends new versions for replacement/deletion, and does not make the BBox export-ready support geometry.
- `DerivedSliceCrop` records private PNG crop artifacts generated from exact active BBox versions. It uses `CoordinateSpace.CROP_PIXEL`, stores source-image checksum/dimensions, source rectangle, requested/applied padding, clipping state, transform metadata, storage checksum/size/content type, and version per slice instance. It is not a raw `ImageAsset` and does not define support geometry.
- `ReviewDecision` targets either an `AnnotationArtifactVersion` or a `SliceClassificationVersion`; the exact-one-target invariant is enforced by `src/server/domain/review.ts`.
- Current image writes persist `ImageValidationStatus.VALIDATED` only after server-side PNG/JPEG validation and object stat verification.
- Current mask writes persist `AnnotationArtifactVersion` checksum, byte size, dimensions, `u8raw-v1` format, and `IMAGE_PIXEL` coordinate space after validation.
- `PredictionRun` is project-scoped and references exactly one `ModelRun`.
- `PredictionArtifactProvenance` references exactly one `PredictionRun`, can link one optional `PREDICTION_MASK` `AnnotationArtifactVersion`, and stores prediction target/classification metadata outside human ground-truth rows.
- `PredictionImportBatchItem` never stores ground-truth state. Successful items link to `AnnotationArtifactVersion` and `PredictionArtifactProvenance` rows created by the RB-057 prediction import service. Staging keys are private and must not be serialized to browser clients. `stagingPurgedAt` means the temporary source object was deleted and the item cannot be retried without re-upload.
- `ExportTarget.PREDICTION_ANALYSIS` is reserved for RB-060/RB-067 QA/debug exports and must not be accepted by the RB-053 training export target parser.
- `ExportItem.predictionProvenanceId` records exact prediction items for prediction-analysis exports without making those predictions ground truth. RB-067 QA metric summaries are export metadata, not schema-level labels.
- `AnnotationTask.predictionRunId` and `AnnotationTask.predictionProvenanceId` are nullable links for future model-prediction correction queues; `modelSource` is not the reproducible source of truth.

## Known Gaps

- Slice-specific metadata and multi-slice/multi-object support-mask editing remain deferred.
- One-default-slice support/classification workflows exist after RB-051. Source-image BBox proposals for multiple candidate slices exist after RB-086, and derived crop generation exists after RB-087. Per-crop support masks remain deferred.
- Review/approval is implemented as a minimal RB-052 workflow; reviewer dashboards and bulk review remain deferred.
- RB-053 implements synchronous owner-only training export generation. RB-060/RB-067 implement separate synchronous owner/QA prediction-analysis exports with QA metrics. RB-061 implements DB-backed prediction import batches, RB-065 adds single-host worker leases/recovery, and RB-066 adds temporary staging/orphan cleanup. Advanced filters, export history UI, metrics dashboards, cleanup UI, and production-scale workers remain deferred.
- Checksum/dimension enforcement for current upload, mask, support-mask, and export paths is implemented by RB-055. RB-066 handles identifiable temporary/orphan cleanup, but committed artifact retention remains out of scope.
- RB-056 implements provenance persistence, RB-057 implements one-at-a-time prediction mask import, RB-058/RB-059 implement correction queues and assisted correction, RB-060 implements prediction-analysis exports, RB-061 implements ZIP-based batch prediction import jobs, RB-065 implements batch-runner hardening, RB-066 implements temporary staging purge markers, and RB-067 implements export-time QA metrics without schema changes.

## Related Tickets / Docs

- [README.md](README.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../known-gaps.md](../known-gaps.md)
