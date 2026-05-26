# RB-132 - Current-State And Architecture Documentation Drift Cleanup

Status: Planned
Priority: P2
Type: Documentation accuracy / agent-governance

## Context

The docs are broadly current, but the deep review found several stale statements that can mislead future implementation work:

- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) still says general write-rate limiting beyond login throttling and same-origin mutation protection is not implemented, even though RB-111 added high-cost write limits.
- [../../docs/src/server/auth.md](../../docs/src/server/auth.md) has the same stale write-rate-limiting gap.
- [../../docs/00-overview/current-state.md](../../docs/00-overview/current-state.md) says it records state through RB-118, but the repository now includes RB-119/RB-120, RB-121 through RB-129, multiple design/performance slices, and EX-001 through EX-005 SaPen-CNN export work.
- [../../docs/03-features/editor.md](../../docs/03-features/editor.md) still describes RB-093 user-facing orchestration as planned for a next sprint, although RB-094/RB-095/RB-101/RB-103/RB-104/RB-123 and design follow-ups changed the current editor flow.
- [../../docs/06-data/crop-based-slice-annotation.md](../../docs/06-data/crop-based-slice-annotation.md) still says "The planned workflow is" for the now-implemented crop path.
- [../../docs/src/components/editor.md](../../docs/src/components/editor.md) still references an iPad Safari checklist as planned in RB-045 instead of the current RB-113/RB-077-B deferred manual gate.
- [../../AGENTS.md](../../AGENTS.md) current baseline risks still group RBAC, audit coverage, login hardening, background workers, and retention cleanup as incomplete without distinguishing the portions already implemented.

## Impact

Future contributors start from `AGENTS.md` and `ARCHITECTURE.md`. Stale current-state statements can cause duplicate work, incorrect risk assessments, or accidental reopening of resolved designs. For production-sensitive annotation/export work, stale docs also increase the chance of changing the wrong flow.

## Goal

Refresh current-state and architecture docs so they distinguish implemented behavior, intentionally deferred work, and historical references.

## Non-Goals

- Do not rewrite the whole docs tree.
- Do not remove historical tickets or ADRs that are accurate as historical records.
- Do not mark the real iPad Safari gate complete.

## Implementation Plan

1. Update stale write-rate-limiting statements in `ARCHITECTURE.md` and auth/server docs to reflect RB-111's single-host high-cost limiter and its limits.
2. Update current-state docs to include RB-119/RB-120, RB-121 through RB-129, design/performance slices where relevant, and EX-001 through EX-005 SaPen-CNN export/materialization work.
3. Refresh editor/crop workflow wording from "planned" to "current" where the implementation now exists, while preserving future/deferred labels for real iPad Safari, advanced gestures, tiled/downscaled masks, bulk review, and dashboards.
4. Narrow `AGENTS.md` baseline-risk wording without expanding it into an encyclopedia.
5. Run docs-link checks and targeted text searches for stale phrases such as "general write-rate limiting ... not implemented" and "planned workflow" in current implementation docs.

## Files to Inspect

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/00-overview/current-state.md`
- `docs/known-gaps.md`
- `docs/src/server/auth.md`
- `docs/03-features/editor.md`
- `docs/06-data/crop-based-slice-annotation.md`
- `docs/src/components/editor.md`
- `docs/06-data/training-export-contract.md`
- `docs/06-data/sapen-cnn-training-dataset-snapshot-contract.md`

## Acceptance Criteria

- Current docs no longer claim RB-111 high-cost write limiting is absent.
- Current-state docs mention SaPen-CNN snapshot/materializer work at map level.
- Implemented crop/editor flows are described as current, not future.
- Real iPad Safari remains explicitly pending and evidence-gated.
- Historical references remain clearly historical.
- Validation includes `npm run check:docs-links`, targeted `rg` checks for the stale phrases, and `git diff --check`.

## Validation Commands

```bash
npm run check:docs-links
rg -n "general write-rate limiting.*not implemented|planned workflow|planned user-facing orchestration" AGENTS.md ARCHITECTURE.md docs
git diff --check
```
