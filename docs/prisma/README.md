# prisma

## Purpose

`prisma` owns the persisted annotation-domain model, migrations, and seed scripts.

## Important Files

- `prisma/schema.prisma` - current database schema.
- `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql` - current development baseline migration.
- `prisma/migrations/20260520134931_prediction_provenance_registry/migration.sql` - RB-056 prediction provenance registry migration.
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

## Known Gaps

- Project/image metadata, default slice support/classification, review, export, upload/artifact validation, and prediction provenance registry workflows exist for the MVP path.
- Slice-specific metadata, multi-slice editing, advanced export policy, prediction file import, active-learning queues, and assisted correction UI remain deferred.
- `MaskKind.REFINED` has been removed from the active schema.

## Related Tickets / Docs

- [schema.md](schema.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma-schema-proposal.md](../06-data/prisma-schema-proposal.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
