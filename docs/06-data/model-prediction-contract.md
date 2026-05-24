# Model Prediction Contract

## Purpose

This page defines the model preprediction and assisted correction contract. RB-056 implements the provenance registry, RB-057 implements the first server-side prediction mask import path, RB-058 implements the first active-learning correction task queue, RB-059 implements assisted correction, RB-061 implements DB-backed batch prediction imports, RB-065 implements single-host batch-runner hardening, RB-066 implements temporary storage cleanup for staging/orphan objects, and RB-067 implements export-time QA metrics for prediction-vs-approved-reference comparisons. Running inference remains deferred.

Hard rule:

```text
Model predictions are proposals, not ground truth.
```

Prediction artifacts must not become training labels unless a human creates or corrects a separate human artifact/version and that human version is submitted and approved through the review workflow.

## Current Evidence

- Current schema: `prisma/schema.prisma`
- Prediction-capable artifact kind: `AnnotationArtifactKind.PREDICTION_MASK`
- Human correction provenance: `ArtifactProvenance.HUMAN_CORRECTION`
- Model prediction provenance: `ArtifactProvenance.MODEL_PREDICTION`
- Correction task type: `AnnotationTaskType.MODEL_PREDICTION_CORRECTION`
- Task source link: `AnnotationTask.sourceArtifactVersionId`
- Structured task run link: `AnnotationTask.predictionRunId`
- Structured task item link: `AnnotationTask.predictionProvenanceId`
- Human artifact source link: `AnnotationArtifactVersion.parentVersionId`
- Model registry: `ModelRun`
- Project inference registry: `PredictionRun`
- Per-image prediction item registry: `PredictionArtifactProvenance`
- Domain service: `src/server/domain/predictionProvenance.ts`
- Import service: `src/server/domain/predictionImport.ts`
- Batch import service: `src/server/domain/predictionImportBatches.ts`
- Storage cleanup service: `src/server/domain/storageCleanup.ts`
- Prediction QA metrics: `src/server/domain/predictionAnalysisMetrics.ts`
- Minimal APIs: `src/app/api/model-runs/*`, `src/app/api/projects/[projectId]/prediction-runs/route.ts`, `src/app/api/prediction-runs/[predictionRunId]/route.ts`, `src/app/api/prediction-runs/[predictionRunId]/predictions/route.ts`, `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts`, `src/app/api/prediction-import-batches/*`, `src/app/api/prediction-runs/[predictionRunId]/correction-tasks/route.ts`, `src/app/api/projects/[projectId]/correction-tasks/route.ts`, and `src/app/api/correction-tasks/[taskId]/route.ts`
- Export implementation: `src/server/domain/exports.ts`

## Implemented Registry

RB-056 adds three persisted registry levels in `prisma/schema.prisma`:

- `ModelRun` stores model family/name/version, task type, checkpoint id/path/hash, training run/dataset/export references, training code version/git commit, config hash, createdBy, notes, warnings, and metadata.
- `PredictionRun` stores a project-scoped inference execution linked to one `ModelRun`, with optional source export/dataset/selection criteria, inference run id, generatedBy/generatedAt, status, input/output counts, aggregate confidence/uncertainty summaries, config hash, warnings, notes, and metadata.
- `PredictionArtifactProvenance` stores per-image prediction proposal metadata linked to a `PredictionRun`, optional `PREDICTION_MASK` artifact version, optional slice instance, target type, predicted class for classification proposals, confidence/uncertainty, per-class scores, output stats, and model-output checksum.

Related enums are `ModelTaskType`, `PredictionRunStatus`, and `PredictionTargetType`.

Direct ModelRun reads are admin-only because they may include internal checkpoint paths. Project `OWNER`/`QA` users read reduced model summaries through project-scoped prediction-run responses; Annotator/`LABELER` users do not receive prediction-run summaries.

## Implemented Import API

RB-057 adds `POST /api/prediction-runs/[predictionRunId]/predictions` for one prediction mask per request. The route accepts `multipart/form-data` with:

- `imageId`
- `targetType` as `SEMANTIC_MASK` or `SLICE_SUPPORT_MASK`
- `file` containing image-sized raw `u8raw-v1` bytes
- `width` and `height`
- optional `format`, `coordinateSpace`, `checksum`, `confidenceScore`, `uncertaintyScore`, `perClassScoresJson`, and `outputStatsJson`

The import route is project-scoped. Project `OWNER` and `QA` can import predictions. `LABELER`, `VIEWER`, and users without membership cannot import predictions. There is no global-admin bypass without project membership.

RB-057 does not accept arbitrary client-supplied storage keys. The app writes imported bytes to private object storage under an internal prediction prefix, verifies the stored object, and returns only sanitized ids/checksum/dimension/provenance metadata.

## Implemented Batch Import API

RB-061 adds `PredictionImportBatchJob` and `PredictionImportBatchItem` persistence plus ZIP-based batch import APIs. The create route is:

- `POST /api/prediction-runs/[predictionRunId]/batch-imports`

Inspect/process/retry routes are:

- `GET /api/projects/[projectId]/prediction-import-batches`
- `GET /api/prediction-import-batches/[batchId]`
- `GET /api/prediction-import-batches/[batchId]/items`
- `POST /api/prediction-import-batches/[batchId]/process`
- `POST /api/prediction-import-batches/process-due`
- `POST /api/prediction-import-batches/[batchId]/retry`

The batch manifest version is `sapen-annotate-prediction-batch-import-v1`. RB-061 supports batch imports for `SEMANTIC_MASK` and `SLICE_SUPPORT_MASK` prediction masks only. The processor calls `importPredictionMaskForUser`, so checksum, dimension, content-type, coordinate-space, label-value, storage, provenance, and proposal-only rules stay identical to the single prediction import path.

RB-065 adds processor identity and DB lease metadata for batch items. The single-host trial flow is: pending/due retry item becomes `PROCESSING` with `processorId`, `processorRunId`, `leaseExpiresAt`, and `lastHeartbeatAt`; success becomes `SUCCEEDED` and is never reprocessed; validation failure becomes `FAILED` with a stable error code; stale processing leases become `RETRY_PENDING` or `FAILED` with `BATCH_ITEM_STALE_PROCESSING_RECOVERED`.

RB-066 adds `PredictionImportBatchItem.stagingPurgedAt` and `stagingPurgeReason` for temporary source cleanup. Purged failed/skipped items keep their terminal state and are not reset by retry because their staged source bytes are gone. Successful prediction artifacts remain protected committed artifact versions and are not cleanup targets.

Batch responses expose status/counts, item-level stable error codes, artifact/provenance ids, and reduced prediction-run summaries. They never expose staged object keys. Successful items are not processed again, and batch-created provenance rows carry `sourceBatchItemId` so a retry can reattach an existing prediction artifact after an interrupted worker pass. This is a PostgreSQL-backed batch import runner only; it is not used for normal annotator browser concurrency.

## Implemented Correction Task Queue

RB-058 adds `src/server/domain/correctionTasks.ts` and the route-addressable project queue at `/app/projects/[projectId]/tasks`.

Implemented APIs:

- `POST /api/prediction-runs/[predictionRunId]/correction-tasks` creates idempotent `MODEL_PREDICTION_CORRECTION` tasks from `PredictionArtifactProvenance` rows for project `OWNER`/`QA`.
- `GET /api/projects/[projectId]/correction-tasks` lists correction tasks for project `OWNER`/`QA` in deterministic active-learning order.
- `GET /api/correction-tasks/[taskId]` returns one sanitized task with prediction/run/provenance summary.
- `PATCH /api/correction-tasks/[taskId]` supports claim, assign, start, dismiss, and priority updates for project `OWNER`/`QA`.

Task creation links `AnnotationTask.predictionRunId`, `AnnotationTask.predictionProvenanceId`, and `AnnotationTask.sourceArtifactVersionId` where an artifact version exists. The unique constraint `@@unique([predictionProvenanceId, type])` prevents duplicate correction tasks for the same prediction item and task type.

Queue responses intentionally omit `AnnotationArtifactVersion.storageKey` and other private object-storage locations.

## Artifact Contract

Prediction mask imports use `AnnotationArtifactKind.PREDICTION_MASK` for mask predictions and store the prediction target in explicit prediction metadata.

Supported RB-057 import targets:

- semantic material mask prediction,
- slice support mask prediction.

Deferred prediction targets:

- instance mask prediction.

`PREDICTION_MASK` is sufficient for the first import workflow because the existing artifact version fields already cover image ownership, storage key, dimensions, coordinate space, label schema version, provenance, parent/source version, and actor/system attribution. RB-056 stores the prediction target on `PredictionArtifactProvenance.targetType`; RB-057 persists imported mask bytes as `PREDICTION_MASK` versions with `ArtifactProvenance.MODEL_PREDICTION`.

Slice classification predictions are represented as `PredictionArtifactProvenance` rows with `targetType = SLICE_CLASSIFICATION` and `predictedClass`. They do not create `SliceClassificationVersion` rows until a human explicitly saves a classification version.

## Human Correction Contract

Implemented correction flow after RB-059:

```text
prediction imported
-> correction task created
-> annotator opens route-addressable task
-> prediction is loaded as read-only overlay or explicit starting point
-> annotator edits a human layer
-> corrected human version saved as DRAFT
-> human version submitted
-> reviewer approves or rejects
-> approved human version becomes export-ready
```

Rules:

- Prediction bytes are never mutated by the editor.
- Human correction creates a new artifact version with `ArtifactProvenance.HUMAN_CORRECTION`.
- Mask corrections should set `AnnotationArtifactVersion.parentVersionId` to the source prediction artifact version where possible.
- Correction tasks should set `AnnotationTask.sourceArtifactVersionId` to the source prediction artifact version.
- Correction tasks should set `AnnotationTask.predictionRunId` and `AnnotationTask.predictionProvenanceId` when prediction registry records exist.
- `AnnotationTask.modelSource` is legacy/display context only. It is not the reproducible source of truth.
- Approval applies to the human correction, not to the model prediction.
- A rejected human correction does not delete or rewrite the prediction artifact.
- RB-059 updates correction task state to `IN_PROGRESS` after draft save, `SUBMITTED` after submit, and `DONE` after approval.
- Slice-classification correction remains deferred; classification predictions are proposals until a human explicitly saves a classification version through a future workflow.

## Provenance Requirements

Minimum future model provenance:

- model family/name,
- model version,
- checkpoint id/path/hash,
- training run id,
- inference run id,
- config hash,
- source dataset/export id where available,
- generatedAt,
- generatedBy system actor or importer,
- input image id and checksum,
- input dimensions,
- output artifact checksum,
- confidence score,
- uncertainty score,
- per-class confidence where available,
- notes and warnings.

Implemented placement after RB-056:

- model/checkpoint/training/config identity lives on `ModelRun`;
- inference/project/source-selection identity lives on `PredictionRun`;
- per-image and per-output confidence, uncertainty, per-class scores, output stats, predicted class, and output checksum live on `PredictionArtifactProvenance`;
- task ranking hints stay on `AnnotationTask.priority`, `confidenceScore`, `uncertaintyScore`, and `taskReason`;
- task provenance links use `predictionRunId` and `predictionProvenanceId`.

Per-class confidence and model output statistics belong to prediction/run metadata. They must not be encoded in display label names, label colors, or approved human artifact fields.

## Export Contract

RB-053 ground-truth training export remains approved-human-only:

- `MODEL_PREDICTION` versions are excluded from default training exports.
- `PREDICTION_MASK` artifacts are excluded from semantic/support/classification export targets.
- Approved human corrections may be exported when they are stored as semantic/support/classification ground-truth artifacts.
- Prediction-analysis exports are a separate RB-060 mode and must not be confused with ground-truth training export.

RB-056 keeps this behavior unchanged. `src/server/domain/exports.ts` still selects latest approved `SEMANTIC_MASK`, `SLICE_SUPPORT_MASK`, and `SliceClassificationVersion` rows only; `PREDICTION_MASK` artifacts and `PredictionArtifactProvenance` rows do not become training-export-ready merely by existing in the database.

RB-060 adds `src/server/domain/predictionAnalysisExports.ts` for QA/debug exports. Those manifests use `sapen-annotate-prediction-analysis-export-v1`, mark each prediction with `artifactRole: "model_prediction_proposal"` and `groundTruth: false`, include `ModelRun`/`PredictionRun` provenance, and keep prediction, human-correction, and approved-ground-truth files in separate package paths.

RB-067 adds `sapen-annotate-prediction-qa-metrics-v1` metrics inside prediction-analysis manifests. Metrics compare semantic/support prediction bytes only against approved human semantic/support references. Missing approved references and unsupported slice-classification metrics are reported with stable not-computed reasons. These QA metrics do not appear in RB-053 training export manifests.

## RB-055 Dependency

RB-055 implements the current upload/artifact validation helpers used by human image and mask writes. Real prediction import should reuse or extend those helpers:

- verify object existence,
- verify size and content type,
- verify checksum,
- verify mask dimensions and coordinate space against the target image,
- reject or document coordinate transforms,
- avoid public MinIO/S3 URLs in browser responses,
- record audit events for imported prediction artifacts.

Large batch imports now use the RB-061/RB-065 DB-backed batch item and lease model rather than one long browser request. RB-066 cleanup is a separate admin operation for temporary source objects. This is a single-host baseline, not HA queue infrastructure.

RB-057 accepts only `u8raw-v1` `application/octet-stream` prediction masks in `IMAGE_PIXEL` coordinate space. Dimensions must match the target image. The server computes and stores canonical SHA-256 checksums and rejects mismatched checksum hints. Semantic predictions are limited to active semantic label byte values. Support predictions are limited to `0` and the active `slice_support` byte; Copper semantic values are rejected as support geometry.

## Deferred After RB-067

- Cleanup UI and production-scale queue infrastructure.
- Slice-classification batch prediction imports.
- Metrics dashboards, report generators, and model-to-model benchmark views.

## Related Docs

- [active-learning-task-model.md](active-learning-task-model.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [prediction-analysis-export-contract.md](prediction-analysis-export-contract.md)
- [prediction-qa-metrics-contract.md](prediction-qa-metrics-contract.md)
- [../08-adr/ADR-004-model-preprediction-active-learning.md](../08-adr/ADR-004-model-preprediction-active-learning.md)
