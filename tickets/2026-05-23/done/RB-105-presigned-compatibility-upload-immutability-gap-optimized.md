# RB-105 - Presigned Compatibility Upload Immutability Gap

## Status

Completed

## Priority

P1

## Type

Storage / Upload Integrity / Export Integrity / Ground-Truth Safety

## Source

- `docs/adr/remediation-backlog.md` RB-105
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- Current app-mediated upload/storage validation baseline from RB-055.
- Client presign wrapper cleanup from RB-074.
- Existing storage cleanup baseline for abandoned temporary objects.

## Blocks

- Production claim that raw images and committed mask artifacts are immutable.
- Reliable export package reproducibility.
- Safe customer-trial handoff if compatibility presigned routes remain reachable.

## Context

The compatibility image and mask presign routes currently return S3-compatible PUT URLs for object keys that later become persisted as final committed storage keys:

- `ImageAsset.storageKey`
- `AnnotationArtifactVersion.storageKey`

A client that still holds a presigned PUT URL can overwrite the object at that key until the URL expires. The app validates bytes at commit time, but after commit the same final key may still be mutable through the still-valid URL.

Export generation reads object bytes from storage while manifest metadata comes from persisted DB checksums and sizes. If storage bytes are mutated after commit, an export may package bytes that no longer match the DB metadata.

Affected areas include:

- `src/app/api/projects/[projectId]/images/presign`
- `src/app/api/projects/[projectId]/images/commit`
- `src/app/api/images/[imageId]/mask/presign`
- `src/app/api/images/[imageId]/mask/commit`
- `src/server/storage/s3.ts`
- `src/server/domain/exports.ts`

## Goal

Ensure presigned compatibility uploads cannot mutate committed raw images or committed mask artifact versions, and ensure exports do not silently package bytes that disagree with persisted checksums.

## Preferred Resolution Strategy

Codex should first determine whether the compatibility presign routes are still required by any active UI, tests, docs, or external integration.

Implemented decision: Path A. Repository search found no active `src/lib` or UI consumers of the presign/commit pair; RB-074 had already removed browser helper exports and locked app-mediated upload helpers as the current client contract. RB-105 therefore keeps the route files for stable compatibility/error behavior but disables them by default without a feature flag. If a future external integration needs direct uploads, it should be implemented as a new staging-key ticket rather than by re-enabling final-key presigned PUT URLs.

### Preferred path A: disable or feature-flag compatibility presign routes

If the current app-mediated upload path fully covers active usage, prefer disabling compatibility presign routes by default.

- Keep route code only if needed for backward compatibility.
- Protect it behind an explicit environment feature flag.
- Default the feature flag to disabled for production/trial.
- Return a stable JSON error when the route is disabled.
- Update docs so operators know that app-mediated upload is the supported path.

### Path B: retain compatibility through staging keys only

If presigned compatibility must remain supported, do not presign final persisted keys.

Instead:

1. Presign only a temporary/staging object key.
2. The staging key must be clearly separated from committed storage prefixes.
3. Commit must validate the staging bytes:
   - object exists,
   - expected content type,
   - expected size,
   - expected dimensions where applicable,
   - expected checksum,
   - existing image/mask validation rules still pass.
4. Commit must write/copy the validated object to a fresh final key that was never presigned to the client.
5. Persist only the final key in DB records.
6. Best-effort delete the staging object after successful commit.
7. Cleanup must be able to remove abandoned staging objects without touching committed data.

Do not implement a hybrid where a presigned URL still points to a key that can become persisted as final committed data.

## Non-Goals

- Do not remove the current app-mediated upload path.
- Do not redesign all storage keys.
- Do not add public object access.
- Do not weaken existing upload, mask, dimension, checksum, or content-type validation.
- Do not change successful export manifest shape unless a versioned manifest change is strictly necessary.
- Do not solve all storage/DB consistency operations issues; that remains RB-114.

## Requirements

### Upload immutability

- Inventory current presigned compatibility routes and their consumers.
- Either disable/feature-flag the routes or move them to staging-key semantics.
- Ensure no client-provided presigned URL can overwrite any persisted `ImageAsset.storageKey`.
- Ensure no client-provided presigned URL can overwrite any persisted `AnnotationArtifactVersion.storageKey`.
- Preserve app-mediated upload behavior.
- Preserve existing successful API payloads where practical.
- Return stable API errors for disabled presign, missing staging object, mismatched checksum, unsupported content type, oversized body, invalid dimensions, and stale/invalid commit context.

### Export integrity

- Add export-time checksum verification for every packaged object before adding bytes to the ZIP.
- Verification must compare actual storage bytes against persisted checksum metadata, not only object stat metadata.
- If bytes do not match persisted checksum/size metadata, fail export creation with a stable integrity error.
- Do not silently skip corrupted or mismatched objects.
- Ensure the integrity failure is logged with object identifiers and DB IDs, but without dumping object contents or secret values.

### Cleanup / operations

- Ensure abandoned staging objects are eligible for cleanup.
- Ensure committed raw images, committed mask artifact versions, approved historical masks, and export packages remain protected from cleanup.
- Update storage/API docs to clearly label the compatibility route policy.

## Implementation Notes

- Disabled `POST /api/projects/[projectId]/images/presign`, `POST /api/projects/[projectId]/images/commit`, `POST /api/images/[imageId]/mask/presign`, and `POST /api/images/[imageId]/mask/commit` after authentication and project/member authorization with stable `410 PRESIGNED_UPLOADS_DISABLED` JSON responses.
- Preserved app-mediated image and mask upload behavior.
- Added `src/server/domain/exportObjectIntegrity.ts` and wired training, crop-training, and prediction-analysis ZIP packaging to verify actual object bytes against persisted checksum and size before archive insertion.
- Failed export batches now retain structured integrity warnings with resource type, resource id, expected checksum/size, and actual checksum/size.
- Updated API/storage/testing/current-state docs and marked the RB-105 backlog item resolved.
- Removed the old non-optimized RB-105 ticket in favor of this implemented optimized ticket.

## Tests

Add or update tests covering the chosen path.

### Required tests for both paths

- Export creation rejects a stored object whose bytes no longer match persisted checksum metadata.
- Export creation still succeeds for valid committed image/mask objects.
- App-mediated upload path remains green.
- Handoff archive dry-run remains green.

### Additional tests if presign routes are disabled

- Image presign route returns a stable disabled/unsupported JSON error by default.
- Mask presign route returns a stable disabled/unsupported JSON error by default.
- Feature flag behavior is documented and tested if the route can be re-enabled.

### Additional tests if staging-key presign remains supported

- Presigned upload writes only to a staging key.
- Commit persists a final key that differs from the presigned staging key.
- A still-valid presigned URL cannot overwrite the persisted final key.
- Staging checksum mismatch rejects commit.
- Missing staging object rejects commit.
- Best-effort staging cleanup is attempted after successful commit.
- Abandoned staging object cleanup does not delete committed objects.

## Acceptance Criteria

- No presigned compatibility URL can overwrite a persisted `ImageAsset.storageKey`.
- No presigned compatibility URL can overwrite a persisted `AnnotationArtifactVersion.storageKey`.
- Export creation fails with a stable integrity error if object bytes no longer match persisted checksum metadata.
- Existing app-mediated upload, mask save, review, and export happy paths remain green.
- Tests cover either the route-disabled path or the staging-key path.
- Docs clearly state the compatibility presign policy and the supported upload path.
- The ticket does not introduce public object access or weaker validation.

## Validation

Completed validation:

- Baseline before editing: `git status --short` showed the pre-existing untracked optimized ticket and source review reports; `npm run test -- tests/unit/client-api-contracts.test.ts tests/integration/export-workflow.test.ts` passed.
- `npm run prisma:generate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test` passed: 42 files, 224 tests.
- `npm run test:e2e` passed: 12 tests.
- `npm run check:design-hardcoding` passed.
- `npm run handoff:archive -- --dry-run` failed before and after commit because the worktree contains the two pre-existing untracked review source reports. `npm run handoff:archive -- --dry-run --allow-dirty` passed after commit and reported 519 files.

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
npm run handoff:archive -- --dry-run
```

If local object storage is unavailable for a specific integration test, document the skipped command and run the closest available storage-domain/unit coverage.
