# RB-058 - Active-Learning Task Queue API And UI

## Status

Proposed

## Priority

Medium / High

## Type

Task Queue / API / UI

## Depends on

- RB-054 - Model Preprediction And Active-Learning Design
- RB-056 - Prediction Provenance And ModelRun Registry
- RB-057 - Prediction Import API And Storage Validation

## Goal

Expose prediction-backed correction tasks in a deterministic active-learning queue.

## Scope

- Add APIs for listing, filtering, assigning, and updating `MODEL_PREDICTION_CORRECTION` tasks.
- Implement ordering by priority, uncertainty, confidence, createdAt, and stable id.
- Validate stable task reasons such as `LOW_CONFIDENCE`, `HIGH_UNCERTAINTY`, and `MODEL_DISAGREEMENT`.
- Add a minimal project-level task queue UI for eligible roles.
- Preserve URL-addressable task navigation.

## Non-Goals

- Editor correction overlay behavior.
- Model import implementation.
- Notification system.
- Complex workload balancing.

## Acceptance Criteria

- Users with appropriate project roles can see correction tasks in deterministic order.
- Viewer/read-only roles cannot mutate task state.
- Queue entries expose prediction provenance summary without leaking private storage keys.
- Validation baseline remains green.
