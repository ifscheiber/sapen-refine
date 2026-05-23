# Sprint — Crop Workflow UX Orchestration

## Status

Proposed / Planning Sprint

## Project

`sapen-annotate`

## Trigger

Manual smoke testing showed that the technical crop workflow exists, but the user-facing workflow is not yet coherent.

The current editor still exposes full-image semantic/support/classification controls, BBox proposal mode, review cards and crop workflow primitives together on one page. This is technically powerful, but the user experience does not match the desired annotation workflow.

## Problem Summary

The current UI lets the user draw semantic masks, support masks and classifications on the full image page while also exposing BBox proposal mode. This is confusing because the desired workflow is staged:

```text
1. On original image: define slice BBoxes.
2. Confirm/submit the BBox set for that image.
3. Use a semantic/crop annotation workspace that still shows the whole image for navigation.
4. Select a slice from a whole-image navigator.
5. Annotate the selected slice in its crop.
6. Show support/semantic/classification status in the navigator.
7. Automatically derive classification from semantic annotation.
8. Prevent semantic-family conflicts such as Copper and Sap/Heartwood on the same slice.
```

The current logic is not wrong at the data-model level, but it is not yet presented as a guided workflow.

---

## Desired UX Model

### Stage 1 — Image-level BBox Stage

The user opens an image and first creates rough BBoxes around all slices.

```text
Original image
→ draw BBoxes
→ save/confirm BBox set
→ generate/ensure crops
→ continue to slice annotation workspace
```

Important: BBoxes are proposals / crop work areas, not ground-truth instance masks.

The UI should use wording like:

```text
Step 1: Mark slice work areas
```

Not:

```text
Ground-truth mask
```

### Stage 2 — Slice Navigation Workspace

After BBox confirmation, the semantic/crop workflow should show the whole image in a navigation/context area.

The user should see:

- all slice BBoxes,
- current selected slice,
- status badge per slice:
  - BBox exists,
  - crop exists,
  - support mask missing/draft/approved,
  - semantic mask missing/draft/approved,
  - classification auto/manual/needs review,
- optional mini mask overlay or thumbnail,
- click a slice to open its crop editor.

This keeps the original image as orientation context.

### Stage 3 — Crop Workbench for Selected Slice

When the user selects a slice, the editor opens the crop for that slice.

The crop workbench should guide the user through:

```text
A. Support mask
   draw complete physical wood outline

B. Semantic mask
   enabled only once support exists
   Sap/Heartwood mode OR Copper mode

C. Classification
   auto-filled from semantic mask
   manual override possible
```

### Stage 4 — Semantic Family Exclusivity

For one slice, semantic annotation mode must be exclusive:

```text
Sap/Heartwood slice:
  semantic labels = Sapwood / Heartwood / optional Unknown

Copper slice:
  semantic labels = Copper / optional non-copper/unknown

Never both on the same slice.
```

If a user has already created Sap/Heartwood annotation, Copper mode should be blocked unless the user intentionally resets/replaces the semantic mask.

If a user has already created Copper annotation, Sap/Heartwood mode should be blocked unless reset/replacement is confirmed.

Classification should follow semantic mode:

```text
Copper semantic mask → COPPER_SLICE
Sap/Heartwood semantic mask → SAP_HEARTWOOD_SLICE
Ambiguous/conflicting → REVIEW_REQUIRED
```

### Stage 5 — Status-Driven Navigation

The navigator should help annotators answer:

```text
Which slices are still missing?
Which slices already have support?
Which slices already have semantic annotation?
Which slices need review?
Which slices are export-ready?
```

The navigator should show the BBox and optionally the latest support/semantic overlay, so the user can see what has been completed.

---

## Design Decisions

### Decision 1 — BBox confirmation is a workflow step, not ground-truth approval

BBoxes are not ground-truth masks. They should have a workflow state such as:

```text
draft
confirmed
needs update
```

The wording should avoid “approved” unless a separate QA role truly reviews BBox proposals.

### Decision 2 — Original image remains navigation context

Even when editing crops, the user should retain the whole-image context with BBoxes. This avoids losing track of which slice is being annotated.

### Decision 3 — Crop editor should be the main annotation surface

Support and semantic pixel work should happen in the crop editor, not in the full original image editor, once crop workflow is active.

### Decision 4 — Classification should be derived, not manually required

The app should automatically set or suggest classification from semantic annotation.

Manual classification remains possible as override.

### Decision 5 — Semantic family conflict should be prevented

The UI should prevent accidental mixing of Copper and Sap/Heartwood semantics for the same slice.

If conflict exists due to older data, show a warning and require explicit resolution.

---

## Sprint Tickets

```text
RB-093  Crop Workflow UX State Machine & Route Design
RB-094  Image-Level BBox Stage and Confirm BBox Set
RB-095  Slice Navigator with Whole-Image Context and Status Badges
RB-096  Unified Slice Crop Annotation Workbench
RB-097  Semantic Family Exclusivity and Classification UX Guards
RB-098  Crop Workflow Smoke Test, Legacy Full-Image Boundary and UX Polish
```

---

## Relationship to Current Crop Sprint

The previous crop implementation sprint created the technical primitives:

```text
BBox versions
Derived crops
Crop support masks
Crop semantic masks
Auto classification
Crop export/readiness
```

This sprint turns those primitives into a coherent user-facing workflow.

---

## Non-Goals

This sprint should not:

- redesign the domain model unless a small workflow state is needed,
- remove full-image editor capabilities completely,
- implement model inference,
- implement SaPen Core integration,
- implement advanced iPad zoom/pan,
- implement multi-user locking.

---

## Recommended Sequence

```text
RB-093  design/state machine first
RB-094  BBox stage and transition
RB-095  slice navigator
RB-096  crop workbench
RB-097  semantic exclusivity/classification UX
RB-098  smoke test and polish
```

RB-093 should come first because route/state decisions influence all later UI tickets.
