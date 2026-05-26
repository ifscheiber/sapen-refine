# RB-086 — BBox Slice Proposal Workflow

## Status

Done

## Priority

High

## Type

Editor / Slice Proposal / Domain Model / Coordinate Geometry / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design

## Blocks

- RB-087 — Derived Slice Crop Generation
- RB-088 — Crop Support Mask Editor
- RB-089 — Crop-Constrained Semantic Annotation
- RB-090 — Auto Slice Classification from Semantic Masks
- RB-091 — Crop / Original Coordinate Export Contract
- RB-092 — Crop Workflow Review / Approval Integration

---

## 1. Context

RB-085 defined the crop-based, support-first annotation workflow.

Key decisions from RB-085:

- Original uploaded image remains the source of truth.
- BBox is a proposal / ergonomic crop work-area, not ground-truth instance geometry.
- Derived crops must be traceable to original image coordinates.
- Coordinate transforms use explicit source and crop coordinate spaces.
- Pixel-perfect support masks remain mandatory before training-ready semantic/copper annotation.
- Copper semantic masks are never support/instance masks.
- Later exports must preserve lineage from crop artifacts back to the original image.

RB-086 is the first implementation slice of the crop workflow. It should introduce BBox slice proposals on the original image while keeping scope tight.

This ticket must not implement crop generation or crop editing yet.

---

## 2. Goal

Allow users to create, view, select, update and delete rough rectangular BBox proposals for slice instances on the original image.

At the end of RB-086:

1. A user can open the original image editor/view in BBox proposal mode.
2. A user can draw one or more rectangular BBoxes around wood slices.
3. Each BBox is linked to a `SliceInstance` or equivalent slice proposal concept.
4. BBox proposals persist and reload.
5. BBox geometry is validated against the original image dimensions.
6. BBox proposals are clearly labeled as proposals, not instance ground truth.
7. Existing full-image annotation/editor workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- derived crop generation,
- crop image storage,
- crop editor,
- pixel-perfect support mask drawing in crops,
- semantic crop annotation,
- auto classification,
- crop-aware export,
- crop review/approval integration,
- model inference,
- multi-object polygon segmentation,
- full editor rewrite,
- changes to existing semantic/support mask save semantics.

If any of these are needed, document for RB-087+.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with the full validation baseline:

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
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Because this ticket likely introduces schema and UI changes, run `db:rebuild`, `prisma:generate`, `typecheck`, `test`, and `test:e2e` before finalizing.

---

## 5. Domain / Schema Scope

### 5.1 BBox proposal model

Implement a persistent versioned BBox proposal model.

Preferred concept names, adapt to existing schema conventions:

```text
SliceBoundingBoxVersion
SliceBoundingBoxProposal
SliceProposalBox
```

The model should represent:

```text
id
projectId
imageId
sliceInstanceId
version
x
y
width
height
coordinateSpace = SOURCE_IMAGE_PIXEL
createdById
createdAt
updatedAt if needed
status / reviewState if needed
provenance = HUMAN_ANNOTATION or equivalent
metadataJson optional
```

If the existing `SliceInstance` can hold the current BBox reference, do that explicitly, but keep BBox history/versioning rather than overwriting silently.

### 5.2 SliceInstance relationship

BBox proposals should be tied to a `SliceInstance`.

Rules:

- creating a new BBox may create a new `SliceInstance`,
- editing a BBox should create a new BBox version or update a draft according to the chosen versioning rule,
- deleting a draft BBox should not delete historical training artifacts,
- downstream crops in RB-087 will reference a specific BBox version.

### 5.3 Versioning rule

Codex must choose and document one clear MVP rule.

Preferred:

```text
Always append-only:
Every saved BBox edit creates a new BBox version.
```

Alternative if append-only is too large:

```text
Draft mutable until crop generation:
BBox can be edited while no derived crop exists.
Once crop is generated, edits create a new BBox version.
```

The chosen rule must be documented and tested.

### 5.4 Coordinate validation

BBox coordinates must be integer pixel coordinates in original image coordinate space.

Rules:

```text
x >= 0
y >= 0
width > 0
height > 0
x + width <= image.width
y + height <= image.height
minimum width/height threshold
```

Use validated `ImageAsset` dimensions as source of truth, not browser display/canvas size.

---

## 6. API / Server Scope

Add minimal app-mediated APIs for BBox proposals.

Suggested routes, adapt to repo conventions:

```text
GET    /api/images/[imageId]/slice-bboxes
POST   /api/images/[imageId]/slice-bboxes
PATCH  /api/slice-bboxes/[bboxVersionId]
DELETE /api/slice-bboxes/[bboxVersionId]
```

Requirements:

- authenticated user,
- project access check via current policy layer,
- owner/QA/labeler or current annotate policy may create/edit,
- viewer cannot mutate,
- stable JSON errors via API error helpers,
- same-origin guard compatibility,
- no private storage keys.

Response should include:

```text
sliceInstanceId
bboxVersionId
x/y/width/height
coordinateSpace
version
createdBy/createdAt
isCurrent
```

---

## 7. Editor / UI Scope

### 7.1 BBox proposal mode

Add a BBox proposal mode to the existing original-image editor or image workspace.

User can:

- enter BBox proposal mode,
- drag to draw rectangular BBox,
- see existing BBoxes,
- select a BBox,
- edit/replace geometry according to chosen versioning rule,
- delete draft/current BBox if safe,
- see a list of slice proposals.

### 7.2 Visual language

BBoxes must be visibly different from masks.

Use design tokens; do not hardcode colors.

Label them clearly:

```text
Slice proposal
Crop proposal
BBox proposal
Not ground truth
```

### 7.3 iPad / touch behavior

BBox drawing must work with pointer/mouse/touch.

Requirements:

- drag start/end behavior works on touch,
- page does not scroll while drawing on canvas,
- no hover-only controls,
- touch target sizes match existing editor controls.

### 7.4 Existing editor behavior

Existing modes must continue to work:

```text
brush
eraser
lasso tools
semantic mask
support mask
classification
review
assisted correction
```

Adding BBox mode must not break existing tool behavior.

---

## 8. Readiness / UX Messaging

Since BBox is not ground truth, show workflow guidance:

```text
Step 1: Draw rough slice boxes.
Step 2: Generate slice crops.
Step 3: Draw pixel-perfect support masks in each crop.
```

Where crop generation is not yet implemented, show:

```text
Crop generation will be available in the next workflow step.
```

Do not present BBox as export-ready.

---

## 9. Tests

### 9.1 Unit tests

Add tests for:

- BBox validation,
- coordinate clipping/rejection,
- source image coordinate conversion from canvas/display coordinates,
- versioning helper if implemented,
- UI helper labels if extracted.

### 9.2 Integration / API tests

Cover:

- authorized user creates BBox,
- viewer cannot create BBox,
- invalid BBox rejected,
- BBox outside image bounds rejected,
- BBox persists and reloads,
- editing follows chosen versioning rule,
- deletion rules are safe,
- stable JSON errors for forbidden/not-found cases.

### 9.3 E2E tests

Add a focused E2E if stable:

```text
login
open project image
enter BBox proposal mode
draw BBox around slice
save
reload
BBox still visible
```

Do not make E2E pixel-perfect if brittle; exact geometry should be covered in unit/API tests.

Existing E2E must remain green.

---

## 10. Documentation Updates

Update:

```text
docs/06-data/crop-based-slice-annotation.md
docs/06-data/coordinate-spaces-and-transforms.md
docs/03-features/editor.md
docs/03-features/images.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- BBox proposals are not ground truth,
- coordinates are source image pixel coordinates,
- downstream crops will reference BBox versions,
- pixel-perfect support mask remains mandatory in later tickets,
- Copper semantic masks remain separate from support geometry.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean.
2. Users can create BBox slice proposals on original images.
3. BBox proposals persist and reload.
4. BBox proposals are linked to slice instances.
5. BBox geometry is validated against original image dimensions.
6. BBox is clearly labeled as proposal / not ground truth.
7. Viewer/non-annotator roles cannot mutate BBoxes.
8. API returns stable JSON errors for representative BBox failures.
9. Existing editor workflows remain green.
10. Tests cover BBox validation, API persistence, and at least one UI/E2E path if stable.
11. Docs are updated.
12. Ticket is moved to:

```text
tickets/crop-slice-annotation-sprint/done/
```

13. Final validation passes:

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
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

14. Final Codex report includes:
    - commits created,
    - schema/migration changes if any,
    - routes/components changed,
    - chosen versioning rule,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define bbox slice proposal implementation"
git commit -m "schema: add slice bbox proposal persistence"
git commit -m "feat: add slice bbox proposal api"
git commit -m "feat: add editor bbox proposal mode"
git commit -m "test: cover slice bbox proposal workflow"
git commit -m "docs: document bbox proposal workflow"
git commit -m "chore: finalize bbox slice proposal ticket"
```

---

## 13. Notes for Codex

- BBox is a proposal, not ground truth.
- Do not implement crop generation in this ticket.
- Do not implement support mask crop editor in this ticket.
- Preserve all existing editor behavior.
- Keep coordinates in source image pixel space.
