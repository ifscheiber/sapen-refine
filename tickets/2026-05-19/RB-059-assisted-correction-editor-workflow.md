# RB-059 - Assisted Correction Editor Workflow

## Status

Proposed

## Priority

Medium / High

## Type

Editor / Prediction Overlay / Human Correction

## Depends on

- RB-054 - Model Preprediction And Active-Learning Design
- RB-057 - Prediction Import API And Storage Validation
- RB-058 - Active-Learning Task Queue API And UI

## Goal

Implement the editor workflow for correcting prediction-backed tasks while preserving human ground-truth integrity.

## Scope

- Open prediction correction tasks through route-addressable editor state.
- Load prediction artifacts as read-only overlays.
- Add explicit "use prediction as starting mask" behavior.
- Save corrected work as separate human artifact versions with `HUMAN_CORRECTION` provenance.
- Link human corrections to source predictions.
- Show model confidence, uncertainty, and task reason without crowding iPad-sized layouts.

## Non-Goals

- Model import APIs.
- Active-learning queue implementation.
- Automatic approval of corrected predictions.
- Multi-object/multi-slice editor expansion beyond the current ticket needs.

## Acceptance Criteria

- Prediction artifacts cannot be mutated by editor actions.
- Corrected human versions are draft/submittable/reviewable through the existing review workflow.
- Prediction and human layers are visually distinct.
- Desktop E2E and iPad smoke preparation are updated.
- Validation baseline remains green.
