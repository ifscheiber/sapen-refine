# RB-107 - Safe Version Allocation Concurrency Hardening

## Status

Planned

## Priority

P1/P2

## Type

Data Integrity / Concurrency / Artifact Versioning / Tests

## Source

- `docs/adr/remediation-backlog.md` RB-107
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- Existing artifact/classification version schema constraints.

## Blocks

- Reliable multi-tab and multi-user annotation saves.
- DB constraint hardening follow-up confidence.

## Context

Multiple save paths allocate the next version by reading the latest version and inserting `latest + 1`. Unique constraints detect collisions but do not prevent them. Concurrent saves can fail after object bytes have already been written.

Affected areas include artifact versions, crop support/semantic versions, classifications, BBoxes, assisted correction, and prediction import.

## Goal

Introduce a shared, safe version allocation approach that prevents or gracefully retries concurrent version collisions.

## Non-Goals

- Do not change the append-only versioning model.
- Do not overwrite historical or approved versions.
- Do not add edit-session locking UX in this ticket; link to RB-083 if needed.
- Do not redesign artifact storage layout.

## Requirements

- Inventory all `latest + 1` version allocation paths.
- Implement a shared helper or transaction pattern for versioned scopes.
- Prefer PostgreSQL advisory transaction locks keyed by logical version family where practical; bounded Prisma `P2002` retry is acceptable only if simpler and well tested.
- Ensure object-storage writes are cleaned up on failed retries where applicable.
- Add concurrency tests for at least semantic mask save, crop semantic/support save, and slice classification save.
- Update docs for version allocation behavior and remaining multi-tab UX limitations.

## Acceptance Criteria

- Two concurrent saves to the same version family either both succeed with distinct versions or one fails with a stable, intentional conflict response after bounded retries.
- No low-level `P2002` reaches the client for covered save paths.
- Tests prove the shared allocation behavior.
- Existing review/export semantics still select the intended latest/approved versions.

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
```
