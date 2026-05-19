# RB-053 - Admin Training Export MVP

## Status

Proposed

## Priority

High

## Type

Export / Manifest / Admin Workflow

## Depends on

- RB-049 - Annotation Domain Schema Implementation
- RB-052 - Review And Approval Workflow

## Goal

Implement a minimal reproducible training export workflow.

## Scope

- Create export batches with actor attribution.
- Generate manifests for semantic segmentation, support/instance segmentation, slice classification, and combined exports.
- Reference exact immutable image, mask/support, classification, label schema, and review versions.
- Include checksums, selection criteria, warnings, and metadata completeness.
- Add export docs and tests for manifest reproducibility.

## Non-Goals

- Large-scale job queue or distributed export worker.
- Direct SaPen Core ingestion.
- Model training orchestration.

## Acceptance Criteria

- Admin/authorized export users can create an export batch.
- Manifest references exact immutable versions.
- Copper semantic masks are never exported as support geometry unless a separate derived support artifact exists.
- Export tests prove reproducibility-critical manifest fields.
- Validation baseline remains green.
