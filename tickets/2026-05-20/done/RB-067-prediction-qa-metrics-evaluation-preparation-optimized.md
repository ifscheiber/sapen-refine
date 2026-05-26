# RB-067 — Prediction QA Metrics & Evaluation Preparation

## Status

Completed by Codex on 2026-05-21

## Priority

Medium

## Type

Prediction Analysis / QA Metrics / Export Contract / Tests / Documentation

## Repository

`sapen-annotate`

## Depends on

- RB-060 — Prediction Analysis Export Mode
- RB-062 — Repository State & Documentation Consistency Sweep
- RB-066 — Batch & Staging Storage Retention / Cleanup

## Blocks

- Future model QA workflows
- Future model comparison dashboards
- Future training-loop evaluation reports
- Future customer-facing model-quality summaries

---

## 1. Context

RB-060 introduced a separate Prediction Analysis Export mode. It is explicitly not the approved-human ground-truth training export.

RB-066 completed staging/storage cleanup for batch prediction imports, so the prediction pipeline now has import, provenance, task queue, assisted correction, prediction-analysis export, batch import processing, runner hardening and cleanup.

The original RB-067 draft correctly identifies the current gap:

- RB-060 exports prediction proposals and optional human/ground-truth references.
- It does not compute Dice, IoU, confusion matrices, per-class overlap, or dashboard-ready summaries.
- Prediction-analysis exports must stay separate from ground-truth training exports.
- Predictions must not become training labels.

This optimized RB-067 implements a small v1 metric baseline for QA/evaluation without creating a full dashboard or changing training-export semantics.

---

## 2. Goal

Prepare and implement a minimal prediction QA metric layer for comparing model predictions against approved human references where available.

At the end of RB-067:

1. Prediction-analysis exports can include v1 QA metrics where comparison data exists.
2. Metrics are computed only for prediction-vs-approved-human-reference comparisons.
3. Metrics are clearly marked as QA/evaluation metadata, not labels.
4. RB-053 approved-human training export remains unchanged.
5. Missing references, incompatible dimensions or unsupported target types are reported with clear “not computed” reasons.
6. Tests prove metric correctness and export-boundary safety.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- changing RB-053 ground-truth training export behavior,
- making predictions training labels,
- model training orchestration,
- Python ML worker requirement,
- full metrics dashboard,
- model comparison UI beyond minimal export/readiness display,
- large report generator,
- multi-model benchmark registry,
- statistical significance analysis,
- GPU/inference execution,
- customer-facing performance claims.

If dashboard/reporting is needed later, create a follow-up ticket.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Work in focused slices and commit after each meaningful slice.

---

## 5. Metric Scope

### 5.1 Supported v1 comparisons

Implement v1 metrics for:

```text
semantic mask prediction vs approved semantic ground truth
support mask prediction vs approved support ground truth
```

Optional if already represented cleanly:

```text
slice classification prediction vs approved slice classification
```

If classification prediction is not implemented as a first-class prediction artifact, document it as deferred.

### 5.2 Semantic segmentation metrics

For semantic predictions, compute per-label and aggregate metrics where label values are known.

Recommended metrics:

```text
per-label intersection
per-label union
per-label prediction pixel count
per-label reference pixel count
per-label IoU
per-label Dice/F1
macro IoU
macro Dice
pixel accuracy
confusion matrix counts
```

Labels should come from the active label schema / manifest mapping, not display colors.

### 5.3 Support segmentation metrics

For support masks, compute binary metrics:

```text
intersection
union
prediction support pixels
reference support pixels
IoU
Dice/F1
false positive pixels
false negative pixels
true positive pixels
true negative pixels
```

Support evaluation must not treat Copper semantic masks as support geometry.

### 5.4 Not-computed reasons

Metrics must explicitly report when they are not computed.

Recommended reasons:

```text
NO_APPROVED_REFERENCE
NO_PREDICTION_ARTIFACT
DIMENSIONS_MISMATCH
LABEL_SCHEMA_MISMATCH
TARGET_TYPE_UNSUPPORTED
ARTIFACT_READ_FAILED
EMPTY_REFERENCE_AND_PREDICTION
CLASSIFICATION_PREDICTION_NOT_IMPLEMENTED
```

Do not silently omit metric fields.

---

## 6. Implementation Strategy

### 6.1 TypeScript-first v1 helper

Do not introduce a Python/ML worker for RB-067.

Implement deterministic TypeScript helpers for u8 mask comparisons.

Suggested locations:

```text
src/server/domain/metrics/**
src/server/domain/predictionAnalysisMetrics.ts
```

or align with existing export service layout.

Helpers should be pure/testable where possible:

```ts
computeBinaryMaskMetrics(prediction: Uint8Array, reference: Uint8Array, supportValue: number)
computeSemanticMaskMetrics(prediction: Uint8Array, reference: Uint8Array, labels: LabelDefinition[])
buildConfusionMatrix(...)
```

### 6.2 Storage/object access

Use existing app/server storage abstraction.

Rules:

- read only app-mediated server-side objects,
- no private MinIO/S3 URL leaks,
- validate checksum/dimensions before computing when metadata exists,
- fail gracefully with not-computed reason if artifact cannot be read.

### 6.3 Prediction-analysis export integration

Extend RB-060 Prediction Analysis Export manifest.

Add metrics under an explicit QA section, for example:

```json
{
  "qaMetrics": {
    "computed": true,
    "metricVersion": "sapen-annotate-prediction-qa-metrics-v1",
    "comparison": "prediction_vs_approved_human_reference",
    "semantic": {
      "macroIoU": 0.72,
      "macroDice": 0.81,
      "pixelAccuracy": 0.91,
      "perLabel": []
    },
    "support": {
      "iou": 0.86,
      "dice": 0.92
    },
    "warnings": []
  }
}
```

If metrics are not available:

```json
{
  "qaMetrics": {
    "computed": false,
    "reason": "NO_APPROVED_REFERENCE"
  }
}
```

### 6.4 Optional standalone API

A standalone metrics preview endpoint is optional.

If implemented, keep it read-only:

```text
GET /api/prediction-analysis-exports/[exportId]/metrics
```

or project/prediction-run scoped readiness.

Do not add a full dashboard in RB-067.

### 6.5 Manifest and package

If metrics are computed during prediction-analysis export, include:

```text
manifest.json
metrics/summary.json
metrics/items/<imageId>.json
```

or embed in manifest only if simpler.

Preferred for MVP:

- include item-level metrics in manifest,
- optionally include `metrics/summary.json` for aggregate summary.

---

## 7. Metric Contract

### 7.1 Version

Define metric version:

```text
sapen-annotate-prediction-qa-metrics-v1
```

### 7.2 Numeric conventions

Document:

- IoU = intersection / union
- Dice = 2 * intersection / (prediction_count + reference_count)
- pixel accuracy = equal pixels / total pixels
- empty union behavior:
  - if both prediction and reference are empty for a class, mark metric as `null` or `notApplicable`, not artificially perfect unless explicitly justified.
- values are numbers in `[0, 1]` where computed.

### 7.3 Confusion matrix

For semantic masks:

- rows = reference labels,
- columns = prediction labels,
- counts = pixels.

Document label ordering and unknown label handling.

### 7.4 Aggregation

For project/export summary:

- aggregate per-item counts first where possible,
- avoid averaging percentages without counts unless documented,
- provide item count and skipped/not-computed count.

---

## 8. UI Scope

Minimal UI only.

Update Prediction Analysis Export panel to show, where available:

- candidate count with metric availability,
- after export: metrics included yes/no,
- summary counts:
  - items with metrics,
  - items without approved reference,
  - items skipped due to mismatch/read failure.

Do not build charts/dashboard.

---

## 9. Training Export Safety

Hard requirements:

- RB-053 training export manifest remains unchanged unless docs clarify non-change.
- Predictions are still excluded from ground-truth training export.
- QA metrics do not appear in training export as labels.
- Prediction-analysis export remains clearly separate from training export.
- Tests must prove separation.

---

## 10. Tests

### 10.1 Unit tests

Cover:

- binary IoU/Dice basic cases,
- semantic per-label counts,
- confusion matrix counts,
- macro metrics,
- empty class behavior,
- dimension mismatch handling,
- unknown label handling,
- not-computed reason creation.

### 10.2 Integration tests

Cover:

- prediction-analysis export includes metrics when approved human reference exists,
- prediction-analysis export marks metrics not computed when reference missing,
- semantic prediction metrics are computed from correct artifacts,
- support prediction metrics are computed from support artifacts only,
- Copper semantic prediction is not treated as support reference,
- RB-053 training export still excludes predictions and QA metrics,
- no private storage keys leak in metric manifest.

### 10.3 E2E tests

E2E may remain unchanged unless stable to extend.

If extended, keep minimal:

```text
login as owner/QA
→ create prediction-analysis export
→ verify metrics included indicator or download link appears
```

Do not add brittle numeric assertions in browser E2E.

---

## 11. Documentation Updates

Update/create:

```text
docs/06-data/prediction-analysis-export-contract.md
docs/06-data/model-prediction-contract.md
docs/06-data/training-export-contract.md
docs/06-data/prediction-qa-metrics-contract.md
docs/03-features/projects.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- supported v1 metrics,
- numeric definitions,
- not-computed reasons,
- prediction-analysis export only,
- no contamination of training export,
- unsupported cases,
- future dashboard/offline-analysis path.

---

## 12. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. v1 metrics contract is documented.
3. Binary support-mask metrics are implemented and tested.
4. Semantic mask per-label / aggregate metrics are implemented and tested.
5. Prediction-analysis export includes metrics or explicit not-computed reasons.
6. Metrics compare predictions only against approved human references.
7. Missing approved references are reported, not silently omitted.
8. Copper semantic masks are not treated as support geometry.
9. RB-053 ground-truth training export remains approved-human-only and prediction-free.
10. Tests cover metric correctness and export separation.
11. UI/docs communicate that metrics are QA/evaluation metadata, not labels.
12. No full dashboard or ML worker is introduced.
13. Existing import/queue/correction/review/export workflows remain green.
14. Ticket is moved to:

```text
tickets/2026-05-20/done/
```

15. Final validation passes:

```bash
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

16. Final Codex report includes:
    - commits created,
    - metric helpers/services changed,
    - export manifest/package changes,
    - tests added/changed,
    - docs changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 13. Suggested Commit Sequence

```bash
git commit -m "docs: define prediction qa metrics contract"
git commit -m "feat: add prediction qa metric helpers"
git commit -m "feat: include qa metrics in prediction analysis exports"
git commit -m "test: cover prediction qa metrics"
git commit -m "test: protect training export boundaries"
git commit -m "docs: document prediction qa evaluation baseline"
git commit -m "chore: finalize prediction qa metrics ticket"
```

---

## 14. Notes for Codex

- Keep this QA-only.
- Do not change ground-truth export semantics.
- Metrics are metadata, not labels.
- Prefer simple deterministic TypeScript helpers over introducing Python/ML workers.
- Be explicit when metrics cannot be computed.
