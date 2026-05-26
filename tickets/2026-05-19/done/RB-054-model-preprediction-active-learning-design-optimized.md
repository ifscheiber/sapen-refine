# RB-054 — Model Preprediction & Active-Learning Design

## Status

Completed

## Priority

Medium / High

## Type

Architecture / Domain Design / Prediction Contract / Active-Learning Queue

## Repository

`sapen-annotate`

## Depends on

- RB-049 — Annotation Domain Schema Implementation Baseline
- RB-050 — Project, Image & Sample Metadata Workflow
- RB-051 — Slice Classification & Support-Mask Workflow Baseline
- RB-052 — Review & Approval Workflow Baseline
- RB-053 — Admin Training Export MVP

## Related

- RB-055 — Upload Artifact Validation and Checksum Hardening

## Blocks

- Future model preprediction import implementation
- Future active-learning task queue implementation
- Future assisted correction editor workflow
- Future SaPen training-module integration

---

## 1. Context

RB-053 completed the first training export MVP:

- only latest approved semantic/support/classification versions are exported,
- export targets remain separate,
- manifest version is `sapen-annotate-training-export-v1`,
- ZIP contains `manifest.json`, raw images, semantic masks and support masks,
- MinIO keys remain private and downloads run through app routes,
- export creation/download is currently OWNER-only.

The original RB-054 draft correctly scopes this as a design task: define future model preprediction, correction and active-learning queue workflows without weakening human ground-truth integrity. It explicitly requires model provenance, task priority/reason/queue context, source prediction references, and separation between human ground truth and model predictions. fileciteturn11file5

RB-054 should stay a design/contract ticket. It should not import real model predictions, run models, or change the editor workflow yet.

The current schema already contains useful hooks:

- `AnnotationArtifactKind.PREDICTION_MASK`
- `AnnotationArtifactKind.DERIVED_MASK`
- `ArtifactProvenance.MODEL_PREDICTION`
- `ArtifactProvenance.HUMAN_CORRECTION`
- `AnnotationTaskType.MODEL_PREDICTION_CORRECTION`
- `AnnotationTask.priority`
- `AnnotationTask.uncertaintyScore`
- `AnnotationTask.confidenceScore`
- `AnnotationTask.modelSource`
- `AnnotationTask.sourceArtifactVersionId`
- `AnnotationArtifactVersion.parentVersionId`

RB-054 must evaluate whether those hooks are sufficient for the first implementation or whether additional model-run/provenance persistence is required.

---

## 2. Goal

Design the future preprediction and active-learning workflow for SaPen Annotate.

The design must define:

1. How model prediction artifacts enter the system.
2. How model provenance is recorded.
3. How prediction artifacts relate to human correction versions.
4. How active-learning tasks are prioritized.
5. How prediction confidence/uncertainty affects task ordering.
6. How the editor should open prediction-backed correction tasks later.
7. How predictions remain excluded from ground-truth exports unless explicitly human-reviewed and approved.
8. Which schema/API/UI implementation tickets are needed next.

The outcome is a documented contract, not runtime implementation.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- running ML models,
- importing actual prediction files,
- calling a worker,
- creating prediction artifacts in production code,
- changing editor behavior,
- adding active-learning queue UI,
- changing training export behavior,
- creating migrations unless purely documentation-linked comments are justified,
- Core handoff,
- automatic approval of predictions,
- QA/prediction export mode.

If implementation needs are discovered, create follow-up tickets.

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

Because this is mostly documentation/design, no runtime code changes are expected unless docs indexes or type references require them.

---

## 5. Design Requirements

### 5.1 Ground-truth integrity

Hard invariant:

```text
Model predictions are not ground truth.
```

Predictions must not be exported as training labels unless a human creates/corrects/submits/approves a separate human artifact/version.

Rules:

- `PREDICTION_MASK` is proposal/input only.
- `MODEL_PREDICTION` provenance is never export-ready ground truth.
- Human correction creates a new artifact/version with `HUMAN_CORRECTION` provenance.
- The human correction should reference the prediction via `parentVersionId` or source reference.
- Approval applies to the human version, not the model prediction.

### 5.2 Prediction artifact types

Design how predictions map to current artifact types:

```text
semantic model prediction       -> PREDICTION_MASK with semantic prediction metadata
support/instance prediction     -> PREDICTION_MASK or DERIVED_MASK with target kind metadata
slice classification prediction -> task/classification proposal, not approved classification
```

The design must decide whether a future implementation should:

- use `AnnotationArtifactKind.PREDICTION_MASK` for all mask predictions with metadata describing target,
- or add more explicit prediction kinds/enums later.

Document trade-offs.

### 5.3 Model provenance

Design the required provenance fields.

Minimum model provenance:

- model family/name,
- model version,
- checkpoint id/path/hash,
- training run id,
- inference run id,
- config hash,
- source dataset/export id if available,
- generatedAt,
- generatedBy system/user,
- input image id/checksum,
- input dimensions,
- output artifact checksum,
- confidence score,
- uncertainty score,
- per-class confidence if available,
- notes/warnings.

Evaluate whether current fields (`modelSource`, `confidenceScore`, `uncertaintyScore`, `provenance`, `parentVersionId`, `metadata Json` if available) are sufficient.

If not, propose follow-up schema work.

### 5.4 Active-learning task model

Design how active-learning tasks should be created and ordered.

Minimum task concepts:

- task type,
- priority,
- task reason,
- uncertainty score,
- confidence score,
- source prediction artifact version,
- source model run,
- assignee,
- status,
- due/created timestamp if useful,
- queue ordering rules.

Recommended task reasons:

```text
LOW_CONFIDENCE
HIGH_UNCERTAINTY
MODEL_DISAGREEMENT
MISSING_GROUND_TRUTH
STALE_MODEL_VERSION
RANDOM_QA_SAMPLE
MANUAL_PRIORITY
```

The design should define deterministic ordering, e.g.:

```text
highest uncertainty first
then lowest confidence
then manual priority
then oldest createdAt
```

or justify a different order.

### 5.5 Correction workflow

Design the future correction workflow:

```text
prediction imported
→ correction task created
→ annotator opens task
→ prediction loaded as starting point / overlay
→ annotator edits
→ corrected human version saved as DRAFT
→ submitted
→ approved/rejected through RB-052 workflow
→ approved human version becomes export-ready
```

Do not implement this workflow in RB-054.

### 5.6 UI/Editor implications

Document future editor requirements:

- show prediction overlay separately from editable human layer,
- allow “use prediction as starting mask” explicitly,
- visually distinguish prediction vs human annotation,
- avoid accidental mutation of prediction artifact,
- preserve semantic/support mode separation,
- preserve iPad usability,
- show model confidence/uncertainty/task reason in the UI,
- keep prediction correction tasks route-addressable.

### 5.7 Export implications

Document how RB-053 export should interact with predictions:

- default training export excludes predictions,
- approved human corrections may be exported,
- prediction artifacts may be referenced as provenance of a human correction,
- optional QA/prediction-analysis export remains deferred and must be clearly separate from ground-truth training export.

### 5.8 Security and data integrity implications

Document interaction with RB-055:

- external prediction imports must verify object existence, size, dimensions and checksum,
- prediction masks must match image dimensions/coordinate space or declare transform,
- imported model artifacts must not leak private storage URLs,
- model provenance should include enough data to reproduce or audit predictions,
- large batch imports may need background processing later.

---

## 6. Required Documentation Outputs

Create or update:

```text
docs/06-data/model-prediction-contract.md
docs/06-data/active-learning-task-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/03-features/editor.md
docs/03-features/projects.md
docs/01-architecture/domain-boundaries.md
docs/08-adr/ADR-004-model-preprediction-active-learning.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

If ADR numbering differs, use the next available ADR number and update the ticket/report.

Docs must clearly mark:

- implemented today,
- designed for future,
- deferred implementation tickets,
- open questions.

---

## 7. Required Follow-Up Tickets

Create follow-up ticket drafts or structured backlog entries for at least:

1. Model prediction import schema/API implementation.
2. Active-learning task queue implementation.
3. Assisted correction editor workflow.
4. Prediction provenance and model-run registry if required.
5. Optional QA/prediction-analysis export mode, clearly separate from ground-truth export.
6. Batch prediction import and background job support if needed.

Do not implement them in RB-054.

---

## 8. Schema Review Questions

RB-054 must explicitly answer:

1. Is `AnnotationArtifactKind.PREDICTION_MASK` sufficient for first prediction imports?
2. Is `AnnotationTask.sourceArtifactVersionId` sufficient to link correction tasks to predictions?
3. Is `AnnotationArtifactVersion.parentVersionId` sufficient to link human corrections to predictions?
4. Is `AnnotationTask.modelSource` enough, or do we need a `ModelRun` / `PredictionRun` entity?
5. Where should per-class confidence and model output statistics live?
6. How should slice classification predictions be represented before human approval?
7. Do we need to distinguish semantic predictions from support predictions more explicitly?
8. What must RB-055 harden before real prediction imports?

---

## 9. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Current schema hooks for prediction/active learning are reviewed.
3. Model prediction artifact contract is documented.
4. Active-learning task model and ordering strategy are documented.
5. Human correction workflow is documented without implementation.
6. Ground-truth integrity rules are explicit: predictions are never approved/exported as ground truth without human correction/review.
7. Export implications are documented and remain consistent with RB-053.
8. RB-055/data-integrity implications are documented.
9. Follow-up implementation tickets/backlog entries are created.
10. Existing validation gates remain green.
11. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

12. Final validation passes:

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

13. Final Codex report includes:
    - commits created,
    - docs changed,
    - schema sufficiency conclusions,
    - follow-up tickets/backlog entries,
    - validation commands run,
    - pass/fail status,
    - known limitations.

---

## 10. Suggested Commit Sequence

```bash
git commit -m "docs: define model prediction artifact contract"
git commit -m "docs: define active learning task model"
git commit -m "docs: specify assisted correction workflow"
git commit -m "docs: align predictions with export and ground truth rules"
git commit -m "docs: add prediction active learning ADR and follow-ups"
git commit -m "chore: finalize prediction design ticket"
```

---

## 11. Notes for Codex

- This is a design ticket, not an implementation ticket.
- Do not weaken the approved-only export rule from RB-053.
- Do not allow model predictions to masquerade as human ground truth.
- Use the existing schema as evidence, but do not force implementation changes.
- Keep future iPad correction workflow in mind, but do not change the editor.
