# Prediction Analysis Export Contract

## Purpose

RB-060 implements a separate export mode for model QA and comparison. It exports model prediction proposals and provenance without making those predictions ground-truth training labels.

This contract is intentionally separate from [training-export-contract.md](training-export-contract.md). RB-053 training exports remain approved-human-only.

## Current Implementation

Important files:

- `src/server/domain/predictionAnalysisExports.ts` - readiness, manifest generation, ZIP packaging, export persistence, app-mediated download authorization.
- `src/app/api/projects/[projectId]/prediction-analysis-export/readiness/route.ts` - project prediction-analysis readiness.
- `src/app/api/projects/[projectId]/prediction-analysis-exports/route.ts` - export creation.
- `src/app/api/prediction-analysis-exports/[exportId]/route.ts` - sanitized export summary.
- `src/app/api/prediction-analysis-exports/[exportId]/download/route.ts` - manifest/package download through the app.
- `src/features/projects/ProjectExportPanel.tsx` - project overview UI with a separate prediction-analysis section.
- `tests/integration/prediction-analysis-export.test.ts` - export separation, authorization, manifest, package layout, and regression coverage.

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
- item warnings.

Human corrections and approved ground truth are references for comparison. They are never merged with prediction output into one label file.

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
- `LABELER` and `VIEWER` cannot create or download prediction-analysis exports.

This differs from RB-053 training export, which remains owner-only.

## Persistence

`ExportBatch.target` is `PREDICTION_ANALYSIS`. `ExportItem` rows may reference `predictionProvenanceId` in addition to image, artifact-version, or classification-version references.

Roles used by RB-060 include:

- `image`,
- `prediction-proposal`,
- `human-correction-reference`,
- `approved-ground-truth-reference`.

`ExportBatch.selectionCriteria` records the prediction-analysis mode and filters. `metadataSummary` records package checksum, package size, item count, and warning count.

## Non-Goals

- RB-060 does not compute Dice, IoU, confusion matrices, or dashboards.
- RB-061 adds batch prediction import jobs. RB-060 prediction-analysis exports remain synchronous and separate from those import jobs.
- RB-060 does not allow predictions through RB-053 training export targets.
- RB-060 does not approve predictions or convert them to ground truth.

## Related Docs

- [training-export-contract.md](training-export-contract.md)
- [model-prediction-contract.md](model-prediction-contract.md)
- [active-learning-task-model.md](active-learning-task-model.md)
- [prisma.md](prisma.md)
