# RB-052 — Review & Approval Workflow Baseline

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Workflow / Authorization / Ground Truth / API / UI / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-049 — Annotation Domain Schema Implementation Baseline
- RB-050 — Project, Image & Sample Metadata Workflow
- RB-051 — Slice Classification & Support-Mask Workflow Baseline

## Blocks

- RB-053 — Admin Training Export MVP
- RB-054 — Model Preprediction and Active-Learning Design
- RB-055 — Upload Artifact Validation and Checksum Hardening

---

## 1. Context

RB-049 introduced the annotation-domain schema and review/export persistence foundations.
RB-050 added project, image, acquisition, and image-level sample metadata.
RB-051 added the first slice workflow:

- default `SliceInstance` per image,
- `SEMANTIC_MASK` artifact versions,
- `SLICE_SUPPORT_MASK` artifact versions,
- `SliceClassificationVersion`,
- explicit separation between semantic masks and support geometry,
- tests ensuring Copper semantic masks cannot be treated as slice support geometry.

The app can now create meaningful annotation artifacts, but it still lacks a formal ground-truth boundary.

Without review/approval, later training export cannot reliably decide which artifact versions are accepted ground truth.

RB-052 establishes the minimal review and approval workflow.

---

## 2. Goal

Implement a minimal, server-enforced ground-truth state workflow for annotation outputs.

The workflow must clearly distinguish:

```text
draft
→ submitted
→ approved / rejected
→ superseded
```

The workflow must apply to:

- semantic mask artifact versions,
- slice support mask artifact versions,
- slice classification versions.

The result should make it possible for RB-053 export to select exact approved versions as reproducible training data.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- admin training export generation,
- model preprediction / active-learning workflow,
- complex reviewer dashboard,
- notification system,
- multi-stage review with multiple reviewers,
- comment threads,
- bulk review workflow,
- Core handoff/correction workflow,
- advanced role-management UI,
- large editor redesign,
- checksum/object hardening beyond existing fields.

If such requirements appear, add backlog entries.

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

Preserve the existing browser E2E workflow.

---

## 5. Domain Rules

### 5.1 Reviewable units

The following are reviewable:

```text
AnnotationArtifactVersion where artifact.kind = SEMANTIC_MASK
AnnotationArtifactVersion where artifact.kind = SLICE_SUPPORT_MASK
SliceClassificationVersion
```

RB-052 should not review the whole image as a single monolithic object unless that is only a display aggregate.

### 5.2 Ground-truth meaning

Only `APPROVED` versions are export-ready ground truth.

`DRAFT` and `SUBMITTED` versions are not training ground truth.

`REJECTED` and `SUPERSEDED` versions remain auditable but are not export-ready.

### 5.3 Immutability

Approved versions must remain immutable.

If an annotator edits after approval, the system must create a new version and leave the approved version intact. The new version starts as `DRAFT`.

Do not overwrite approved mask bytes, classification values, creator attribution, label schema version, or storage metadata.

### 5.4 Review decisions

Review decisions must be append-only/auditable where the schema supports it.

A decision should record:

- reviewed object type,
- reviewed version id,
- decision,
- reviewer id,
- timestamp,
- optional comment/reason,
- previous state,
- new state.

### 5.5 Reject reasons

Rejecting should require or strongly encourage a reason/comment.

If the UI does not enforce this strictly in RB-052, the API should at least support a comment field and docs should state the current behavior.

### 5.6 Superseding

When a new version is created for the same artifact or classification after a previous submitted/approved version, older non-current versions may be marked or considered `SUPERSEDED` according to the implemented schema.

Rules must be documented precisely:

- what gets superseded automatically,
- what remains approved historical ground truth,
- what is considered latest/current.

Recommended MVP rule:

```text
Creating a new draft version does not delete or mutate approved history.
The latest approved version remains export-ready until a newer version is approved.
For display, show both latest draft/submitted and latest approved if they differ.
```

---

## 6. Authorization Rules

RB-052 must enforce review permissions server-side.

Minimum role semantics:

```text
OWNER / ADMIN       can annotate, submit, approve, reject
REVIEWER            can approve/reject, may annotate if existing role rules allow
ANNOTATOR           can create/edit draft and submit, cannot approve/reject
VIEWER              can view where allowed, cannot submit/approve/reject
```

Adjust names to the actual enum/model introduced in RB-049.

Hard rules:

- A user without review permission must not approve/reject via API.
- A user without project access must not view or mutate review state.
- UI hiding controls is not sufficient; API must enforce authorization.
- Actor attribution must use authenticated user/session context.

If the current membership model cannot fully express this, implement the minimal server-side checks possible and document the gap.

---

## 7. Scope

### 7.1 Domain/server helpers

Add small testable helpers for:

- review state transitions,
- permission checks,
- latest draft/submitted/approved version resolution,
- export-ready version resolution,
- reviewable object type discrimination,
- whether a version can be submitted,
- whether a version can be approved/rejected.

Suggested helper behavior:

```text
DRAFT -> SUBMITTED
SUBMITTED -> APPROVED
SUBMITTED -> REJECTED
APPROVED -> no mutation, new edit creates DRAFT version
REJECTED -> no direct approve unless resubmitted or new version created
SUPERSEDED -> terminal/history state
```

### 7.2 API/server workflow

Implement minimal API/server operations.

Possible routes, adjust to repo conventions:

```text
GET  /api/images/[imageId]/review-state
POST /api/artifacts/[artifactVersionId]/submit
POST /api/artifacts/[artifactVersionId]/approve
POST /api/artifacts/[artifactVersionId]/reject
POST /api/slice-classifications/[classificationVersionId]/submit
POST /api/slice-classifications/[classificationVersionId]/approve
POST /api/slice-classifications/[classificationVersionId]/reject
```

Alternative route grouping is acceptable if cleaner.

Server rules:

- enforce project access,
- enforce role/permission,
- validate reviewed object belongs to requested project/image context,
- validate legal transition,
- persist `ReviewDecision`,
- update review state on reviewed version where schema supports it,
- return stable response payloads,
- do not leak storage keys or private URLs.

### 7.3 UI workflow

Add minimal UI controls in existing image/editor context.

Required UI concepts:

- show review state for semantic mask,
- show review state for support mask,
- show review state for slice classification,
- submit button for annotators/allowed users,
- approve/reject controls for reviewers/admins,
- optional comment/reason input for review decision,
- clear distinction between:
  - latest draft/submitted version,
  - latest approved version,
  - missing review state.

Recommended placement:

- editor side panel or image detail review section,
- not a separate large dashboard.

Rules:

- Do not redesign the whole editor.
- Reuse App Shell and existing feature components.
- Keep touch targets iPad-friendly.
- Do not hardcode colors/styles outside design tokens.
- If the current UI cannot cleanly handle all three reviewable units, implement the core artifact path first and document remaining UI gap, but API/tests should cover all reviewable unit types where practical.

### 7.4 Browser flow

Extend the E2E path where feasible:

```text
login as annotator/admin
→ upload/open image
→ create semantic mask
→ create support mask
→ set classification
→ submit
→ approve/reject as allowed user
→ reload
→ verify state persisted
```

If multi-user role switching is too heavy for this ticket, use seeded users or API-level integration tests for permission checks and keep E2E to the happy-path admin case.

### 7.5 Review state display for export readiness

Do not implement export, but add display/readiness language:

```text
Approved semantic mask: yes/no
Approved support mask: yes/no
Approved slice classification: yes/no
Export-ready: yes/no/warnings
```

This can be a simple computed summary in UI/server helpers.

---

## 8. Tests

Add focused tests.

### 8.1 Unit/domain tests

Cover:

- allowed transitions,
- invalid transitions,
- submit/approve/reject helper behavior,
- export-ready helper chooses approved versions only,
- approved version immutability rule,
- latest draft vs latest approved resolution.

### 8.2 Route/integration tests

Cover:

- annotator can submit own draft,
- annotator cannot approve/reject,
- reviewer/admin can approve/reject submitted version,
- viewer cannot submit/review,
- rejected version is not export-ready,
- approved semantic/support/classification versions are export-ready,
- review decision records actor, timestamp, decision, comment/reason.

### 8.3 E2E tests

Extend Playwright smoke if feasible:

- create annotations,
- submit,
- approve,
- reload,
- verify approved state.

Keep selectors accessible and robust.

---

## 9. Documentation Updates

Update:

```text
docs/03-features/editor.md
docs/03-features/images.md
docs/06-data/annotation-domain-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/training-export-contract.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- what review/approval means,
- which units are reviewable,
- which states exist,
- who may submit/review,
- approved versions are immutable/export-ready,
- export itself remains deferred to RB-053,
- multi-reviewer workflow remains deferred,
- real iPad Safari smoke remains deferred until deployment/device access exists.

---

## 10. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Semantic mask versions can be submitted and approved/rejected.
3. Support mask versions can be submitted and approved/rejected.
4. Slice classification versions can be submitted and approved/rejected.
5. Server-side authorization prevents annotators/viewers from approving/rejecting.
6. Review decisions are persisted with actor, timestamp, decision, reviewed object, and comment/reason where supported.
7. Approved versions remain immutable; edits create new draft versions rather than mutating approved versions.
8. UI shows review state and minimal submit/approve/reject controls.
9. Export-readiness summary uses approved versions only.
10. Existing semantic/support/classification editor flows remain green.
11. Tests cover transitions, permissions, and export-ready approved-version selection.
12. No export/preprediction/Core handoff workflow is implemented.
13. Docs are updated and distinguish implemented vs deferred behavior.
14. Ticket is moved to:

```text
tickets/2026-05-19/done/
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
```

16. Final Codex report includes:
    - commits created,
    - files/routes changed,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations,
    - backlog entries added/updated.

---

## 11. Suggested Commit Sequence

```bash
git commit -m "docs: define review approval workflow baseline"
git commit -m "feat: add review state transition helpers"
git commit -m "feat: add review submit and decision APIs"
git commit -m "feat: add review controls to annotation workflow"
git commit -m "test: cover review transitions and permissions"
git commit -m "test: extend browser smoke for approval workflow"
git commit -m "docs: document approval ground truth boundary"
git commit -m "chore: finalize review approval ticket"
```

---

## 12. Notes for Codex

- This ticket creates the ground-truth boundary.
- Keep it minimal and server-enforced.
- Do not implement export yet.
- Do not build a large reviewer dashboard.
- Approved versions are the basis for RB-053 export.
- Preserve existing browser and editor workflows.
