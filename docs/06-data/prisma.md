# Prisma Data Model

## Purpose

This page summarizes the RB-049 persisted annotation-domain baseline plus RB-050 through RB-067 workflow, provenance, batch-runner, storage-cleanup, prediction-QA extensions, the RB-086 BBox slice proposal model, the RB-087 derived crop model, the RB-088 crop support-mask lineage model, the RB-089 crop semantic-mask lineage model, the RB-090 semantic-derived classification model, the RB-091 crop training export contract, and the RB-092 crop review/readiness integration. The exact schema source is `prisma/schema.prisma`; migrations live under `prisma/migrations`.

RB-049 intentionally replaces the previous MVP migration. There is no production data, so local development uses a destructive rebuild instead of preservation migrations.

## Current Persisted Model

- `User`, `Role`, `UserGlobalRole`, `Session`, and `AuthLoginThrottle` support local authentication, global roles, session persistence, and hashed login failure buckets.
- `AnnotationProject` and `AnnotationProjectMember` are the standalone annotation project and membership boundary.
- `LabelSchemaVersion` and `LabelDefinition` persist stable machine-readable label ids, semantic meanings, UI metadata, and task applicability.
- `ImageAsset`, `ImageAcquisitionMetadata`, and `SampleMetadata` persist immutable image references plus the RB-050 image-level metadata workflow.
- `AnnotationTask` and `AnnotationSession` provide the persistence baseline for assignment, active-learning/preprediction fields, and edit context. RB-058 adds a unique correction-task link for `predictionProvenanceId + type`.
- `AnnotationArtifact` and `AnnotationArtifactVersion` replace `Mask`/`MaskVersion` and separate semantic, support/instance, prediction, and derived artifact families. RB-088 adds nullable `derivedCropId` and `sliceInstanceId` links on artifact versions for crop support masks. RB-089 adds nullable `supportMaskVersionId` and `cropSemanticMode` links for crop semantic masks.
- `SliceInstance` and `SliceClassificationVersion` provide the persistence baseline for RB-051. RB-086 adds `SliceBoundingBoxVersion` for append-only source-image BBox proposal history linked to slice instances. RB-087 adds `DerivedSliceCrop` for append-only private crop PNG versions linked to source images, BBox versions, and slice instances. RB-088 links crop support artifact versions to those crop and slice rows. RB-089 links crop semantic artifact versions to the crop, slice, exact support mask version, and semantic mode. RB-090 adds manual/auto classification source, derivation reason, metadata, and optional links from classifications back to the semantic mask, support mask, and crop that produced an auto suggestion.
- `ReviewDecision` and `ArtifactReviewState` provide the persistence and workflow baseline for draft/submitted/approved/rejected/superseded ground-truth state. RB-052 decisions can target artifact versions or slice classification versions.
- `ExportBatch` and `ExportItem` persist RB-053 full-image training export batches, RB-091 crop training export batches, and RB-060/RB-067 prediction-analysis export batches, manifest/package metadata, QA metric summary metadata, warnings, actor attribution, exact exported version/provenance references, and crop-package `derivedCropId` references.
- `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance` persist RB-056 model/checkpoint/training provenance, project-scoped inference runs, per-image prediction proposal metadata, and RB-065 batch-item idempotency keys for retry-safe imports.
- `PredictionImportBatchJob` and `PredictionImportBatchItem` persist RB-061/RB-066 batch prediction import source, status/counts, item retry/error state, processor identity, lease/stale recovery state, created prediction artifact/provenance links, and staging purge markers.
- `AuditLog` records explicit audit events for upload acceptance/rejection, mask commits/validation failures, login success/failure/lockout, project/image metadata changes, slice classifications, review decisions, export creation/download, prediction provenance/import, correction tasks, assisted corrections, batch import processing, and storage cleanup. It is append-only but no admin audit UI exists yet.

## Current Compatibility Behavior

Existing browser URLs and APIs still use project/image/mask language. Route handlers now map those writes to the new schema:

- project routes use `AnnotationProject`,
- image routes use `ImageAsset`,
- image metadata routes use `ImageAcquisitionMetadata` and image-level/default `SampleMetadata`,
- current editor mask saves create or append to a `SEMANTIC_MASK` `AnnotationArtifact`,
- support-mask editor saves create or append to a `SLICE_SUPPORT_MASK` `AnnotationArtifact`,
- BBox proposal editor writes create `SliceInstance` rows plus append-only `SliceBoundingBoxVersion` rows in `SOURCE_IMAGE_PIXEL` coordinate space,
- derived crop generation writes append-only `DerivedSliceCrop` rows in `CROP_PIXEL` coordinate space and stores private PNG crop bytes under project-scoped derived-crop keys,
- crop support-mask editor saves create or append to a crop-scoped `SLICE_SUPPORT_MASK` artifact with `CROP_PIXEL`, `derivedCropId`, and `sliceInstanceId`,
- crop semantic-mask editor saves create or append to a crop-scoped `SEMANTIC_MASK` artifact with `CROP_PIXEL`, `derivedCropId`, `sliceInstanceId`, `supportMaskVersionId`, and `cropSemanticMode`; successful saves also append a draft `SliceClassificationVersion` with `source = AUTO_FROM_SEMANTIC_MASK`,
- slice classification writes create `SliceClassificationVersion` rows for the default `SliceInstance`; crop workflow manual overrides create rows for the addressed `SliceInstance` through `/api/slices/[sliceInstanceId]/classification`,
- review routes update `reviewState` and append `ReviewDecision` rows for semantic masks, support masks, and slice classifications,
- crop readiness is derived from existing crop, artifact-version, classification-version, review-decision, and membership rows by `src/server/domain/cropReadiness.ts`; RB-092 does not add schema tables,
- upload routes persist verified `ImageAsset` checksums/dimensions/status for PNG/JPEG images,
- prediction provenance routes create/read `ModelRun` and project-scoped `PredictionRun` records without importing prediction bytes,
- correction-task routes create/read/update `MODEL_PREDICTION_CORRECTION` `AnnotationTask` rows linked to prediction provenance,
- prediction batch routes create/read/process/process-due/retry `PredictionImportBatchJob` and `PredictionImportBatchItem` rows, with processing delegated to the RB-057 import service and RB-065 Postgres leases for background processing,
- storage cleanup marks purged temporary batch item sources on `PredictionImportBatchItem.stagingPurgedAt` and `stagingPurgeReason`,
- prediction-analysis export routes create/read/download `ExportBatch.target = PREDICTION_ANALYSIS` packages with `ExportItem.predictionProvenanceId` references and manifest-level QA metrics,
- crop training export routes create/read/download `ExportBatch.target = CROP_TRAINING` packages with `ExportItem.derivedCropId` references for original-image, derived-crop, crop support-mask, crop semantic-mask, and crop classification roles,
- login throttling writes hashed failure buckets to `AuthLoginThrottle` and never stores raw email/IP values in that table,
- latest-mask reads return the latest `AnnotationArtifactVersion` for the default semantic mask scope.

`MaskKind.REFINED` is removed from the Prisma schema. Current editor saves are draft human semantic mask versions, not refinement artifacts.

## Rebuild Path

Use the destructive development rebuild after pulling RB-049 schema changes:

```bash
npm run db:rebuild
```

The command removes local Docker volumes, recreates PostgreSQL/MinIO, applies `prisma migrate deploy`, and runs `node prisma/seed.mjs`.

## Seed Baseline

`prisma/seed.mjs` creates:

- global `ADMIN` and `USER` roles,
- local admin and labeler users,
- one default label schema version,
- default semantic/support/classification labels,
- `demo_project` with owner/labeler memberships.

The default label schema includes stable ids for `background`, `unknown`, `sapwood`, `heartwood`, `copper`, `slice_support`, `review_required`, and slice classification labels.

## Trial Bootstrap Baseline

Customer-facing trial deployment uses `npm run trial:bootstrap` after `prisma migrate deploy`. That command creates only global `ADMIN`/`USER` roles and the same default label schema/definitions used by the local seed. It does not create `admin@sapen.local`, `labeler@sapen.local`, or `demo_project`; named users are created separately with `npm run trial:user:create`.

## Implemented And Deferred Work

- RB-050 implements project/image metadata UI/API workflow for image-level acquisition and default sample metadata.
- RB-051 implements one-default-slice classification/support-mask user workflow.
- RB-052 implements minimal review/approval UI/API behavior; bulk review and reviewer dashboards remain deferred.
- RB-053 implements synchronous owner-only training export generation for trial-sized datasets; advanced filters, export history UI, and job queues remain deferred.
- RB-054 documents the model prediction and active-learning contract; RB-056 implements the provenance registry; RB-057 implements one-at-a-time prediction mask import; RB-058 implements the first active-learning correction task queue; RB-059 implements assisted correction; RB-060 implements separate prediction-analysis exports; RB-061 implements ZIP-based batch prediction import jobs; RB-065 adds single-host DB leases, stale processing recovery, process-due API support, and an optional Compose worker profile; RB-066 adds temporary staging/presigned-orphan cleanup markers and admin cleanup tooling; RB-067 adds export-time QA metrics without schema changes.
- RB-055 strengthens checksum, dimension, object metadata validation, and audit events for current image/mask/export paths.
- RB-064 adds central role-policy helpers, DB-backed login throttling, same-origin mutation guards, throttled session `lastSeenAt` updates, and broader auth/project/review/provenance audit coverage.
- RB-086 implements persistent source-image BBox proposal versions. RB-087 implements derived crop generation with configurable 32 px default padding, clipped source rectangles, private PNG storage, and app-mediated reads. RB-088 implements crop support-mask editing and artifact lineage. RB-089 implements support-constrained crop semantic masks with exact support-version lineage. RB-090 implements draft auto slice classification suggestions from crop semantic masks plus manual override provenance. RB-091 implements crop-aware training export packages, and RB-092 centralizes crop readiness/review integration without schema changes.

## Related Docs

- [current-to-target-schema-map.md](current-to-target-schema-map.md)
- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [../prisma/schema.md](../prisma/schema.md)
