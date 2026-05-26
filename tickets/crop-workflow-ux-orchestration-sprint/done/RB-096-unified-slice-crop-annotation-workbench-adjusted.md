# RB-096 — Unified Slice Crop Annotation Workbench

## Status

Proposed / Ready for Codex

## Priority

High

## Type

UX / Editor Orchestration / Crop Workbench / Mode-Aware Workflow / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-093 — Crop Workflow UX State Machine & Route Design
- RB-094 — Image-Level BBox Stage and Confirm BBox Set
- RB-095 — Slice Navigator with Whole-Image Context and Status Badges
- RB-099 — Crop Semantic Editor Reload Stability Hotfix
- RB-100 — Mode-Aware Support Policy for Crop Semantics
- RB-101 — Embedded Slice Navigator and Ensure Current Crops, if already implemented
- RB-102 — Full Crop Mask Tool Palette and Shared Mask Operations, if already implemented

## Blocks

- RB-097 — Semantic Family Exclusivity and Classification UX Guards
- RB-103 — BBox Stage Re-Entry From Crop Workflow
- RB-098 — Crop Workflow Smoke Test and Final Workflow Polish

---

## 1. Context

The crop workflow originally assumed a strict support-first sequence:

```text
Support mask → Semantic mask → Classification
```

After the support-policy hotfix sprint, this is no longer correct.

The current intended policy is mode-aware:

```text
Sap/Heartwood:
  support mask optional
  semantic foreground can define derived support geometry
  no implicit full-crop support

Copper:
  support mask not required for draft semantic save
  support mask required for readiness/export
  Copper semantic mask is never support geometry
```

RB-096 must therefore build a **mode-aware unified crop workbench**, not a linear support-first workbench.

---

## 2. Goal

Provide a unified crop workbench for a selected slice that guides the user through support, semantic annotation, classification, and readiness according to the selected semantic family.

At the end of RB-096:

1. User can select a slice and open a unified crop workbench.
2. Workbench shows crop image and whole-image/slice navigation context.
3. User can choose or see the semantic family:
   - Sap/Heartwood,
   - Copper.
4. Sap/Heartwood semantic annotation is available without a support mask.
5. Copper semantic draft annotation is available without a support mask, but readiness/export shows support required.
6. Support mask step is available and recommended/required depending on mode.
7. Classification status is displayed and follows semantic annotation.
8. Existing support and semantic editors remain functional.
9. The workbench links only to crop workflow surfaces, not the legacy full-image editor.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- semantic family exclusivity/reset logic beyond basic routing/display; that is RB-097,
- new mask semantics,
- crop export changes,
- review dashboard,
- model inference,
- advanced iPad zoom/pan,
- multi-user locks,
- new semantic labels unless already required by existing mode policy.

If a blocker requires a separate domain change, document and create a follow-up ticket.

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

---

## 5. Desired Workbench Flow

### 5.1 Entry

The user enters from:

```text
slice navigator
BBox/crop panel
direct crop/slice URL
```

The route should be deep-linkable.

Suggested route, adapt to current conventions:

```text
/app/projects/[projectId]/images/[imageId]/slices/[sliceInstanceId]/workbench
```

or reuse the current crop editor route family if cleaner.

### 5.2 Workbench layout

The workbench should show:

```text
left / main:
  selected slice crop editor area

right:
  slice navigator / whole-image context
  selected slice status
  next action guidance
```

If RB-101 already embedded the right-side navigator, reuse it.

### 5.3 Workbench steps

The workbench should show mode-aware steps.

#### Sap/Heartwood mode

```text
Step A: Semantic annotation
  available even without explicit support

Step B: Optional support mask
  optional, may provide explicit geometry if desired

Step C: Classification
  auto-derived from semantic mask
```

Readiness guidance:

```text
supportGeometrySource = SEMANTIC_FOREGROUND
```

#### Copper mode

```text
Step A: Copper semantic draft
  available without explicit support

Step B: Support mask
  required before readiness/export

Step C: Classification
  auto-derived from Copper semantic mask
```

Readiness guidance:

```text
Copper draft saved, but not export-ready until approved support mask exists.
```

---

## 6. UI Requirements

### 6.1 Workbench header

Show:

```text
slice name/number
semantic family
crop status
support status
semantic status
classification status
readiness/export status
```

### 6.2 Next action card

Show a clear next action:

Examples:

```text
Sap/Heartwood: Start semantic annotation
Sap/Heartwood: Review semantic mask
Copper: Draw Copper draft
Copper: Add required support mask for export readiness
Classification: Review auto-derived classification
```

### 6.3 Editor links / embedding

The workbench may either:

- embed support/semantic editors, or
- link to existing deep-linkable support/semantic editors in a guided panel.

Prefer the smallest safe implementation that avoids duplicating editor logic.

The workbench must not use the legacy full-image editor as an escape hatch. Links should point to crop workflow routes such as BBox stage, support editor, semantic editor, or the selected workbench.

### 6.4 Support policy messaging

The workbench must explain:

```text
Sap/Heartwood can derive support geometry from semantic foreground.
Copper requires explicit support before export/readiness.
```

### 6.5 Whole-image context

Keep whole-image context accessible through the navigator. User must know which slice is selected and which slices are done.

---

## 7. Server / API Scope

RB-096 should prefer using existing APIs.

Only add small read endpoints if needed for workbench summary:

```text
GET /api/slices/[sliceInstanceId]/workbench
```

or extend existing crop/readiness endpoints.

No new persistence model unless strictly necessary.

---

## 8. Tests

### 8.1 Unit / component tests

Cover:

- mode-aware next-action logic,
- support policy labels,
- workbench status mapping.

### 8.2 Integration/API tests

Only if new server endpoint is added.

### 8.3 E2E tests

Add focused E2E if stable:

```text
open crop workbench for a slice
Sap/Heartwood path shows semantic available without support
Copper path shows semantic draft available but support required for readiness
classification status visible
navigator/context visible
```

Existing crop support/semantic editor tests must remain green.

---

## 9. Documentation Updates

Update:

```text
docs/03-features/editor.md
docs/03-features/images.md
docs/06-data/crop-based-slice-annotation.md
docs/06-data/training-export-contract.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must reflect the mode-aware workbench flow.

---

## 10. Acceptance Criteria

1. Unified crop workbench exists.
2. Workbench is mode-aware.
3. Sap/Heartwood semantic annotation is presented as available without support.
4. Copper semantic draft is available without support, but readiness/export shows support required.
5. Workbench shows support, semantic and classification status.
6. Whole-image/slice navigation context remains accessible.
7. Existing support/semantic editor routes remain valid.
8. Existing crop workflows remain green.
9. Docs and smoke tests are updated.
10. Ticket is moved to done.
11. Full validation gate passes.

---

## 11. Notes for Codex

- Do not reintroduce the old “semantic requires support first” assumption.
- Do not implement semantic family reset/guard details here; RB-097 handles that.
- Prefer orchestrating existing editors over duplicating canvas logic.
