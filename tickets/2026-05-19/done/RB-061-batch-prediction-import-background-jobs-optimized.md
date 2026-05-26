# RB-061 — Batch Prediction Import & Background Job Baseline

## Status

Proposed / Ready for Codex

## Priority

Medium

## Type

Batch Import / Background Jobs / Operations / Prediction Import / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-056 — Prediction Provenance / ModelRun Registry
- RB-057 — Prediction Import API & Storage Validation
- RB-058 — Active-Learning Task Queue API/UI
- RB-059 — Assisted Correction Editor Workflow
- RB-060 — Prediction Analysis Export Mode

## Blocks

- Larger customer prediction trials
- Future model-worker integration
- Future scheduled/bulk prediction workflows
- Future production-grade async job infrastructure

---

## 1. Context

RB-057 implemented the single-prediction import path. RB-058 created correction tasks from imported prediction provenance. RB-059 added the assisted correction editor workflow. RB-060 added a prediction-analysis export mode.

The remaining gap in the prediction pipeline is operational:

```text
single prediction import works
but larger prediction runs should not rely on long browser or route-handler requests
```

The original RB-061 draft correctly calls for larger prediction imports without long synchronous browser/route-handler requests, a background job model, batch status, item-level failures, retries, import summaries, preservation of RB-056/RB-057 validation/provenance rules, and no inference or HA job infrastructure.

RB-061 should implement a **single-host, DB-backed batch import/job baseline** suitable for the current Strato-style trial architecture.

This is not a full distributed job system.

---

## 2. Goal

Implement a reliable batch prediction import baseline that can import many prediction artifacts through job/item bookkeeping instead of one long request.

At the end of RB-061:

1. Users with appropriate permissions can create a batch prediction import job for an existing `PredictionRun`.
2. The batch contains item-level prediction import entries.
3. Each item is processed through the existing RB-057 prediction import validation/service path.
4. Job and item statuses are persisted and inspectable.
5. Partial failures are explicit and retryable.
6. Imported predictions remain proposal artifacts only.
7. Correction tasks can be generated after successful imports using the existing RB-058 workflow.
8. No ambiguous ground-truth state is created.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- running inference,
- training models,
- high-availability job infrastructure,
- RabbitMQ/Redis/BullMQ unless already present and strongly justified,
- Kubernetes/job orchestration,
- scheduled production worker fleet,
- replacing RB-053 synchronous training export,
- prediction-analysis metrics dashboard,
- editor correction changes,
- automatic approval of predictions,
- batch export changes.

If future production-grade queue infrastructure is needed, create a follow-up ticket.

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

Because this ticket likely includes schema changes and operational scripts, run full validation before finalizing.

---

## 5. Architecture Decision

### 5.1 Single-host DB-backed job baseline

Use a DB-backed job/item model.

Recommended approach:

```text
API creates PredictionImportBatchJob + PredictionImportBatchItem rows
worker/processor claims pending items
processor calls existing RB-057 import service
item status is updated
job summary is updated
```

This avoids long browser requests while staying simple for the single-host trial.

### 5.2 No external queue dependency

Do not introduce an external queue service unless the repository already has one and it is trivial.

Preferred MVP:

- DB tables,
- deterministic claim/processing logic,
- CLI or npm script to process jobs,
- optional API endpoint to trigger one processing pass for local/trial use if safe.

### 5.3 Reuse RB-057 import service

Do not reimplement prediction validation.

The batch processor must call the same domain-level import function used by the single prediction import path.

All RB-055/RB-057 rules still apply:

- checksum validation,
- dimension validation,
- content type/format validation,
- target-type validation,
- project/image ownership,
- prediction provenance,
- no ground-truth/export-ready state.

---

## 6. Batch Input Model

### 6.1 Batch manifest

RB-061 should define a batch import manifest format.

Suggested manifest version:

```text
sapen-annotate-prediction-batch-import-v1
```

Suggested JSON structure:

```json
{
  "manifestVersion": "sapen-annotate-prediction-batch-import-v1",
  "predictionRunId": "...",
  "items": [
    {
      "clientItemId": "optional-stable-id",
      "imageId": "...",
      "targetType": "SEMANTIC_MASK_PREDICTION",
      "fileName": "predictions/image-1.u8raw",
      "checksum": "sha256:...",
      "width": 1024,
      "height": 768,
      "contentType": "application/octet-stream",
      "confidenceScore": 0.91,
      "uncertaintyScore": 0.09,
      "perClassScores": {},
      "outputStats": {}
    }
  ]
}
```

The exact shape may differ but must be documented and tested.

### 6.2 Artifact file transport

For MVP, choose one practical input mode.

Recommended options:

#### Option A — ZIP upload

One API accepts a ZIP containing:

```text
manifest.json
predictions/<files...>
```

The server extracts/validates manifest and creates batch items.

#### Option B — manifest first + per-item upload

API creates batch from manifest, then item files are uploaded separately.

#### Option C — server-side staging prefix

API references objects in an internal staging prefix, but only if RB-055 storage-key safety constraints are met.

Preferred for RB-061 if feasible: **Option A ZIP upload**, because it matches customer/operator workflows and keeps one upload artifact.

If ZIP parsing is too large for this slice, choose Option B and document ZIP import as follow-up.

Do not accept arbitrary unscoped client storage keys.

### 6.3 Size limits

Batch import must enforce configurable limits:

- max ZIP/batch upload bytes,
- max items per batch,
- max single prediction artifact bytes,
- supported file content types.

Defaults should be trial-friendly and documented.

---

## 7. Schema / Persistence

Add minimal schema if not already present.

Suggested models:

```text
PredictionImportBatchJob
- id
- projectId
- predictionRunId
- createdById
- status
- manifestVersion
- sourceKind
- sourceFilename
- sourceChecksum
- totalItems
- pendingItems
- processingItems
- succeededItems
- failedItems
- skippedItems
- createdAt
- startedAt
- completedAt
- metadataJson
- errorSummaryJson

PredictionImportBatchItem
- id
- batchJobId
- clientItemId
- imageId
- targetType
- status
- attemptCount
- maxAttempts
- nextRetryAt
- sourcePath / fileName / stagingKey as applicable
- expectedChecksum
- expectedWidth
- expectedHeight
- contentType
- confidenceScore
- uncertaintyScore
- perClassScoresJson
- outputStatsJson
- predictionArtifactVersionId nullable
- predictionProvenanceId nullable
- errorCode nullable
- errorMessage nullable sanitized
- createdAt
- startedAt
- completedAt
```

Suggested enums:

```text
PredictionImportBatchStatus
PredictionImportBatchItemStatus
PredictionImportBatchSourceKind
```

Status examples:

```text
PENDING
PROCESSING
COMPLETED
COMPLETED_WITH_ERRORS
FAILED
CANCELLED
```

Item status examples:

```text
PENDING
PROCESSING
SUCCEEDED
FAILED
SKIPPED
RETRY_PENDING
```

Do not introduce broad schema churn unrelated to batch imports.

---

## 8. Job Processing Semantics

### 8.1 Claiming items

Implement deterministic item claiming.

For single-host trial, a simple transaction-based claim is sufficient.

Rules:

- claim only `PENDING` or due `RETRY_PENDING` items,
- set item status to `PROCESSING`,
- increment attempt count,
- record `startedAt`,
- avoid duplicate processing where practical.

### 8.2 Processing items

For each item:

1. Read bytes from uploaded ZIP/staging source.
2. Validate expected metadata.
3. Call the existing prediction import domain service.
4. Persist returned artifact/provenance ids on item.
5. Mark item `SUCCEEDED`.

On failure:

- record stable error code,
- record sanitized message,
- mark `FAILED` or `RETRY_PENDING` depending on retry policy,
- update batch summary.

### 8.3 Retry behavior

Implement minimal retry semantics:

- retry only deterministic transient failures if identifiable, e.g. object read/stat failures,
- do not retry validation failures such as checksum/dimension mismatch by default,
- max attempts configurable or fixed small number, e.g. 3,
- manual retry endpoint may reset failed items if authorized.

If retry classification is too broad, implement manual retry only and document automatic retry as deferred.

### 8.4 Job completion

Batch job status should reflect item results:

```text
COMPLETED              all items succeeded
COMPLETED_WITH_ERRORS  some succeeded, some failed/skipped
FAILED                 no items succeeded or fatal batch error
```

No partial failure may create ambiguous ground-truth state.

Successful prediction items remain proposals only.

---

## 9. API Scope

Implement minimal APIs.

Recommended routes:

```text
POST /api/prediction-runs/[predictionRunId]/batch-imports
GET  /api/prediction-import-batches/[batchId]
GET  /api/prediction-import-batches/[batchId]/items
POST /api/prediction-import-batches/[batchId]/process
POST /api/prediction-import-batches/[batchId]/retry
```

### 9.1 Create batch

`POST /api/prediction-runs/[predictionRunId]/batch-imports`

For ZIP mode:

```text
multipart/form-data
- file: zip
```

For manifest mode:

```json
{ "manifest": {...} }
```

Creates batch job and items, but does not process all items in the request unless intentionally limited.

### 9.2 Process batch

`POST /api/prediction-import-batches/[batchId]/process`

For trial/local use, this can process a limited number of items synchronously, e.g.:

```json
{ "limit": 10 }
```

Preferred also add CLI:

```bash
npm run jobs:prediction-import -- --batch <id> --limit 100
```

or a documented script name.

### 9.3 Inspect batch

Return:

- batch status,
- counts,
- item summaries,
- stable error codes,
- created artifact/provenance references,
- no private storage keys.

### 9.4 Retry

Allow authorized retry of failed items.

Rules:

- validation errors may require new batch or explicit reset,
- no duplicate successful imports for already succeeded items,
- retry must remain idempotent.

---

## 10. Authorization

Server-side authorization required.

Recommended:

```text
OWNER / QA:
- create batch import,
- process batch,
- retry failed items,
- inspect batch.

LABELER:
- may inspect if project policy allows, but cannot create/process/retry.

VIEWER:
- no mutation, possibly no batch visibility unless current policy allows read-only.
```

Project access required in all cases.

No UI-only enforcement.

---

## 11. UI Scope

Add minimal project-level UI if feasible.

Suggested placement:

```text
Project Overview → Prediction Imports / Batch Imports panel
```

or dedicated route:

```text
/app/projects/[projectId]/prediction-imports
```

Minimum UI:

- list recent batch imports,
- create batch import from ZIP/manifest if implemented,
- show status counts,
- show item failures,
- process/retry button for authorized users,
- link to PredictionRun,
- no private storage keys.

If full upload UI is too large, implement read/status UI and keep create/process API documented. Preferred outcome: minimal create/status UI exists.

Do not build active-learning task queue UI here; RB-058 already did that.

---

## 12. Tests

### 12.1 Unit/domain tests

Cover:

- batch manifest validation,
- item status transitions,
- batch status aggregation,
- retry eligibility,
- item ordering/claiming behavior,
- validation errors vs retryable errors.

### 12.2 Integration/API tests

Cover:

- authorized user creates batch,
- unauthorized user cannot create/process/retry,
- batch item imports call the prediction import path,
- success item creates prediction artifact/provenance,
- failed checksum/dimension item records stable error,
- partial success leads to `COMPLETED_WITH_ERRORS`,
- re-processing does not duplicate successful imports,
- retry failed item behavior,
- batch summaries do not leak private storage keys,
- predictions remain not ground truth/export-ready.

### 12.3 E2E tests

Extend only if stable and valuable.

Possible path:

```text
login as owner/QA
→ create prediction run
→ upload small batch manifest/zip
→ process batch
→ see succeeded/failed counts
→ create correction tasks from successful predictions
```

If ZIP upload E2E is too brittle, cover via integration tests and document E2E deferral.

Existing E2E must remain green.

---

## 13. Documentation Updates

Update:

```text
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/03-features/projects.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Add or update:

```text
docs/04-server/batch-prediction-imports.md
```

Docs must state:

- batch manifest format,
- processing model,
- retry behavior,
- limits,
- operational command/API,
- item-level failure behavior,
- predictions remain proposals,
- no inference is run,
- production-grade queue infrastructure remains deferred.

---

## 14. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Batch prediction import jobs can be created for an existing `PredictionRun`.
3. Batch items are persisted with target type, image reference, expected checksum/dimensions and status.
4. A processor can import pending items through the existing RB-057 prediction import service.
5. Successful items link to `AnnotationArtifactVersion` and `PredictionArtifactProvenance`.
6. Failed items retain stable error codes and sanitized messages.
7. Partial failures result in clear batch status and summaries.
8. Retry behavior is implemented or explicitly limited and documented.
9. Duplicate processing does not create duplicate prediction artifacts for already successful items.
10. Batch APIs enforce project access and role permissions.
11. UI or documented operational API allows inspecting batch/job/item status.
12. Predictions remain proposals, not ground truth.
13. RB-053 export remains approved-human-only.
14. Tests cover batch creation, processing, failure, retry/idempotency and authorization.
15. Existing import/queue/correction/export workflows remain green.
16. Docs are updated and distinguish implemented vs deferred behavior.
17. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

18. Final validation passes:

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

19. Final Codex report includes:
    - commits created,
    - schema changes/models/enums added,
    - routes/services/UI changed,
    - processing mode chosen,
    - tests added/changed,
    - retry/idempotency behavior,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 15. Suggested Commit Sequence

```bash
git commit -m "docs: define batch prediction import baseline"
git commit -m "schema: add prediction import batch job model"
git commit -m "feat: add batch prediction import services"
git commit -m "feat: add batch prediction import api routes"
git commit -m "feat: add prediction import batch status ui"
git commit -m "test: cover batch prediction import behavior"
git commit -m "docs: document batch import operations"
git commit -m "chore: finalize batch prediction import ticket"
```

---

## 16. Notes for Codex

- Reuse RB-057 single prediction import service.
- Do not run inference.
- Do not introduce heavyweight external queue infrastructure.
- Keep single-host trial operations simple and explicit.
- Item-level bookkeeping and idempotency are more important than UI polish.
- Predictions remain proposals only.
