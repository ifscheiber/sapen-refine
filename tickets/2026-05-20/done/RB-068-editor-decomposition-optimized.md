# RB-068 — Editor Decomposition

## Status

Completed by Codex on 2026-05-21

## Priority

Medium / High

## Type

Editor / Refactor / Maintainability / iPad Readiness / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-062 — Repository State & Documentation Consistency Sweep
- RB-067 — Prediction QA Metrics & Evaluation Preparation

## Blocks

- Future editor tools such as eraser/brush refinements
- Safer iPad editor iteration
- Future multi-slice / multi-object editor work
- Future annotation productivity improvements

---

## 1. Context

The editor has accumulated most of the product’s core workflows:

- manual semantic mask drawing,
- slice support mask mode,
- slice classification,
- metadata/editor state integration,
- save/dirty state,
- review/approval controls,
- prediction overlay and assisted correction,
- task context,
- iPad pointer/touch behavior,
- canvas rendering,
- artifact loading and commit behavior.

The original RB-068 draft correctly identifies the issue: `src/features/editor/EditorClient.tsx` owns drawing tools, semantic/support modes, review controls, slice classification, assisted correction, save state, overlays, task context, and viewport behavior. The editor works, but future changes will become risky if every feature continues to land in one large component. fileciteturn16file5

RB-067 also added/updated follow-up work around editor eraser UX. That should remain separate. RB-068 is not the eraser feature; it is a behavior-preserving decomposition so future editor work becomes safer.

---

## 2. Goal

Refactor the editor into smaller, named modules without changing runtime behavior.

At the end of RB-068:

1. `EditorClient.tsx` is materially smaller and acts more as an orchestrator.
2. Canvas rendering, tool controls, review/status controls, correction context, and save/commit logic have clearer ownership.
3. Existing editor workflows behave the same.
4. Existing desktop E2E remains green.
5. The editor remains usable at iPad-sized viewports.
6. Documentation explains the new editor module structure.
7. Future editor tools can be added without modifying one monolithic component.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- eraser UX,
- new annotation tools,
- brush algorithm changes,
- mask serialization changes,
- review/export/prediction semantics changes,
- new API routes,
- schema changes,
- multi-slice/multi-object editor,
- visual redesign,
- iPad-specific gesture redesign,
- performance optimization beyond incidental cleanup,
- behavior changes to assisted correction.

If a real bug is discovered, document it unless it blocks the decomposition.

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
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Work in focused slices and commit after each meaningful slice.

Because this is a refactor, run at least `lint`, `typecheck`, `test`, and `test:e2e` after the main extraction commits.

---

## 5. Decomposition Strategy

### 5.1 Inventory first

Before refactoring, document the current editor responsibilities.

Create/update:

```text
docs/03-features/editor.md
docs/08-adr/remediation-backlog.md
```

Inventory should identify:

- editor routes using `EditorClient`,
- data loading sources,
- mask modes,
- canvas state,
- save/commit paths,
- review/status controls,
- slice classification controls,
- assisted correction context,
- prediction overlay behavior,
- iPad/touch/pointer assumptions.

### 5.2 Keep `EditorClient` as orchestrator

Target shape:

```text
EditorClient.tsx
→ loads context and high-level state
→ composes extracted components/hooks
→ delegates rendering/control/save/review/correction details
```

It should not own every UI panel and every canvas handler directly.

### 5.3 Extract one concern at a time

Candidate extraction order:

1. Shared editor types/constants.
2. Editor state/reducer/hooks.
3. Canvas layer/rendering component.
4. Toolbar/tool/label controls.
5. Save/dirty/status controls.
6. Review/status controls.
7. Slice classification controls.
8. Assisted correction context/panel.
9. API/save adapter functions.

Do not extract all at once if that creates risk. Prefer multiple small commits.

---

## 6. Suggested Target Structure

Codex may adapt names, but final ownership should be clear.

Suggested files/directories:

```text
src/features/editor/
  EditorClient.tsx
  editorTypes.ts
  editorConstants.ts
  editorState.ts
  editorApi.ts

  components/
    EditorCanvas.tsx
    EditorToolbar.tsx
    EditorModeControls.tsx
    EditorLabelPalette.tsx
    EditorSaveStatus.tsx
    EditorReviewPanel.tsx
    EditorSliceClassificationPanel.tsx
    EditorAssistedCorrectionPanel.tsx
    EditorPredictionOverlayControls.tsx

  hooks/
    useEditorState.ts
    useEditorCanvasInteraction.ts
    useEditorSave.ts
    useEditorReviewState.ts
    useAssistedCorrection.ts
```

If the repo already has different conventions, follow them and document the chosen structure.

---

## 7. Behavior Preservation Requirements

RB-068 must preserve these workflows:

### 7.1 Manual annotation

- open image editor,
- draw semantic mask,
- save,
- reload,
- persisted mask appears.

### 7.2 Support mask and classification

- switch semantic/support mode,
- draw support mask,
- save,
- set slice classification,
- reload and confirm state.

### 7.3 Review/approval

- submit,
- approve/reject where allowed,
- status remains correct.

### 7.4 Assisted correction

- open correction task,
- load prediction read-only,
- use prediction as starting mask,
- save human correction,
- prediction artifact remains unchanged.

### 7.5 iPad assumptions

- no hover-only controls,
- touch targets not degraded,
- drawing behavior unchanged,
- existing pointer/touch handling preserved.

---

## 8. Refactor Boundaries

### 8.1 API behavior

No API route behavior changes.

If moving API client helpers into `editorApi.ts`, keep request/response contracts unchanged.

### 8.2 Mask format

No mask serialization or byte format changes.

### 8.3 Styling/design

Use existing design tokens and UI primitives.

Do not introduce hardcoded colors, fonts, or inline theme values.

### 8.4 State behavior

No behavioral change to save/dirty/unsaved-change guard.

If extracting state into reducer/hooks, add tests for pure reducers/helpers where practical.

---

## 9. Tests

### 9.1 Unit tests

Add tests for extracted pure logic where useful:

- editor reducer transitions,
- mode switching helper,
- save-state helper,
- prediction overlay state helper,
- review status mapping,
- tool/label config.

Do not over-test React component markup.

### 9.2 Integration tests

No new API tests expected unless extraction touches client/server boundaries.

### 9.3 E2E tests

Existing Playwright desktop browser smoke must remain green.

If existing selectors are too coupled to old markup, update them to robust accessible selectors while preserving workflow coverage.

No new E2E path is required unless decomposition changes structure enough to require selector updates.

---

## 10. Documentation Updates

Update:

```text
docs/03-features/editor.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- new editor module/component structure,
- which behavior is unchanged,
- which future editor enhancements are easier after this refactor,
- eraser UX remains separate if still open,
- multi-slice/multi-object remains deferred,
- real iPad Safari smoke remains manual/deferred until deployment/device access exists.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. `EditorClient.tsx` is materially smaller and no longer owns all editor concerns.
3. At least three major concerns are extracted, for example:
   - canvas rendering/interaction,
   - toolbar/mode/label controls,
   - review/status panel,
   - assisted correction panel,
   - save/commit adapter.
4. Extracted files have clear names and ownership.
5. Existing editor behavior is preserved.
6. Existing E2E browser smoke remains green.
7. New unit tests cover extracted pure helpers where practical.
8. No API/schema/mask-format semantics change.
9. No new editor feature such as eraser UX is implemented.
10. Docs describe the new editor structure.
11. Ticket is moved to:

```text
tickets/2026-05-20/done/
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
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

13. Final Codex report includes:
    - commits created,
    - files/components/hooks extracted,
    - tests added/changed,
    - behavior preservation notes,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: map current editor responsibilities"
git commit -m "refactor: extract editor types and state helpers"
git commit -m "refactor: extract editor canvas and controls"
git commit -m "refactor: extract editor review and correction panels"
git commit -m "test: cover extracted editor helpers"
git commit -m "docs: document editor module structure"
git commit -m "chore: finalize editor decomposition ticket"
```

---

## 13. Notes for Codex

- This is a behavior-preserving refactor.
- Do not implement eraser UX here.
- Do not rewrite the editor from scratch.
- Keep existing E2E as the safety net.
- Prefer several small extractions over one large risky rewrite.
