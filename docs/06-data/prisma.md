# Prisma Data Model

## Purpose

This page summarizes the RB-049 persisted annotation-domain baseline plus RB-050 through RB-058 workflow and provenance extensions. The exact schema source is `prisma/schema.prisma`; migrations live under `prisma/migrations`.

RB-049 intentionally replaces the previous MVP migration. There is no production data, so local development uses a destructive rebuild instead of preservation migrations.

## Current Persisted Model

- `User`, `Role`, `UserGlobalRole`, and `Session` support local authentication and global roles.
- `AnnotationProject` and `AnnotationProjectMember` are the standalone annotation project and membership boundary.
- `LabelSchemaVersion` and `LabelDefinition` persist stable machine-readable label ids, semantic meanings, UI metadata, and task applicability.
- `ImageAsset`, `ImageAcquisitionMetadata`, and `SampleMetadata` persist immutable image references plus the RB-050 image-level metadata workflow.
- `AnnotationTask` and `AnnotationSession` provide the persistence baseline for assignment, active-learning/preprediction fields, and edit context. RB-058 adds a unique correction-task link for `predictionProvenanceId + type`.
- `AnnotationArtifact` and `AnnotationArtifactVersion` replace `Mask`/`MaskVersion` and separate semantic, support/instance, prediction, and derived artifact families.
- `SliceInstance` and `SliceClassificationVersion` provide the persistence baseline for RB-051.
- `ReviewDecision` and `ArtifactReviewState` provide the persistence and workflow baseline for draft/submitted/approved/rejected/superseded ground-truth state. RB-052 decisions can target artifact versions or slice classification versions.
- `ExportBatch` and `ExportItem` persist RB-053 training export batches, manifest/package metadata, warnings, actor attribution, and exact exported version references.
- `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance` persist RB-056 model/checkpoint/training provenance, project-scoped inference runs, and per-image prediction proposal metadata.
- `AuditLog` records explicit RB-055 audit events for upload acceptance/rejection, mask commits/validation failures, export creation, and export downloads. It is not yet a complete audit trail for every mutation route.

## Current Compatibility Behavior

Existing browser URLs and APIs still use project/image/mask language. Route handlers now map those writes to the new schema:

- project routes use `AnnotationProject`,
- image routes use `ImageAsset`,
- image metadata routes use `ImageAcquisitionMetadata` and image-level/default `SampleMetadata`,
- current editor mask saves create or append to a `SEMANTIC_MASK` `AnnotationArtifact`,
- support-mask editor saves create or append to a `SLICE_SUPPORT_MASK` `AnnotationArtifact`,
- slice classification writes create `SliceClassificationVersion` rows for the default `SliceInstance`,
- review routes update `reviewState` and append `ReviewDecision` rows for semantic masks, support masks, and slice classifications,
- upload routes persist verified `ImageAsset` checksums/dimensions/status for PNG/JPEG images,
- prediction provenance routes create/read `ModelRun` and project-scoped `PredictionRun` records without importing prediction bytes,
- correction-task routes create/read/update `MODEL_PREDICTION_CORRECTION` `AnnotationTask` rows linked to prediction provenance,
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

## Known Deferred Work

- RB-050 implements project/image metadata UI/API workflow for image-level acquisition and default sample metadata.
- RB-051 implements one-default-slice classification/support-mask user workflow.
- RB-052 implements minimal review/approval UI/API behavior; bulk review and reviewer dashboards remain deferred.
- RB-053 implements synchronous owner-only training export generation for trial-sized datasets; advanced filters, QA export policy, export history UI, and job queues remain deferred.
- RB-054 documents the future model prediction and active-learning contract; RB-056 implements the provenance registry; RB-057 implements one-at-a-time prediction mask import; RB-058 implements the first active-learning correction task queue. Assisted correction UI, prediction-analysis exports, and batch imports remain deferred.
- RB-055 strengthens checksum, dimension, object metadata validation, and audit events for current image/mask/export paths.

## Related Docs

- [current-to-target-schema-map.md](current-to-target-schema-map.md)
- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [../prisma/schema.md](../prisma/schema.md)
