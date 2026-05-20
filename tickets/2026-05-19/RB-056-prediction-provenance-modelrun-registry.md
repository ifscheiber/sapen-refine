# RB-056 - Prediction Provenance And ModelRun Registry

## Status

Proposed

## Priority

High

## Type

Schema / Provenance / Prediction Contract

## Depends on

- RB-054 - Model Preprediction And Active-Learning Design
- RB-055 - Upload Artifact Validation And Checksum Hardening

## Goal

Add persisted model-run and prediction-run provenance so future prediction imports are reproducible and auditable.

## Scope

- Define `ModelRun` / `PredictionRun` or equivalent provenance storage.
- Record model family/name, version, checkpoint, training run, inference run, config hash, source export/dataset, generatedAt, generatedBy, warnings, and notes.
- Define where per-class confidence, uncertainty, and output statistics live.
- Link prediction artifact versions and correction tasks to provenance records.
- Update docs and tests for provenance integrity.

## Non-Goals

- Running models.
- Importing prediction files.
- Active-learning UI.
- Training export changes.

## Acceptance Criteria

- Prediction provenance can be stored without using display labels or free-form task text as the source of truth.
- A prediction artifact can be traced to a model/run/config/source dataset.
- Human correction artifacts can reference prediction provenance indirectly through their source prediction.
- Validation baseline remains green.
