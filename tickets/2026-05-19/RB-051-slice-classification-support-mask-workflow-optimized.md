# RB-051 — Slice Classification & Support-Mask Workflow Baseline

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Domain Workflow / Editor / API / Mask Model / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-049 — Annotation Domain Schema Implementation Baseline
- RB-050 — Project, Image & Sample Metadata Workflow

## Blocks

- RB-052 — Review and Approval Workflow
- RB-053 — Admin Training Export MVP
- RB-055 — Upload Artifact Validation and Checksum Hardening
- Future instance-segmentation training export

---

## 1. Context

RB-049 introduced the annotation-domain schema baseline, including:

- `AnnotationArtifact`
- `AnnotationArtifactVersion`
- `AnnotationArtifactKind`
- `SliceInstance`
- `SliceClassificationVersion`
- `SliceClass`

RB-050 added project/image/acquisition/sample metadata workflow and preserved the browser E2E path.

The original RB-051 draft correctly identifies the next domain need: slice classification and support/instance masks must be separate from semantic material masks. In particular, Copper semantic masks must never be silently treated as physical slice geometry. The draft scope already requires slice classes such as `SAP_HEARTWOOD_SLICE`, `COPPER_SLICE`, `UNKNOWN`, `REVIEW_REQUIRED`, support/instance mask artifacts separate from semantic material masks, and focused tests. fileciteturn13file0

This optimized ticket keeps that goal but narrows the first implementation slice:

- implement a **minimal default slice instance per image** workflow,
- implement a **support-mask artifact mode** separate from semantic material masks,
- implement **slice classification versioning**,
- preserve all existing semantic mask and metadata workflows,
- defer complex multi-object/multi-slice editing to a later ticket.

---

## 2. Goal

Implement the first usable workflow for:

1. Creating or maintaining a default `SliceInstance` for an image.
2. Creating a `SLICE_SUPPORT_MASK` artifact/version separate from `SEMANTIC_MASK`.
3. Linking the default slice instance to the latest support-mask version.
4. Persisting slice classification as `SliceClassificationVersion`.
5. Making the distinction visible in the UI and enforced server-side.
6. Extending tests/E2E so this distinction is protected.

The result should support the first training-data needs for:

- slice classification training,
- future support/instance segmentation training,
- future export of semantic masks vs support geometry as separate targets.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- multi-slice / multi-object editor UX,
- advanced instance editor with separate object list,
- polygon/vector editing,
- review/approval workflow,
- admin training export generation,
- model prediction or active-learning queue,
- Core handoff/correction workflow,
- full slice-specific sample metadata model,
- full checksum/object hardening beyond existing RB-050 state,
- major editor rewrite.

If multi-slice requirements are discovered, add backlog entries rather than expanding this ticket.

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

## 5. Schema Constraints and Design Decisions

### 5.1 No schema change expected

The RB-049 schema appears sufficient for the first RB-051 baseline:

- `AnnotationArtifact.kind = SLICE_SUPPORT_MASK`
- `AnnotationArtifactVersion.reviewState = DRAFT`
- `SliceInstance.supportArtifactVersionId`
- `SliceClassificationVersion.class`
- `SliceClassificationVersion.labelSchemaVersionId`
- `AnnotationArtifact.scopeKey`

Codex should avoid schema changes unless a blocking gap is found. If a schema change is required, document why and keep it minimal.

### 5.2 Default-slice baseline

For RB-051, implement a **default slice instance per image**.

Recommended convention:

```text
SliceInstance: one default slice instance per ImageAsset for the current MVP
AnnotationArtifact.kind: SLICE_SUPPORT_MASK
AnnotationArtifact.scopeKey: "default"
```

This is intentionally not the final multi-slice model.

Document clearly:

- RB-051 supports one default slice/support geometry per image.
- Later multi-slice support may use multiple `SliceInstance` rows and non-default `scopeKey` values.
- Image-level `SampleMetadata` from RB-050 remains image-level/default metadata, not true per-slice metadata.

### 5.3 Semantic mask vs support mask

Semantic material masks:

```text
AnnotationArtifactKind.SEMANTIC_MASK
labels: sapwood, heartwood, copper, background/unknown
```

Support mask:

```text
AnnotationArtifactKind.SLICE_SUPPORT_MASK
labels: slice_support vs background/unknown
```

Hard invariant:

```text
A COPPER semantic mask is not support geometry.
A SEMANTIC_MASK artifact version must not be accepted as SliceInstance.supportArtifactVersionId.
```

### 5.4 Slice classification

Persist classifications through `SliceClassificationVersion`.

Supported classes:

```text
SAP_HEARTWOOD_SLICE
COPPER_SLICE
UNKNOWN
REVIEW_REQUIRED
```

Rules:

- classification creates a new version per slice instance,
- classification records `createdById`,
- classification records `labelSchemaVersionId`,
- latest classification is displayed in the image/editor context,
- no approval workflow in RB-051; use draft state only unless existing schema requires otherwise.

---

## 6. Scope

### 6.1 Domain helpers

Add small, testable domain helpers for:

- artifact kind checks:
  - semantic mask,
  - support mask,
  - prediction/derived if useful.
- validation that a support version is really a support artifact version.
- latest slice classification resolution.
- next version number calculation for support artifact versions and classification versions.
- default slice instance lookup/create semantics.

Suggested location:

```text
src/features/slices/**
src/server/slices/**
src/server/annotations/**
```

or adapt to the existing project structure.

### 6.2 API/server workflow

Implement minimal API/server operations for:

1. Get slice/support/classification state for an image.
2. Ensure default slice instance exists for an image.
3. Commit or update a support mask artifact version.
4. Set slice classification.
5. Read latest support mask and latest classification.

Possible routes, adjust to repo conventions:

```text
GET  /api/images/[imageId]/slice
POST /api/images/[imageId]/slice/ensure
POST /api/images/[imageId]/support-mask/commit
PATCH /api/images/[imageId]/slice/classification
```

Or integrate into existing image/editor routes if this is cleaner.

Server rules:

- enforce project access,
- use authenticated actor for attribution,
- require active/default project label schema,
- validate image ownership,
- validate artifact kind,
- do not expose private storage keys or MinIO URLs,
- return stable errors.

### 6.3 Editor/UI workflow

Add a minimal user-facing workflow.

Acceptable implementation:

- Add a clear editor mode or tab:
  - `Semantic mask`
  - `Slice support`
- In `Slice support` mode, drawing saves to `SLICE_SUPPORT_MASK`, not `SEMANTIC_MASK`.
- Add slice classification control near image metadata/editor side panel:
  - `Sap/Heartwood slice`
  - `Copper slice`
  - `Unknown`
  - `Review required`
- Display latest support-mask status:
  - missing,
  - draft exists,
  - saved at timestamp,
  - created by if available.
- Display latest classification.

Rules:

- Reuse existing editor canvas where practical.
- Do not create a second editor implementation.
- Do not hardcode colors outside the design/token/canvas-label config.
- Keep iPad-sized touch targets reasonable.
- Preserve existing semantic mask editor path.

### 6.4 Support-mask label behavior

For the first baseline, the support mask can be binary:

```text
0 = background/unknown
1 = slice_support
```

The UI does not need many labels in support mode.

Ensure the support-mask byte values are tied to the default label schema definitions where practical.

If the current mask serialization assumes semantic labels, adapt it carefully so artifact kind and label schema remain explicit.

### 6.5 Data integrity rules

Implement and test:

- support mask dimensions match image dimensions,
- support mask artifact kind is `SLICE_SUPPORT_MASK`,
- semantic mask artifact kind remains `SEMANTIC_MASK`,
- semantic `copper` label cannot satisfy support geometry,
- classification belongs to the same project/image/slice,
- classification references label schema version,
- actor attribution exists for support versions and classifications.

Full checksum/dimension hardening remains RB-055, but obvious dimension mismatches should be rejected if the current code can detect them cheaply.

### 6.6 Tests

Add focused tests.

Minimum tests:

#### Unit/domain tests

- `isSupportMaskArtifactKind(SLICE_SUPPORT_MASK) === true`
- `isSupportMaskArtifactKind(SEMANTIC_MASK) === false`
- Copper semantic mask/artifact is rejected as support geometry.
- Latest classification resolution returns newest version.

#### Route/integration tests

- ensure default slice instance for image.
- commit support mask creates `SLICE_SUPPORT_MASK` artifact version.
- semantic mask save still creates `SEMANTIC_MASK`.
- assign classification creates `SliceClassificationVersion` with actor and label schema.
- attempt to link semantic artifact version as support version fails.

#### E2E test extension

Extend current browser smoke:

```text
login
→ project
→ upload image
→ metadata if required
→ open editor
→ draw semantic mask and save
→ switch to slice support mode
→ draw support mask and save
→ set slice classification
→ reload
→ verify semantic mask persisted
→ verify support-mask status persisted
→ verify classification persisted
```

If full support drawing E2E is too brittle, cover support/classification by API/integration tests and document why.

### 6.7 Documentation

Update:

```text
docs/03-features/editor.md
docs/03-features/images.md
docs/06-data/annotation-domain-model.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/annotation-label-schema.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- RB-051 implements one default slice instance per image.
- Support mask and semantic mask are separate artifact kinds.
- Copper semantic mask is not support geometry.
- Multi-slice/multi-object workflow remains deferred.
- Review/export remain deferred.

---

## 7. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. A default slice instance can be created/read for an image.
3. A support mask can be saved as `SLICE_SUPPORT_MASK`, separate from existing `SEMANTIC_MASK`.
4. Existing semantic mask save/reload still works.
5. Slice classification can be set and persists as `SliceClassificationVersion`.
6. Classification records actor and label schema version.
7. Support-mask artifact version records actor, label schema version, dimensions, and storage metadata.
8. Server-side code rejects semantic artifact versions as support geometry.
9. Copper semantic annotations cannot be silently treated as slice support geometry.
10. UI clearly distinguishes semantic mask mode from slice support mode.
11. E2E or integration tests cover semantic/support/classification persistence.
12. No review/export/preprediction workflow is introduced.
13. Docs document the default-slice limitation and deferred multi-slice workflow.
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

## 8. Suggested Commit Sequence

```bash
git commit -m "docs: define slice support workflow baseline"
git commit -m "feat: add slice support and classification server workflow"
git commit -m "feat: add editor support-mask mode and classification control"
git commit -m "test: cover support mask and slice classification invariants"
git commit -m "test: extend browser smoke for slice workflow"
git commit -m "docs: document default slice support limitations"
git commit -m "chore: finalize slice support workflow ticket"
```

---

## 9. Notes for Codex

- Keep this ticket minimal and durable.
- Do not build a complex multi-object annotation system yet.
- Reuse the existing editor.
- Keep semantic masks and support masks separate in persistence, API, UI, tests, and docs.
- Copper semantic staining is not physical support geometry.
- Preserve all existing workflows and tests.
