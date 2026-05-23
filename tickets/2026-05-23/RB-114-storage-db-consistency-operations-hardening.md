# RB-114 - Storage/DB Consistency Operations Hardening

## Status

Planned

## Priority

P2/P3

## Type

Storage / Operations / Cleanup / Observability

## Source

- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Existing RB-066 storage cleanup baseline

## Depends On

- RB-066 batch/staging storage retention cleanup.
- RB-105 for presigned final-key immutability.

## Blocks

- Reliable long-running trial operations with repeated uploads/imports/exports.

## Context

Object storage writes and DB writes are best-effort consistent, which is normal for this architecture. Cleanup tooling exists, but production operation needs scheduled execution, metrics, and drift reporting so orphaned objects or missing referenced objects are visible.

## Goal

Make storage cleanup and DB/object drift detection an explicit operational practice.

## Non-Goals

- Do not delete committed raw images, committed artifact versions, approved historical masks, export packages, or prediction artifacts.
- Do not introduce HA/object replication.
- Do not redesign object storage layout.

## Requirements

- Review current cleanup coverage and identify gaps for orphan detection and protected-object verification.
- Add summary metrics to cleanup output: scanned objects, protected objects, orphan candidates, deleted objects, skipped objects, and bytes reclaimed.
- Document how cleanup should be scheduled in the single-host trial environment.
- Add a dry-run drift report mode if not already sufficient.
- Keep deletion rules conservative when DB linkage is ambiguous.
- Consider a future outbox/staging pattern and document whether it is deferred.

## Acceptance Criteria

- Operators can run or schedule cleanup with clear dry-run and execute behavior.
- Cleanup output is suitable for support/debugging without exposing secrets.
- Protected committed artifacts remain undeleted in tests.
- Docs describe operational cadence and interpretation.

## Validation

Run:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run storage:cleanup -- --dry-run
```

If local storage services are unavailable, document the skipped cleanup command and run unit/integration coverage instead.
