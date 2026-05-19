# RB-051 - Slice Classification And Support-Mask Workflow

## Status

Proposed

## Priority

High

## Type

Domain Workflow / Editor / Mask Model

## Depends on

- RB-049 - Annotation Domain Schema Implementation

## Goal

Implement the first slice classification and slice support/instance mask workflow.

## Scope

- Add or expose workflows for slice classifications such as `SAP_HEARTWOOD_SLICE`, `COPPER_SLICE`, `UNKNOWN`, and `REVIEW_REQUIRED`.
- Add support/instance mask artifact creation separate from semantic material masks.
- Keep Copper semantic masks separate from physical slice support geometry.
- Update editor docs, mask docs, and domain docs.
- Add focused tests for domain/API behavior where practical.

## Non-Goals

- Admin export implementation.
- Model-assisted prediction.
- Complex multi-object editing UI if a minimal support mask workflow is sufficient for the slice.

## Acceptance Criteria

- Slice classification is persisted with attribution and schema version context.
- Support/instance geometry is persisted separately from semantic material masks.
- Copper semantic annotations cannot be silently treated as slice support geometry.
- Validation baseline remains green.
