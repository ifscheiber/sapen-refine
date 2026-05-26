# RB-059 — Assisted Correction Editor Workflow

## Status

Proposed / Ready for Codex

## Priority

Medium / High

## Type

Editor / Prediction Overlay / Human Correction / Workflow / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-057 — Prediction Import API & Storage Validation
- RB-058 — Active-Learning Task Queue API/UI

## Blocks

- RB-060 — Prediction Analysis Export Mode
- RB-061 — Batch Prediction Import and Background Jobs
- Future customer model-assisted correction workflow

---

## 1. Context

RB-057 implemented server-side prediction import:

- model-generated masks are imported as `AnnotationArtifact.kind = PREDICTION_MASK`,
- versions use `AnnotationArtifactVersion.provenance = MODEL_PREDICTION`,
- `PredictionArtifactProvenance` links prediction run, image, target type and artifact version,
- imported predictions are not reviewable/export-ready ground truth.

RB-058 implemented the active-learning correction task queue:

- idempotent `MODEL_PREDICTION_CORRECTION` task creation from `PredictionArtifactProvenance`,
- project-level task queue UI at `/app/projects/[projectId]/tasks`,
- APIs for create/list/get/patch correction tasks,
- deterministic ordering and role logic for `OWNER`, `QA`, `LABELER`, `VIEWER`.

The original RB-059 draft correctly defines the next step: open prediction correction tasks through route-addressable editor state, load prediction artifacts as read-only overlays, provide explicit “use prediction as starting mask” behavior, save corrected work as separate human artifact versions with `HUMAN_CORRECTION` provenance, link human corrections to source predictions, and show model confidence/uncertainty/task reason without crowding iPad-sized layouts.

RB-059 must implement that assisted correction workflow while preserving the existing human-ground-truth boundaries:

```text
prediction artifact
→ read-only proposal / optional starting mask
→ human correction draft
→ submit/review/approve through existing RB-052 workflow
→ approved human correction becomes export-ready
```

Predictions themselves must remain immutable proposals.

---

## 2. Goal

Implement the first assisted correction editor workflow for prediction-backed correction tasks.

At the end of RB-059, an eligible user should be able to:

1. Open a correction task from the project task queue.
2. See prediction provenance summary and target type.
3. Load the prediction artifact as a read-only overlay/proposal.
4. Explicitly copy/use the prediction as the starting editable human mask.
5. Edit the human mask in the existing editor.
6. Save the correction as a new human artifact version:
   - `provenance = HUMAN_CORRECTION`,
   - linked to the prediction source version/provenance,
   - draft/reviewable through existing review workflow.
7. Update the task state appropriately without mutating the prediction artifact.

The workflow should support both:

- semantic prediction correction,
- slice support prediction correction.

Slice-classification correction may be documented/deferred if current prediction import is mask-only.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- prediction import APIs,
- active-learning task creation/listing logic beyond integration with existing RB-058 task detail,
- model execution,
- batch/background imports,
- prediction-analysis export,
- automatic approval of corrections,
- changing RB-053 ground-truth export rules,
- review/approval redesign,
- complex multi-object/multi-slice editor,
- advanced model-comparison tools,
- notification system.

If broader needs appear, add backlog entries.

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

- manual annotation,
- metadata,
- semantic/support/classification,
- review/approval,
- export,
- prediction import,
- correction task queue.

---

## 5. Workflow Model

### 5.1 Route-addressable correction task

Add a route-addressable correction editor entry.

Preferred route:

```text
/app/projects/[projectId]/tasks/[taskId]/correct
```

Alternative:

```text
/app/projects/[projectId]/images/[imageId]/edit?taskId=...
```

Use whichever fits the current App Router structure best.

Hard requirement:

- the correction workflow must be deep-linkable,
- task context must be loaded server-side or through authenticated API,
- invalid/inaccessible tasks must show safe error states.

### 5.2 Correction context

The correction editor must load a task context containing:

- task id,
- project id,
- image id,
- target type,
- task reason,
- confidence/uncertainty,
- prediction run/model summary,
- source prediction artifact version id,
- prediction provenance id,
- image dimensions,
- current human artifact/version state if one exists,
- review state if a human correction already exists,
- editor mode:
  - semantic correction,
  - support correction.

No private MinIO/S3 keys in browser responses.

### 5.3 Prediction overlay

Prediction artifact must be loaded as read-only data.

UI requirements:

- visually distinguish prediction from editable human mask,
- show “Prediction / model proposal” label,
- show target type and confidence/uncertainty summary,
- provide overlay toggle if practical,
- prevent editing prediction bytes directly.

Implementation options:

- render prediction as a separate canvas/layer,
- or load prediction bytes into a read-only overlay data structure used by existing canvas.

Do not write back to prediction artifact/version.

### 5.4 Explicit “use prediction as starting mask”

The user must explicitly choose to copy the prediction into an editable human correction layer.

Recommended UI action:

```text
Use prediction as starting mask
```

Rules:

- no automatic conversion to human ground truth on open,
- no automatic save just because prediction is displayed,
- copying creates local editable human state,
- saving creates a new human artifact version,
- if an existing human draft correction exists, warn before overwriting local editor state.

### 5.5 Human correction save

Saving correction must create a human artifact version.

For semantic prediction correction:

```text
AnnotationArtifact.kind = SEMANTIC_MASK
AnnotationArtifactVersion.provenance = HUMAN_CORRECTION
parentVersionId/source link = prediction artifact version
reviewState = DRAFT
```

For support prediction correction:

```text
AnnotationArtifact.kind = SLICE_SUPPORT_MASK
AnnotationArtifactVersion.provenance = HUMAN_CORRECTION
parentVersionId/source link = prediction artifact version
reviewState = DRAFT
```

Rules:

- use RB-055 validation helpers,
- validate dimensions/byte length/label values,
- compute checksum,
- record actor attribution,
- link to prediction provenance where schema supports it,
- preserve semantic/support separation,
- preserve Copper-not-support invariant.

### 5.6 Review workflow integration

After correction save:

- human correction appears in existing review state UI,
- user can submit through RB-052 workflow,
- reviewer/admin can approve/reject through existing controls,
- approved human correction becomes eligible for RB-053 export,
- prediction artifact remains not reviewable and not export-ready.

RB-059 may add a quick “Save draft and submit” button only if it reuses existing review APIs cleanly. Otherwise keep submit separate.

### 5.7 Task state integration

Task state should reflect correction progress.

Recommended behavior:

- opening task may mark task `IN_PROGRESS` / started if user explicitly starts or edits,
- saving a human correction may mark task as `IN_PROGRESS` or `READY_FOR_REVIEW` if enum exists,
- submitting correction may mark task `DONE` / completed if the system can confirm a human submitted version exists,
- dismiss remains available from task queue, not necessarily editor.

If current task status enum is limited, implement the minimal meaningful transition and document limitations.

Do not mark a task complete merely because a prediction was viewed.

---

## 6. API / Server Scope

### 6.1 Correction context API

Add or extend an API endpoint:

```text
GET /api/correction-tasks/[taskId]/correction-context
```

or integrate into existing task detail API.

Must return sanitized context for editor loading.

### 6.2 Prediction artifact read route

Add or reuse app-mediated artifact read route for prediction bytes.

Requirements:

- authenticated,
- project access checked,
- task/prediction provenance checked,
- no private storage keys leaked,
- stable errors for missing/forbidden artifacts.

### 6.3 Human correction save API

Add endpoint or extend existing mask commit route to support correction context.

Possible route:

```text
POST /api/correction-tasks/[taskId]/corrections
```

Request:

- correction mask bytes,
- target type/mode,
- source prediction artifact version id or implicit task source,
- optional submit flag if supported.

Response:

- created human artifact version id,
- artifact kind,
- provenance,
- parent/source prediction id,
- checksum/dimensions,
- review state,
- task state summary.

Server must validate:

- user can work on task,
- task belongs to project/image,
- source artifact is `PREDICTION_MASK`,
- source version provenance is `MODEL_PREDICTION`,
- target type maps to correct human artifact kind,
- mask dimensions match image,
- values are valid for target,
- prediction artifact is not mutated.

### 6.4 Authorization

Suggested behavior:

```text
OWNER / QA:
- can open correction tasks,
- can save corrections,
- can review/approve if existing role rules allow.

LABELER:
- can open assigned/open tasks,
- can claim/start if not assigned,
- can save human correction drafts,
- can submit if existing review workflow allows.

VIEWER:
- cannot open correction editor for mutation,
- may not access prediction bytes unless current policy allows read-only task view.
```

Adapt to actual role model.

Hard rules:

- users without project access cannot access correction context or prediction bytes,
- viewer cannot save corrections,
- API authorization is required even if UI hides controls.

---

## 7. Editor/UI Scope

### 7.1 Correction task entry

From `/app/projects/[projectId]/tasks`, each actionable task should link to the correction editor route.

UI label example:

```text
Open correction
```

### 7.2 Editor additions

Add to existing editor UI, not a second editor implementation:

- correction task banner/panel,
- prediction provenance summary,
- target type,
- confidence/uncertainty,
- reason,
- prediction overlay toggle if feasible,
- explicit “Use prediction as starting mask” button,
- save correction action,
- review state/status section reusing existing controls.

### 7.3 iPad-sized layout

Keep iPad-sized usability:

- touch-friendly controls,
- no crowded side panel,
- prediction summary collapsible if needed,
- no hover-only interactions,
- existing drawing behavior remains stable.

Real iPad Safari smoke remains manual/deferred until deployment/device access exists.

---

## 8. Tests

Add focused tests.

### 8.1 Unit/domain tests

Cover:

- prediction target → human artifact kind mapping,
- source prediction validation,
- copying prediction bytes into editable correction state helper if extracted,
- correction save payload validation,
- task state transition helpers if added.

### 8.2 Integration/API tests

Cover:

- authorized labeler/owner can load correction context,
- unauthorized user cannot access correction context,
- prediction bytes can be read via app route without storage key leak,
- saving semantic correction creates `SEMANTIC_MASK` version with `HUMAN_CORRECTION`,
- saving support correction creates `SLICE_SUPPORT_MASK` version with `HUMAN_CORRECTION`,
- human correction links to source prediction artifact/provenance,
- prediction artifact remains unchanged,
- saved correction can be submitted/approved through RB-052 APIs,
- approved human correction appears in RB-053 export eligibility,
- prediction itself remains excluded from export.

### 8.3 E2E tests

Extend Playwright if feasible:

```text
login
→ create/import prediction via test fixture/API
→ create correction task
→ open task queue
→ open correction editor
→ use prediction as starting mask
→ edit/draw correction
→ save correction
→ reload
→ verify human correction status
```

If approval/export in E2E becomes too broad, keep those in integration tests.

Existing E2E must remain green.

---

## 9. Documentation Updates

Update:

```text
docs/03-features/editor.md
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- how correction tasks open editor context,
- prediction layer is read-only,
- “use prediction as starting mask” is explicit,
- human corrections are separate versions,
- corrections link to source predictions,
- predictions remain excluded from ground-truth export,
- review/approval remains required for export-ready ground truth,
- multi-slice/multi-object and advanced overlay behavior remain deferred if not implemented.

---

## 10. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Correction tasks have a route-addressable editor entry.
3. Correction context loads prediction provenance and source prediction artifact safely.
4. Prediction artifact can be displayed/loaded as read-only proposal.
5. User must explicitly choose to use prediction as starting mask.
6. Saving a semantic correction creates a human `SEMANTIC_MASK` artifact version with `HUMAN_CORRECTION`.
7. Saving a support correction creates a human `SLICE_SUPPORT_MASK` artifact version with `HUMAN_CORRECTION`.
8. Human correction links to source prediction artifact/provenance.
9. Prediction artifact bytes/version are not mutated.
10. Human correction draft can flow into existing submit/review/approval workflow.
11. Approved human correction can be selected by RB-053 export; prediction remains excluded.
12. API/server authorization prevents unauthorized correction access/mutation.
13. No private storage keys leak to browser/API responses.
14. UI remains usable in desktop and iPad-sized layouts.
15. Tests cover source prediction safety, correction persistence and export/review boundaries.
16. Existing queue/import/review/export/browser workflows remain green.
17. Docs are updated and distinguish implemented vs deferred behavior.
18. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

19. Final validation passes:

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

20. Final Codex report includes:
    - commits created,
    - routes/services/UI changed,
    - tests added/changed,
    - correction workflow behavior,
    - review/export boundary behavior,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 11. Suggested Commit Sequence

```bash
git commit -m "docs: define assisted correction editor workflow"
git commit -m "feat: add correction task editor context api"
git commit -m "feat: add prediction overlay and starting mask workflow"
git commit -m "feat: save human corrections from prediction tasks"
git commit -m "test: cover assisted correction boundaries"
git commit -m "test: extend browser smoke for assisted correction"
git commit -m "docs: document assisted correction workflow"
git commit -m "chore: finalize assisted correction ticket"
```

---

## 12. Notes for Codex

- Prediction artifacts are read-only proposals.
- Human corrections are separate artifacts/versions.
- Do not auto-approve corrections.
- Do not change RB-053 export rules.
- Do not build a separate editor.
- Keep iPad usability in mind, but real iPad smoke remains manual.
