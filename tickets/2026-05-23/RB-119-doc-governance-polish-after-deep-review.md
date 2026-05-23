# RB-119 - Documentation Governance Polish After Deep Review

## Status

Planned

## Priority

P3

## Type

Documentation / Governance / Contributor Workflow

## Source

- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- RB-108 for root architecture current-flow corrections.

## Blocks

- Lower-friction future agent/human contribution.

## Context

The combined report downgraded several documentation findings but kept them as useful polish: `AGENTS.md` prediction wording is mildly ambiguous, historical path labels can be clearer, ADR/backlog locations are split but documented, and a markdown/link check would prevent future false positives.

The `docs/README.md` broken-link finding is rejected and must not be treated as a defect.

## Goal

Polish documentation governance without changing product behavior.

## Non-Goals

- Do not claim `docs/README.md` links are broken.
- Do not move all ADRs unless explicitly scoped and low-risk.
- Do not change code or routes.

## Requirements

- Clarify `AGENTS.md` wording around implemented secondary prediction/correction workflows vs future Core handoff work.
- Add a historical/current path convention where useful.
- Clarify ADR/backlog source-of-truth expectations and whether duplicate backlog files are allowed.
- Consider adding a simple docs link checker or path-validation script.
- Preserve `AGENTS.md` as short and stable.

## Acceptance Criteria

- Prediction/correction scope wording no longer reads as purely future.
- Historical removed paths are not easily mistaken for current implementation paths.
- ADR/backlog navigation remains unambiguous.
- Any docs link checker passes and does not flag valid relative links.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
```
