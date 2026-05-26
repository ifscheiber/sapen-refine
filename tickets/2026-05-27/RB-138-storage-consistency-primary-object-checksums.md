# RB-138 - Deep Checksum Consistency For Primary Storage Objects

Status: Planned
Priority: P1/P2
Type: Evidence-grade storage integrity

## Context

The DB stores checksums for uploaded images, annotation artifact versions, and derived crop objects. The reviewed storage consistency check verifies referenced object existence and size for primary objects, while export package objects additionally get SHA-256 verification.

## Impact

A corrupted or overwritten object with the same byte size may pass normal consistency checks. For evidence and training-data provenance, an optional deep checksum mode should detect this.

## Non-goals

- Do not make every normal cleanup dry-run download every object by default.
- Do not block trial operations with expensive full-bucket reads.
- Do not change checksum algorithms unless required.

## Implementation plan

1. Extend protected storage references to include expected checksum where available.
2. Add a `deepChecksum` option to consistency checks and CLI/API route parsing.
3. In normal mode, preserve current existence/size checks.
4. In deep mode, read referenced primary objects and compare `sha256Checksum()` against normalized DB checksum.
5. Add limits to avoid accidentally reading huge projects without operator intent:
   - max objects;
   - max bytes;
   - projectId strongly recommended or required for deep mode.
6. Record checksum mismatch findings with `HARD_DRIFT`.
7. Update docs/runbook for when and how to use deep checksum mode.

## Files to inspect

- `src/server/domain/storageCleanup.ts`
- `src/app/api/storage-cleanup/route.ts`
- `scripts/storage-cleanup.mjs`
- `tests/integration/storage-cleanup.test.ts`
- `docs/04-server/storage-retention-cleanup.md`
- `docs/04-server/backup-restore.md`

## Acceptance criteria

- `ImageAsset`, `AnnotationArtifactVersion`, and `DerivedSliceCrop` consistency checks can validate checksums in explicit deep mode.
- Same-size checksum drift is reported as `HARD_DRIFT`.
- Normal cleanup/consistency mode remains fast and does not download all objects.
- Deep mode has documented limits and operator warnings.
- Tests cover matching checksum, mismatch, missing checksum metadata, and size mismatch precedence.

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
