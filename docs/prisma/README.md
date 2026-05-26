# prisma

## Purpose

`prisma` owns the persisted annotation-domain model, migrations, and seed scripts.

## Important Files

- `prisma/schema.prisma` - current database schema.
- `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql` - current development baseline migration.
- `prisma/migrations/20260520134931_prediction_provenance_registry/migration.sql` - RB-056 prediction provenance registry migration.
- `prisma/migrations/20260520204932_prediction_import_batches/migration.sql` - RB-061 prediction import batch/job/item migration.
- `prisma/migrations/20260520213000_prediction_analysis_exports/migration.sql` - RB-060 prediction-analysis export target and provenance item references.
- `prisma/migrations/20260521072000_auth_rbac_audit_hardening/migration.sql` - RB-064 login throttle persistence migration.
- `prisma/migrations/20260521084500_batch_runner_hardening/migration.sql` - RB-065 prediction import batch processor/lease fields and indexes.
- `prisma/migrations/20260521090500_prediction_import_idempotency/migration.sql` - RB-065 batch-item source idempotency key for prediction provenance rows.
- `prisma/migrations/20260521103000_storage_retention_cleanup/migration.sql` - RB-066 batch staging purge markers.
- `prisma/migrations/20260522214000_slice_bbox_proposals/migration.sql` - RB-086 source-image slice BBox proposal persistence.
- `prisma/migrations/20260522223000_derived_slice_crops/migration.sql` - RB-087 derived slice crop persistence and `CROP_PIXEL` coordinate-space extension.
- `prisma/migrations/20260523081500_crop_support_mask_lineage/migration.sql` - RB-088 crop support-mask lineage from artifact versions to derived crops and slice instances.
- `prisma/migrations/20260523110000_crop_semantic_mask_lineage/migration.sql` - RB-089 crop semantic-mask support-version lineage and semantic mode persistence.
- `prisma/migrations/20260523123000_slice_classification_semantic_derivation/migration.sql` - RB-090 slice-classification source/reason and semantic/support/crop lineage persistence.
- `prisma/migrations/20260523133000_crop_training_export_contract/migration.sql` - RB-091 crop training export target and `ExportItem.derivedCropId` provenance links.
- `prisma/migrations/20260523153000_image_crop_workflow_state/migration.sql` - RB-094 image-level BBox set confirmation workflow state.
- `prisma/migrations/20260524090000_review_export_integrity_constraints/migration.sql` - RB-109 review/export DB check constraints and migration preflight checks.
- `prisma/migrations/20260524113000_high_cost_rate_limit_buckets/migration.sql` - RB-111 hashed high-cost write limiter bucket persistence.
- `prisma/migrations/20260524123000_async_export_jobs/migration.sql` - RB-112 async export job statuses, package metadata, processor lease/retry fields, and package metadata backfill.
- `prisma/migrations/20260524124500_export_legacy_created_completed/migration.sql` - RB-112 legacy generated-export compatibility update from `CREATED` to `COMPLETED`.
- `prisma/migrations/20260526213000_image_annotation_review/migration.sql` - image-level annotation review state for whole-image submit/approve/reject workflows.
- `prisma/migrations/20260527110000_artifact_version_mask_stats_metadata/migration.sql` - RB-142 optional `AnnotationArtifactVersion.metadataJson` for version-scoped crop mask stats.
- `prisma/seed.ts` and `prisma/seed.mjs` - local seed scripts.
- `scripts/trial-bootstrap.mjs` - customer-trial bootstrap for global roles and the default label schema without demo users/projects.
- `prisma.config.ts` - Prisma config and environment loading.

## Public Interfaces / Routes / Functions

- Prisma Client is generated with `npx prisma generate`.
- Application DB access goes through `src/server/db.ts`.

## Invariants And Constraints

- Schema changes require docs and tests.
- This repository is still in development stage; local data may be destroyed and the migration baseline may be reset when it removes prototype debt.
- Raw images and mask versions must remain attributable and integrity-checked before database commit where practical.
- Approved mask versions and exports must be append-only and reproducible from stored checksums, dimensions, metadata, review state, exact version references, and completed export package checksum/size metadata.
- Append-only version numbers for `AnnotationArtifactVersion`, `SliceBoundingBoxVersion`, `DerivedSliceCrop`, and `SliceClassificationVersion` are allocated by application writers under RB-107 PostgreSQL transaction advisory locks, with the existing unique constraints acting as a final guard.
- `ReviewDecision` rows have a DB-enforced exact-one-target check: exactly one of `artifactVersionId` or `sliceClassificationVersionId` must be present.
- Current stable `ExportItem.role` values have DB-enforced reference-shape checks for image, full-image artifact/classification, crop, prediction proposal, correction reference, and approved-reference rows. The role/reference matrix is documented in `docs/prisma/schema.md`; unknown future roles remain unconstrained until their semantics are explicitly modeled.
- Model predictions remain provenance/proposal records until a human creates and approves separate ground-truth artifact or classification versions.
- `AuthLoginThrottle` stores hashed login failure buckets only; it must not store raw email or IP values.
- `HighCostRateLimitBucket` stores hashed route-family/user/scope buckets for expensive authenticated write limits. It must not store raw user ids, project ids, request bodies, object keys, or uploaded contents.
- `PredictionImportBatchItem` leases are for single-host trial background import processing only. `SUCCEEDED` items are terminal and must not be reprocessed into duplicate prediction artifacts.
- `PredictionImportBatchItem.stagingPurgedAt` marks temporary source objects deleted by cleanup. Purged failed/skipped items cannot be reset for retry without re-uploading source data.
- `SliceBoundingBoxVersion` rows are append-only proposal history. Replacement appends a new active version; deletion appends a `DELETED` version. BBoxes use `CoordinateSpace.SOURCE_IMAGE_PIXEL` and are not support masks.
- `ImageCropWorkflowState` stores one image-level BBox set workflow state row per image. It snapshots confirmed active BBox version ids and is marked `NEEDS_UPDATE` when confirmed BBoxes change.
- `ImageAnnotationReview` stores one image-level annotation review row per image. It snapshots the crop support, crop semantic, and slice-classification version ids submitted/reviewed by the image-level workflow while the underlying artifact/classification versions keep their existing review states for export compatibility.
- `DerivedSliceCrop` rows are append-only crop versions per slice instance. They reference the source image, source checksum/dimensions, exact BBox version, private crop PNG object, `CoordinateSpace.CROP_PIXEL`, requested/applied padding, clipping state, and transform metadata. They are not raw image uploads and not support geometry.
- Crop support masks are crop-scoped `SLICE_SUPPORT_MASK` artifact versions. `AnnotationArtifactVersion.derivedCropId` and `sliceInstanceId` link each saved `CROP_PIXEL` mask to the selected `DerivedSliceCrop` and `SliceInstance`.
- Crop semantic masks are crop-scoped `SEMANTIC_MASK` artifact versions. `AnnotationArtifactVersion.supportMaskVersionId` references the exact crop support-mask version used as the editing constraint, and `cropSemanticMode` records whether the crop semantic draft is `SAP_HEARTWOOD` or `COPPER`.
- Crop support and crop semantic artifact versions may store immutable `metadataJson` mask statistics generated at save time. Readiness and family checks can use those stats before falling back to object-storage byte reads for legacy or stale rows.
- Auto-derived crop classifications are draft `SliceClassificationVersion` rows with `source = AUTO_FROM_SEMANTIC_MASK`, a stable derivation reason, and links to the source semantic mask, support mask, and crop. Manual crop overrides append separate `source = MANUAL` rows.
- `ExportTarget.CROP_TRAINING` records RB-091 crop ground-truth packages. `ExportItem.derivedCropId` links crop package rows back to the exact `DerivedSliceCrop` used for original image, crop PNG, crop support-mask, crop semantic-mask, and crop classification roles.
- `ExportItem.predictionProvenanceId` is required for constrained prediction-analysis item roles except the shared `image` role, where it remains optional because full-image training exports and prediction-analysis exports both use that role.
- `ExportBatch.status`, `jobAttemptCount`, `jobMaxAttempts`, `nextRetryAt`, `processorId`, `processorRunId`, `leaseExpiresAt`, and processing/completion/failure timestamps model RB-112 single-host export jobs. New exports are queued as `PENDING`; downloads are available only after `COMPLETED`. Legacy generated `CREATED` exports with package objects are migrated to `COMPLETED`.

## Known Gaps

- Project/image metadata, default slice support/classification, source-image BBox slice proposals, derived slice crop generation, review, async training export jobs, upload/artifact validation, prediction provenance registry, one-at-a-time prediction mask import, active-learning queue, assisted correction, async prediction-analysis export jobs with QA metrics, ZIP batch prediction import, single-host batch/export worker leases, auth/RBAC/audit hardening, and temporary storage cleanup workflows exist for the MVP path.
- Crop support-mask editing exists after RB-088, mode-aware crop semantic editing exists after RB-089/RB-100, draft auto classification suggestions from crop semantics exist after RB-090, crop-aware training export exists after RB-091, and central crop review/readiness exists after RB-092. Slice-specific metadata, source-image-space crop-mask reprojection, advanced export policy/history, metric dashboards/reports, cleanup UI, production-scale queue infrastructure, and slice-classification batch prediction import remain deferred.
- `MaskKind.REFINED` has been removed from the active schema.

## Related Tickets / Docs

- [schema.md](schema.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma-schema-proposal.md](../06-data/prisma-schema-proposal.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
