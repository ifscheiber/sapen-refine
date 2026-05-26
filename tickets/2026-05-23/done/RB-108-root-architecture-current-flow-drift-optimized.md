# RB-108 - Root Architecture Current-Flow Drift

## Status

Completed

## Priority

P2

## Type

Documentation / Architecture Map / Agent Onboarding / Repository Hygiene

## Source

- `docs/adr/remediation-backlog.md` RB-108
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- README sequence note: RB-108 is docs-only but early because `ARCHITECTURE.md` is an agent/contributor entry point.

## Depends On

- RB-104 legacy full-image editor route removal.
- Current crop workflow documentation after RB-091/RB-092/RB-098/RB-104.
- RB-106 completed only as baseline context; this ticket must not change API behavior.

## Blocks

- Reliable agent/contributor onboarding from the root `ARCHITECTURE.md`.
- Avoiding new tickets or code changes against a removed route or already-implemented broad crop review/export functionality.

## Context

`ARCHITECTURE.md` is a high-level entry map for humans and Codex agents. It still presents `/app/projects/[projectId]/images/[imageId]/edit` as a current editor flow even though the legacy full-image editor product route was removed by RB-104.

It also still describes `crop-aware exports/review integration` as a broad known workflow gap. That wording is now too broad because crop training export, crop readiness, crop review controls, and crop export integration exist. The remaining gaps are narrower and should be stated as such.

This is documentation drift, not a runtime bug. The fix should be intentionally small and should not become a general documentation cleanup or route redesign.

## Goal

Bring the root architecture map back in line with the current app route structure, crop workflow state, and remaining known gaps, while preserving historical route references only where they are clearly marked as historical.

## Non-Goals

- Do not change production routes.
- Do not restore `/app/projects/[projectId]/images/[imageId]/edit`.
- Do not modify API route behavior or runtime code.
- Do not rewrite detailed implementation docs that are already current.
- Do not reintroduce the rejected `docs/README.md` broken-link finding.
- Do not perform broader ADR/backlog governance cleanup; leave that to RB-119.

## Requirements

- Update `ARCHITECTURE.md` current-flow sections so they no longer present the removed `/edit` route as current.
- Describe the current crop-oriented flow at root level, including the relevant high-level stages:
  - project/image workspace entry,
  - crop workflow entry,
  - BBox stage,
  - slice navigator / selected crop workbench,
  - crop support editor,
  - crop semantic editor,
  - assisted-correction route if currently documented as part of the flow.
- Narrow the known-gap wording from broad `crop-aware exports/review integration` to the actual remaining gaps, such as:
  - reviewer dashboards,
  - bulk review,
  - export history,
  - advanced filters,
  - async/large-job handling,
  - source-image-space crop-mask reprojection only if it is still not implemented.
- Check `docs/src/app/routes.md`, `docs/08-adr/ADR-006-crop-workflow-ux-orchestration.md`, and `docs/known-gaps.md` only to avoid contradiction with root docs.
- If touching lower-level docs, limit changes to cross-link alignment or labels such as `Current route`, `Historical route`, and `Removed by RB-104`.
- Update the remediation backlog entry for RB-108 if present.
- Move the ticket to the appropriate `done/` folder once implemented.

## Acceptance Criteria

- `ARCHITECTURE.md` no longer presents `/app/projects/[projectId]/images/[imageId]/edit` as a current product route.
- `ARCHITECTURE.md` no longer implies that crop-aware export/review integration is broadly missing.
- Remaining crop review/export gaps are stated narrowly and consistently with current lower-level docs.
- Any historical references to removed routes are clearly labeled as historical/removed and not part of the current flow.
- No production code changes are included.
- The rejected `docs/README.md` broken-link claim is not reintroduced.

## Suggested Implementation Plan

1. Inspect `ARCHITECTURE.md` for current-flow route references and known-gap wording.
2. Cross-check the current route description in `docs/src/app/routes.md` and the RB-104/ADR historical note.
3. Patch only the minimal root-doc sections necessary to remove drift.
4. Update `docs/adr/remediation-backlog.md` or equivalent backlog status if present.
5. Run docs validation and commit the docs-only slice.

## Implementation Notes

- Updated `ARCHITECTURE.md` so the current annotation entry is the crop workflow rather than the removed legacy `/edit` route.
- Corrected crop support/semantic editor paths to the current `/crop/slices/[sliceInstanceId]/crops/[cropId]/...` routes.
- Narrowed root known-gap wording to remaining review/export dashboards, bulk operations, export history/filtering, async large-job handling, and source-image-space crop-mask reprojection.
- Marked RB-108 resolved in `docs/adr/remediation-backlog.md`.
- Moved this optimized ticket to `tickets/2026-05-23/done/` and removed the old non-optimized ticket.

## Validation

Completed validation:

- Baseline before editing: `git status --short` showed staged optimized RB-107/RB-108 tickets, two review source reports, and `tickets/design/DESIGN-001-sapen-annotate-login-page-redesign.md`; `npm run test -- tests/unit/api-route-error-contracts.test.ts` passed.
- `git diff --check` passed.
- `npm run lint` passed.

Required command set:

```bash
git status --short
git diff --check
npm run lint
```

If lint is intentionally skipped for a docs-only slice, document why. If the handoff dry-run is needed and remains blocked only by the known pre-existing untracked review reports, run:

```bash
npm run handoff:archive -- --dry-run --allow-dirty
```

and document the reason.
