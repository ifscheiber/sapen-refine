# Mask Format

## Current Format

Current mask serialization uses the `MSK1` header and `u8raw-v1` style label bytes through `src/mask/serialize.ts`.

The binary layout is:

- 4-byte magic value `MSK1`
- 4-byte big-endian width
- 4-byte big-endian height
- `width * height` bytes of label ids

`tests/unit/mask-serialize.test.ts` covers round-trip serialization and invalid headers.

## Current Labels

`src/mask/labels.ts` defines the MVP label ids:

- `0` - background
- `1` - sapwood
- `2` - heartwood
- `3` - copper

These ids are currently code constants, not persisted label-schema records. Display names and colors are only UI metadata.

## Current Storage

Mask artifacts are stored in S3/MinIO and referenced by `AnnotationArtifactVersion.storageKey` in `prisma/schema.prisma`. App-mediated browser reads stream the bytes through `src/app/api/images/[imageId]/mask/versions/[versionId]/asset/route.ts`.

## Current Limitations

- The binary format does not embed the label schema; the database `AnnotationArtifactVersion` row references the label schema version.
- Semantic masks and slice support/instance masks are separated by `AnnotationArtifactKind`.
- `MaskKind.REFINED` is removed from the active schema.
- Copper is stored as a semantic label only; it must not be treated as physical slice support geometry.

RB-049 implements the schema baseline. Binary format normalization remains deferred to a later implementation ticket.
