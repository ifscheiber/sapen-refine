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

Mask artifacts are stored in S3/MinIO and referenced by `MaskVersion.storageKey` in `prisma/schema.prisma`. App-mediated browser reads stream the bytes through `src/app/api/images/[imageId]/mask/versions/[versionId]/asset/route.ts`.

## Current Limitations

- The current format does not embed or reference a persisted label schema version.
- Semantic masks and future slice support/instance masks are not separated in the database yet.
- `MaskKind.REFINED` is legacy MVP terminology and does not express whether a mask is draft ground truth, approved ground truth, prediction, or support geometry.
- Copper is currently stored as a semantic label only; it must not be treated as physical slice support geometry.

RB-048 documents the target mask/artifact model only. Format or schema migration remains deferred to a later implementation ticket.
