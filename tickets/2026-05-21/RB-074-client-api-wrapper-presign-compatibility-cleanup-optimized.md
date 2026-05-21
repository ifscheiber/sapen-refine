# RB-074 — Client API Wrapper / Presign Compatibility Cleanup

## Status

Proposed / Ready for Codex

## Priority

Medium / High

## Type

Client API / Storage Contract / Repository Hygiene / Trial Readiness / Tests

## Depends on

- RB-071 — Architecture / Docs / Backlog Consistency Hotfix
- RB-072 — Route-Level API Auth/Error Contract Hardening
- RB-073 — Trial Deployment Secret & Build-Context Hygiene
- RB-070 — Editor Eraser Tool UX

## Goal

Align `src/lib` client API helpers and documentation with the current app-mediated upload/read storage contract.

The current browser workflow should not depend on stale presign/commit wrappers or browser-visible private storage fields such as `storageKey`.

## Context

The deep review found that `src/lib` still contains stale browser-side API wrappers for older presign/commit paths and fields such as `storageKey`, while current browser workflows use app-mediated upload/read routes.

RB-071 explicitly marked stale `src/lib` wrappers as an RB-074 follow-up without changing code.

## Non-Goals

Do **not** implement:

- storage architecture redesign,
- new upload workflow,
- new API routes,
- MinIO/S3 exposure changes,
- mask/image storage format changes,
- deletion of compatibility API routes unless proven safe and explicitly documented,
- server-side validation behavior changes,
- broad UI refactor.

## Required Baseline

Start with:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

## Scope

### 1. Audit `src/lib`

Inspect:

```text
src/lib/**
docs/src/lib/README.md
```

Search for stale direct-storage assumptions:

```bash
rg -n "presign|commit|storageKey|signed|s3|minio|uploadUrl|downloadUrl|maskVersion|MaskVersion" src/lib src/features src/app docs/src/lib docs
```

Classify each helper:

```text
currently used browser contract
unused stale helper
server-only helper accidentally in client lib
legacy compatibility helper
safe to remove
keep but rename/document
```

### 2. Remove or isolate stale wrappers

For unused wrappers:

- remove if no imports/tests depend on them,
- or move to a clearly named internal/legacy module,
- or mark deprecated if removal is not safe.

Do not leave stale wrappers looking like the recommended browser contract.

### 3. Align current client helpers

Current browser-facing helpers should:

- call app-mediated routes,
- not expose private storage keys,
- use current RB-072 stable JSON error shape where practical,
- use current response shapes,
- have names matching current concepts.

### 4. Clean browser-facing types

Avoid browser-facing types exposing private storage details:

```text
storageKey
bucket
S3 endpoint
presigned URL internals
MinIO path
```

If internal IDs are needed, keep them as opaque IDs.

### 5. Presign compatibility policy

Audit existing presign/commit routes and decide:

```text
keep as legacy internal compatibility route
feature-flag for local/dev only
deprecate but keep for now
remove if provably unused and tests pass
```

Recommended for RB-074:

- remove stale client wrappers first,
- do not remove server routes unless trivial and safe,
- document presign routes as internal/legacy if they remain.

## Tests

Add lightweight tests if useful:

- app-mediated helper builds expected route,
- error wrapper handles RB-072 error shape,
- browser-facing mapper drops private storage fields,
- no stale helper imports remain.

Existing E2E must remain green.

## Docs

Update:

```text
docs/src/lib/README.md
docs/03-features/images.md
docs/03-features/editor.md
docs/04-server/storage.md or equivalent
docs/04-server/api-error-contracts.md if relevant
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- browser uploads/reads are app-mediated,
- private storage keys are server-side only,
- presign compatibility status,
- supported client helper modules,
- stale helper cleanup result.

## Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. `src/lib` is audited and stale wrappers are removed, isolated, or documented.
3. Current browser-facing helpers use app-mediated upload/read routes.
4. Browser-facing helpers/types do not expose private storage keys unless explicitly justified.
5. Presign compatibility policy is documented.
6. No supported UI workflow depends on stale presign/commit wrappers.
7. Existing server-side validation/authorization remains source of truth.
8. Existing browser workflows remain green.
9. Docs describe the current client API/storage contract.
10. Ticket is moved to `tickets/2026-05-21/done/`.
11. Full validation gate passes.

## Suggested Commit Sequence

```bash
git commit -m "docs: define client api storage contract cleanup"
git commit -m "chore: remove stale client storage wrappers"
git commit -m "refactor: align client helpers with app mediated routes"
git commit -m "test: cover client api helper contracts"
git commit -m "docs: document presign compatibility policy"
git commit -m "chore: finalize client api cleanup ticket"
```
