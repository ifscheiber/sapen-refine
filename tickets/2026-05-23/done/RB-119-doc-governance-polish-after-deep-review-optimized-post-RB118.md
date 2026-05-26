# RB-119 - Documentation Governance Polish After Deep Review (Optimized Post-RB-118)

## Status

Completed

## Priority

P3

## Type

Documentation / Governance / Contributor Workflow / ADR Hygiene / Link & Path Validation

## Source

- `tickets/2026-05-23/sapen_annotate_deep_review_report_chatGPT.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Completed RB-108: root architecture current-flow drift.
- Completed RB-115: ADR-007 system actor attribution model.
- Completed RB-116: audit coverage matrix and guard.
- Completed RB-116-A: trial bootstrap operator attribution.
- Completed RB-118: ADR-008 upload content safety.

## Depends On

- RB-108 should remain the completed source for root architecture route/current-flow alignment.
- RB-115/RB-116/RB-116-A/RB-118 docs and ADRs are now part of the baseline.
- RB-113 remains open and must not be completed or modified with fabricated iPad evidence.

## Blocks

- Lower-friction future agent/human contribution.
- Avoiding reintroduction of rejected deep-review findings.
- Clear navigation between ADRs, known gaps, remediation backlog, tickets, and current implementation docs.

## Context

The combined deep review downgraded several documentation findings but kept them as useful governance polish:

- `AGENTS.md` prediction wording was mildly ambiguous.
- historical/current path labels can be clearer.
- ADR/backlog locations are split but documented.
- a markdown/link/path validation helper would help prevent false positives and future drift.

Important: the `docs/README.md` broken-link claim from the early static review was rejected. Those links were relative to `docs/README.md` and resolved correctly. RB-119 must not reintroduce that rejected finding as a defect.

Since the original RB-119 ticket, the repo has gained additional governance docs:

- ADR-007 for system actor attribution,
- ADR-008 for upload content safety,
- audit coverage matrix and guard,
- RB-115-A/B/C and RB-118-A through RB-118-E follow-up tickets,
- RB-116-A operator attribution completion.

Therefore, RB-119 should now do a focused documentation governance pass over the current post-RB-118 baseline.

## Goal

Polish documentation governance without changing product behavior.

A successful RB-119 should make it easier for Codex and human contributors to know:

- which docs are current vs historical,
- where active ADRs and remediation backlog entries live,
- which routes/paths are current vs removed,
- how prediction/import/correction/Core-handoff wording should be interpreted,
- which link/path validation checks are available,
- which findings from the deep review were rejected and must not be revived.

## Non-Goals

- Do not change production code.
- Do not change app routes.
- Do not restore the removed legacy `/app/projects/[projectId]/images/[imageId]/edit` route.
- Do not move all ADRs or rewrite the entire documentation tree unless an index update is very small and safe.
- Do not treat valid `docs/README.md` relative links as broken.
- Do not complete or fabricate RB-113 iPad Safari evidence.
- Do not implement RB-115-B, RB-115-C, RB-118-A through RB-118-E, or RB-120.
- Do not perform broad refactors.

## Required Review Areas

Inspect and polish only where needed:

### 1. `AGENTS.md`

Clarify wording around prediction/correction workflows:

- distinguish already implemented secondary prediction import/correction/prediction-analysis paths;
- distinguish future SaPen Core handoff work;
- preserve `AGENTS.md` as concise, stable, and action-oriented;
- avoid turning it into a detailed architecture doc.

### 2. Current vs Historical Path Labels

Where touched, make path status explicit:

- `Current path`
- `Historical path`
- `Removed by RB-104`
- `ADR/history only`
- `Future/deferred`

Do not rewrite every historical ADR. Focus on confusing references that are likely to mislead an agent into editing a removed route or stale workflow.

### 3. ADR / Backlog Navigation

Clarify the current source-of-truth expectations after ADR-007 and ADR-008:

- active ADR location(s),
- where historical ADRs live,
- where the remediation backlog lives,
- where review-derived tickets live,
- how follow-up tickets should be linked.

Do not consolidate all ADR folders unless the repo already clearly expects that and the change is small.

### 4. Known Gaps / Current State

Ensure current known-gaps/current-state docs distinguish:

- completed RB-105 through RB-118 work,
- RB-113 still open as real iPad Safari manual gate,
- RB-115-B and RB-115-C still deferred follow-ups,
- RB-118 follow-up implementation tickets still deferred,
- RB-120 still opportunistic maintainability work.

Do not upgrade readiness claims beyond the evidence.

### 5. Link / Path Validation

Consider adding a small docs validation script/test if it is low-risk.

Possible scope:

- check markdown links for local files that should exist;
- validate that active ticket links in `tickets/2026-05-23/README.md` point to existing files;
- validate ADR index links;
- validate that known rejected false-positive links are not reported.

Important:

- The checker must resolve relative links from the markdown file location.
- The checker must ignore external URLs unless intentionally supported.
- The checker must not flag valid `docs/README.md` links to `docs/src/...` as broken.
- If a full link checker is too broad, add a narrower path-validation script focused on ticket/ADR indexes.

### 6. Rejected-Finding Note

Add or preserve a short note in the appropriate sprint/review docs that the early `docs/README.md` broken-link claim was rejected, so future agents do not reintroduce it.

## Requirements

- Keep changes documentation-focused.
- Preserve or improve the current contributor onboarding path.
- Avoid duplicating long content across docs.
- Prefer index/link clarifications over large rewrites.
- Ensure all links added by RB-119 resolve correctly.
- If adding a validation script/test:
  - add an npm script only if repo conventions support it;
  - add unit coverage where practical;
  - document what it checks and what it intentionally ignores.

## Acceptance Criteria

- `AGENTS.md` prediction/correction/Core-handoff wording no longer reads as purely future or misleading.
- Historical removed paths are less likely to be mistaken for current implementation paths where RB-119 touches them.
- ADR/backlog navigation remains unambiguous after ADR-007 and ADR-008.
- Known gaps/current-state docs do not claim RB-113 completion without evidence.
- The rejected `docs/README.md` broken-link finding is not reintroduced.
- If a docs link/path checker is added, it passes and correctly resolves relative links from each file's location.
- No production behavior changes are included.
- RB-113 remains open unless real physical iPad evidence was separately provided.
- Worktree is clean and handoff dry-run passes.

## Validation

For docs-only work:

```bash
git status --short
git diff --check
npm run lint
npm run handoff:archive -- --dry-run
```

If a docs validation script/test is added, also run the relevant command, for example:

```bash
npm run test -- tests/unit/docs-link-check.test.ts
```

or the actual script name added by the implementation.

If code/package scripts are touched, run:

```bash
npm run typecheck
npm run test
```

## Completion Protocol

1. Apply the focused documentation governance polish.
2. Add or update a docs link/path checker only if low-risk.
3. Update remediation backlog and sprint index.
4. Move this optimized RB-119 ticket to the appropriate `done/` folder.
5. Leave RB-113 open unless physical iPad evidence exists.
6. Commit the completed slice.
7. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- This is a documentation governance ticket, not an implementation ticket.
- Do not revive rejected findings.
- Do not over-expand `AGENTS.md`.
- Do not fabricate iPad evidence.
- Do not implement RB-115-B/C or RB-118 follow-ups here.
- Keep changes small, reviewable, and directly tied to the deep-review governance polish.
