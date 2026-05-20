# RB-057 - Prediction Import API And Storage Validation

## Status

Proposed

## Priority

High

## Type

API / Storage / Prediction Import / Data Integrity

## Depends on

- RB-054 - Model Preprediction And Active-Learning Design
- RB-055 - Upload Artifact Validation And Checksum Hardening
- RB-056 - Prediction Provenance And ModelRun Registry

## Goal

Implement the first server-side prediction import path for model-generated mask proposals.

## Scope

- Add authenticated import APIs for prediction mask artifacts.
- Validate object existence, size, checksum, dimensions, content type, and coordinate space.
- Persist `PREDICTION_MASK` artifact versions with `MODEL_PREDICTION` provenance.
- Link imported predictions to model-run/prediction-run provenance.
- Keep MinIO/S3 storage keys private and expose only app-mediated reads where needed.
- Add tests for permission, validation failure modes, and prediction-not-ground-truth invariants.

## Non-Goals

- Running inference.
- Batch/background imports.
- Editor correction UI.
- Default training export of predictions.

## Acceptance Criteria

- A valid prediction import creates an immutable prediction artifact version.
- Invalid checksum, dimensions, size, or coordinate space are rejected with stable API errors.
- Prediction artifacts are not marked export-ready ground truth.
- Validation baseline remains green.
