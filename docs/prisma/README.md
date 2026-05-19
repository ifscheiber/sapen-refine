# prisma

## Purpose

`prisma` owns the persisted annotation-domain model, migrations, and seed scripts.

## Important Files

- `prisma/schema.prisma` - current database schema.
- `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql` - current development baseline migration.
- `prisma/seed.ts` and `prisma/seed.mjs` - local seed scripts.
- `prisma.config.ts` - Prisma config and environment loading.

## Public Interfaces / Routes / Functions

- Prisma Client is generated with `npx prisma generate`.
- Application DB access goes through `src/server/db.ts`.

## Invariants And Constraints

- Schema changes require docs and tests.
- This repository is still in development stage; local data may be destroyed and the migration baseline may be reset when it removes prototype debt.
- Raw images and mask versions must remain attributable.
- Future approved mask versions and exports must be append-only and reproducible.

## Known Gaps

- Project/image metadata workflow exists for image-level acquisition and default sample metadata.
- Slice-specific metadata, review, slice support, and export workflows remain split across RB-051 through RB-055.
- `MaskKind.REFINED` has been removed from the active schema.

## Related Tickets / Docs

- [schema.md](schema.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma-schema-proposal.md](../06-data/prisma-schema-proposal.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
