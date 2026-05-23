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
- Approved mask versions and exports must be append-only and reproducible from stored checksums, dimensions, metadata, review state, and exact version references.
- Model predictions remain provenance/proposal records until a human creates and approves separate ground-truth artifact or classification versions.
- `AuthLoginThrottle` stores hashed login failure buckets only; it must not store raw email or IP values.
- `PredictionImportBatchItem` leases are for single-host trial background import processing only. `SUCCEEDED` items are terminal and must not be reprocessed into duplicate prediction artifacts.
- `PredictionImportBatchItem.stagingPurgedAt` marks temporary source objects deleted by cleanup. Purged failed/skipped items cannot be reset for retry without re-uploading source data.
- `SliceBoundingBoxVersion` rows are append-only proposal history. Replacement appends a new active version; deletion appends a `DELETED` version. BBoxes use `CoordinateSpace.SOURCE_IMAGE_PIXEL` and are not support masks.
- `ImageCropWorkflowState` stores one image-level BBox set workflow state row per image. It snapshots confirmed active BBox version ids and is marked `NEEDS_UPDATE` when confirmed BBoxes change.
- `DerivedSliceCrop` rows are append-only crop versions per slice instance. They reference the source image, source checksum/dimensions, exact BBox version, private crop PNG object, `CoordinateSpace.CROP_PIXEL`, requested/applied padding, clipping state, and transform metadata. They are not raw image uploads and not support geometry.
- Crop support masks are crop-scoped `SLICE_SUPPORT_MASK` artifact versions. `AnnotationArtifactVersion.derivedCropId` and `sliceInstanceId` link each saved `CROP_PIXEL` mask to the selected `DerivedSliceCrop` and `SliceInstance`.
- Crop semantic masks are crop-scoped `SEMANTIC_MASK` artifact versions. `AnnotationArtifactVersion.supportMaskVersionId` references the exact crop support-mask version used as the editing constraint, and `cropSemanticMode` records whether the crop semantic draft is `SAP_HEARTWOOD` or `COPPER`.
- Auto-derived crop classifications are draft `SliceClassificationVersion` rows with `source = AUTO_FROM_SEMANTIC_MASK`, a stable derivation reason, and links to the source semantic mask, support mask, and crop. Manual crop overrides append separate `source = MANUAL` rows.
- `ExportTarget.CROP_TRAINING` records RB-091 crop ground-truth packages. `ExportItem.derivedCropId` links crop package rows back to the exact `DerivedSliceCrop` used for original image, crop PNG, crop support-mask, crop semantic-mask, and crop classification roles.

## Known Gaps

- Project/image metadata, default slice support/classification, source-image BBox slice proposals, derived slice crop generation, review, training export, upload/artifact validation, prediction provenance registry, one-at-a-time prediction mask import, active-learning queue, assisted correction, prediction-analysis export with QA metrics, ZIP batch prediction import, single-host batch worker leases, auth/RBAC/audit hardening, and temporary storage cleanup workflows exist for the MVP path.
- Crop support-mask editing exists after RB-088, mode-aware crop semantic editing exists after RB-089/RB-100, draft auto classification suggestions from crop semantics exist after RB-090, crop-aware training export exists after RB-091, and central crop review/readiness exists after RB-092. Slice-specific metadata, source-image-space crop-mask reprojection, advanced export policy/history, metric dashboards/reports, cleanup UI, production-scale queue infrastructure, and slice-classification batch prediction import remain deferred.
- `MaskKind.REFINED` has been removed from the active schema.

## Related Tickets / Docs

- [schema.md](schema.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma-schema-proposal.md](../06-data/prisma-schema-proposal.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
