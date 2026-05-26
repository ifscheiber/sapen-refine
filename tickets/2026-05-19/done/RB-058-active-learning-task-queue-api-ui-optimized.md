# RB-058 — Active-Learning Task Queue API & UI

## Status

Proposed / Ready for Codex

## Priority

Medium / High

## Type

Task Queue / API / UI / Active Learning / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-054 — Model Preprediction & Active-Learning Design
- RB-056 — Prediction Provenance / ModelRun Registry
- RB-057 — Prediction Import API & Storage Validation

## Blocks

- RB-059 — Assisted Correction Editor Workflow
- RB-060 — Prediction Analysis Export Mode
- RB-061 — Batch Prediction Import and Background Jobs

---

## 1. Context

RB-056 added reproducible prediction provenance:

- `ModelRun`
- `PredictionRun`
- `PredictionArtifactProvenance`
- prediction target types,
- confidence/uncertainty fields,
- project-scoped prediction run access.

RB-057 added the first server-side prediction import path:

- `POST /api/prediction-runs/[predictionRunId]/predictions`
- one prediction artifact per request,
- `AnnotationArtifact.kind = PREDICTION_MASK`,
- `AnnotationArtifactVersion.provenance = MODEL_PREDICTION`,
- `PredictionArtifactProvenance` links prediction run, image, target type and artifact version,
- predictions are not reviewable/export-ready ground truth,
- no correction tasks were created in RB-057 by design.

The next step is to materialize and expose correction tasks from imported prediction provenance.

RB-058 creates the queue and task-management layer. It must not implement the assisted editor overlay or human correction behavior; that is RB-059.

---

## 2. Goal

Implement the first active-learning correction task queue for prediction-backed annotation work.

At the end of RB-058:

1. Imported prediction provenance can be converted into `MODEL_PREDICTION_CORRECTION` tasks.
2. Tasks are listed in a deterministic project-level queue.
3. Queue ordering prioritizes uncertain/low-confidence predictions.
4. Eligible users can claim/assign/start/dismiss tasks.
5. Queue entries expose prediction provenance summaries without leaking storage keys.
6. Each task links to the existing prediction artifact version and future editor route context.
7. RB-059 can use these tasks to open assisted correction editor sessions.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- assisted correction editor overlay,
- “use prediction as starting mask” behavior,
- saving human corrections from predictions,
- prediction-analysis export mode,
- batch/background prediction imports,
- model inference,
- notification system,
- complex workload balancing,
- full kanban/task-management UI,
- changing RB-053 ground-truth export behavior.

If these needs appear, document them for RB-059+.

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

---

## 5. Task Creation Model

### 5.1 Source of tasks

RB-058 should create tasks from `PredictionArtifactProvenance`.

Recommended service operation:

```text
createCorrectionTasksForPredictionRun(predictionRunId, options)
```

It should:

- find prediction provenance records for a prediction run,
- skip records that already have an open/completed correction task,
- create `AnnotationTask` rows with type `MODEL_PREDICTION_CORRECTION`,
- link `sourceArtifactVersionId` to the prediction artifact version,
- link prediction provenance/run where the schema supports it,
- copy target type, confidence and uncertainty where useful,
- set deterministic priority and task reason.

### 5.2 Idempotency

Task creation must be idempotent.

Running task creation twice for the same prediction run must not create duplicate tasks for the same prediction artifact/provenance.

Use existing unique constraints if available; otherwise enforce in service code and document any missing DB-level uniqueness as backlog.

### 5.3 Task reasons

Support stable task reasons.

Minimum task reasons:

```text
LOW_CONFIDENCE
HIGH_UNCERTAINTY
MISSING_GROUND_TRUTH
MANUAL_PRIORITY
```

Optional if already designed:

```text
MODEL_DISAGREEMENT
STALE_MODEL_VERSION
RANDOM_QA_SAMPLE
```

If the current schema lacks an enum, use validated string constants and document the follow-up if a schema enum is needed.

### 5.4 Priority and ordering

Implement deterministic ordering.

Recommended queue order:

```text
1. higher priority first
2. higher uncertaintyScore first
3. lower confidenceScore first
4. older createdAt first
5. stable id ascending
```

If score values are missing, define and document fallback behavior.

### 5.5 Task status

Use existing `AnnotationTask` status enum if present.

Minimum states needed:

```text
OPEN / TODO
ASSIGNED / IN_PROGRESS
DONE / COMPLETED
DISMISSED / SKIPPED
```

If exact enum names differ, adapt to the schema.

Rules:

- completed/dismissed tasks should not appear in default open queue,
- task status changes are attributable,
- invalid transitions should fail with stable errors.

---

## 6. API Scope

Implement minimal APIs for queue operations.

Recommended routes, adapt to repo conventions:

```text
POST /api/prediction-runs/[predictionRunId]/correction-tasks
GET  /api/projects/[projectId]/correction-tasks
GET  /api/correction-tasks/[taskId]
PATCH /api/correction-tasks/[taskId]
```

### 6.1 Create tasks for prediction run

`POST /api/prediction-runs/[predictionRunId]/correction-tasks`

Creates missing correction tasks for prediction provenance records in a run.

Request options may include:

```json
{
  "reason": "HIGH_UNCERTAINTY",
  "defaultPriority": 50,
  "assigneeId": null
}
```

Response:

```json
{
  "predictionRunId": "...",
  "created": 10,
  "skippedExisting": 3,
  "tasks": [...]
}
```

### 6.2 List project queue

`GET /api/projects/[projectId]/correction-tasks`

Filters:

- status,
- assignee,
- target type,
- prediction run,
- task reason,
- assigned to me.

MVP may implement only:

```text
open tasks
my tasks
all non-closed tasks
```

But ordering must be deterministic.

### 6.3 Task detail

`GET /api/correction-tasks/[taskId]`

Returns:

- task id,
- image id,
- project id,
- prediction run summary,
- prediction artifact version id,
- target type,
- confidence/uncertainty,
- task reason,
- status,
- assignee,
- created/updated timestamps,
- editor route target for RB-059.

No private storage keys.

### 6.4 Update task

`PATCH /api/correction-tasks/[taskId]`

Supported actions:

```text
assign to self
assign to user if admin/owner
start
complete
dismiss/skip with reason
change priority if admin/owner/QA
```

Do not mark a prediction as corrected in RB-058. Actual correction completion belongs to RB-059 after the editor can create human correction versions.

---

## 7. Authorization

Server-side authorization is mandatory.

Suggested rules:

```text
OWNER / ADMIN / QA:
- create correction tasks from prediction runs,
- view all project tasks,
- assign tasks,
- change priority,
- dismiss tasks.

ANNOTATOR / REVIEWER:
- view eligible project tasks,
- claim/assign to self,
- start own tasks,
- possibly dismiss own tasks according to implemented rules.

VIEWER:
- read-only or no queue access depending on existing project access policy,
- cannot mutate tasks.
```

Adjust to actual role enums.

Hard rules:

- user without project access cannot read or mutate tasks,
- viewer cannot mutate tasks,
- task mutation must be actor-attributed,
- UI hiding controls is not sufficient.

---

## 8. UI Scope

Add a minimal project-level active-learning queue UI.

Suggested placement:

```text
Project Overview → Prediction / Correction Tasks panel
```

or a route such as:

```text
/app/projects/[projectId]/tasks
```

Preferred if route structure is already clean: dedicated project task page with link from project overview.

Minimum UI:

- queue summary:
  - open tasks,
  - assigned to me,
  - completed/dismissed counts if cheap,
- list of open tasks ordered by active-learning priority,
- columns/cards:
  - image filename / T-number if available,
  - target type,
  - task reason,
  - confidence,
  - uncertainty,
  - prediction run/model summary,
  - status,
  - assignee,
  - link placeholder to future correction editor route,
- controls:
  - create tasks from prediction run if user allowed,
  - assign to me,
  - start,
  - dismiss/skip,
  - change priority if allowed.

Do not build the assisted editor in RB-058.

The future editor link may point to the existing image editor with query params or a disabled/placeholder route if RB-059 will implement it. Document whichever is chosen.

Keep the UI responsive and usable on iPad-sized screens.

---

## 9. Tests

Add focused tests.

### 9.1 Unit/domain tests

Cover:

- deterministic ordering,
- task reason validation,
- idempotent task creation,
- priority fallback behavior,
- status transition validation,
- task summary from prediction provenance.

### 9.2 Integration/API tests

Cover:

- owner/admin/QA can create tasks from prediction run,
- repeated creation skips existing tasks,
- queue listing returns deterministic order,
- annotator can claim/start own task if allowed,
- viewer cannot mutate tasks,
- user without project access cannot read tasks,
- task response does not leak private storage keys,
- task links to prediction provenance and source artifact version.

### 9.3 E2E tests

Extend Playwright only if stable and useful.

Possible happy path:

```text
login as owner/admin
→ create/import prediction via setup/API fixture
→ create correction tasks
→ open project task queue
→ verify task appears
→ claim/start/dismiss task
→ verify state persists after reload
```

If E2E setup is too heavy, cover API/integration thoroughly and document E2E deferral.

Existing E2E must remain green.

---

## 10. Documentation Updates

Update:

```text
docs/06-data/active-learning-task-model.md
docs/06-data/model-prediction-contract.md
docs/03-features/projects.md
docs/03-features/editor.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- how tasks are created from prediction provenance,
- ordering strategy,
- supported task reasons,
- role/permission rules,
- what the UI supports,
- editor correction is deferred to RB-059,
- prediction artifacts remain proposals and not ground truth,
- no prediction export change in RB-058.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Correction tasks can be created from imported prediction provenance.
3. Task creation is idempotent.
4. Queue listing is deterministic and ordered by active-learning criteria.
5. Task entries expose prediction provenance summary without private storage keys.
6. Task APIs enforce project access and role permissions.
7. Eligible users can claim/start/dismiss or otherwise update tasks according to documented rules.
8. Minimal project-level queue UI exists.
9. Future editor route/link context is provided or documented for RB-059.
10. Predictions remain proposal artifacts and do not become ground truth.
11. RB-053 export behavior remains approved-human-only.
12. Tests cover task creation, ordering, permissions and response sanitization.
13. Existing import/review/export/browser workflows remain green.
14. Docs are updated and distinguish implemented vs deferred behavior.
15. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

16. Final validation passes:

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

17. Final Codex report includes:
    - commits created,
    - routes/services/UI changed,
    - tests added/changed,
    - task ordering rules,
    - authorization behavior,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define active learning queue implementation"
git commit -m "feat: add correction task domain services"
git commit -m "feat: add correction task api routes"
git commit -m "feat: add project correction task queue ui"
git commit -m "test: cover correction task queue behavior"
git commit -m "docs: document active learning queue baseline"
git commit -m "chore: finalize active learning queue ticket"
```

---

## 13. Notes for Codex

- This ticket materializes queue/tasks from prediction provenance.
- Do not implement the assisted correction editor.
- Do not mutate prediction artifacts.
- Do not change approved-human-only export behavior.
- Keep queue ordering deterministic.
- Keep UI minimal and project-scoped.
