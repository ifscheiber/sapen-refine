# RB-050 — Project, Image & Sample Metadata Workflow

## Status

Done

## Priority

High

## Type

API / UI / Metadata / Validation / Trial Workflow

## Repository

`sapen-annotate`

## Depends on

- RB-049 — Annotation Domain Schema Implementation Baseline

## Blocks

- RB-051 — Slice Classification and Support-Mask Workflow
- RB-052 — Review and Approval Workflow
- RB-053 — Admin Training Export MVP
- RB-055 — Upload Artifact Validation and Checksum Hardening

---

## 1. Context

RB-049 introduced the annotation-domain Prisma baseline:

- `AnnotationProject`
- `AnnotationProjectMember`
- `LabelSchemaVersion` / `LabelDefinition`
- `ImageAsset`
- `ImageAcquisitionMetadata`
- `SampleMetadata`
- `AnnotationTask` / `AnnotationSession`
- `AnnotationArtifact` / `AnnotationArtifactVersion`
- `SliceInstance`
- `SliceClassificationVersion`
- `ReviewDecision`
- `ExportBatch` / `ExportItem`

The existing browser E2E flow remains green:

```text
login → project → upload → editor → draw → save → reload → mask persistence
```

RB-050 is the first user-facing workflow slice on top of the new domain schema. It should make project, image, acquisition, and basic sample metadata visible and editable without introducing review, export, support-mask, or preprediction workflows.

This ticket must keep the current desktop browser workflow green and remain usable on iPad-sized screens.

---

## 2. Goal

Implement a minimal but scalable metadata workflow for SaPen Annotate.

Users should be able to:

1. View and edit project-level metadata.
2. Upload images and see server-side image validation metadata.
3. Add/edit acquisition metadata for an image.
4. Add/edit basic sample/specimen/slice metadata for an image.
5. See whether important metadata is complete, incomplete, or optional.
6. Keep the editor workflow intact.

The workflow should prepare later export/readiness checks without implementing export or review yet.

---

## 3. Schema Review Notes

The RB-049 schema is usable for RB-050. Do **not** redesign it in this ticket unless a blocking issue appears.

Important schema implications:

### 3.1 `SampleMetadata` is image-scoped

`SampleMetadata` is currently `1:1` with `ImageAsset`. For RB-050, treat it as **image-level/default sample metadata**.

Do not pretend this fully solves multi-slice images with different sample metadata. If slice-specific metadata is needed, document it as RB-051/RB-052 follow-up tied to `SliceInstance`.

### 3.2 `ImageAsset.validationStatus`

Use `ImageValidationStatus` as the user-visible validation state for the uploaded image asset.

RB-050 may show and update validation status only through server-side validation paths. Do not let users manually mark an invalid image as validated without server logic.

### 3.3 `checksum`, dimensions, content type and size

The schema already contains fields for these. RB-050 may display them and ensure they are populated where the current upload path already has that information.

Full checksum/dimension hardening belongs to RB-055.

### 3.4 `AnnotationProject.labelSchemaVersionId`

Project creation/editing should ensure the active/default label schema is attached where practical. If the field remains nullable for compatibility, the UI should still surface missing label schema as a setup warning.

### 3.5 Review/export/prediction fields

The schema contains review/export/prediction-ready structures. RB-050 must not implement those workflows.

---

## 4. Non-Goals

Do **not** implement these in this ticket:

- slice support/instance mask workflow,
- slice classification workflow beyond displaying existing class if already available,
- review/approval workflow,
- admin training export,
- model preprediction or active-learning queue,
- Core handoff,
- full LIMS integration,
- advanced EXIF parsing pipeline,
- RB-055 checksum/object-hardening beyond minimal display/population,
- broad schema redesign.

If gaps are discovered, add precise backlog entries.

---

## 5. Required Working Mode

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

Because RB-049 introduced a local PostgreSQL integration test and a new schema baseline, run `npm run db:rebuild` before validation when needed.

Work in focused slices. Commit after each meaningful slice.

---

## 6. Scope

### 6.1 Project metadata workflow

Implement or refine project-level view/edit workflow.

Minimum fields:

- project name,
- description,
- active label schema display,
- project role/membership display if already available,
- created/updated metadata where useful.

Rules:

- Keep project routes thin.
- Use existing App Shell and feature-module boundaries.
- Do not build a full admin/member-management workflow unless already trivial.
- If no label schema is attached, show a setup warning and/or attach default schema through server logic.

Expected files may include:

```text
src/features/projects/**
src/app/(workspace)/**
src/app/api/projects/**
```

### 6.2 Image asset metadata display

For each image, expose immutable technical metadata:

- original filename,
- content type,
- byte size,
- checksum if available,
- width,
- height,
- storage/validation status,
- uploaded by,
- uploaded at.

Rules:

- Users may not edit immutable upload facts directly.
- Show missing values as validation/setup gaps.
- Do not expose private MinIO/S3 URLs.

### 6.3 Acquisition metadata edit workflow

Use `ImageAcquisitionMetadata`.

Supported editable fields:

- camera/device,
- lens/objective,
- exposure,
- aperture,
- ISO,
- white balance,
- color profile,
- lighting setup,
- captured by,
- captured at,
- notes.

Rules:

- Accept partial metadata.
- Validate types and dates server-side.
- Persist via API route/server action with actor/session context where current architecture supports it.
- Keep form usable on desktop and iPad-sized screens.
- Do not require advanced EXIF import.

### 6.4 Sample/specimen metadata edit workflow

Use `SampleMetadata`.

Supported editable fields:

- T-number,
- specimen identifier,
- slice index,
- replicate,
- treatment/reference,
- notes.

Rules:

- Treat these as image-level/default metadata in RB-050.
- Do not claim full per-slice metadata unless it is modeled through `SliceInstance` in a later ticket.
- T-number should be user-editable and visible in project/image lists where helpful.
- Missing T-number should be a visible warning, not necessarily a hard blocker yet.
- Validate slice index as integer if provided.

### 6.5 Metadata completeness/readiness summary

Add a simple metadata completeness summary for image/project views.

Recommended status categories:

```text
complete
incomplete
optional-missing
not-validated
failed-validation
```

This can be computed in server/helper code; it does not need a new DB enum unless the implemented schema already supports one.

The summary should distinguish:

- required for current annotation workflow,
- required later for training export,
- optional but useful acquisition metadata.

### 6.6 API/server validation

Add or update routes/server functions for:

- reading image metadata bundle,
- updating acquisition metadata,
- updating sample metadata,
- updating project metadata if needed.

Validation requirements:

- typed request parsing,
- no client-trusted immutable fields,
- server-side project access check,
- stable error responses,
- no secret/internal URL leaks.

### 6.7 E2E and tests

Extend tests to cover the new workflow.

At minimum:

- unit tests for metadata validation/completeness helpers,
- route/integration tests for metadata update APIs,
- Playwright E2E extension:
  - login,
  - project,
  - upload image,
  - fill T-number/sample metadata,
  - fill at least one acquisition metadata field,
  - save,
  - reload,
  - verify persisted metadata,
  - open editor and confirm existing draw/save path still works.

Keep selectors accessible and robust.

---

## 7. Documentation Updates

Update:

```text
docs/03-features/projects.md
docs/03-features/images.md
docs/03-features/editor.md
docs/06-data/prisma.md
docs/06-data/annotation-domain-model.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must clearly state:

- RB-050 implements image-level/default sample metadata.
- Slice-specific metadata remains deferred unless implemented later.
- Full checksum/object validation remains RB-055.
- Review/export remain deferred.

---

## 8. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Project metadata view/edit is implemented or explicitly documented if only display is possible.
3. Image technical metadata is visible and not directly editable by the user.
4. Acquisition metadata can be added/edited and persists after reload.
5. Sample/specimen metadata can be added/edited and persists after reload.
6. T-number is visible in an appropriate project/image context.
7. Missing key metadata is visible as warning/readiness information.
8. Metadata API/server code validates input and enforces project access.
9. Private MinIO/S3 URLs are not exposed to the browser.
10. Existing editor draw/save/reload flow remains green.
11. E2E test covers metadata edit + reload + editor path.
12. Unit/integration tests cover validation/completeness/API behavior.
13. No review/export/preprediction/support-mask workflow is introduced.
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
    - files changed,
    - API/routes added or changed,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations and follow-up backlog entries.

---

## 9. Suggested Commit Sequence

```bash
git commit -m "docs: align metadata workflow with annotation schema"
git commit -m "feat: add project and image metadata APIs"
git commit -m "feat: add acquisition and sample metadata forms"
git commit -m "test: cover metadata validation and persistence"
git commit -m "test: extend browser smoke for metadata workflow"
git commit -m "docs: document metadata workflow and deferred slice metadata"
git commit -m "chore: finalize metadata workflow ticket"
```

---

## 10. Notes for Codex

- This is the first user-facing workflow after the schema baseline.
- Keep the workflow minimal and useful for customer/browser trial.
- Do not overbuild LIMS-like metadata management.
- Do not blur image-level sample metadata with future slice-level metadata.
- Preserve iPad-sized usability but do not run real iPad tests unless available.
- Keep all validation gates green.

## 11. Completion Notes

- Implemented project metadata edit/display with active label schema visibility.
- Implemented image metadata detail route with immutable technical metadata, readiness summary, acquisition metadata edit, and image-level/default sample metadata edit.
- Added app-mediated upload checksum storage; full checksum/object/dimension hardening remains RB-055.
- Extended image list with T-number/readiness visibility and metadata/editor links without exposing private storage keys.
- Added unit, DB integration, and desktop browser E2E coverage.
- Updated docs for features, app routes/APIs, data model, Prisma, testing, manual smoke, known gaps, and remediation backlog.
- Deferred slice-specific sample metadata to future `SliceInstance` workflow work.
