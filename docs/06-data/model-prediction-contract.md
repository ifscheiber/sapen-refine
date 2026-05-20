# Model Prediction Contract

## Purpose

This page defines the model preprediction and assisted correction contract. RB-056 implements the provenance registry needed by future imports, but it does not import prediction files, run inference, create active-learning queues, or add assisted editor UI.

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
- Minimal APIs: `src/app/api/model-runs/*`, `src/app/api/projects/[projectId]/prediction-runs/route.ts`, and `src/app/api/prediction-runs/[predictionRunId]/route.ts`
- Export implementation: `src/server/domain/exports.ts`

## Implemented Registry

RB-056 adds three persisted registry levels in `prisma/schema.prisma`:

- `ModelRun` stores model family/name/version, task type, checkpoint id/path/hash, training run/dataset/export references, training code version/git commit, config hash, createdBy, notes, warnings, and metadata.
- `PredictionRun` stores a project-scoped inference execution linked to one `ModelRun`, with optional source export/dataset/selection criteria, inference run id, generatedBy/generatedAt, status, input/output counts, aggregate confidence/uncertainty summaries, config hash, warnings, notes, and metadata.
- `PredictionArtifactProvenance` stores per-image prediction proposal metadata linked to a `PredictionRun`, optional `PREDICTION_MASK` artifact version, optional slice instance, target type, predicted class for classification proposals, confidence/uncertainty, per-class scores, output stats, and model-output checksum.

Related enums are `ModelTaskType`, `PredictionRunStatus`, and `PredictionTargetType`.

Direct ModelRun reads are admin-only because they may include internal checkpoint paths. Project members read reduced model summaries through project-scoped prediction-run responses.

## Artifact Contract

Prediction mask imports should use `AnnotationArtifactKind.PREDICTION_MASK` for mask predictions and store the prediction target in explicit prediction metadata.

Supported future prediction targets:

- semantic material mask prediction,
- slice support mask prediction,
- instance mask prediction.

`PREDICTION_MASK` is sufficient for the first import workflow because the existing artifact version fields already cover image ownership, storage key, dimensions, coordinate space, label schema version, provenance, parent/source version, and actor/system attribution. RB-056 stores the prediction target on `PredictionArtifactProvenance.targetType`; adding separate artifact kinds such as `SEMANTIC_PREDICTION_MASK` and `SUPPORT_PREDICTION_MASK` can wait until a real import implementation proves that the metadata approach is too weak.

Slice classification predictions are represented as `PredictionArtifactProvenance` rows with `targetType = SLICE_CLASSIFICATION` and `predictedClass`. They do not create `SliceClassificationVersion` rows until a human explicitly saves a classification version.

## Human Correction Contract

Future correction flow:

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
- Prediction artifact ids may appear only as provenance of a human correction in a future manifest extension.
- Any QA or prediction-analysis export mode must be a separate future target and must not be confused with ground-truth training export.

RB-056 keeps this behavior unchanged. `src/server/domain/exports.ts` still selects latest approved `SEMANTIC_MASK`, `SLICE_SUPPORT_MASK`, and `SliceClassificationVersion` rows only; `PREDICTION_MASK` artifacts and `PredictionArtifactProvenance` rows do not become export-ready merely by existing in the database.

## RB-055 Dependency

RB-055 implements the current upload/artifact validation helpers used by human image and mask writes. Real prediction import should reuse or extend those helpers:

- verify object existence,
- verify size and content type,
- verify checksum,
- verify mask dimensions and coordinate space against the target image,
- reject or document coordinate transforms,
- avoid public MinIO/S3 URLs in browser responses,
- record audit events for imported prediction artifacts.

Large batch imports should use a background job design rather than synchronous browser requests.

## Deferred After RB-056

- RB-057: prediction import API that validates prediction objects and creates `PREDICTION_MASK` artifact versions linked to `PredictionArtifactProvenance`.
- RB-058: active-learning task queue APIs/UI using `predictionRunId`, `predictionProvenanceId`, priority, confidence, uncertainty, and task reason.
- RB-059: assisted correction editor workflow that loads prediction overlays read-only and writes human correction artifacts separately.
- RB-060: prediction-analysis export mode separate from ground-truth training exports.
- RB-061: background jobs for large/batch prediction imports.

## Related Docs

- [active-learning-task-model.md](active-learning-task-model.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [../08-adr/ADR-004-model-preprediction-active-learning.md](../08-adr/ADR-004-model-preprediction-active-learning.md)
