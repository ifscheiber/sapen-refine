# SCNN-002 - Native Annotate Snapshot Loader And Config Templates

## Repository

`sapen-cnn`

## Context

The first Annotate export sprint materializes local folders compatible with current
`sapen-cnn` loaders. A later CNN-side improvement should allow `sapen-cnn` to understand
the Annotate snapshot contract directly, or provide config templates that point to a
materialized snapshot without manual path editing.

## Goal

Add native support or documented templates for SaPen Annotate CNN training snapshots.

## Acceptance Criteria

- Instance segmentation, classification, and semantic segmentation configs can be
  generated or copied for a materialized Annotate snapshot root.
- Classification training consumes crop-level samples, not whole-image labels.
- Split assignments from Annotate are preserved.
- Docs reference the Annotate manifest version
  `sapen-annotate-cnn-training-dataset-v1`.
- No storage keys or secrets are required by `sapen-cnn` training commands.
