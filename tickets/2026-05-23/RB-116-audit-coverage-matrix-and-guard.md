# RB-116 - Audit Coverage Matrix And Guard

## Status

Planned

## Priority

P3/P2

## Type

Audit / Tests / API Governance

## Source

- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `docs/known-gaps.md`

## Depends On

- RB-106 API route inventory is useful but not strictly required.
- RB-115 if system actor semantics affect audit classification.

## Blocks

- Confidence that new mutation paths remain attributable.

## Context

Audit coverage is broad but not machine-enforced. Future mutation routes can be added without `AuditLog` events or a documented reason why persisted domain rows are sufficient attribution.

## Goal

Create an audit coverage matrix and a guard that makes unaudited mutation paths visible during review.

## Non-Goals

- Do not force every mutation to write `AuditLog` if an append-only domain row already provides sufficient evidence.
- Do not add audit UI dashboards.
- Do not redesign `AuditLog` schema unless RB-115 requires it.

## Requirements

- Inventory mutation routes and domain write commands.
- For each action, document the attribution mechanism:
  - `AuditLog`,
  - append-only domain row with actor,
  - system actor,
  - explicit exemption.
- Add a test or script that detects new mutation route files missing from the matrix.
- Keep the matrix close to docs/testing or auth/audit docs.
- Add missing audit calls only if the matrix reveals clear gaps with no existing attribution.

## Acceptance Criteria

- Every mutation route is represented in the matrix.
- New mutation route additions fail the guard until classified.
- Existing audit coverage is documented without overclaiming completeness.
- Any discovered gaps are ticketed or fixed in focused slices.

## Validation

Run:

```bash
git status --short
npm run lint
npm run typecheck
npm run test
```
