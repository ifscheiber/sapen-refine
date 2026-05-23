# Sprint — Crop Workflow UX Orchestration

## Status

Partially implemented / Adjusted after Hotfix Sprint

## Project

`sapen-annotate`

## Updated Context

This sprint originally aimed to turn the already implemented crop-domain primitives into a coherent user-facing workflow.

After RB-093 to RB-095, the workflow has already moved forward:

```text
RB-093  Crop Workflow UX State Machine & Route Design        implemented
RB-094  Image-Level BBox Stage and Confirm BBox Set          implemented
RB-095  Slice Navigator with Whole-Image Context/Status      implemented
```

During manual smoke testing and follow-up review, additional issues were discovered. These led to a dedicated hotfix sprint:

```text
RB-099  Crop Semantic Editor Reload Stability Hotfix
RB-100  Mode-Aware Support Policy for Crop Semantics
RB-101  Embedded Slice Navigator and Ensure Current Crops
RB-102  Full Crop Mask Tool Palette and Shared Mask Operations
```

This updated sprint overview reflects those changes and two additional post-hotfix decisions:

```text
RB-103  BBox Stage Re-Entry From Crop Workflow
RB-104  Remove Legacy Full-Image Editor Route and Surface
```

The main conceptual correction is:

```text
The crop workflow is no longer a strict “support first, semantic second” workflow.
It is now mode-aware.
```

---

## 1. Problem Summary

The technical crop workflow exists:

```text
BBox versions
Derived crops
Crop support masks
Crop semantic masks
Auto classification
Crop training export/readiness
```

But smoke testing showed that the user-facing workflow was still confusing because the editor exposed too many primitives at once and did not clearly guide the user through the desired annotation process.

The original sprint document described a staged workflow:

```text
1. Draw BBoxes.
2. Confirm BBox set.
3. Navigate slices on the whole image.
4. Select one slice.
5. Annotate the crop.
6. Show status per slice.
7. Auto-classify.
8. Prevent Copper vs Sap/Heartwood conflicts.
```

That remains correct at a high level.

However, the old detail:

```text
Support mask → Semantic mask → Classification
```

is no longer universally correct.

---

## 2. Corrected Support Policy

## 2.1 Sap/Heartwood

For Sap/Heartwood crops:

```text
Support mask is optional.
Semantic annotation may start without explicit support.
Semantic foreground defines derived support geometry.
Crop padding is never support unless semantically labelled as foreground.
```

Rationale:

For Sap/Heartwood slices, the relevant wood geometry can be derived from non-background Sapwood/Heartwood semantic foreground. Requiring a separate pixel-perfect support mask first creates unnecessary annotation work.

## 2.2 Copper

For Copper crops:

```text
Copper semantic draft may be saved without support.
Copper export/readiness requires explicit approved support mask.
Copper semantic mask is never support geometry.
```

Rationale:

Copper semantic annotation marks penetrated/copper-stained pixels. It does not describe the full physical slice outline. Therefore Copper needs an explicit support mask before it can be training/export-ready.

---

## 3. Desired UX Model

## Stage 1 — Image-Level BBox Stage

The user opens an image and marks slice work areas by drawing BBoxes.

```text
Original image
→ draw BBoxes around slices
→ save BBoxes
→ confirm BBox set
→ ensure/generate crops
→ continue to slice annotation workspace
```

Important terminology:

```text
BBox = slice work area / crop proposal
BBox is not ground-truth instance geometry
BBox confirmation is not ground-truth approval
```

Preferred UI wording:

```text
Step 1: Mark slice work areas
```

Avoid:

```text
Approve BBox as ground truth
```

---

## Stage 2 — Whole-Image Slice Navigator

After BBox confirmation, the workflow should show the whole source image as orientation context.

The navigator should show:

```text
all slice BBoxes
selected slice
crop status
support status
semantic status
classification status
readiness/export status
```

The user clicks a slice to open the crop workbench for that slice.

The navigator should remain visible in support and semantic crop editors as a right-side rail where possible.

---

## Stage 3 — Unified Crop Workbench

When a slice is selected, the user should land in a unified crop workbench.

The workbench shows:

```text
selected crop image
semantic family / mode
support status
semantic status
classification status
readiness status
slice navigator / whole-image context
next action guidance
```

The workbench is mode-aware.

### Sap/Heartwood path

```text
Select slice
→ choose/use Sap/Heartwood mode
→ semantic annotation is available immediately
→ supportGeometrySource = SEMANTIC_FOREGROUND
→ classification auto-derives SAP_HEARTWOOD_SLICE
→ review/readiness follows policy
```

Optional support mask may still be allowed, but it is not required.

### Copper path

```text
Select slice
→ choose/use Copper mode
→ Copper semantic draft can be saved immediately
→ classification auto-derives COPPER_SLICE
→ readiness/export remains blocked until explicit support mask exists and is approved
```

Copper support mask is mandatory for readiness/export because Copper mask is not full slice geometry.

---

## Stage 4 — Semantic Family Exclusivity

For one slice, semantic family must be exclusive:

```text
SAP_HEARTWOOD
or
COPPER
not both at the same time
```

If Sap/Heartwood annotation exists:

```text
Copper mode must be blocked or require explicit reset/replacement.
```

If Copper annotation exists:

```text
Sap/Heartwood mode must be blocked or require explicit reset/replacement.
```

Historical versions remain append-only. Switching family must not silently mutate or delete existing versions.

Conflict state:

```text
Semantic family conflict → REVIEW_REQUIRED / not export-ready
```

Manual classification override remains possible, but it must not hide semantic family conflicts.

---

## Stage 5 — Status-Driven Workflow

The UI should help annotators answer:

```text
Which slices still need BBoxes?
Which slices have crops?
Which slices need semantic annotation?
Which Copper slices still need support masks?
Which slices need review?
Which slices are export-ready?
```

For each slice, display compact status badges:

```text
BBox
Crop
Support
Semantic
Classification
Readiness
```

---

## 4. Implemented / Adjusted Ticket Sequence

## Already implemented

```text
RB-093  Crop Workflow UX State Machine & Route Design
RB-094  Image-Level BBox Stage and Confirm BBox Set
RB-095  Slice Navigator with Whole-Image Context and Status Badges
```

## Hotfix sprint inserted after RB-095

```text
RB-099  Crop Semantic Editor Reload Stability Hotfix
RB-100  Mode-Aware Support Policy for Crop Semantics
RB-101  Embedded Slice Navigator and Ensure Current Crops
RB-102  Full Crop Mask Tool Palette and Shared Mask Operations
```

## Remaining adjusted UX tickets

```text
RB-096  Unified Slice Crop Annotation Workbench
RB-097  Semantic Family Exclusivity and Classification UX Guards
RB-103  BBox Stage Re-Entry From Crop Workflow
RB-104  Remove Legacy Full-Image Editor Route and Surface
RB-098  Crop Workflow Smoke Test and Final Workflow Polish
```

The adjusted RB-096 to RB-098 tickets supersede the original versions. RB-103 and RB-104 were added after manual smoke testing showed that BBox re-entry and full-image editor removal need explicit implementation slices.

---

## 5. Updated Ticket Intent

## RB-096 — Unified Slice Crop Annotation Workbench

Old intent:

```text
Support mask first, then semantic, then classification.
```

Updated intent:

```text
Mode-aware crop workbench:
  Sap/Heartwood semantic can start without support.
  Copper draft can start without support but not become ready/exportable until support exists.
```

## RB-097 — Semantic Family Exclusivity and Classification UX Guards

Purpose:

```text
Prevent accidental Copper + Sap/Heartwood mixing on one slice.
Require explicit reset/replacement to switch semantic family.
Keep append-only history.
Ensure conflicts cannot become export-ready.
```

## RB-098 — Crop Workflow Smoke Test and Final Workflow Polish

Purpose:

```text
Validate the final crop workflow UX:
  Sap/Heartwood supportless path
  Copper support-required-for-readiness path
  semantic family conflict path
  BBox re-entry after crop editing
  legacy full-image editor removal
```

## RB-103 — BBox Stage Re-Entry From Crop Workflow

Purpose:

```text
Make the image-level BBox stage reachable from crop semantic/support editors.
Keep confirmed BBoxes locked by default.
Allow explicit BBox edit/re-confirm loops after crop inspection.
Remove crop-workflow escape hatches to the legacy full-image editor.
```

## RB-104 — Remove Legacy Full-Image Editor Route and Surface

Purpose:

```text
Remove /images/[imageId]/edit as a product route.
Delete stale full-image semantic/support/classification annotation UI.
Keep BBox-stage and correction functionality only through dedicated non-legacy surfaces.
Update tests and docs to make crop workflow the annotation path.
```

---

## 6. Relationship to Full-Image Editor

The full-image editor should be removed as a user-facing product surface.

The primary annotation path is:

```text
BBox stage
→ slice navigator
→ crop workbench
```

Manual smoke testing showed that retaining the full-image editor as a fallback creates confusion and stale code. RB-104 removes the legacy `/edit` route and the full-image annotation surface.

Implementation must preserve the non-legacy capabilities that currently share code with the full editor:

```text
crop BBox stage drawing
assisted correction task editing, if still retained
crop support and semantic editors
```

---

## 7. Non-Goals

This sprint should not:

```text
introduce model inference
integrate SaPen Core
implement production multi-user locking
implement advanced iPad zoom/pan
change raw mask storage format
change prediction-analysis export semantics
```

---

## 8. Validation Principles

Each implementation ticket should preserve:

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

Manual smoke tests must explicitly cover:

```text
Sap/Heartwood supportless path
Copper draft without support but not-ready state
Copper with approved support becomes readiness-eligible
Semantic family conflict prevention
BBox re-entry after crop editor navigation
Legacy full-image editor removal
```

---

## 9. Expected Sprint Outcome

After the adjusted sprint is complete, the user-facing crop workflow should be coherent:

```text
Upload image
→ draw/confirm BBoxes
→ view all slices in whole-image navigator
→ select slice
→ annotate crop according to semantic family
→ see support/semantic/classification/readiness status
→ prevent semantic family conflicts
→ export only ready/consistent crop items
```

The workflow should no longer expose contradictory full-image and crop annotation primitives as equally primary paths.
