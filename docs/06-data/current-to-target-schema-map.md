# Current-To-Target Schema Map

## Purpose

This page records the RB-049 decisions for replacing the MVP persistence model with the annotation-domain baseline.

## Mapping

| MVP concept | RB-049 decision | Implemented target |
| --- | --- | --- |
| `Project` | Replaced after development DB reset. | `AnnotationProject` in `prisma/schema.prisma`. Existing URLs still use `/projects` for browser compatibility. |
| `ProjectMember` | Replaced after development DB reset. | `AnnotationProjectMember` with `AnnotationProjectRole`. |
| `ProjectRole` | Replaced after development DB reset. | `AnnotationProjectRole` with `OWNER`, `QA`, `LABELER`, `VIEWER`. RB-052 enforces submit/review permissions; export authorization remains RB-053 work. |
| `Image` | Replaced after development DB reset. | `ImageAsset` with storage key, size/content type, optional checksum/dimensions, validation state, uploadedBy/uploadedAt, and metadata relations. |
| `Mask` | Replaced after development DB reset. | `AnnotationArtifact` with `AnnotationArtifactKind` and scoped uniqueness by image/kind/scopeKey. |
| `MaskVersion` | Replaced after development DB reset. | `AnnotationArtifactVersion` with label schema version, review state, provenance, coordinate space, storage metadata, actor attribution, and source/parent support. |
| `MaskKind.PREDICTION` | Replaced. | `AnnotationArtifactKind.PREDICTION_MASK` plus future prediction provenance fields. |
| `MaskKind.REFINED` | Removed. | Current editor saves map to `AnnotationArtifactKind.SEMANTIC_MASK` versions with `ArtifactReviewState.DRAFT` and `ArtifactProvenance.HUMAN_ANNOTATION`. |
| Current upload/read/commit routes | Kept as compatibility API surface. | Route handlers now persist `ImageAsset`, `AnnotationArtifact`, and `AnnotationArtifactVersion`. |
| Current user/session attribution | Kept and extended. | `User`, `Role`, `UserGlobalRole`, `Session`, and `AuditLog` remain; image, artifact, review, and export records now include actor fields. |

## Compatibility Layer

The public browser route/API language remains project/image/mask oriented for RB-049 so the desktop E2E flow stays stable:

```text
login -> project -> upload -> editor -> draw -> save -> reload -> mask persistence
```

Internally, the current editor mask path now writes a semantic annotation artifact:

- `AnnotationArtifact.kind = SEMANTIC_MASK`
- `AnnotationArtifact.scopeKey = default`
- `AnnotationArtifactVersion.reviewState = DRAFT`
- `AnnotationArtifactVersion.provenance = HUMAN_ANNOTATION`

This is intentional compatibility, not legacy `MaskKind.REFINED` semantics.

## Rebuild Decision

RB-049 replaces the previous development baseline migration with:

```text
prisma/migrations/20260519213000_annotation_domain_baseline/migration.sql
```

Local data preservation is not attempted. Use:

```bash
npm run db:rebuild
```

Trial/server deployment still uses `prisma migrate deploy`, not `prisma migrate dev`.

## Related Docs

- [prisma.md](prisma.md)
- [prisma-schema-proposal.md](prisma-schema-proposal.md)
- [annotation-domain-model.md](annotation-domain-model.md)
