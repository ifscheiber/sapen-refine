# RB-120 - Opportunistic Large Module Decomposition

## Status

Planned

## Priority

P3

## Type

Refactoring / Maintainability / Risk Reduction

## Source

- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- None directly. This ticket should be activated only when touching affected areas for real feature or bug work.

## Blocks

- Lower-risk future changes to editor save state, crop editors, exports, and prediction imports.

## Context

Several editor and domain modules remain large. The reports agree this is real maintainability debt but not a standalone production blocker. Broad rewrites would be risky and low value unless tied to active changes.

Likely areas:

- editor save/versioning hooks and canvas state,
- crop semantic/support editor internals,
- export package builders,
- prediction import batch processing.

## Goal

Define an opportunistic decomposition policy and concrete split candidates so future work reduces risk without broad unrelated refactors.

## Non-Goals

- Do not perform a big-bang rewrite.
- Do not change behavior without tests.
- Do not refactor unrelated modules merely because they are large.

## Requirements

- Identify high-churn large modules and their natural extraction seams.
- For each area, define a small target extraction that can be done alongside a future feature/fix.
- Add or preserve tests before behavior-affecting moves.
- Document preferred boundaries, such as export manifest builders vs object packaging, and editor canvas hooks vs save API orchestration.

## Acceptance Criteria

- The ticket produces a short decomposition map or implementation slice plan.
- Any extraction is behavior-preserving and covered by existing or new tests.
- No unrelated product behavior changes are included.

## Validation

For planning/docs-only work:

```bash
git status --short
git diff --check
npm run lint
```

For code refactors:

```bash
npm run typecheck
npm run build
npm run test
npm run test:e2e
```
