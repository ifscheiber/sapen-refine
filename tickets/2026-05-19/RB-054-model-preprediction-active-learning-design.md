# RB-054 - Model Preprediction And Active-Learning Design

## Status

Proposed

## Priority

Medium

## Type

Architecture / Domain Design / Future Workflow

## Depends on

- RB-049 - Annotation Domain Schema Implementation

## Goal

Design the future model preprediction, correction, and active-learning queue workflow without weakening human ground-truth integrity.

## Scope

- Define prediction artifact provenance: model source, checkpoint/run/config, generatedAt, confidence, and uncertainty.
- Define AnnotationTask priority, task reason, queue/ranking context, and source prediction references.
- Define how human correction creates separate artifact versions instead of overwriting predictions.
- Update ADR/domain docs and create implementation tickets if needed.

## Non-Goals

- Running models.
- Importing actual prediction artifacts.
- Rewriting the editor for assisted correction.

## Acceptance Criteria

- Prediction and active-learning concepts are documented with source references to the implemented schema.
- Human ground truth remains separate from model predictions.
- Follow-up implementation tickets are created if design identifies concrete slices.
