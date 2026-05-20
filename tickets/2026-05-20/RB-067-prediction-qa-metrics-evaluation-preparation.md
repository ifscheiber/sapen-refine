# RB-067 - Prediction QA Metrics And Evaluation Preparation

## Status

Proposed / Ready for Codex

## Priority

Medium

## Type

Prediction Analysis / QA Metrics / Export Contract / Tests

## Depends on

- RB-060 - Prediction Analysis Export Mode
- RB-062 - Repository State and Documentation Consistency Sweep

## Goal

Prepare prediction-analysis exports and/or offline workflows for model QA metrics without contaminating ground-truth training export semantics.

Current gap:

- RB-060 exports prediction proposals and optional human/ground-truth references.
- It does not compute Dice, IoU, confusion matrices, per-class overlap, or dashboard-ready summaries.

## Non-Goals

- Do not make model predictions training labels.
- Do not change RB-053 approved-human-only training export rules.
- Do not implement a full dashboard unless separately scoped.
- Do not require a Python ML worker unless explicitly chosen by a later implementation plan.

## Required Baseline

Run before editing:

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
```

## Implementation Notes

- Define the v1 metrics contract for semantic mask and slice-support mask comparisons.
- Keep prediction-analysis exports clearly marked as QA/proposal artifacts.
- Decide whether metrics are computed during export, as a manifest supplement, or by a documented offline command.
- Include checksum/version references for every compared input.
- Document unsupported cases such as missing approved reference masks or classification-only proposals.

## Acceptance Criteria

- Metrics contract is documented and implemented or prepared with a concrete offline path.
- Prediction-analysis manifests remain separate from training export manifests.
- Tests prove predictions are still excluded from ground-truth training export.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

