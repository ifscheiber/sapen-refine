# RB-107 - Safe Version Allocation Concurrency Hardening

## Status

Completed

## Priority

P1/P2

## Type

Data Integrity / Concurrency / Artifact Versioning / Stable API Errors / Tests

## Source

- `docs/adr/remediation-backlog.md` RB-107
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Post-RB-106 implementation report: commit `a4e69f6 fix: enforce protected api error contracts`

## Depends On

- RB-106 completed: protected API routes now use `withApiErrorHandling`, and `tests/unit/api-route-error-contracts.test.ts` guards new unwrapped protected routes.
- Existing append-only artifact/classification/BBox version schema constraints.
- RB-105 if it has already changed presigned image/mask commit routes; otherwise include the current compatibility commit paths in the inventory and leave final-key immutability to RB-105.

## Blocks

- Reliable multi-tab and multi-user annotation saves.
- DB constraint hardening in RB-109, because DB constraints should reinforce a safe write path rather than merely expose avoidable races.
- Production confidence for append-only ground-truth and correction/version provenance.

## Context

Several current save paths allocate the next version by reading the latest row and inserting `latest + 1`. Existing unique constraints detect collisions but do not prevent the race. Two tabs, two users, or a retrying client can therefore collide on the same logical version family. In the worst case, object-storage bytes may already have been written before the DB insert fails.

Affected version families include, but are not limited to:

- full-image semantic mask / `AnnotationArtifactVersion` per `artifactId`,
- compatibility mask commit path if still present after RB-105,
- default/full-slice support masks,
- crop support masks,
- crop semantic masks,
- slice classifications,
- slice bounding boxes,
- assisted-correction version writers,
- prediction-import version writers.

RB-106 now guarantees that protected API routes can return stable JSON errors, so this ticket should not allow low-level Prisma `P2002` or raw database errors to reach clients.

## Goal

Introduce one shared, reusable safe-version-allocation pattern for all append-only version families so concurrent saves either:

1. both commit successfully with distinct monotonically increasing versions, or
2. fail with a stable, intentional conflict/retryable error after bounded retries, without leaking raw DB errors and without leaving avoidable orphaned storage objects.

## Non-Goals

- Do not change the append-only versioning model.
- Do not overwrite, renumber, compact, or delete historical or approved versions.
- Do not add edit-session locking UX or multi-tab warnings in this ticket; reference RB-083 or create a follow-up if needed.
- Do not redesign artifact storage layout.
- Do not introduce in-process-only locks as the primary correctness mechanism; they do not protect multiple app instances or worker processes.
- Do not broaden RB-109 DB constraint work into this ticket.

## Required Technical Decision

Choose and document exactly one primary allocation strategy before implementing broadly:

### Preferred strategy: PostgreSQL advisory transaction locks

Use a transaction-scoped advisory lock keyed by a deterministic logical version-family key, then read latest version and insert the next row inside the same transaction.

Example logical family keys:

- `annotation-artifact-version:{artifactId}`
- `slice-classification-version:{sliceInstanceId}`
- `slice-bbox-version:{sliceInstanceId}`
- `crop-support-version:{derivedCropId or supportArtifactId}`
- `crop-semantic-version:{derivedCropId or semanticArtifactId}`
- `prediction-import-version:{scopeId}`

The implementation may hash these keys for `pg_advisory_xact_lock`, but the source helper should keep the human-readable family key visible for logs/tests.

### Acceptable fallback: bounded unique-conflict retry

A bounded Prisma `P2002` retry loop is acceptable only if advisory locks are impractical in the current test/runtime setup. If this fallback is chosen, it must be implemented once in a shared helper and covered by concurrency tests. Do not add ad hoc retry loops in individual routes.

## Requirements

- Inventory all current `latest + 1`, `findFirst(... orderBy: { version: "desc" })`, and equivalent version allocation paths.
- Create a shared helper/module for version allocation and document how new version families must use it.
- Replace ad hoc allocation in covered save paths with the shared helper/pattern.
- Keep version numbers monotonic per logical family.
- Preserve existing latest/approved selection semantics in review and export workflows.
- Map allocation conflicts and retry exhaustion through the existing RB-106 stable API error contract.
- Ensure storage cleanup behavior is explicit:
  - If bytes are written before DB commit and DB commit ultimately fails, best-effort delete newly written object bytes.
  - If deletion fails, log enough metadata for existing storage cleanup/drift tooling without exposing secrets.
- Add focused concurrency tests for at least:
  - full-image semantic mask save or current semantic artifact writer,
  - crop semantic mask save,
  - crop support mask save,
  - slice classification save,
  - slice bounding box save if it still uses a versioned save path.
- Include at least one test proving that raw `P2002` does not reach the client or caller for a covered path.
- Update docs/backlog notes with the chosen strategy and remaining multi-tab UX limitation.

## Acceptance Criteria

- All inventoried version allocation paths either use the shared safe allocator or are explicitly documented as not requiring version allocation.
- Two concurrent saves to the same logical family create distinct versions, or one fails with a stable, intentional conflict/retryable response after bounded retries.
- No low-level Prisma/database concurrency error reaches the client for covered protected API routes.
- Object-storage bytes written by failed save attempts are best-effort cleaned up, with test coverage where practical.
- Review/export behavior still resolves the intended latest/approved versions.
- Docs clearly state the allocation pattern for future writers.

## Suggested Implementation Plan

1. Add a short inventory note or test fixture listing current version families and writer locations.
2. Implement the shared safe allocator with advisory transaction locks or the documented fallback strategy.
3. Migrate one representative writer first and add a focused concurrency test.
4. Migrate the remaining versioned writers.
5. Add regression tests for stable error mapping and storage cleanup on failed allocation.
6. Update docs/remediation backlog and move this ticket to `done/` when committed.

## Implementation Notes

- Chosen strategy: PostgreSQL transaction-scoped advisory locks via `src/server/domain/versionAllocation.ts`.
- Lock family keys remain human-readable in source/tests, then are hashed for `pg_advisory_xact_lock`.
- Migrated append-only version writers for full-image semantic mask upload, default support masks, crop support masks, crop semantic masks, manual/auto slice classifications, BBox replace/delete versions, derived slice crops, prediction imports, and assisted corrections.
- Preserved successful payload shapes and existing latest/approved read semantics.
- Preserved best-effort object cleanup where bytes are written before DB commit; allocation failures now surface as stable `VERSION_ALLOCATION_CONFLICT` or existing domain conflicts such as `BBOX_VERSION_STALE`.
- Added concurrency coverage in `tests/integration/version-allocation-concurrency.test.ts` and P2002 normalization coverage in `tests/unit/version-allocation.test.ts`.
- Updated server, Prisma, API-error, testing, and remediation-backlog docs.
- Moved this optimized ticket to `tickets/2026-05-23/done/` and removed the old non-optimized ticket.

## Validation

Completed validation:

- Baseline before editing: `git status --short` showed the untracked optimized RB-107 ticket plus review/design source files; focused affected workflow baseline passed with 7 files and 37 tests.
- `npm run test -- tests/unit/version-allocation.test.ts tests/integration/version-allocation-concurrency.test.ts` passed: 2 files, 5 tests.
- `npm run test -- tests/integration/slice-workflow.test.ts tests/integration/slice-bbox-workflow.test.ts tests/integration/slice-crop-workflow.test.ts tests/integration/crop-support-mask-workflow.test.ts tests/integration/crop-semantic-mask-workflow.test.ts tests/integration/prediction-import.test.ts tests/integration/assisted-correction.test.ts tests/integration/version-allocation-concurrency.test.ts tests/unit/version-allocation.test.ts` passed: 9 files, 42 tests.
- `npm run prisma:generate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run check:design-hardcoding` passed.
- `npm run test -- tests/unit/api-route-error-contracts.test.ts` passed: 1 file, 3 tests.
- Initial `npm run test` failed in `tests/integration/storage-cleanup.test.ts` because the local MinIO bucket had accumulated enough stale `projects/` objects that the cleanup test's list cap missed its fixture. After `npm run db:rebuild`, `npm run test` passed: 45 files, 232 tests.
- `npm run test:e2e` passed: 12 tests.
- `npm run handoff:archive -- --dry-run` was attempted after commit and failed because the worktree still contains unrelated untracked review/design files. `npm run handoff:archive -- --dry-run --allow-dirty` passed and reported 523 files.

Required command set:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run test -- tests/unit/api-route-error-contracts.test.ts
```

If `npm run handoff:archive -- --dry-run` is still blocked only by the two known pre-existing untracked review reports, run:

```bash
npm run handoff:archive -- --dry-run --allow-dirty
```

and document the reason.
