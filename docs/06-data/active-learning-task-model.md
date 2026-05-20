# Active-Learning Task Model

## Purpose

This page defines the active-learning and model-prediction correction task contract. RB-056 implements the prediction-run/provenance links and RB-057 imports prediction mask proposals that future queues can use, but queue APIs and UI remain deferred.

The task model must help annotators decide what to correct next without allowing model output to bypass human review.

## Current Evidence

Current schema hooks in `prisma/schema.prisma`:

- `AnnotationTaskType.MODEL_PREDICTION_CORRECTION`
- `AnnotationTask.status`
- `AnnotationTask.priority`
- `AnnotationTask.taskReason`
- `AnnotationTask.uncertaintyScore`
- `AnnotationTask.confidenceScore`
- `AnnotationTask.modelSource`
- `AnnotationTask.sourceArtifactVersionId`
- `AnnotationTask.predictionRunId`
- `AnnotationTask.predictionProvenanceId`
- `AnnotationTask.assigneeId`
- `AnnotationTask.createdAt`
- `PredictionRun`
- `PredictionArtifactProvenance`

These hooks are sufficient to design the first queue behavior and a simple MVP task list. `modelSource` remains a display/compatibility hint; reproducible model provenance now comes from `predictionRunId` and `predictionProvenanceId`.

## Task Reasons

Future task reasons should use stable machine-readable values:

- `LOW_CONFIDENCE`
- `HIGH_UNCERTAINTY`
- `MODEL_DISAGREEMENT`
- `MISSING_GROUND_TRUTH`
- `STALE_MODEL_VERSION`
- `RANDOM_QA_SAMPLE`
- `MANUAL_PRIORITY`

`taskReason` is currently a string, so the first implementation can validate these values at the service/API layer before deciding whether a Prisma enum is needed.

## Task Creation

Future RB-058 task creation should create correction tasks when:

- a prediction exists and no approved human ground truth exists,
- a prediction has high uncertainty or low confidence,
- multiple model outputs disagree,
- a project owner or QA user manually requests review,
- a model version is stale against a newer approved label schema or image set.

Tasks should reference:

- project,
- image,
- slice instance when applicable,
- source prediction artifact version where applicable,
- `predictionRunId` and `predictionProvenanceId` when a prediction registry row exists,
- model source/run summary derived from `PredictionRun.modelRun`, not free text,
- confidence and uncertainty scores,
- assignee when assigned,
- createdBy system actor or importer.

## Queue Ordering

Default deterministic ordering for active-learning queues:

```text
highest manual priority first
then highest uncertainty score
then lowest confidence score
then oldest createdAt
then stable task id
```

Rationale:

- manual priority lets project owners escalate urgent work,
- uncertainty surfaces likely high-value correction cases,
- low confidence breaks ties toward weaker model outputs,
- oldest createdAt prevents starvation,
- task id makes ordering stable for pagination.

Future implementation should define whether `priority` is an integer scale such as `0..100` or a small enum-like band. Until then, higher numeric priority means more urgent.

## Task Status

Existing task statuses are usable for the first queue:

- `OPEN` - created and available.
- `IN_PROGRESS` - assigned or actively being edited.
- `SUBMITTED` - human correction is submitted for review.
- `BLOCKED` - cannot proceed due to missing image/artifact/metadata.
- `DONE` - accepted workflow outcome exists.
- `CANCELLED` - no longer needed.

Review approval remains artifact/classification state, not task state. A task reaching `DONE` should not imply that a model prediction became approved.

## Editor Requirements

Future correction routes should be URL-addressable, for example through a task-specific route or query parameter that can load:

- source image,
- read-only prediction overlay,
- editable human mask layer,
- confidence/uncertainty/task reason context,
- review state of the human output.

Editor constraints:

- prediction overlay must be visually distinct from editable human annotation,
- "use prediction as starting mask" must be explicit,
- prediction artifacts must remain immutable,
- semantic mask and slice support modes must stay separate,
- touch targets and layout must remain usable on iPad-sized screens.

## Deferred Implementation

RB-054/RB-057 do not add queue APIs or UI. Follow-up tickets should implement:

- task queue query/update APIs,
- task list and assignment UI,
- assisted correction editor route/workflow,
- optional prediction-analysis export mode.

RB-056 implements the provenance schema/model-run registry, and RB-057 imports prediction masks without creating tasks. RB-058 should create/list correction tasks from `PredictionArtifactProvenance` and should not fall back to `AnnotationTask.modelSource` as the source of truth.

## Related Docs

- [model-prediction-contract.md](model-prediction-contract.md)
- [../03-features/editor.md](../03-features/editor.md)
- [../workflows/future-prediction-assisted-annotation.md](../workflows/future-prediction-assisted-annotation.md)
