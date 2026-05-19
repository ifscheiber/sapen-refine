# Prisma Data Model

See `docs/prisma/schema.md` for the current persisted model.

RB-044 replaces stale prototype migration history with a single development baseline migration at `prisma/migrations/20260519090000_init/migration.sql`. This does not change the domain schema; it makes fresh local DB rebuilds deterministic.

Domain expansion remains deferred.
