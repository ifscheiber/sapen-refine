# RB-056 — Prediction Provenance / ModelRun Registry

## Status

Completed

## Priority

High

## Type

Schema / Provenance / Prediction Contract / API / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-054 — Model Preprediction & Active-Learning Design
- RB-055 — Upload & Artifact Validation / Checksum Hardening

## Blocks

- RB-057 — Prediction Import API and Storage Validation
- RB-058 — Active-Learning Task Queue API/UI
- RB-059 — Assisted Correction Editor Workflow
- RB-060 — Prediction Analysis Export Mode
- RB-061 — Batch Prediction Import and Background Jobs

---

## 1. Context

RB-054 documented the future model preprediction and active-learning design. It concluded that `AnnotationTask.modelSource` is not sufficient for reproducible provenance and that a persisted model-run / prediction-run registry is needed before real prediction imports.

RB-055 hardened storage and artifact validation for current image/mask/export write paths. Future prediction imports can now rely on centralized checksum, dimension, content-type, object-stat and stable-error helpers.

The original RB-056 draft requires persisted `ModelRun` / `PredictionRun` provenance with model family/name, version, checkpoint, training run, inference run, config hash, source export/dataset, generated timestamps, actor/system attribution, warnings, notes, per-class confidence/uncertainty/output statistics placement, and links from prediction artifact versions and correction tasks.

RB-057 will later implement actual prediction mask imports. RB-056 must therefore implement the provenance registry and link model, but it must not import prediction files or create prediction artifacts yet.

---

## 2. Goal

Add reproducible, auditable model and prediction-run provenance persistence.

At the end of RB-056:

1. The database can store model/training/inference provenance.
2. A future prediction artifact can be traced to a model/run/config/source dataset.
3. Future correction tasks can link to prediction provenance without relying on display strings.
4. RB-057 has clear schema/API targets for prediction import.
5. Human ground truth remains separate from prediction provenance.
6. Existing training export remains approved-human-only.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- running inference,
- importing prediction files,
- creating `PREDICTION_MASK` artifact versions from uploaded files,
- active-learning queue UI,
- assisted correction editor workflow,
- prediction-analysis export mode,
- batch/background import jobs,
- model training orchestration,
- changing RB-053 default ground-truth export behavior,
- automatic approval of predictions.

If a future need appears, update follow-up tickets/backlog.

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

Because this ticket likely includes a Prisma migration, run `npm run db:rebuild` before final validation.

---

## 5. Domain Model Requirements

### 5.1 Model registry vs prediction run

Separate at least two concepts:

```text
ModelRun / ModelVersion / ModelArtifact
PredictionRun / InferenceRun
```

Codex may choose exact names, but the semantics must be clear.

Recommended split:

#### ModelRun

Represents a model/training/checkpoint identity.

Required concepts:

- id,
- model family/name,
- model version or semantic version,
- model task type:
  - semantic segmentation,
  - support/instance segmentation,
  - slice classification,
  - combined/other,
- checkpoint id/path/hash,
- training run id,
- training dataset/export id or manifest reference,
- training code version / git commit if available,
- config hash,
- createdAt,
- createdBy/system actor if applicable,
- notes/warnings,
- metadata JSON for future extension.

#### PredictionRun

Represents one inference/prediction execution over one project or selection.

Required concepts:

- id,
- modelRunId,
- projectId,
- source export id / dataset id / selection criteria,
- inference run id,
- generatedAt,
- generatedBy/system actor,
- input image count,
- output prediction count,
- aggregate confidence/uncertainty summary,
- config hash / inference parameters hash,
- status,
- warnings/notes,
- metadata JSON.

### 5.2 Prediction item provenance

RB-057 will need to link individual prediction artifacts to a `PredictionRun`.

RB-056 must define and preferably implement a linkable model or fields for individual prediction records.

Recommended options:

Option A: Add `PredictionArtifactProvenance`

```text
PredictionArtifactProvenance
- id
- predictionRunId
- artifactVersionId nullable until RB-057 creates actual artifact
- imageId
- targetType
- confidenceScore
- uncertaintyScore
- perClassScoresJson
- outputStatsJson
- modelOutputChecksum nullable
- createdAt
```

Option B: Add nullable `predictionRunId` and prediction metadata fields directly to `AnnotationArtifactVersion`.

Preferred: Option A if it keeps `AnnotationArtifactVersion` from becoming overloaded and allows pre-import planning.

Codex should choose the least disruptive option and document the rationale.

### 5.3 Task linkage

Future `AnnotationTask` records for `MODEL_PREDICTION_CORRECTION` must be able to reference:

- source prediction artifact version,
- prediction run/provenance,
- confidence/uncertainty,
- task reason.

If the existing schema has `AnnotationTask.sourceArtifactVersionId`, `confidenceScore`, `uncertaintyScore`, and `modelSource`, RB-056 should decide whether to add `predictionRunId` or a separate provenance link.

Do not rely on `modelSource` free text as the source of truth.

### 5.4 Classification predictions

Slice-classification predictions are proposals, not approved `SliceClassificationVersion`.

Design/implement the persistence path so a classification prediction can be represented later without creating approved human classification versions.

Possible approaches:

- prediction item with targetType = `SLICE_CLASSIFICATION`,
- predicted class stored in prediction metadata,
- future task asks human to accept/correct class,
- approved human class still created through RB-052 review path.

### 5.5 Human correction linkage

Human corrections should be traceable to source predictions.

Current design may use:

- `AnnotationArtifactVersion.parentVersionId`,
- `AnnotationTask.sourceArtifactVersionId`,
- new prediction provenance links.

RB-056 must document and implement enough schema linkage so RB-059 can later create human correction versions with clear provenance.

### 5.6 Ground-truth safety

Hard invariants:

```text
ModelRun / PredictionRun records are provenance only.
Prediction records do not imply ground truth.
Prediction artifacts must not become export-ready ground truth without human correction, submit, review, and approval.
RB-053 default export remains approved-human-only.
```

---

## 6. API / Service Scope

RB-056 should add minimal server/domain APIs for provenance registry management, but not prediction artifact import.

### 6.1 Domain services

Add services/helpers for:

- create model run,
- create prediction run,
- read model run,
- read prediction run,
- validate provenance references,
- summarize prediction provenance for UI/API use,
- ensure prediction provenance cannot mark artifacts as approved ground truth.

Suggested location:

```text
src/server/domain/predictions/**
src/server/domain/provenance/**
```

### 6.2 API routes

Add minimal authenticated routes if consistent with repo architecture.

Possible routes:

```text
POST /api/model-runs
GET  /api/model-runs/[modelRunId]
POST /api/prediction-runs
GET  /api/prediction-runs/[predictionRunId]
GET  /api/projects/[projectId]/prediction-runs
```

Rules:

- project access required for project-scoped prediction runs,
- owner/admin/system-style role required to create provenance records,
- viewer may read summaries only if project access permits,
- no private storage keys or credentials in responses,
- validate request payloads,
- stable sanitized errors.

If API routes are deferred, Codex must still implement domain services/tests and document why route creation is postponed. Preferred outcome: minimal API exists.

### 6.3 No UI requirement

No full UI is required in RB-056.

A small project-level provenance summary link/list is optional only if trivial.

Do not build active-learning UI.

---

## 7. Schema / Migration Requirements

A Prisma migration is expected unless the current schema already supports all requirements.

Add models/enums as needed.

Possible enums:

```text
ModelTaskType
PredictionRunStatus
PredictionTargetType
PredictionTaskReason
```

Possible models:

```text
ModelRun
PredictionRun
PredictionArtifactProvenance
```

Keep names aligned with existing schema conventions.

Indexes/constraints should support:

- lookup prediction runs by project,
- lookup prediction runs by model run,
- unique external inference run id per project/model where appropriate,
- lookup prediction provenance by artifact version,
- lookup prediction provenance by image.

Do not introduce broad schema churn unrelated to prediction provenance.

---

## 8. Tests

Add focused tests.

### 8.1 Unit/domain tests

Cover:

- provenance payload validation,
- model-run creation shape,
- prediction-run creation shape,
- stable confidence/uncertainty bounds if validated,
- prediction target type validation,
- ground-truth safety helper returns false for prediction provenance.

### 8.2 Integration/route tests

Cover:

- authorized user can create model run,
- authorized user can create prediction run linked to model run and project,
- unauthorized user cannot create provenance records,
- user without project access cannot read project prediction run,
- prediction run can store model/config/source dataset identifiers,
- prediction artifact provenance can reference a run without becoming export-ready,
- correction task/source linkage can resolve prediction provenance where implemented.

### 8.3 Regression tests

Existing flows must remain green:

- upload,
- semantic/support/classification,
- review/approval,
- export,
- E2E smoke.

---

## 9. Documentation Updates

Update or create:

```text
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/06-data/prisma.md
docs/03-features/projects.md
docs/01-architecture/domain-boundaries.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- implemented ModelRun/PredictionRun schema,
- where confidence/uncertainty/per-class scores live,
- how future RB-057 imports link to provenance,
- how future RB-058 queues use prediction provenance,
- how future RB-059 human corrections link to predictions,
- predictions remain excluded from RB-053 training export,
- open limitations/deferred behavior.

---

## 10. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Model-run and prediction-run provenance can be persisted.
3. Model/checkpoint/config/source dataset identifiers are represented.
4. Prediction run can be associated with an annotation project.
5. Per-run confidence/uncertainty/output stats placement is defined and implemented or explicitly deferred with rationale.
6. Individual prediction artifact provenance can be linked to a prediction run or a documented field path exists for RB-057.
7. Future correction tasks can link to prediction provenance without relying on free-form display text.
8. Predictions do not become approved/export-ready ground truth by virtue of provenance records.
9. Minimal API/domain services exist, or route deferral is explicitly justified.
10. Tests cover provenance creation, authorization, linkage, and ground-truth safety.
11. Existing export/review/editor workflows remain green.
12. Docs are updated and distinguish implemented vs deferred behavior.
13. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

14. Final validation passes:

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

15. Final Codex report includes:
    - commits created,
    - migrations/schema changes,
    - models/enums added,
    - APIs/services added,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 11. Suggested Commit Sequence

```bash
git commit -m "docs: define prediction provenance implementation plan"
git commit -m "schema: add model run and prediction run registry"
git commit -m "feat: add prediction provenance domain services"
git commit -m "feat: add prediction provenance api routes"
git commit -m "test: cover prediction provenance registry"
git commit -m "docs: document model run provenance registry"
git commit -m "chore: finalize prediction provenance ticket"
```

---

## 12. Notes for Codex

- This ticket creates provenance persistence only.
- Do not import prediction mask files.
- Do not create active-learning queue UI.
- Do not change RB-053 default approved-human-only export.
- RB-057 will use this registry for actual prediction imports.
- RB-055 validation helpers must be reused by RB-057, not re-invented here.
