# RB-098 — Crop Workflow Smoke Test, Legacy Full-Image Boundary and UX Polish

## Status

Proposed / Depends on RB-097

## Priority

Medium / High

## Type

Smoke Test / UX Polish / Workflow Boundary / Documentation

## Goal

Finalize the crop workflow UX sprint with smoke coverage, documentation, and clear boundaries between legacy full-image editing and crop-based annotation.

## Scope

- Add/update full crop workflow E2E/manual smoke:
  - upload image,
  - draw BBoxes,
  - confirm BBox set,
  - navigate slices,
  - generate crop,
  - support mask,
  - semantic mask,
  - auto classification,
  - readiness/export visibility.
- Clarify when full-image editor is still used.
- Clarify when crop workflow is preferred.
- Remove/soft-hide confusing full-image semantic/support controls if crop workflow is active, if safe.
- Update docs and known gaps.
- Produce sprint closeout notes.

## Non-Goals

- No large refactor.
- No new domain model unless a small UX flag is needed.
- No iPad physical validation unless available.

## Tests

- Crop workflow smoke is green.
- Existing full-image editor smoke remains green.
- No regression in exports.
- Manual smoke docs updated.

## Acceptance Criteria

1. End-to-end crop workflow is documented and test-covered.
2. Legacy/full-image boundary is understandable.
3. UI no longer exposes contradictory workflows in the same primary view.
4. Sprint closeout docs updated.
5. Full validation passes.
