# RB-095 — Slice Navigator with Whole-Image Context and Status Badges

## Status

Proposed / Depends on RB-094

## Priority

High

## Type

UX / Navigation / Crop Workflow / Status Summary / Tests

## Goal

Add a slice navigator that shows the whole image with BBoxes and per-slice annotation status.

## Desired Behavior

The user sees the whole source image as orientation context, with BBoxes overlaid.

Each slice has a navigator card or list entry with:

```text
slice number/name
BBox status
crop status
support status
semantic status
classification status
review/export readiness
```

Clicking a slice opens the crop workbench for that slice.

## Scope

- Whole-image navigator view.
- BBox overlays.
- Selected slice highlight.
- Slice cards/list.
- Status badges.
- Optional small mask/crop thumbnails if cheap.
- Navigation to crop support/semantic workbench.

## Non-Goals

- Do not implement crop editing here.
- Do not implement new annotation persistence.
- Do not create a full dashboard.

## Tests

- Navigator shows all current BBoxes/slices.
- Click slice changes selected slice.
- Selected slice opens correct crop route/workbench.
- Status badges update after support/semantic/classification exist.
- Existing project/image routes remain green.

## Acceptance Criteria

1. Whole-image context navigator exists.
2. BBoxes are visible in navigation.
3. Slice selection is clear.
4. Status badges show annotation progress.
5. Navigation to crop workbench works.
6. Docs and smoke tests updated.
7. Full validation passes.
