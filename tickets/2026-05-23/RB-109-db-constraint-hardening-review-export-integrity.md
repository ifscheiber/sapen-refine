# RB-109 - DB Constraint Hardening For Review And Export Integrity

## Status

Planned

## Priority

P2

## Type

Database / Review Integrity / Export Integrity / Tests

## Source

- `docs/adr/remediation-backlog.md` RB-109
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- RB-107 should be implemented first unless new review/export writers are being added.

## Blocks

- Strong auditability of review and export records.

## Context

`ReviewDecision` allows nullable `artifactVersionId` and nullable `sliceClassificationVersionId` without a database-level check that exactly one target is present. `ExportItem` stores multiple nullable references plus a free-text `role`, while domain code controls valid combinations.

The current service layer is disciplined, but future scripts, migrations, or new writers could create ambiguous audit/export rows.

## Goal

Push low-risk review/export invariants into the database so persisted audit artifacts remain unambiguous.

## Non-Goals

- Do not redesign the entire review/export model.
- Do not change export manifest semantics unless required by constraints.
- Do not over-constrain complex artifact lineage in the first slice.

## Requirements

- Add raw SQL migrations for constraints Prisma cannot express directly.
- Start with `ReviewDecision` exact-one-target constraint.
- Add `ExportItem` role/reference consistency either through check constraints or a typed enum plus checks.
- Backfill or verify existing rows before applying constraints.
- Add DB integration tests that invalid rows are rejected.
- Update `docs/prisma/README.md` and export/review docs.

## Acceptance Criteria

- Invalid `ReviewDecision` rows with zero or two targets cannot be inserted.
- Invalid `ExportItem` role/reference combinations cannot be inserted for constrained roles.
- Existing valid review/export workflows pass.
- Migration is safe for existing trial data.

## Validation

Run:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
```
