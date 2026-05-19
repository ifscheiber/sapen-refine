# prisma

## Purpose

`prisma` owns the persisted MVP domain model, migrations, and seed scripts.

## Important Files

- `prisma/schema.prisma` - current database schema.
- `prisma/migrations/**/migration.sql` - migration history.
- `prisma/seed.ts` and `prisma/seed.mjs` - local seed scripts.
- `prisma.config.ts` - Prisma config and environment loading.

## Public Interfaces / Routes / Functions

- Prisma Client is generated with `npx prisma generate`.
- Application DB access goes through `src/server/db.ts`.

## Invariants And Constraints

- Schema changes require docs and tests.
- Raw images and mask versions must remain attributable.
- Future approved mask versions and exports must be append-only and reproducible.

## Known Gaps

- Current schema is MVP-level and lacks final annotation metadata, task, review, approval, label-schema, and export models.
- Legacy `MaskKind.REFINED` naming remains in the schema, migrations, and current mask route handlers until a schema/domain ticket changes it.

## Related Tickets / Docs

- [schema.md](schema.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
