# RB-061 - Batch Prediction Import And Background Jobs

## Status

Proposed

## Priority

Medium

## Type

Batch Import / Background Jobs / Operations

## Depends on

- RB-054 - Model Preprediction And Active-Learning Design
- RB-056 - Prediction Provenance And ModelRun Registry
- RB-057 - Prediction Import API And Storage Validation

## Goal

Support larger prediction imports without relying on long synchronous browser or route-handler requests.

## Scope

- Define a background job model for batch prediction import.
- Track batch status, item-level failures, retries, and import summaries.
- Preserve object validation and provenance rules from RB-056/RB-057.
- Document operational behavior for customer-trial and future production deployments.
- Add tests for retry-safe import bookkeeping.

## Non-Goals

- Running inference.
- Replacing the current synchronous training export.
- High-availability job infrastructure.

## Acceptance Criteria

- Batch import progress and failures are attributable and inspectable.
- Partial failures do not create ambiguous ground-truth state.
- Imported predictions remain proposal artifacts only.
- Validation baseline remains green.
