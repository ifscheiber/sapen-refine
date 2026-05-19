# Prisma Schema

## Purpose

This page summarizes the current persisted model in `prisma/schema.prisma`.

## Important Files

- `prisma/schema.prisma` - model definitions.
- `src/server/db.ts` - Prisma client setup.

## Current Model Summary

- `User`, `Role`, `UserGlobalRole` - local user and global role records.
- `Session` - hashed session tokens, expiry, revocation, user agent, and IP.
- `Project`, `ProjectMember` - project container and role-based membership.
- `Image` - raw uploaded object metadata and project ownership.
- `Mask`, `MaskVersion` - mask container and append-only version rows.
- `AuditLog` - audit row structure, not yet consistently used.

## Current MVP Mapping

- `Project` maps to the future standalone annotation project concept, but currently lacks label schema, export, and workflow settings.
- `Image` maps to the future immutable image asset concept, but currently lacks checksum, dimensions, acquisition metadata, sample metadata, and validation state.
- `Mask` maps only to a current per-image/per-kind container. It is not yet the final semantic/support/prediction artifact model.
- `MaskVersion` maps to an append-only artifact version, but currently lacks label schema version, review status, provenance kind, parent/source version, and accepted/exported state.
- `MaskKind.REFINED` maps to the current human-edited mask save path. It should not become final terminology for standalone scratch annotation.

## Invariants And Constraints

- `Image.storageKey` and `MaskVersion.storageKey` are unique.
- `MaskVersion` is versioned per `Mask`.
- Project membership gates protected project/image/mask access.

## Known Gaps

- No first-class acquisition metadata model.
- No annotation task model.
- No review/approval model.
- No export batch or manifest model.
- No versioned label-schema model.

## Related Tickets / Docs

- [README.md](README.md)
- [../known-gaps.md](../known-gaps.md)
