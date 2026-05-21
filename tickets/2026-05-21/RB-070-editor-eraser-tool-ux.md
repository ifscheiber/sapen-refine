# RB-070 - Editor Eraser Tool UX

## Status

Proposed / Ready for Planning

## Priority

Medium

## Type

Editor UX / Annotation Workflow / iPad Readiness

## Context

The current editor supports brush and lasso tools, and users can effectively erase by painting the background label. That is functionally sufficient, but the workflow is not obvious and is weak UX for repeated desktop or iPad annotation.

Current evidence:

- `src/features/editor/EditorClient.tsx` defines `Tool = "brush" | "lasso_free" | "lasso_poly"`.
- The label palette includes background labels, so erasing is possible indirectly.
- There is no explicit Eraser control or mode.

## Goal

Add an explicit Eraser tool or eraser mode that writes the active background value for the current mask mode while preserving existing brush/lasso behavior.

## Requirements

- Semantic eraser writes `Labels.BG`.
- Support-mask eraser writes the support background value.
- The eraser should use the same size control as the brush.
- The UI should make erasing discoverable on desktop and iPad-sized layouts.
- Undo/redo, autosave dirty state, and overlay updates must work exactly like brush strokes.
- Existing background-label painting should remain valid if the label palette still exposes background.

## Non-Goals

- Do not change mask serialization.
- Do not change review/export semantics.
- Do not add multi-touch gestures in this ticket.
- Do not refactor the full editor component unless required for a small safe implementation.

## Acceptance Criteria

- Users can select an explicit Eraser control and erase semantic/support mask pixels.
- Eraser works with pointer/mouse/touch input.
- Eraser stroke is undoable and redoable.
- Desktop E2E or focused unit/editor test coverage protects eraser behavior.
- Editor/iPad smoke docs mention the eraser workflow.

