# Prisma Schema

## Purpose

This page summarizes the current persisted model in `prisma/schema.prisma`.

## Important Files

- `prisma/schema.prisma` - model definitions.
- `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql` - current development baseline migration.
- `prisma/migrations/20260519233000_review_classification_decisions/migration.sql` - RB-052 review decision target extension.
- `prisma/seed.mjs` - active Prisma seed command from `prisma.config.ts`.
- `src/server/db.ts` - Prisma client setup.

## Current Model Summary

- `User`, `Role`, `UserGlobalRole`, `Session` - local identity, global roles, and sessions.
- `AnnotationProject`, `AnnotationProjectMember` - standalone annotation project and membership/access boundary.
- `LabelSchemaVersion`, `LabelDefinition` - versioned label definitions with stable machine-readable ids.
- `ImageAsset`, `ImageAcquisitionMetadata`, `SampleMetadata` - immutable image asset references plus RB-050 image-level acquisition/default sample metadata workflow storage.
- `AnnotationTask`, `AnnotationSession` - assignment/edit context baseline with priority, confidence/uncertainty, and model-source placeholders.
- `AnnotationArtifact`, `AnnotationArtifactVersion` - semantic/support/instance/prediction/derived artifact baseline; RB-051 uses semantic and default slice-support artifacts.
- `SliceInstance`, `SliceClassificationVersion` - physical slice object and classification baseline; RB-051 uses one default slice instance per image.
- `ReviewDecision` - review/approval decisions for artifact versions and slice classification versions.
- `ExportBatch`, `ExportItem` - RB-053 export batch persistence, manifest/package metadata, warnings, actor attribution, and exact exported version references.
- `AuditLog` - generic audit rows, still not exhaustively used by all mutation routes.

## Invariants And Constraints

- `ImageAsset.storageKey` and `AnnotationArtifactVersion.storageKey` are unique.
- `AnnotationArtifactVersion` is versioned per `AnnotationArtifact`.
- `AnnotationArtifact` is unique by `(imageId, kind, scopeKey)` so the current editor has one default semantic mask artifact and one default slice-support artifact per image.
- Every annotation artifact version references exactly one `LabelSchemaVersion`.
- `AnnotationArtifactKind.SEMANTIC_MASK` is separate from `SLICE_SUPPORT_MASK` and `INSTANCE_MASK`.
- Copper is a semantic label in the default label schema and is not support geometry.
- `ReviewDecision` targets either an `AnnotationArtifactVersion` or a `SliceClassificationVersion`; the exact-one-target invariant is enforced by `src/server/domain/review.ts`.

## Known Gaps

- Slice-specific metadata and multi-slice/multi-object editing remain deferred.
- One-default-slice support/classification workflows exist after RB-051.
- Review/approval is implemented as a minimal RB-052 workflow; reviewer dashboards and bulk review remain deferred.
- RB-053 implements synchronous owner-only export generation; advanced filters, export history UI, QA export policy, and job queues remain deferred.
- Checksum/dimension enforcement remains RB-055.

## Related Tickets / Docs

- [README.md](README.md)
- [../06-data/current-to-target-schema-map.md](../06-data/current-to-target-schema-map.md)
- [../06-data/prisma.md](../06-data/prisma.md)
- [../known-gaps.md](../known-gaps.md)
