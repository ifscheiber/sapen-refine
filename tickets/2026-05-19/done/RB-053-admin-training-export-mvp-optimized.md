# RB-053 — Admin Training Export MVP

## Status

Completed

## Priority

High

## Type

Export / Manifest / Admin Workflow / Training Data / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-049 — Annotation Domain Schema Implementation Baseline
- RB-050 — Project, Image & Sample Metadata Workflow
- RB-051 — Slice Classification & Support-Mask Workflow Baseline
- RB-052 — Review & Approval Workflow Baseline

## Blocks

- Customer training-data handoff
- Model training pipeline integration
- RB-054 — Model Preprediction and Active-Learning Design
- RB-055 — Upload Artifact Validation and Checksum Hardening

---

## 1. Context

RB-052 established the review/approval ground-truth boundary:

- semantic mask versions can be submitted and approved/rejected,
- support mask versions can be submitted and approved/rejected,
- slice classification versions can be submitted and approved/rejected,
- editor shows review state and export-readiness,
- approved versions are the basis for export readiness.

The original RB-053 draft correctly requires export batches with actor attribution, manifests for semantic segmentation, support/instance segmentation, slice classification and combined exports, exact immutable version references, checksums, selection criteria, warnings, metadata completeness, and tests for manifest reproducibility. It also requires that Copper semantic masks are never exported as support geometry unless a separate support artifact exists.

RB-053 should now implement the first admin export workflow.

This is an MVP export, not a large-scale export subsystem. It should be reliable for trial/customer datasets and establish a reproducible manifest contract for future training modules.

---

## 2. Goal

Implement a minimal reproducible training export workflow.

An authorized admin/export user should be able to:

1. Select an annotation project for export.
2. Choose export target(s):
   - semantic segmentation,
   - support/instance segmentation,
   - slice classification,
   - combined manifest.
3. Generate an `ExportBatch`.
4. Produce a manifest referencing exact immutable approved versions.
5. Download or retrieve an export package containing manifest and referenced data artifacts where practical.
6. See warnings for incomplete or non-export-ready data.

The export must be reproducible and auditable.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- model training orchestration,
- SaPen Core ingestion,
- distributed export worker,
- long-running job queue,
- advanced filtering UI,
- dataset version registry beyond `ExportBatch`/manifest,
- data lake/object-store migration,
- model preprediction,
- active-learning queue,
- full checksum/object hardening beyond the currently available metadata,
- real iPad Safari testing.

If export size/performance limits appear, document them and add backlog entries.

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

Preserve existing browser E2E workflows.

---

## 5. Export Principles

### 5.1 Approved versions only

Export must use approved versions only.

Do not export:

- draft versions,
- submitted but unapproved versions,
- rejected versions,
- superseded versions unless explicitly included as historical audit metadata, not as training target.

### 5.2 Exact immutable references

Manifest entries must reference exact immutable IDs:

- image asset id,
- image checksum if available,
- semantic artifact version id,
- support artifact version id,
- slice classification version id,
- label schema version id,
- review decision id or approval metadata where available.

### 5.3 Separate export targets

The export contract must distinguish:

```text
semantic_segmentation
support_segmentation
slice_classification
combined
```

Do not merge these conceptually.

### 5.4 Copper safety invariant

Hard invariant:

```text
A COPPER semantic mask must never be exported as slice support geometry.
```

A support segmentation export requires a separate approved `SLICE_SUPPORT_MASK` artifact version.

### 5.5 Manifest-first design

The manifest is the source of truth.

Any ZIP/package is a transport container around the manifest and referenced files.

### 5.6 Warning instead of silent omission

If an image is missing required approved artifacts for a selected export target, the export should either:

- exclude it with an explicit warning,
- or include it as incomplete with explicit status,

depending on the selected mode.

Do not silently pretend the dataset is complete.

---

## 6. Scope

### 6.1 Export target model

Define a small export target/type layer.

Required targets:

```text
SEMANTIC_SEGMENTATION
SUPPORT_SEGMENTATION
SLICE_CLASSIFICATION
COMBINED
```

Use existing Prisma enums if present; otherwise use validated string constants/helpers.

If a schema enum is required and clearly missing, add a minimal migration. Otherwise prefer keeping RB-053 focused on workflow.

### 6.2 Export selection

For MVP, support project-level export.

Minimum selection:

- project id,
- export targets,
- include only approved versions,
- optional include incomplete/warnings flag if simple.

Advanced filters are deferred:

- by T-number,
- by label/class,
- by date,
- by annotator,
- by reviewer,
- by metadata completeness.

### 6.3 Export readiness resolver

Implement server-side export readiness logic.

For each image/default slice, resolve:

- latest approved semantic mask version,
- latest approved support mask version,
- latest approved slice classification version,
- image metadata,
- acquisition metadata,
- sample metadata,
- label schema version,
- warnings.

Recommended helper output:

```ts
type ExportCandidate = {
  imageId: string
  imageFilename: string
  semanticMaskVersionId?: string
  supportMaskVersionId?: string
  classificationVersionId?: string
  labelSchemaVersionId?: string
  warnings: string[]
  eligibleTargets: ExportTarget[]
}
```

Rules:

- semantic export requires approved semantic mask.
- support export requires approved support mask.
- classification export requires approved classification.
- combined export should include whichever selected components are approved, but must warn about missing components.
- If all requested target data is missing, the candidate should be excluded or clearly marked as skipped.

### 6.4 Manifest contract

Implement a manifest generator.

Suggested manifest shape:

```json
{
  "manifestVersion": "sapen-annotate-training-export-v1",
  "exportId": "...",
  "exportedAt": "...",
  "exportedBy": "...",
  "project": {
    "id": "...",
    "name": "..."
  },
  "selection": {
    "targets": ["semantic_segmentation", "support_segmentation", "slice_classification"],
    "approvedOnly": true
  },
  "labelSchema": {
    "id": "...",
    "version": "..."
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
      "metadata": {
        "tNumber": "...",
        "specimenIdentifier": "...",
        "sliceIndex": 0,
        "replicate": "...",
        "treatmentReference": "..."
      },
      "semanticMask": {
        "artifactVersionId": "...",
        "storageKey": "relative/export/path",
        "checksum": "sha256:...",
        "labelSchemaVersionId": "..."
      },
      "supportMask": {
        "artifactVersionId": "...",
        "storageKey": "relative/export/path",
        "checksum": "sha256:...",
        "labelSchemaVersionId": "..."
      },
      "classification": {
        "classificationVersionId": "...",
        "class": "COPPER_SLICE",
        "labelSchemaVersionId": "..."
      },
      "review": {
        "approvedBy": "...",
        "approvedAt": "..."
      },
      "warnings": []
    }
  ],
  "warnings": []
}
```

The exact shape may differ, but it must be documented and tested.

### 6.5 Export files/package

Implement a practical MVP package.

Preferred MVP:

- create manifest JSON,
- include referenced raw images,
- include referenced approved semantic masks,
- include referenced approved support masks,
- include classification data in manifest,
- store export artifact or stream/download ZIP.

Acceptable implementation options:

1. Generate ZIP synchronously for trial-sized datasets.
2. Persist export manifest and provide a download endpoint.
3. If ZIP is too large or not practical, generate manifest download first and document artifact file download as deferred.

However, because the app's explicit purpose includes admin download of training data, RB-053 should aim to provide a downloadable package unless a blocker appears.

Recommended package paths:

```text
manifest.json
images/<imageId>.<ext>
masks/semantic/<imageId>.u8raw
masks/support/<imageId>.u8raw
metadata/<optional>.json
```

Do not expose private MinIO URLs directly to the browser.

### 6.6 Export persistence

Use existing `ExportBatch` / `ExportItem` persistence from RB-049.

Required persistence:

- export id,
- project id,
- targets,
- status,
- created/exported by,
- created/exported at,
- selection criteria,
- manifest checksum if generated,
- export artifact storage key if stored,
- item references to exact immutable versions,
- warnings or summary.

If the existing schema is insufficient, add a minimal migration only if necessary. Prefer using JSON fields if already designed for selection/manifest metadata.

### 6.7 API/server workflow

Implement minimal API/server operations.

Possible routes, adjust to repo conventions:

```text
GET  /api/projects/[projectId]/export/readiness
POST /api/projects/[projectId]/exports
GET  /api/exports/[exportId]
GET  /api/exports/[exportId]/download
```

Rules:

- enforce project access,
- enforce export/admin permission,
- sanitize errors,
- do not leak private storage keys or credentials,
- keep response payloads stable,
- handle empty/no-approved-data projects gracefully.

### 6.8 UI workflow

Add minimal admin/export UI.

Suggested placement:

- project overview page,
- project images page,
- or dedicated project export page.

Minimum UI:

- export readiness summary:
  - approved semantic masks count,
  - approved support masks count,
  - approved classifications count,
  - incomplete/warning count.
- export target selection.
- create export button for authorized users.
- export result panel:
  - export id,
  - status,
  - created/exported at,
  - download link if available,
  - warnings.
- clear message if user lacks permission.

Do not build a complex data-management dashboard.

### 6.9 Authorization

Server-side authorization is required.

Minimum:

- owner/admin/export role may create/download export.
- annotator/reviewer without export permission cannot create export unless the current role model explicitly allows it.
- viewer cannot create export.

If role names differ, adapt to the actual schema.

### 6.10 Tests

Add focused tests.

#### Unit/domain tests

- export readiness selects approved versions only.
- rejected/submitted/draft versions are excluded.
- support export requires support mask, not copper semantic mask.
- combined export records missing component warnings.
- manifest generation is deterministic for stable input.

#### Route/integration tests

- authorized user can create export batch.
- unauthorized user cannot create export.
- export items reference exact version IDs.
- manifest includes label schema, metadata and warnings.
- no private storage keys/URLs leak in browser API response unless they are export-internal relative paths.

#### E2E tests

Extend or add Playwright test where feasible:

```text
login as admin
→ project with approved semantic/support/classification data
→ open export UI
→ see readiness counts
→ create export
→ download or view manifest
→ verify export exists/succeeds
```

If the full package download is brittle in Playwright, test creation/readiness in E2E and cover package contents in integration tests.

---

## 7. Documentation Updates

Update:

```text
docs/06-data/training-export-contract.md
docs/06-data/annotation-domain-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/03-features/projects.md
docs/03-features/images.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/04-server/backup-restore.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- only approved versions are export-ready,
- semantic/support/classification targets are separate,
- Copper semantic masks are not support geometry,
- manifest version and shape,
- package layout,
- known MVP limits,
- large-scale/job queue export remains deferred,
- RB-055 will harden checksums/object validation further.

---

## 8. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Authorized export user can create an export batch for a project.
3. Export readiness is computed server-side.
4. Export uses approved versions only.
5. Draft/submitted/rejected versions are not exported as ground truth.
6. Semantic segmentation, support segmentation, slice classification and combined targets are represented.
7. Support export requires approved `SLICE_SUPPORT_MASK`, not Copper semantic mask.
8. Manifest references exact immutable version IDs and label schema version.
9. Manifest includes image/sample/acquisition metadata where available.
10. Manifest includes warnings for incomplete metadata or missing approved components.
11. Export package/manifest is downloadable or a documented MVP fallback exists with a clear follow-up.
12. Export persistence records actor attribution and selection criteria.
13. Server-side authorization prevents unauthorized export creation/download.
14. Tests prove manifest reproducibility-critical fields.
15. Existing editor/review/browser workflows remain green.
16. No model training orchestration or preprediction is implemented.
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
    - files/routes changed,
    - tests added/changed,
    - export package/manifest behavior,
    - validation commands run,
    - pass/fail status,
    - known limitations,
    - backlog entries added/updated.

---

## 9. Suggested Commit Sequence

```bash
git commit -m "docs: define training export mvp contract"
git commit -m "feat: add export readiness and manifest generation"
git commit -m "feat: add admin export api and persistence"
git commit -m "feat: add project export ui"
git commit -m "test: cover export manifest and permissions"
git commit -m "test: extend browser smoke for export workflow"
git commit -m "docs: document export package and mvp limits"
git commit -m "chore: finalize training export ticket"
```

---

## 10. Notes for Codex

- This is export MVP, not a training pipeline.
- Manifest correctness matters more than UI polish.
- Approved versions only.
- Exact immutable references only.
- Copper semantic masks are not support masks.
- Do not expose private MinIO/S3 URLs to the browser.
- Keep the workflow usable for customer trial datasets.
