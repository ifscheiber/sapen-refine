# Prisma Data Model

## Purpose

This page summarizes the RB-049 persisted annotation-domain baseline. The exact schema source is `prisma/schema.prisma`; the current development baseline migration is `prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql`.

RB-049 intentionally replaces the previous MVP migration. There is no production data, so local development uses a destructive rebuild instead of preservation migrations.

## Current Persisted Model

- `User`, `Role`, `UserGlobalRole`, and `Session` support local authentication and global roles.
- `AnnotationProject` and `AnnotationProjectMember` are the standalone annotation project and membership boundary.
- `LabelSchemaVersion` and `LabelDefinition` persist stable machine-readable label ids, semantic meanings, UI metadata, and task applicability.
- `ImageAsset`, `ImageAcquisitionMetadata`, and `SampleMetadata` persist immutable image references plus metadata structures for RB-050.
- `AnnotationTask` and `AnnotationSession` provide the persistence baseline for assignment, future active-learning/preprediction fields, and edit context.
- `AnnotationArtifact` and `AnnotationArtifactVersion` replace `Mask`/`MaskVersion` and separate semantic, support/instance, prediction, and derived artifact families.
- `SliceInstance` and `SliceClassificationVersion` provide the persistence baseline for RB-051.
- `ReviewDecision` and `ArtifactReviewState` provide the persistence baseline for draft/submitted/approved/rejected/superseded ground-truth state.
- `ExportBatch` and `ExportItem` provide the persistence baseline for RB-053 export manifests.
- `AuditLog` remains available for explicit audit events and is not yet a complete audit trail.

## Current Compatibility Behavior

Existing browser URLs and APIs still use project/image/mask language. Route handlers now map those writes to the new schema:

- project routes use `AnnotationProject`,
- image routes use `ImageAsset`,
- current editor mask saves create or append to a `SEMANTIC_MASK` `AnnotationArtifact`,
- latest-mask reads return the latest `AnnotationArtifactVersion` for the default semantic mask scope.

`MaskKind.REFINED` is removed from the Prisma schema. Current editor saves are draft human semantic mask versions, not refinement artifacts.

## Rebuild Path

Use the destructive development rebuild after pulling RB-049 schema changes:

```bash
npm run db:rebuild
```

The command removes local Docker volumes, recreates PostgreSQL/MinIO, applies `prisma migrate deploy`, and runs `node prisma/seed.mjs`.

## Seed Baseline

`prisma/seed.mjs` creates:

- global `ADMIN` and `USER` roles,
- local admin and labeler users,
- one default label schema version,
- default semantic/support/classification labels,
- `demo_project` with owner/labeler memberships.

The default label schema includes stable ids for `background`, `unknown`, `sapwood`, `heartwood`, `copper`, `slice_support`, `review_required`, and slice classification labels.

## Known Deferred Work

- RB-050 implements full metadata UI/API workflow.
- RB-051 implements slice classification/support-mask user workflows.
- RB-052 implements review/approval UI/API behavior.
- RB-053 implements export generation.
- RB-055 strengthens checksum and object metadata validation.

## Related Docs

- [current-to-target-schema-map.md](current-to-target-schema-map.md)
- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [annotation-domain-model.md](annotation-domain-model.md)
- [../prisma/schema.md](../prisma/schema.md)
