# Prediction QA Metrics Contract

## Purpose

RB-067 adds deterministic QA/evaluation metrics to prediction-analysis exports. These metrics compare model proposals against approved human references where available.

They are QA metadata only. They are not labels, are not training targets, and do not change the RB-053 approved-human training export.

## Current Implementation

Important files:

- `src/server/domain/predictionAnalysisMetrics.ts` - pure u8 mask metric helpers and not-computed payloads.
- `src/server/domain/predictionAnalysisExports.ts` - export-time object loading, label-schema lookup, manifest embedding, and summary metadata.
- `src/features/projects/ProjectExportPanel.tsx` - minimal readiness/export UI counts for metric availability.
- `tests/unit/prediction-analysis-metrics.test.ts` - binary/semantic metric correctness.
- `tests/integration/prediction-analysis-export.test.ts` - export manifest metrics, training-export separation, and Copper/support boundary coverage.

Metric version:

```text
sapen-annotate-prediction-qa-metrics-v1
```

Comparison:

```text
prediction_vs_approved_human_reference
```

## Supported V1 Comparisons

Computed in RB-067:

- semantic mask prediction vs latest approved `SEMANTIC_MASK` human reference,
- slice support mask prediction vs latest approved `SLICE_SUPPORT_MASK` human reference.

Deferred:

- slice-classification prediction metrics. Classification proposals receive `CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED`.
- instance/support-object metrics beyond the current default support mask.
- dashboard/report generation and model-to-model benchmarking.

Copper remains semantic material. A Copper semantic mask is never treated as slice support geometry for support metrics.

## Numeric Definitions

Semantic metrics:

- per-label prediction pixels,
- per-label reference pixels,
- per-label intersection,
- per-label union,
- per-label IoU: `intersection / union`,
- per-label Dice/F1: `2 * intersection / (prediction_pixels + reference_pixels)`,
- macro IoU: mean of computed trainable per-label IoU values,
- macro Dice: mean of computed trainable per-label Dice values,
- pixel accuracy: equal pixels divided by total pixels,
- confusion matrix counts.

Support metrics:

- true positive, true negative, false positive, false negative pixels,
- prediction support pixels,
- reference support pixels,
- intersection,
- union,
- IoU: `intersection / union`,
- Dice/F1: `2 * intersection / (prediction_support_pixels + reference_support_pixels)`.

If a class/support union is empty, the metric value is `null`, not artificially perfect.

## Label Handling

Metrics use `LabelDefinition` rows from the artifact `labelSchemaVersionId`.

Required source-of-truth fields:

- `stableId`,
- `byteValue`,
- `semanticMeaning`,
- `applicability`,
- `isTrainable`,
- `sortOrder`.

Display names and colors are included for readability but are not the source of truth. Semantic metrics use trainable semantic labels for per-label and macro metrics. Support metrics require the `slice_support` support label byte; Copper semantic bytes are not valid support bytes.

The semantic confusion matrix uses:

- rows: reference labels,
- columns: prediction labels,
- ordering: label schema `sortOrder`, then `stableId`,
- counts: pixels.

Unknown byte values are reported in `unknownPredictionValues` and `unknownReferenceValues`.

## Manifest Shape

Each prediction-analysis manifest item has `qaMetrics`.

Computed semantic example:

```json
{
  "qaMetrics": {
    "computed": true,
    "metricVersion": "sapen-annotate-prediction-qa-metrics-v1",
    "comparison": "prediction_vs_approved_human_reference",
    "targetType": "SEMANTIC_MASK",
    "inputs": {
      "predictionArtifactVersionId": "...",
      "predictionChecksum": "sha256:...",
      "referenceArtifactVersionId": "...",
      "referenceChecksum": "sha256:..."
    },
    "semantic": {
      "macroIoU": 0.72,
      "macroDice": 0.81,
      "pixelAccuracy": 0.91,
      "perLabel": [],
      "confusionMatrix": {
        "rows": "reference_labels",
        "columns": "prediction_labels",
        "labels": [],
        "counts": []
      }
    },
    "warnings": []
  }
}
```

Not-computed example:

```json
{
  "qaMetrics": {
    "computed": false,
    "metricVersion": "sapen-annotate-prediction-qa-metrics-v1",
    "comparison": "prediction_vs_approved_human_reference",
    "targetType": "SEMANTIC_MASK",
    "reason": "NO_APPROVED_REFERENCE",
    "warnings": []
  }
}
```

The manifest summary includes `summary.qaMetrics` with computed/not-computed item counts and reason counts. `ExportBatch.metadataSummary.qaMetricsSummary` stores the same summary for sanitized export API responses.

Metrics are embedded in `manifest.json`; RB-067 does not add separate metrics files.

## Not-Computed Reasons

Supported stable reasons:

- `NO_APPROVED_REFERENCE`
- `NO_PREDICTION_ARTIFACT`
- `DIMENSIONS_MISMATCH`
- `LABEL_SCHEMA_MISMATCH`
- `TARGET_TYPE_UNSUPPORTED`
- `ARTIFACT_READ_FAILED`
- `EMPTY_REFERENCE_AND_PREDICTION`
- `CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED`

Metrics are never silently omitted.

## Training Export Boundary

RB-053 training exports remain approved-human-only:

- no `PredictionArtifactProvenance` rows are training inputs,
- no `PREDICTION_MASK` versions are exported as labels,
- no `qaMetrics` section appears in training export manifests,
- approved human corrections can become training data only after normal review approval.

## Future Work

Deferred follow-ups:

- classification metric workflow,
- aggregate reports and dashboards,
- model-to-model comparison,
- export history UI for metrics,
- large async prediction-analysis export jobs.
