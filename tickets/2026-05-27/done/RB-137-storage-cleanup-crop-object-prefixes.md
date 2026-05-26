# RB-137 - Storage Cleanup Coverage For Crop Object Prefixes

Status: Done
Priority: P1
Type: Object-store integrity / operational cleanup

## Context

Storage cleanup protects `ImageAsset`, `AnnotationArtifactVersion`, and `DerivedSliceCrop` DB references, but orphan cleanup classification in the reviewed snapshot only recognizes raw image uploads, full-image mask uploads, and prediction-import batch objects. Crop workflows now create additional object families under project-scoped prefixes.

Known crop object families include:

- `projects/<projectId>/crop-support-masks/...`
- `projects/<projectId>/crop-semantic-masks/...`
- `projects/<projectId>/derived-crops/...`

The real repo reportedly already fixed project-scoped listing to list `projects/<projectId>/` directly. This ticket is about prefix classification and tests, not that already-completed listing fix.

## Impact

If an object write succeeds and the DB transaction fails, route handlers try best-effort deletion. If that deletion fails, crop objects may remain orphaned and never appear as cleanup candidates.

## Non-goals

- Do not delete any DB-referenced object.
- Do not change object storage layout unless strictly necessary.
- Do not rework backup/restore.

## Implementation plan

1. Extend `CleanupObjectCategory` as needed, for example:
   - `ORPHAN_DERIVED_CROP_OBJECT`
   - `ORPHAN_CROP_SUPPORT_MASK_OBJECT`
   - `ORPHAN_CROP_SEMANTIC_MASK_OBJECT`
2. Extend `classifyStorageCleanupKey()` to recognize crop object prefixes.
3. Ensure `protectedKeys()` / protected references continue to prevent deletion of referenced crop objects.
4. Add integration tests with:
   - referenced crop support mask object is skipped/protected;
   - referenced crop semantic mask object is skipped/protected;
   - referenced derived crop object is skipped/protected;
   - unreferenced old crop object becomes `WOULD_DELETE` in dry-run;
   - execute mode deletes only the orphan.
5. Update storage cleanup docs to distinguish protected-reference coverage from orphan-prefix classification.

## Files to inspect

- `src/server/domain/storageCleanup.ts`
- `src/app/api/slice-crops/[cropId]/support-mask/upload/route.ts`
- `src/app/api/slice-crops/[cropId]/semantic-mask/upload/route.ts`
- `src/server/domain/sliceCrops.ts`
- `tests/integration/storage-cleanup.test.ts`
- `docs/04-server/storage-retention-cleanup.md`
- `docs/04-server/storage.md`

## Acceptance criteria

- Crop support-mask, crop semantic-mask, and derived-crop object prefixes are classified by cleanup.
- DB-referenced objects in those prefixes are never deleted.
- Orphan objects older than the configured retention threshold are reported and deleted in execute mode.
- Cleanup result summaries include the new categories.
- Tests cover dry-run and execute behavior.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test -- tests/integration/storage-cleanup.test.ts
npm run check:docs-links
git diff --check
```


---

Renumbering note: This ticket was renumbered to avoid collision with Codex deep-review tickets RB-130 through RB-135.
