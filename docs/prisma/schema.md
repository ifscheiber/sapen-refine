# Prisma Schema

## Purpose

This page summarizes the current persisted model in `prisma/schema.prisma`.

## Important Files

- `prisma/schema.prisma` - model definitions.
- `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql` - current development baseline migration.
- `prisma/seed.mjs` - active Prisma seed command from `prisma.config.ts`.
- `src/server/db.ts` - Prisma client setup.

## Current Model Summary

- `User`, `Role`, `UserGlobalRole`, `Session` - local identity, global roles, and sessions.
- `AnnotationProject`, `AnnotationProjectMember` - standalone annotation project and membership/access boundary.
- `LabelSchemaVersion`, `LabelDefinition` - versioned label definitions with stable machine-readable ids.
- `ImageAsset`, `ImageAcquisitionMetadata`, `SampleMetadata` - immutable image asset references and metadata structures.
- `AnnotationTask`, `AnnotationSession` - assignment/edit context baseline with priority, confidence/uncertainty, and model-source placeholders.
- `AnnotationArtifact`, `AnnotationArtifactVersion` - semantic/support/instance/prediction/derived artifact baseline.
- `SliceInstance`, `SliceClassificationVersion` - physical slice object and classification baseline.
- `ReviewDecision` - review/approval decision baseline.
- `ExportBatch`, `ExportItem` - export persistence baseline.
- `AuditLog` - generic audit rows, still not exhaustively used by all mutation routes.

## Invariants And Constraints

- `ImageAsset.storageKey` and `AnnotationArtifactVersion.storageKey` are unique.
- `AnnotationArtifactVersion` is versioned per `AnnotationArtifact`.
- `AnnotationArtifact` is unique by `(imageId, kind, scopeKey)` so the current editor has one default semantic mask artifact per image.
- Every annotation artifact version references exactly one `LabelSchemaVersion`.
- `AnnotationArtifactKind.SEMANTIC_MASK` is separate from `SLICE_SUPPORT_MASK` and `INSTANCE_MASK`.
- Copper is a semantic label in the default label schema and is not support geometry.

## Known Gaps

- Metadata capture UI remains RB-050.
- Slice support/classification workflows remain RB-051.
- Review/approval workflows remain RB-052.
- Export generation remains RB-053.
- Checksum/dimension enforcement remains RB-055.

## Related Tickets / Docs

- [README.md](README.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../known-gaps.md](../known-gaps.md)
