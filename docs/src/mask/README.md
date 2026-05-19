# src/mask

## Purpose

`src/mask` owns current mask labels, mask buffer representation, serialization, patching, tool helpers, and overlay rendering.

## Important Files

- `src/mask/labels.ts` - current label constants and default label colors.
- `src/mask/maskBuffer.ts` - in-memory mask buffer type.
- `src/mask/serialize.ts` - current `u8raw-v1` serialization/deserialization.
- `src/mask/patch.ts` - mask patch helper.
- `src/mask/tools.ts` - tool-related mask helpers.
- `src/mask/renderOverlay.ts` - renders mask labels into overlay image data.

## Public Interfaces / Routes / Functions

- The current editor serializes masks as `u8raw-v1`.
- Mask latest/commit routes live under `src/app/api/images/[imageId]/mask` and persist `AnnotationArtifactVersion` records.

## Invariants And Constraints

- Mask dimensions must match the target image or an explicitly documented coordinate space.
- Semantic mask labels and future instance/support masks must remain conceptually separate.
- Approved ground-truth mask versions must be append-only when review/approval exists.

## Known Gaps

- The binary mask format is still simple `u8raw-v1`, while the database version row now references a label schema version.
- Prisma mask kinds no longer use legacy refinement language; artifact kinds live in `AnnotationArtifactKind`.
- Format compatibility tests are not present yet.
- Copper is currently a semantic material label only. It is not slice support geometry and must stay separate from future support/instance masks.

## Related Tickets / Docs

- [../../known-gaps.md](../../known-gaps.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
