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
- `prisma/seed.ts` and `prisma/seed.mjs` - local seed scripts.
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

## Known Gaps

- Project/image metadata, default slice support/classification, review, training export, upload/artifact validation, prediction provenance registry, one-at-a-time prediction mask import, active-learning queue, assisted correction, prediction-analysis export, ZIP batch prediction import, single-host batch worker leases, and auth/RBAC/audit hardening workflows exist for the MVP path.
- Slice-specific metadata, multi-slice editing, advanced export policy/history, metrics dashboards, staging cleanup, production-scale queue infrastructure, and slice-classification batch prediction import remain deferred.
- `MaskKind.REFINED` has been removed from the active schema.

## Related Tickets / Docs

- [schema.md](schema.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma-schema-proposal.md](../06-data/prisma-schema-proposal.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
