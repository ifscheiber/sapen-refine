# RB-093 — Crop Workflow UX State Machine & Route Design

## Status

Proposed / Ready for Codex

## Priority

High

## Type

UX Architecture / Workflow State / Routing / Documentation

## Goal

Define the user-facing crop workflow state machine and route structure before further UI implementation.

## Context

Manual smoke testing showed that the current editor exposes too many underlying primitives at once. Users can draw semantic/support masks and classifications on the full image page while BBox/crop workflow tools also exist. The desired workflow is staged:

```text
BBox stage → Slice navigator → Crop support/semantic workbench → Classification/readiness
```

## Scope

Create/update documentation and route/state design for:

- Image-level BBox stage,
- BBox set confirmation,
- Slice navigation workspace,
- Crop annotation workbench,
- semantic-family exclusivity,
- classification derived from semantic masks,
- readiness/status display per slice.

## Non-Goals

Do not implement runtime UI or schema changes unless a tiny route/docs helper is required.

## Required Decisions

- What routes exist for:
  - BBox stage,
  - slice navigator,
  - crop workbench,
  - selected slice support/semantic mode.
- What workflow states exist:
  - no BBoxes,
  - BBox draft,
  - BBox set confirmed,
  - crop exists,
  - support missing/draft/approved,
  - semantic missing/draft/approved,
  - classification auto/manual/review required.
- How the full-image editor relates to the crop workflow.
- Whether BBox “approve” should instead be called “confirm”.

## Acceptance Criteria

1. Workflow state diagram is documented.
2. Route structure is documented.
3. Terminology distinguishes BBox confirmation from ground-truth approval.
4. Follow-up tickets RB-094 to RB-098 are aligned.
5. No product behavior changes.
6. Full validation gate or docs-appropriate validation passes.
