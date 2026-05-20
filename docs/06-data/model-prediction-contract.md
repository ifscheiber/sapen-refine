# Model Prediction Contract

## Purpose

This page defines the RB-054 design contract for future model preprediction and assisted correction workflows. It is not implemented at runtime yet.

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
- Human artifact source link: `AnnotationArtifactVersion.parentVersionId`
- Export implementation: `src/server/domain/exports.ts`

## Artifact Contract

First implementation should use `AnnotationArtifactKind.PREDICTION_MASK` for mask predictions and store the prediction target in explicit prediction metadata.

Supported future prediction targets:

- semantic material mask prediction,
- slice support mask prediction,
- instance mask prediction.

`PREDICTION_MASK` is sufficient for the first import workflow because the existing artifact version fields already cover image ownership, storage key, dimensions, coordinate space, label schema version, provenance, parent/source version, and actor/system attribution. Adding separate artifact kinds such as `SEMANTIC_PREDICTION_MASK` and `SUPPORT_PREDICTION_MASK` can wait until a real import implementation proves that the metadata approach is too weak.

Slice classification predictions should not be represented as approved `SliceClassificationVersion` rows. The first design should represent them as task/proposal context tied to an image or slice instance, with model provenance and confidence metadata, until a human explicitly saves a classification version.

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

Current schema sufficiency:

- `AnnotationTask.modelSource`, `confidenceScore`, and `uncertaintyScore` are enough for a visible MVP queue hint.
- They are not enough for reproducible model provenance.
- `AnnotationArtifactVersion` has no general metadata JSON field for per-class confidence or inference statistics.
- RB-056 should add a `ModelRun`/`PredictionRun` concept or equivalent normalized provenance storage before real imports.

Per-class confidence and model output statistics belong to prediction/run metadata. They must not be encoded in display label names, label colors, or approved human artifact fields.

## Export Contract

RB-053 ground-truth training export remains approved-human-only:

- `MODEL_PREDICTION` versions are excluded from default training exports.
- `PREDICTION_MASK` artifacts are excluded from semantic/support/classification export targets.
- Approved human corrections may be exported when they are stored as semantic/support/classification ground-truth artifacts.
- Prediction artifact ids may appear only as provenance of a human correction in a future manifest extension.
- Any QA or prediction-analysis export mode must be a separate future target and must not be confused with ground-truth training export.

## RB-055 Dependency

Real prediction import must wait for or include object hardening:

- verify object existence,
- verify size and content type,
- verify checksum,
- verify mask dimensions and coordinate space against the target image,
- reject or document coordinate transforms,
- avoid public MinIO/S3 URLs in browser responses,
- record audit events for imported prediction artifacts.

Large batch imports should use a background job design rather than synchronous browser requests.

## Related Docs

- [active-learning-task-model.md](active-learning-task-model.md)
- [mask-and-artifact-versioning.md](mask-and-artifact-versioning.md)
- [training-export-contract.md](training-export-contract.md)
- [../08-adr/ADR-004-model-preprediction-active-learning.md](../08-adr/ADR-004-model-preprediction-active-learning.md)
