# RB-057 — Prediction Import API & Storage Validation

## Status

Completed

## Priority

High

## Type

API / Storage / Prediction Import / Data Integrity / Provenance / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-054 — Model Preprediction & Active-Learning Design
- RB-055 — Upload & Artifact Validation / Checksum Hardening
- RB-056 — Prediction Provenance / ModelRun Registry

## Blocks

- RB-058 — Active-Learning Task Queue API/UI
- RB-059 — Assisted Correction Editor Workflow
- RB-060 — Prediction Analysis Export Mode
- RB-061 — Batch Prediction Import and Background Jobs

---

## 1. Context

RB-054 defined the future prediction/active-learning design and the ground-truth safety rule:

```text
Model predictions are proposals, not ground truth.
```

RB-055 hardened storage validation, checksum/dimension checks, stable API errors, and audit behavior for current image/mask/export write paths.

RB-056 added persisted prediction provenance:

- `ModelRun`
- `PredictionRun`
- `PredictionArtifactProvenance`
- `ModelTaskType`
- `PredictionRunStatus`
- `PredictionTargetType`

RB-056 also established that:

- `AnnotationTask.modelSource` remains only legacy/display,
- real provenance flows through `predictionRunId` / `predictionProvenanceId`,
- classification predictions must not create human `SliceClassificationVersion` rows,
- predictions are not export-ready and remain excluded from the RB-053 ground-truth export.

The original RB-057 draft correctly scopes the next step: implement the first server-side prediction import path, validate object existence/size/checksum/dimensions/content type/coordinate space, persist `PREDICTION_MASK` artifact versions with `MODEL_PREDICTION` provenance, link to model-run/prediction-run provenance, keep MinIO/S3 keys private, and test failure modes and prediction-not-ground-truth invariants.

This optimized ticket turns that into a concrete, bounded implementation slice.

---

## 2. Goal

Implement the first server-side API for importing model-generated prediction mask proposals.

At the end of RB-057, an authorized user/system should be able to:

1. Select an existing `PredictionRun`.
2. Import a prediction mask for an existing `ImageAsset`.
3. Validate the prediction artifact using RB-055 storage/integrity helpers.
4. Persist it as an immutable `AnnotationArtifactVersion` with:
   - `artifact.kind = PREDICTION_MASK`,
   - `provenance = MODEL_PREDICTION`,
   - checksum,
   - dimensions,
   - coordinate-space metadata,
   - prediction provenance link.
5. Create/update `PredictionArtifactProvenance` linking:
   - `PredictionRun`,
   - image,
   - prediction artifact version,
   - target type,
   - confidence/uncertainty,
   - output stats/per-class scores where provided.
6. Optionally create a minimal `MODEL_PREDICTION_CORRECTION` annotation task if the schema and RB-056 service shape already support it cleanly.
7. Ensure imported predictions remain proposals and never become approved/export-ready ground truth.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- running inference,
- batch/background import jobs,
- active-learning queue UI,
- assisted correction editor workflow,
- “use prediction as starting mask” editor behavior,
- prediction-analysis export mode,
- default ground-truth export of predictions,
- automatic approval of predictions,
- review/approval of model predictions as human ground truth,
- model training orchestration,
- broad schema redesign.

If task creation becomes too large, defer task creation to RB-058 and document the exact API/provenance state RB-058 should use.

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

Because this ticket touches storage, artifacts and provenance, run full validation before finalizing.

---

## 5. Import Model

### 5.1 Import unit

RB-057 should import **one prediction artifact per request**.

This is intentionally not a batch import.

A later RB-061 may wrap the same service in batch/background jobs.

### 5.2 Target types

Support at least mask prediction imports for:

```text
SEMANTIC_MASK_PREDICTION
SLICE_SUPPORT_MASK_PREDICTION
```

If the existing enum uses different names, align with `PredictionTargetType`.

Classification prediction imports may be accepted as metadata/proposal only if the RB-056 model supports it cleanly, but RB-057 must not create approved human classification versions.

### 5.3 Artifact kind

Imported mask predictions must be persisted as:

```text
AnnotationArtifact.kind = PREDICTION_MASK
AnnotationArtifactVersion.provenance = MODEL_PREDICTION
```

Do not store model predictions as `SEMANTIC_MASK` or `SLICE_SUPPORT_MASK`, because those are human/editable artifact tracks.

The target type in provenance metadata indicates whether the prediction is intended as semantic or support/instance proposal.

### 5.4 Parent/source links

Prediction imports should not have a human parent version.

Later human corrections should reference prediction versions through:

- `AnnotationArtifactVersion.parentVersionId`, and/or
- `AnnotationTask.sourceArtifactVersionId`, and/or
- `PredictionArtifactProvenance`.

RB-057 only needs to create the prediction side of that chain.

---

## 6. API / Service Scope

### 6.1 Domain service

Add a central prediction import domain service.

Suggested location:

```text
src/server/domain/predictions/importPrediction.ts
```

or align with existing `predictionProvenance` service layout.

Required responsibilities:

1. Load and validate `PredictionRun`.
2. Verify project/image ownership.
3. Validate user/system permissions.
4. Validate target type.
5. Validate input artifact bytes or storage object reference.
6. Use RB-055 helpers for:
   - checksum,
   - object existence/stat,
   - content type,
   - size,
   - dimensions,
   - mask byte length,
   - coordinate space.
7. Create or locate appropriate `AnnotationArtifact` of kind `PREDICTION_MASK`.
8. Create immutable `AnnotationArtifactVersion`.
9. Create/update `PredictionArtifactProvenance`.
10. Optionally create correction task if scope remains small.
11. Record audit events.
12. Return sanitized import summary.

### 6.2 API route

Implement one minimal import route.

Preferred shape:

```text
POST /api/prediction-runs/[predictionRunId]/predictions
```

Possible request types:

#### Option A: multipart upload

```text
multipart/form-data
- imageId
- targetType
- file
- checksum optional expected checksum
- confidenceScore optional
- uncertaintyScore optional
- perClassScoresJson optional
- outputStatsJson optional
```

#### Option B: server-side storage reference

```json
{
  "imageId": "...",
  "targetType": "...",
  "storageKey": "...",
  "checksum": "sha256:...",
  "contentType": "application/octet-stream",
  "byteSize": 123,
  "width": 1024,
  "height": 768,
  "confidenceScore": 0.91,
  "uncertaintyScore": 0.09,
  "perClassScores": {},
  "outputStats": {}
}
```

For RB-057, **prefer multipart upload** if it avoids accepting arbitrary client-provided storage keys. If storage-key import is needed, it must be strictly scoped to an allowed private import prefix and must validate object existence/stat/checksum.

Do not expose private MinIO/S3 URLs to the browser.

### 6.3 Response

Return a sanitized payload:

```json
{
  "predictionRunId": "...",
  "imageId": "...",
  "artifactId": "...",
  "artifactVersionId": "...",
  "predictionProvenanceId": "...",
  "targetType": "SEMANTIC_MASK_PREDICTION",
  "checksum": "sha256:...",
  "width": 1024,
  "height": 768,
  "reviewState": "DRAFT",
  "provenance": "MODEL_PREDICTION",
  "createdTaskId": "optional"
}
```

No private storage keys unless they are internal-only and never sent to untrusted clients. Prefer no storage key in response.

### 6.4 Auth and roles

Server-side authorization is mandatory.

Suggested rule:

```text
OWNER / ADMIN / QA can import predictions.
ANNOTATOR / REVIEWER / VIEWER cannot import predictions by default.
```

Adjust to actual role enums.

Project access is required in all cases.

ModelRun direct admin-only rules from RB-056 remain unchanged.

### 6.5 Stable error codes

Use or extend RB-055 stable error payloads.

Relevant codes:

```text
PREDICTION_RUN_NOT_FOUND
PREDICTION_RUN_PROJECT_MISMATCH
PREDICTION_TARGET_UNSUPPORTED
PREDICTION_IMPORT_FORBIDDEN
IMAGE_NOT_FOUND
IMAGE_PROJECT_MISMATCH
UNSUPPORTED_CONTENT_TYPE
UPLOAD_TOO_LARGE
CHECKSUM_MISMATCH
MASK_FORMAT_UNSUPPORTED
MASK_BYTE_LENGTH_MISMATCH
MASK_DIMENSIONS_MISMATCH
OBJECT_WRITE_FAILED
OBJECT_STAT_FAILED
```

Errors must be sanitized.

---

## 7. Validation Rules

### 7.1 Mask format

Supported MVP prediction artifact format:

```text
u8raw-v1
```

or the currently used internal u8 raw mask format.

The API must document what it accepts.

If the current upload path sends raw bytes without a header, RB-057 must clearly validate using explicit width/height/image dimensions and expected byte length.

### 7.2 Dimensions

Prediction mask dimensions must match the image dimensions for RB-057.

No implicit resize/transform.

If transforms are needed later, defer to a future ticket.

### 7.3 Target-specific value validation

For semantic prediction:

- allow label values compatible with the active label schema where practical,
- unknown values should fail or be warned according to existing mask validation capabilities.

For support prediction:

- require binary/support-compatible values where practical:
  - background/unknown,
  - slice support.

Do not allow a semantic Copper mask to satisfy support prediction import.

### 7.4 Checksum

Server computes actual checksum.

If caller provides expected checksum, compare and reject mismatch.

Persist canonical checksum.

### 7.5 Provenance

Every imported prediction must link to:

- `PredictionRun`,
- `PredictionArtifactProvenance`,
- image,
- target type,
- artifact version.

Confidence/uncertainty must be in valid numeric bounds if provided.

### 7.6 Ground-truth safety

Hard rules:

```text
Imported predictions are not approved.
Imported predictions are not review-approved human ground truth.
Imported predictions do not appear in RB-053 training export.
Imported predictions cannot be submitted/approved through RB-052 as if they were human versions.
```

If review APIs currently see all artifact versions, they must reject or ignore `MODEL_PREDICTION` / `PREDICTION_MASK` versions.

---

## 8. Optional Task Creation

RB-057 may create a minimal correction task if it is straightforward.

If implemented:

- task type: `MODEL_PREDICTION_CORRECTION`,
- status: open/todo,
- priority from request or default,
- sourceArtifactVersionId = prediction artifact version,
- predictionRun/provenance link if schema supports it,
- confidence/uncertainty copied from provenance,
- assignedTo optional/null.

If not implemented:

- document that RB-058 will create/list tasks based on `PredictionArtifactProvenance`.

Do not build task queue UI in RB-057.

---

## 9. Tests

Add focused tests.

### 9.1 Unit/domain tests

Cover:

- prediction import payload validation,
- target type validation,
- confidence/uncertainty bounds,
- expected checksum mismatch,
- dimension mismatch,
- support target rejects non-binary/non-support-compatible data,
- ground-truth safety helper.

### 9.2 Integration/API tests

Cover:

- authorized user imports semantic prediction mask,
- authorized user imports support prediction mask,
- unauthorized user cannot import,
- image outside prediction run project is rejected,
- invalid checksum rejected,
- invalid dimensions rejected,
- imported artifact has kind `PREDICTION_MASK`,
- imported artifact version has provenance `MODEL_PREDICTION`,
- `PredictionArtifactProvenance` links to run/image/artifact version,
- imported prediction is not export-ready and not included in RB-053 export,
- review/approval API cannot approve prediction artifact as human ground truth.

### 9.3 E2E tests

No full browser E2E is required unless a simple admin API-backed path is already available.

Existing E2E must remain green.

---

## 10. Documentation Updates

Update:

```text
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/03-features/projects.md
docs/03-features/editor.md
docs/04-server/deployment-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- prediction import API behavior,
- accepted artifact format,
- validation rules,
- provenance linkage,
- predictions are proposal artifacts only,
- no ground-truth export,
- no editor correction UI yet,
- no batch import yet,
- RB-058/RB-059 follow-up boundaries.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Authorized import can create a prediction mask artifact version linked to a prediction run.
3. Imported prediction artifact uses `PREDICTION_MASK` and `MODEL_PREDICTION`.
4. `PredictionArtifactProvenance` links prediction run, image, target type, and artifact version.
5. Server validates checksum, content type/format, size, dimensions, and coordinate space.
6. Invalid checksum/dimensions/target/project are rejected with stable errors.
7. Support prediction import cannot treat Copper semantic data as support geometry.
8. Prediction imports do not create approved human ground truth.
9. RB-052 review APIs cannot approve prediction artifacts as human versions.
10. RB-053 ground-truth export excludes prediction artifacts.
11. Optional correction task creation is implemented or explicitly deferred to RB-058.
12. No private MinIO/S3 URLs leak to browser/API response.
13. Tests cover success/failure/provenance/ground-truth safety.
14. Existing browser/review/export workflows remain green.
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
    - files/routes changed,
    - tests added/changed,
    - stable error codes introduced,
    - task creation implemented/deferred status,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define prediction import api boundary"
git commit -m "feat: add prediction import validation service"
git commit -m "feat: add prediction import api route"
git commit -m "test: cover prediction import validation"
git commit -m "test: protect prediction ground truth boundaries"
git commit -m "docs: document prediction import workflow"
git commit -m "chore: finalize prediction import ticket"
```

---

## 13. Notes for Codex

- This is the first prediction import path.
- Do not build active-learning queue UI.
- Do not build assisted correction editor workflow.
- Do not let predictions become approved/exportable ground truth.
- Reuse RB-055 validation helpers.
- Reuse RB-056 provenance registry.
