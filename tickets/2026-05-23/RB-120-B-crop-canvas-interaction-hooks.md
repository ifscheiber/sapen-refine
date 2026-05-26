# RB-120-B - Crop Canvas Interaction Hooks

## Status

Planned / Deferred

## Priority

P3 after RB-113 evidence, P2 only if real iPad Safari testing exposes canvas interaction defects

## Type

Maintainability / Editor Canvas / iPad Risk Reduction

## Source

- `docs/01-architecture/opportunistic-decomposition-map.md`
- RB-120 follow-up

## Activation Condition

Wait for RB-113 real iPad Safari evidence or a concrete crop canvas feature/bug. Do not change touch, pointer, zoom, or Pencil behavior speculatively.

## Goal

Extract shared crop editor canvas interaction state only where crop semantic and crop support behavior is already proven equivalent.

## Requirements

- Preserve current Pointer Events behavior.
- Do not encode Safari/iPad-specific behavior before evidence exists.
- Keep semantic-family and Copper support policy outside the canvas hook.
- Cover pointer/canvas helper behavior with focused tests.

## Validation

- `npm run test -- tests/unit/editor-canvas-geometry.test.ts tests/unit/crop-mask-operations.test.ts`
- Crop workflow E2E if interaction behavior changes.
