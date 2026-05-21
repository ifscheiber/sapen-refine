# Mask Format

## Current Format

The current editor upload and persisted artifact format is raw `u8raw-v1` mask bytes.

The upload body contains:

- exactly `width * height` bytes,
- one unsigned byte per image pixel,
- no header,
- no embedded dimensions,
- no embedded label schema.

Dimensions, coordinate space, format, checksum, size, creator, review state, and label schema version are stored on `AnnotationArtifactVersion` in `prisma/schema.prisma`. The current runtime accepts only image-pixel coordinate space where mask dimensions match the target image dimensions.

`src/features/editor/editorMaskUpload.ts` is the current browser editor upload helper. It validates byte length before upload, sends exact raw `Uint8Array` bytes, and adds `x-mask-byte-length` only as diagnostic metadata. Server validation still uses the actual received request body length.

`src/mask/serialize.ts` still provides an older `MSK1` header round-trip helper covered by `tests/unit/mask-serialize.test.ts`. It is a legacy/test compatibility helper and is not the current editor upload body or persisted artifact format.

Current editor upload routes:

- `src/app/api/images/[imageId]/mask/upload/route.ts`
- `src/app/api/images/[imageId]/support-mask/upload/route.ts`
- `src/app/api/correction-tasks/[taskId]/corrections/route.ts`

## Current Labels

`src/mask/labels.ts` defines the MVP label ids:

- `0` - background
- `1` - sapwood
- `2` - heartwood
- `3` - copper
- `10` - slice support geometry in the current seeded support-label schema

These ids mirror the seeded label schema for the current MVP. Persisted artifact versions reference a label schema version; display names and colors are only UI metadata.

## Current Storage

Mask artifacts are stored in S3/MinIO and referenced by `AnnotationArtifactVersion.storageKey` in `prisma/schema.prisma`. App-mediated browser reads stream semantic bytes through `src/app/api/images/[imageId]/mask/versions/[versionId]/asset/route.ts` and support bytes through the support-mask latest asset URL.

## Current Limitations

- The raw artifact body does not embed the label schema; the database `AnnotationArtifactVersion` row references the label schema version.
- Semantic masks and slice support/instance masks are separated by `AnnotationArtifactKind`.
- `MaskKind.REFINED` is removed from the active schema.
- Copper is stored as a semantic label only; it must not be treated as physical slice support geometry.

RB-049 implements the schema baseline. Binary format normalization remains deferred to a later implementation ticket.
