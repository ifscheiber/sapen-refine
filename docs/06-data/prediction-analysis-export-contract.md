# Prediction Analysis Export Contract

## Purpose

RB-060 implements a separate export mode for model QA and comparison. It exports model prediction proposals and provenance without making those predictions ground-truth training labels.

This contract is intentionally separate from [training-export-contract.md](training-export-contract.md). RB-053 training exports remain approved-human-only.

## Current Implementation

Important files:

- `src/server/domain/predictionAnalysisExports.ts` - readiness, exact snapshot creation, async manifest/package generation, export persistence, and app-mediated download authorization.
- `src/server/domain/exportJobs.ts` - due-job processing, atomic claim, bounded retry, and stale lease recovery for export jobs.
- `src/server/domain/exportPackageWriter.ts` - current verified JSZip package-writer boundary.
- `src/app/api/projects/[projectId]/prediction-analysis-export/readiness/route.ts` - project prediction-analysis readiness.
- `src/app/api/projects/[projectId]/prediction-analysis-exports/route.ts` - export creation.
- `src/app/api/prediction-analysis-exports/[exportId]/route.ts` - sanitized export summary.
- `src/app/api/export-jobs/process-due/route.ts` - worker-oriented due export job processing.
- `src/app/api/prediction-analysis-exports/[exportId]/download/route.ts` - manifest/package download through the app.
- `src/features/projects/ProjectExportPanel.tsx` - project exports route UI with a separate prediction-analysis section.
- `src/server/domain/predictionAnalysisMetrics.ts` - RB-067 QA metric helpers for semantic/support prediction comparisons.
- `tests/integration/prediction-analysis-export.test.ts` - export separation, authorization, manifest, package layout, metrics, and regression coverage.

Manifest version:

```text
sapen-annotate-prediction-analysis-export-v1
```

Persisted export type:

```text
ExportTarget.PREDICTION_ANALYSIS
```

## Scope

The MVP supports project-level export with optional selection by:

- `predictionRunId`,
- `modelRunId`,
- prediction target types,
- `includeHumanReferences`.

Supported target types are the current `PredictionTargetType` values. The UI exposes semantic mask predictions, slice support predictions, and slice-classification proposals.

## Manifest Boundary

Every prediction item is explicitly marked:

```json
{
  "artifactRole": "model_prediction_proposal",
  "groundTruth": false
}
```

The top-level manifest includes the warning:

```text
This export contains model predictions for QA/analysis. It is not a ground-truth training-label export.
```

The manifest includes:

- project and actor attribution,
- selection criteria,
- model run summaries without private checkpoint paths,
- prediction run summaries,
- image metadata,
- prediction provenance id,
- prediction artifact version id where a mask artifact exists,
- confidence, uncertainty, per-class scores, output stats, and model output checksum,
- correction task context where available,
- human correction references where available,
- approved human ground-truth references where available,
- QA metrics or explicit not-computed reasons for each item,
- item warnings.

Human corrections and approved ground truth are references for comparison. They are never merged with prediction output into one label file.

## QA Metrics

RB-067 embeds v1 QA metrics in `manifest.json` only. Metrics compare model predictions against approved human references and remain evaluation metadata, not labels.

Metric version:

```text
sapen-annotate-prediction-qa-metrics-v1
```

Implemented comparisons:

- semantic mask prediction vs approved semantic human reference,
- slice support mask prediction vs approved support human reference.

Each item includes `qaMetrics`. Computed semantic metrics include per-label counts, IoU, Dice, macro IoU/Dice, pixel accuracy, and a reference-by-prediction confusion matrix. Computed support metrics include TP/TN/FP/FN pixels, support pixel counts, IoU, and Dice.

If metrics cannot be computed, `qaMetrics.computed` is `false` with a stable reason such as `NO_APPROVED_REFERENCE`, `DIMENSIONS_MISMATCH`, `LABEL_SCHEMA_MISMATCH`, or `CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED`.

The top-level `summary.qaMetrics` and `ExportBatch.metadataSummary.qaMetricsSummary` record computed/not-computed item counts and reason counts for UI/readiness display.

See [prediction-qa-metrics-contract.md](prediction-qa-metrics-contract.md).

## Package Layout

The ZIP package uses separate relative paths:

```text
manifest.json
images/<imageId>.<ext>
predictions/<semantic|support|instance>/<imageId>-<predictionProvenanceId>.u8raw
human-corrections/<semantic|support|instance>/<imageId>-<artifactVersionId>.u8raw
ground-truth/<semantic|support|instance>/<imageId>-<artifactVersionId>.u8raw
```

Slice-classification prediction proposals are manifest-only in RB-060 because they do not have mask bytes.

Generated objects are stored privately under:

```text
projects/<projectId>/prediction-analysis-exports/<exportId>/manifest.json
projects/<projectId>/prediction-analysis-exports/<exportId>/package.zip
```

Browser downloads use `/api/prediction-analysis-exports/[exportId]/download?file=manifest` and `?file=package`. API responses and manifests do not expose private MinIO/S3 storage keys.

## Access

- Project members can inspect readiness.
- Project `OWNER` and `QA` can create and download prediction-analysis exports.
- `LABELER` and `VIEWER` cannot access prediction-analysis export readiness, create prediction-analysis exports, or download prediction-analysis exports.

This differs from RB-053 training export, which remains owner-only.

## Persistence

`ExportBatch.target` is `PREDICTION_ANALYSIS`. `ExportItem` rows may reference `predictionProvenanceId` in addition to image, artifact-version, or classification-version references.

Roles used by RB-060 include:

- `image`,
- `prediction-proposal`,
- `human-correction-reference`,
- `approved-ground-truth-reference`.

`ExportBatch.selectionCriteria` records the prediction-analysis mode and filters. RB-112 queues prediction-analysis exports as async jobs; `metadataSummary` records item count/warning count while pending and package checksum, package size, and QA metrics summary after completion.

Create requests return `202 Accepted` with `status = PENDING`; downloads are enabled only after the worker marks the batch `COMPLETED`. Failed jobs expose stable `errorCode`/`errorMessage` values without private storage keys.

## Non-Goals

- RB-067 does not implement dashboards or model-to-model benchmark reports.
- RB-061 adds batch prediction import jobs. RB-112 prediction-analysis exports use a separate async export job path and remain separate from prediction-import jobs.
- RB-060 does not allow predictions through RB-053 training export targets.
- RB-060 does not approve predictions or convert them to ground truth.

## Related Docs

- [training-export-contract.md](training-export-contract.md)
- [prediction-qa-metrics-contract.md](prediction-qa-metrics-contract.md)
- [model-prediction-contract.md](model-prediction-contract.md)
- [active-learning-task-model.md](active-learning-task-model.md)
- [prisma.md](prisma.md)
