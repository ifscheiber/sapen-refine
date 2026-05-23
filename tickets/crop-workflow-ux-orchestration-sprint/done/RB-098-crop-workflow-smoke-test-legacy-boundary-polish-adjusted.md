# RB-098 — Crop Workflow Smoke Test and Final Workflow Polish

## Status

Done / Implemented

## Priority

Medium / High

## Type

Smoke Test / UX Polish / Workflow Closeout / Documentation

## Repository

`sapen-annotate`

## Depends on

- RB-096 — Unified Slice Crop Annotation Workbench
- RB-097 — Semantic Family Exclusivity and Classification UX Guards
- RB-100 — Mode-Aware Support Policy for Crop Semantics
- RB-101 — Embedded Slice Navigator and Ensure Current Crops
- RB-102 — Full Crop Mask Tool Palette and Shared Mask Operations, if completed
- RB-103 — BBox Stage Re-Entry From Crop Workflow
- RB-104 — Remove Legacy Full-Image Editor Route and Surface

---

## 1. Goal

Finalize the crop workflow UX sprint with smoke coverage, documentation, BBox re-entry verification, and confirmation that the legacy full-image editor surface has been removed.

---

## 2. Required Smoke Paths

### 2.1 Sap/Heartwood supportless path

Test/document:

```text
upload image
draw BBoxes
confirm BBox set
open slice navigator/workbench
generate/ensure crop
open Sap/Heartwood semantic editor
save semantic mask without support
auto classification = SAP_HEARTWOOD_SLICE
supportGeometrySource = SEMANTIC_FOREGROUND
readiness/export follows review policy
```

### 2.2 Copper support-required-for-readiness path

Test/document:

```text
open Copper semantic editor
save Copper draft without support
auto classification = COPPER_SLICE
crop is not export-ready due to missing support
draw/approve support mask
readiness becomes possible after support + semantic + classification review policy
```

### 2.3 Semantic family conflict path

Test/document:

```text
create Sap/Heartwood semantic
attempt Copper semantic
UI blocks or requires explicit reset
conflict cannot be export-ready
```

### 2.4 BBox re-entry path

Test/document:

```text
open crop semantic/support editor after BBox confirmation
click Edit BBoxes
return to /crop/bboxes
confirmed BBoxes are visible and locked by default
explicitly unlock BBox editing
edit or replace a BBox
re-confirm BBox set
continue back to crop annotation
```

### 2.5 Legacy full-image editor removal

Test/document:

```text
image list and image metadata route to Crop workflow
crop editors route back to BBox stage, Support, Semantic, or Image
no visible Open editor / Full editor / Editor links remain
/images/[imageId]/edit is not a product route
full-image semantic/support/classification editor smoke is removed
```

---

## 3. Non-Goals

Do not implement:

- large refactor,
- new domain model unless tiny UX state needed,
- iPad physical validation unless available,
- model inference,
- new export manifest design.

---

## 4. Tests

Add/update:

- crop workflow E2E,
- manual smoke docs,
- BBox re-entry smoke,
- legacy full-image editor removal assertions,
- export readiness smoke where stable.

Existing crop workflow, crop export, and assisted-correction smoke must remain green.

---

## 5. Documentation Updates

Update:

```text
docs/03-features/editor.md
docs/03-features/images.md
docs/06-data/crop-based-slice-annotation.md
docs/06-data/training-export-contract.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/known-gaps.md
docs/adr/remediation-backlog.md
```

Add sprint closeout notes if useful.

---

## 6. Acceptance Criteria

1. Full crop workflow smoke is documented and test-covered.
2. Sap/Heartwood supportless path is covered.
3. Copper support-required-for-readiness path is covered.
4. Semantic family conflict path is covered.
5. BBox re-entry from crop editors is tested.
6. UI no longer presents full-image and crop annotation as equal paths.
7. Legacy full-image editor route/link removal is verified.
8. Docs and manual smoke tests are updated.
9. Full validation gate passes.

---

## 7. Implementation Notes

Implemented as the final crop workflow UX closeout slice.

- Added `tests/e2e/crop-workflow-closeout.spec.ts`.
- The new browser smoke covers supportless Copper semantic draft save, missing-support readiness blocking, explicit support creation/review, Copper semantic/classification review, and final crop readiness.
- The new browser smoke covers Sap/Heartwood-to-Copper semantic-family reset confirmation and verifies cancelling reset keeps Sap/Heartwood active.
- Existing E2E coverage remains responsible for Sap/Heartwood supportless review/export, BBox-stage re-entry, large-image crop semantic save, and removed legacy editor URL behavior.
- Manual smoke docs now separate Sap/Heartwood supportless/reset checks from the Copper support-required readiness path.
- Testing docs and known-gaps/workflow docs now reference the RB-098 closeout coverage.

## 8. Validation

Baseline before edits:

- `git status --short` clean.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test` passed.

Final validation:

- `npm run prisma:generate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test` passed.
- `npm run check:design-hardcoding` passed.
- `npx playwright test tests/e2e/crop-workflow-closeout.spec.ts tests/e2e/slice-bbox-proposals.spec.ts tests/e2e/desktop-browser-smoke.spec.ts tests/e2e/large-mask-upload.spec.ts tests/e2e/missing-resource-soft-landing.spec.ts` passed.
- `npm run test:e2e` passed.
