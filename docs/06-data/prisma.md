# Prisma Data Model

## Purpose

This page summarizes the current persisted model before annotation-domain schema implementation. The exact schema source is `prisma/schema.prisma`; the current development baseline migration is `prisma/migrations/20260519090000_init/migration.sql`.

RB-048 documents the target model only. It does not change `prisma/schema.prisma` and does not add a migration.

## Current Persisted Model

- `User`, `Role`, `UserGlobalRole`, and `Session` support local authentication and global roles.
- `Project` and `ProjectMember` are the current collaboration and authorization boundary.
- `Image` stores one immutable raw object reference per project plus filename, content type, size, creation time, and optional creator.
- `Mask` groups version rows for one image and one `MaskKind`.
- `MaskVersion` stores append-only mask artifacts with storage key, version number, size, dimensions, format, creator, and timestamp.
- `AuditLog` is present but not consistently populated by current route handlers.

## Current Relationships

- A `Project` has many `ProjectMember` rows and many `Image` rows.
- An `Image` belongs to exactly one `Project` and has many `Mask` rows.
- A `Mask` belongs to exactly one `Image` and is unique by `(imageId, kind)`.
- A `MaskVersion` belongs to exactly one `Mask` and is unique by `(maskId, version)`.
- `Image.createdById`, `MaskVersion.createdById`, and `AuditLog.actorId` currently point to `User` with nullable attribution on delete.

## Current Constraints

- `Image.storageKey` and `MaskVersion.storageKey` are unique.
- `MaskKind` currently contains `PREDICTION` and `REFINED`.
- Current route handlers use `MaskKind.REFINED` as the latest human-edited mask container.
- There is no first-class label schema, task, review state, approval record, export batch, slice instance, or sample/acquisition metadata table.

## Target Direction

The planned annotation-domain implementation should introduce explicit concepts for label schema versions, semantic mask versions, support/instance mask versions, slice classifications, annotation tasks, review/approval state, export manifests, and prediction provenance.

Because this repository is still in development, later implementation tickets may reset local development data and replace the single baseline migration. That reset belongs to the schema implementation ticket, not RB-048.

## Related Docs

- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [../prisma/schema.md](../prisma/schema.md)
