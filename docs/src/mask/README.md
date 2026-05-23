# src/mask

## Purpose

`src/mask` owns current mask labels, mask buffer representation, serialization, patching, tool helpers, and overlay rendering.

## Important Files

- `src/mask/labels.ts` - current semantic/support label constants and default label colors.
- `src/mask/maskBuffer.ts` - in-memory mask buffer type.
- `src/mask/serialize.ts` - legacy/test `MSK1` header serialization/deserialization helper.
- `src/mask/patch.ts` - mask patch helper.
- `src/mask/tools.ts` - tool-related mask helpers.
- `src/mask/renderOverlay.ts` - renders mask labels into overlay image data.

## Public Interfaces / Routes / Functions

- The current editor serializes semantic and support masks as `u8raw-v1` raw byte arrays.
- Current editor upload bodies are exactly `width * height` raw bytes with no `MSK1` header. `src/features/editor/editorMaskUpload.ts` owns the browser upload payload/header construction.
- Semantic mask latest/commit routes live under `src/app/api/images/[imageId]/mask`.
- Support-mask latest/upload routes live under `src/app/api/images/[imageId]/support-mask`.
- Crop support-mask latest/upload routes live under `src/app/api/slice-crops/[cropId]/support-mask`.
- Crop semantic-mask latest/upload routes live under `src/app/api/slice-crops/[cropId]/semantic-mask`.
- These paths persist `AnnotationArtifactVersion` records with explicit artifact kind and label schema version.
- RB-055 upload helpers validate `u8raw-v1` byte length, checksum, dimensions, and support-mask label values before persisting version rows.

## Invariants And Constraints

- Mask dimensions must match the target image or an explicitly documented coordinate space.
- Default full-image mask coordinate space is `IMAGE_PIXEL`. RB-086 BBox proposals use `SOURCE_IMAGE_PIXEL`, RB-087 derived crops use `CROP_PIXEL`, RB-088 crop support-mask artifacts use `CROP_PIXEL`, and RB-089 crop semantic-mask artifacts use `CROP_PIXEL` with dimensions matching their selected crop.
- Semantic mask labels and support/instance masks must remain conceptually separate.
- Support-mask bytes may contain only `0` and the active `slice_support` byte.
- Crop support-mask bytes follow the same binary support values and must not interpret crop padding as support geometry.
- Crop semantic-mask bytes must use mode-specific semantic labels. Sap/Heartwood bytes may be supportless and use non-background semantic foreground as support geometry. Copper bytes may be saved as drafts without support, but Copper readiness/export requires explicit support and rejects foreground outside approved support.
- Crop editor brush and polygon tools use crop-pixel coordinates. `src/features/editor/cropMaskOperations.ts` wraps the shared `src/mask/tools.ts` mutation helpers so Copper semantic brush and lasso fills can be clipped to explicit support while Sap/Heartwood and support-mask edits remain unconstrained in crop space.
- RB-070 editor erasing uses existing mask tool mutation paths: semantic erasing writes `Labels.BG`, and support-mask erasing writes the current support background value.
- Approved ground-truth mask versions must be append-only when review/approval exists.

## Known Gaps

- The persisted mask body is still simple raw `u8raw-v1`, while the database version row references a label schema version.
- Prisma mask kinds no longer use legacy refinement language; artifact kinds live in `AnnotationArtifactKind`.
- Format compatibility tests are not present yet.
- Copper is a semantic material label only. It is not slice support geometry and must stay separate from support/instance masks.

## Related Tickets / Docs

- [../../known-gaps.md](../../known-gaps.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
