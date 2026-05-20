# RB-060 - Prediction Analysis Export Mode

## Status

Proposed

## Priority

Medium

## Type

Export / QA / Prediction Analysis

## Depends on

- RB-054 - Model Preprediction And Active-Learning Design
- RB-056 - Prediction Provenance And ModelRun Registry
- RB-057 - Prediction Import API And Storage Validation

## Goal

Design and implement an optional prediction-analysis export mode that is explicitly separate from ground-truth training export.

## Scope

- Define a new export target or route for prediction QA/analysis datasets.
- Include prediction artifacts, model provenance, confidence/uncertainty, and comparison references where available.
- Keep RB-053 default training exports approved-human-only.
- Add warnings and naming that prevent prediction exports from being mistaken for ground-truth labels.
- Add tests for target separation and authorization.

## Non-Goals

- Changing default training export eligibility.
- Training model orchestration.
- Automatic model evaluation metrics unless explicitly covered by the implementation ticket.

## Acceptance Criteria

- Prediction-analysis exports cannot be requested through default ground-truth export targets.
- Export manifests clearly label prediction artifacts as proposals.
- Approved human ground truth and model predictions remain distinct in package layout and manifest fields.
- Validation baseline remains green.
