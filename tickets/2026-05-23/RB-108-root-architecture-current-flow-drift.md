# RB-108 - Root Architecture Current-Flow Drift

## Status

Planned

## Priority

P2

## Type

Documentation / Architecture Map / Repository Hygiene

## Source

- `docs/adr/remediation-backlog.md` RB-108
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- RB-104 legacy full-image editor removal.

## Blocks

- Reliable agent/contributor onboarding from `ARCHITECTURE.md`.

## Context

`ARCHITECTURE.md` still lists `/app/projects/[projectId]/images/[imageId]/edit` as the current editor flow after RB-104 removed that product route. It also says "crop-aware exports/review integration" is a known workflow gap even though crop training export, crop readiness, and crop review controls now exist.

The verification report agrees this is real documentation drift, but it should be treated as a documentation/governance issue rather than a runtime blocker.

## Goal

Bring the root architecture map back in line with current routes, crop workflow state, and remaining gaps.

## Non-Goals

- Do not change production routes.
- Do not restore the removed `/edit` route.
- Do not rewrite detailed implementation docs that are already current.

## Requirements

- Update `ARCHITECTURE.md` current flows to describe the crop entry, BBox stage, slice navigator, selected crop workbench, crop support editor, crop semantic editor, and assisted-correction route.
- Remove `/edit` from current-flow wording.
- Narrow crop review/export known gaps to reviewer dashboards, bulk review, export history, advanced filters, async large-job handling, and source-image-space crop-mask reprojection if still applicable.
- Keep removed paths only in historical ADR/ticket context.
- If touching lower docs, only align cross-links or clarify historical/current labels.

## Acceptance Criteria

- `ARCHITECTURE.md` no longer presents `/edit` as a current route.
- Current root docs no longer imply crop-aware export/review is broadly missing.
- Historical removed route references are clearly marked as historical where touched.
- No code changes are included.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
```

If lint is skipped for a docs-only slice, document why.
