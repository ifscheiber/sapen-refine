# Active-Learning Task Model

## Purpose

This page defines the active-learning and model-prediction correction task contract. RB-056 implements the prediction-run/provenance links, RB-057 imports prediction mask proposals, and RB-058 implements the first project-level correction task queue APIs/UI.

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

These hooks now back the first queue behavior and MVP task list. `modelSource` remains a display/compatibility hint; reproducible model provenance comes from `predictionRunId` and `predictionProvenanceId`.

## Task Reasons

RB-058 validates these stable machine-readable task reasons at the service/API layer:

- `LOW_CONFIDENCE`
- `HIGH_UNCERTAINTY`
- `MISSING_GROUND_TRUTH`
- `MANUAL_PRIORITY`

`taskReason` is still a string in `prisma/schema.prisma`; `src/server/domain/correctionTasks.ts` is the current validation boundary. `MODEL_DISAGREEMENT`, `STALE_MODEL_VERSION`, and `RANDOM_QA_SAMPLE` remain planned future reasons.

## Task Creation

RB-058 creates correction tasks from `PredictionArtifactProvenance` rows through `src/server/domain/correctionTasks.ts` and `POST /api/prediction-runs/[predictionRunId]/correction-tasks`.

Creation rules:

- project `OWNER` and `QA` can create correction tasks for a prediction run;
- one `MODEL_PREDICTION_CORRECTION` task is created per prediction provenance row;
- repeated creation is idempotent through service checks and `@@unique([predictionProvenanceId, type])` on `AnnotationTask`;
- `HIGH_UNCERTAINTY`, `LOW_CONFIDENCE`, and `MISSING_GROUND_TRUTH` are derived from provenance scores unless a valid reason/default priority is supplied;
- source prediction bytes remain private and are never copied into a human ground-truth artifact by this queue step.

Tasks reference:

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

Default deterministic ordering for active-learning queues, implemented in `src/server/domain/correctionTasks.ts`:

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

RB-058 validates priority as an integer `0..100`. Higher numeric priority means more urgent.

## Task Status

Existing task statuses are usable for the first queue:

- `OPEN` - created and available.
- `IN_PROGRESS` - assigned or actively being edited.
- `SUBMITTED` - human correction is submitted for review.
- `BLOCKED` - cannot proceed due to missing image/artifact/metadata.
- `DONE` - accepted workflow outcome exists.
- `CANCELLED` - no longer needed.

Review approval remains artifact/classification state, not task state. A task reaching `DONE` should not imply that a model prediction became approved.

RB-058/RB-059 task actions:

- `assign_to_me` sets the current user as assignee.
- `assign` is owner/QA-only and requires an assignable project member.
- `start` moves an active task to `IN_PROGRESS`.
- `dismiss` moves an active task to `CANCELLED`.
- `set_priority` is owner/QA-only.
- RB-059 correction draft save moves an active task to `IN_PROGRESS` and assigns it to the saving user if it was unassigned.
- RB-059 review submit moves a linked human correction task to `SUBMITTED`; approval moves it to `DONE`; rejection moves it back to `IN_PROGRESS`.

Tasks are not marked complete merely because a prediction was viewed or copied locally.

## Editor Requirements

RB-058 exposes queue navigation through `/app/projects/[projectId]/tasks`; RB-059 routes correction tasks to `/app/projects/[projectId]/tasks/[taskId]/correct`.

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

## Implemented APIs And UI

- `GET /api/projects/[projectId]/correction-tasks` lists project correction tasks for project members.
- `POST /api/prediction-runs/[predictionRunId]/correction-tasks` creates idempotent correction tasks for project `OWNER`/`QA`.
- `GET /api/correction-tasks/[taskId]` returns one sanitized correction task.
- `PATCH /api/correction-tasks/[taskId]` supports claim/assign/start/dismiss/priority actions.
- `/app/projects/[projectId]/tasks` renders the first responsive project task queue.
- `/app/projects/[projectId]/tasks/[taskId]/correct` renders the first assisted correction editor entry.

API responses expose sanitized model/run/provenance summaries and do not expose artifact storage keys.

## Deferred Implementation

Follow-up tickets should implement:

- assisted correction editor route/workflow that loads prediction overlays read-only;
- optional prediction-analysis export mode;
- background/batch prediction imports and queue generation;
- additional task reasons such as model disagreement or stale model version.

## Related Docs

- [model-prediction-contract.md](model-prediction-contract.md)
- [../03-features/editor.md](../03-features/editor.md)
- [../workflows/future-prediction-assisted-annotation.md](../workflows/future-prediction-assisted-annotation.md)
