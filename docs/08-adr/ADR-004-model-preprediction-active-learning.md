# ADR-004 - Model Preprediction And Active Learning

## Status

Accepted for RB-054 design. RB-056 through RB-061 now implement the first provenance, import, correction queue, assisted correction, prediction-analysis export, and batch import slices.

## Context

RB-049 through RB-053 established the core SaPen Annotate data boundary: images, label schemas, semantic masks, slice support masks, slice classifications, review/approval state, and approved-only training exports.

The schema already includes prediction-oriented hooks such as `AnnotationArtifactKind.PREDICTION_MASK`, `ArtifactProvenance.MODEL_PREDICTION`, `ArtifactProvenance.HUMAN_CORRECTION`, `AnnotationTaskType.MODEL_PREDICTION_CORRECTION`, task priority/confidence/uncertainty fields, `AnnotationTask.sourceArtifactVersionId`, and `AnnotationArtifactVersion.parentVersionId`.

Those hooks allow the product to design prediction-assisted annotation without changing the ground-truth rules.

## Decision

Model predictions are proposals only. They are not ground truth and are not export-ready training labels.

For the first implementation:

- mask predictions use `AnnotationArtifactKind.PREDICTION_MASK`,
- prediction target type is stored in explicit prediction metadata,
- correction tasks link to predictions through `AnnotationTask.sourceArtifactVersionId`,
- human mask corrections link to predictions through `AnnotationArtifactVersion.parentVersionId`,
- human corrections create separate versions with `ArtifactProvenance.HUMAN_CORRECTION`,
- review/approval applies to the human version, not the prediction,
- RB-053 training exports stay approved-human-only.

The current task fields are sufficient for a first active-learning queue ordering. They are not sufficient for reproducible model provenance by themselves. RB-056 adds `ModelRun`, `PredictionRun`, and `PredictionArtifactProvenance` before real prediction imports.

## Consequences

- Prediction-assisted correction can be added later without weakening ground-truth integrity.
- Existing export behavior does not need to change for RB-054.
- The RB-059 editor supports read-only prediction overlays and editable human correction layers for semantic/support masks.
- Slice classification predictions need a proposal/task representation before human approval; they should not be inserted as approved classification rows.
- RB-055 object validation hardening is used by RB-057 for trustworthy one-at-a-time prediction mask imports; RB-061 reuses the same import service for ZIP-backed batch imports.

## Deferred Work

- RB-056: Prediction provenance schema and model-run registry. Implemented after this ADR.
- RB-057: Prediction import API and storage validation. Implemented after this ADR.
- RB-058: Active-learning task queue API/UI. Implemented after this ADR.
- RB-059: Assisted correction editor workflow. Implemented after this ADR.
- RB-060: Optional QA/prediction-analysis export mode separate from ground-truth export. Implemented after this ADR.
- RB-061: Batch prediction import and background job support. Implemented after this ADR as a single-host DB-backed baseline.
- RB-065: Single-host batch runner leases, stale recovery, and optional Compose worker. Implemented after this ADR.
- RB-066: Temporary staging/orphan storage cleanup. Implemented after this ADR.
- Cleanup UI, production-scale workers, classification batch imports, and model metrics dashboards remain deferred.

## Evidence

- Current schema: `prisma/schema.prisma`
- Prediction contract: `docs/06-data/model-prediction-contract.md`
- Active-learning task model: `docs/06-data/active-learning-task-model.md`
- Training export contract: `docs/06-data/training-export-contract.md`
- Editor docs: `docs/03-features/editor.md`
