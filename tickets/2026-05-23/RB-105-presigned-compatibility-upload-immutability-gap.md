# RB-105 - Presigned Compatibility Upload Immutability Gap

## Status

Planned

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

- Current upload/storage validation baseline from RB-055.
- Client presign wrapper cleanup from RB-074.

## Blocks

- Production claim that raw images and committed mask artifacts are immutable.
- Reliable export package reproducibility.

## Context

The compatibility image and mask presign routes return S3-compatible PUT URLs for the final object keys that are later persisted in `ImageAsset.storageKey` or `AnnotationArtifactVersion.storageKey`. A client that still holds the presigned URL can overwrite the object until the URL expires.

The app validates the object at commit time, but after commit the same final key can still be mutated through the still-valid URL. Export generation reads object bytes from storage while manifest metadata comes from persisted DB checksums and sizes.

Affected areas include:

- `src/app/api/projects/[projectId]/images/presign`
- `src/app/api/projects/[projectId]/images/commit`
- `src/app/api/images/[imageId]/mask/presign`
- `src/app/api/images/[imageId]/mask/commit`
- `src/server/storage/s3.ts`
- `src/server/domain/exports.ts`

## Goal

Ensure presigned compatibility uploads cannot mutate committed raw images or committed mask artifact versions, and ensure exports do not silently package bytes that disagree with persisted checksums.

## Non-Goals

- Do not remove the current app-mediated upload path.
- Do not redesign all storage keys.
- Do not add public object access.
- Do not change successful export manifest shape beyond adding integrity-failure behavior if needed.

## Requirements

- Decide whether compatibility presign routes are disabled, feature-flagged, or retained through a staging-key flow.
- If retained, presign staging keys only and never final persisted keys.
- On commit, validate staging bytes, write/copy to a fresh final key that was never presigned to the client, persist the final key, and best-effort delete staging bytes.
- Add export-time checksum verification for every packaged object before adding it to the ZIP.
- Return stable API errors when staged bytes are missing, changed, unsupported, oversized, or checksum-mismatched.
- Update storage/API docs to clearly label compatibility behavior.
- Ensure cleanup can still remove abandoned staging objects without touching committed data.

## Acceptance Criteria

- A still-valid presigned URL cannot overwrite a persisted `ImageAsset.storageKey` or `AnnotationArtifactVersion.storageKey`.
- Export creation fails with a stable integrity error if object bytes no longer match persisted checksum metadata.
- Tests cover post-commit presigned overwrite attempts or the route-disabled path.
- Tests cover export checksum mismatch rejection.
- Docs explain the compatibility route policy.

## Validation

Run:

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
