# RB-060 — Prediction Analysis Export Mode

## Status

Proposed / Ready for Codex

## Priority

Medium

## Type

Export / QA / Prediction Analysis / Manifest / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-053 — Admin Training Export MVP
- RB-056 — Prediction Provenance / ModelRun Registry
- RB-057 — Prediction Import API & Storage Validation
- RB-058 — Active-Learning Task Queue API/UI
- RB-059 — Assisted Correction Editor Workflow

## Blocks

- Future model QA workflows
- Future model comparison/evaluation workflows
- Future batch prediction analysis/reporting
- RB-061 — Batch Prediction Import and Background Jobs

---

## 1. Context

RB-053 implemented the default training export. It is intentionally **approved-human-only** and exports ground-truth data for training.

RB-056 introduced reproducible `ModelRun` / `PredictionRun` provenance.

RB-057 implemented prediction import as `PREDICTION_MASK` / `MODEL_PREDICTION`, with storage validation and prediction-not-ground-truth protection.

RB-058 added active-learning correction tasks.

RB-059 added the assisted correction editor workflow:

- prediction masks load read-only,
- users explicitly choose “Use prediction as starting mask”,
- human corrections are saved as separate `HUMAN_CORRECTION` versions,
- semantic and support corrections remain separate,
- human corrections can flow into review/approval,
- predictions remain immutable proposals.

The original RB-060 draft correctly scopes an optional prediction-analysis export mode that is explicitly separate from the default ground-truth training export. It requires prediction artifacts, model provenance, confidence/uncertainty, comparison references where available, warnings and naming that prevent prediction exports from being mistaken for ground-truth labels.

RB-060 should now implement this separate QA/export mode.

---

## 2. Goal

Implement an optional **Prediction Analysis Export** mode for model QA and comparison.

This export is not a training-label export.

It should allow authorized users to export:

- model prediction artifacts,
- model/prediction provenance,
- confidence/uncertainty/task context,
- related human correction references where available,
- related approved human ground-truth references where available,
- manifest warnings that clearly label predictions as proposals.

The resulting package/manifest should support offline QA, model debugging and later evaluation workflows without weakening the ground-truth boundary.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- changing RB-053 default training export eligibility,
- exporting predictions through default ground-truth targets,
- model training orchestration,
- running inference,
- batch/background prediction import,
- automatic model metrics dashboard,
- full pixel-level evaluation metrics unless already trivial and explicitly scoped,
- prediction approval as ground truth,
- active-learning queue redesign,
- assisted correction editor changes,
- customer reporting UI.

If metric computation or dashboards are needed, add follow-up tickets.

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
```

Work in focused slices and commit after each meaningful slice.

Preserve all existing workflows:

- ground-truth training export,
- prediction import,
- active-learning queue,
- assisted correction editor,
- review/approval,
- manual annotation.

---

## 5. Export Boundary Rules

### 5.1 Separate export mode

Prediction analysis export must be a separate route/API/target namespace from RB-053 ground-truth training export.

Recommended route namespace:

```text
/api/projects/[projectId]/prediction-analysis-exports
/api/prediction-analysis-exports/[exportId]
/api/prediction-analysis-exports/[exportId]/download
```

Do not add prediction artifacts as selectable default targets in the RB-053 ground-truth export unless the UI makes the separation unmistakable and the server still routes to a separate export type.

### 5.2 Manifest name and version

Use a separate manifest version.

Recommended:

```text
sapen-annotate-prediction-analysis-export-v1
```

Do not reuse:

```text
sapen-annotate-training-export-v1
```

### 5.3 Prediction labels are proposals

Every prediction item in the manifest must be explicitly marked as:

```text
artifactRole: "model_prediction_proposal"
groundTruth: false
```

or equivalent.

### 5.4 Human references are references, not merged labels

If approved human ground truth or human corrections exist, they may be referenced for comparison.

Do not merge prediction and human ground truth into one label file.

Do not overwrite or rename prediction files as ground truth.

### 5.5 RB-053 remains unchanged

The default training export remains:

```text
approved-human-only
```

RB-060 must include regression tests proving this.

---

## 6. Scope

### 6.1 Export selection

For MVP, support project-level prediction-analysis export.

Selection options:

- project id,
- prediction run id optional,
- model run id optional,
- target types:
  - semantic prediction,
  - support prediction,
  - slice classification prediction/proposal if represented,
- include related human corrections if available,
- include approved ground-truth references if available,
- include task metadata if available.

Advanced filters are deferred:

- by confidence threshold,
- by uncertainty threshold,
- by task status,
- by date,
- by annotator/reviewer,
- by model version comparison.

### 6.2 Readiness / candidate resolver

Implement server-side resolver for prediction-analysis candidates.

For each prediction provenance record, resolve:

- prediction run,
- model run,
- image,
- prediction artifact version,
- prediction target type,
- confidence/uncertainty/per-class scores,
- output stats,
- related correction task if any,
- related human correction artifact version if any,
- latest approved human ground-truth version for the matching target if any,
- metadata / T-number / acquisition info where available,
- warnings.

Candidate states should distinguish:

```text
prediction_only
prediction_with_correction_draft
prediction_with_submitted_correction
prediction_with_approved_human_reference
prediction_without_matching_human_reference
```

Exact names may differ but must be documented.

### 6.3 Manifest contract

Create a separate prediction-analysis manifest generator.

Suggested shape:

```json
{
  "manifestVersion": "sapen-annotate-prediction-analysis-export-v1",
  "exportId": "...",
  "exportedAt": "...",
  "exportedBy": "...",
  "project": { "id": "...", "name": "..." },
  "selection": {
    "predictionRunId": "...",
    "modelRunId": "...",
    "targetTypes": ["SEMANTIC_MASK_PREDICTION"],
    "includeHumanReferences": true
  },
  "modelRun": {
    "id": "...",
    "modelFamily": "...",
    "modelVersion": "...",
    "checkpointHash": "...",
    "configHash": "..."
  },
  "predictionRun": {
    "id": "...",
    "generatedAt": "...",
    "status": "..."
  },
  "items": [
    {
      "image": {
        "id": "...",
        "filename": "...",
        "width": 0,
        "height": 0,
        "checksum": "sha256:..."
      },
      "prediction": {
        "artifactRole": "model_prediction_proposal",
        "groundTruth": false,
        "artifactVersionId": "...",
        "targetType": "SEMANTIC_MASK_PREDICTION",
        "checksum": "sha256:...",
        "path": "predictions/semantic/<imageId>.u8raw",
        "confidenceScore": 0.91,
        "uncertaintyScore": 0.09,
        "perClassScores": {},
        "outputStats": {}
      },
      "correctionTask": {
        "taskId": "...",
        "status": "...",
        "reason": "LOW_CONFIDENCE"
      },
      "humanCorrection": {
        "artifactVersionId": "...",
        "reviewState": "SUBMITTED",
        "path": "human-corrections/semantic/<imageId>.u8raw"
      },
      "approvedGroundTruthReference": {
        "artifactVersionId": "...",
        "path": "ground-truth/semantic/<imageId>.u8raw"
      },
      "warnings": []
    }
  ],
  "warnings": [
    "This export contains model predictions for QA/analysis. It is not a ground-truth training-label export."
  ]
}
```

Exact shape may differ, but the separation and warning language are mandatory.

### 6.4 Package layout

If ZIP/package generation exists from RB-053, reuse it carefully.

Suggested layout:

```text
manifest.json
images/<imageId>.<ext>
predictions/semantic/<imageId>.u8raw
predictions/support/<imageId>.u8raw
human-corrections/semantic/<imageId>.u8raw
human-corrections/support/<imageId>.u8raw
ground-truth/semantic/<imageId>.u8raw
ground-truth/support/<imageId>.u8raw
```

Only include sections that are selected and available.

Do not expose private MinIO/S3 keys.

### 6.5 Export persistence

Use existing `ExportBatch` / export persistence if flexible enough, but ensure prediction-analysis exports are clearly typed.

If necessary, add a minimal enum/field/migration to distinguish:

```text
GROUND_TRUTH_TRAINING_EXPORT
PREDICTION_ANALYSIS_EXPORT
```

If the existing schema already has enough fields, use documented JSON metadata instead of broad schema churn.

Persistence must record:

- actor,
- project,
- selection criteria,
- export kind/mode,
- predictionRun/modelRun references if available,
- manifest checksum/storage key,
- warnings,
- created/exported timestamps.

### 6.6 API / UI

Add minimal API and UI.

#### API

Recommended routes:

```text
GET  /api/projects/[projectId]/prediction-analysis-export/readiness
POST /api/projects/[projectId]/prediction-analysis-exports
GET  /api/prediction-analysis-exports/[exportId]
GET  /api/prediction-analysis-exports/[exportId]/download
```

#### UI

Add a clearly separated Prediction Analysis Export panel.

Suggested placement:

- project overview export section,
- or a separate project export page if already present.

UI must visibly warn:

```text
Prediction analysis exports contain model proposals and are not ground-truth training labels.
```

Minimum UI:

- select prediction run,
- select target type(s),
- include human references toggle if supported,
- readiness/candidate count,
- create export,
- download/view manifest link,
- warnings.

### 6.7 Authorization

Server-side authorization required.

Recommended:

```text
OWNER / QA can create prediction-analysis export.
OWNER / QA can download.
VIEWER / LABELER cannot create/download unless explicitly allowed by current policy.
```

Adapt to actual role enums.

No UI-only enforcement.

### 6.8 No metrics requirement

RB-060 may include references needed for later metric computation.

Do not implement full Dice/IoU/confusion metrics unless already trivial and well-tested.

If simple counts are added, label them clearly as metadata, not validated model evaluation.

---

## 7. Tests

Add focused tests.

### 7.1 Unit/domain tests

- prediction-analysis candidate resolver includes prediction artifacts.
- candidate resolver includes approved human references when available.
- candidate resolver distinguishes prediction-only vs prediction-with-human-reference.
- manifest labels predictions as not ground truth.
- manifest warning text is present.
- package layout separates predictions and ground truth paths.

### 7.2 Integration/API tests

- authorized user creates prediction-analysis export.
- unauthorized user cannot create/download.
- prediction-analysis export includes prediction artifact and model provenance.
- prediction-analysis export can include human correction/reference if available.
- RB-053 default training export still excludes predictions.
- ground-truth export targets cannot request prediction artifacts.
- no private storage keys leak in API response/manifest public fields.

### 7.3 E2E tests

Extend only if stable and useful.

Possible path:

```text
login as owner/QA
→ use test fixture/API to create prediction run + prediction import
→ open project export panel
→ create prediction analysis export
→ verify manifest/download link appears
```

If E2E setup is too heavy, cover via integration tests and document E2E deferral.

Existing E2E must remain green.

---

## 8. Documentation Updates

Update:

```text
docs/06-data/training-export-contract.md
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/03-features/projects.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- prediction-analysis export is separate from ground-truth export,
- manifest version and package layout,
- prediction artifacts are proposals,
- approved human references are optional comparison references,
- default RB-053 export remains approved-human-only,
- metrics/dashboard remain deferred,
- batch/background export remains deferred if not implemented.

---

## 9. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Prediction-analysis export mode is clearly separate from ground-truth training export.
3. Manifest version is distinct from RB-053 manifest.
4. Prediction artifacts are included only in prediction-analysis exports.
5. Manifest clearly labels predictions as proposals / not ground truth.
6. ModelRun/PredictionRun provenance is included.
7. Confidence/uncertainty/per-class/output stats are included where available.
8. Approved human corrections/ground-truth references are included only as separate reference fields/files.
9. Package layout keeps prediction and human ground-truth files separate.
10. Default RB-053 export still excludes predictions.
11. Server-side authorization protects create/download.
12. No private storage keys or credentials leak.
13. Tests cover export separation and manifest safety language.
14. Existing import/queue/correction/review/export workflows remain green.
15. Docs are updated and distinguish implemented vs deferred behavior.
16. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

17. Final validation passes:

```bash
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
```

18. Final Codex report includes:
    - commits created,
    - routes/services/UI changed,
    - tests added/changed,
    - manifest/package behavior,
    - authorization behavior,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 10. Suggested Commit Sequence

```bash
git commit -m "docs: define prediction analysis export boundary"
git commit -m "feat: add prediction analysis export manifest service"
git commit -m "feat: add prediction analysis export api"
git commit -m "feat: add prediction analysis export ui"
git commit -m "test: cover prediction export separation"
git commit -m "docs: document prediction analysis export mode"
git commit -m "chore: finalize prediction analysis export ticket"
```

---

## 11. Notes for Codex

- Do not weaken RB-053 ground-truth export rules.
- Prediction-analysis export is QA/debug only.
- Manifest warnings and naming matter.
- Keep prediction and human files separate.
- Do not implement full model metrics unless explicitly safe and tiny.
