# RB-070 — Editor Eraser Tool UX

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Editor UX / Annotation Workflow / iPad Readiness / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-068 — Editor Decomposition
- RB-072 — Route-Level API Auth/Error Contract Hardening
- RB-073 — Trial Deployment Secret & Build-Context Hygiene

## Blocks

- Customer-facing annotation trial usability
- Real iPad Safari annotation smoke confidence
- Future brush/tool UX improvements

---

## 1. Context

The current editor supports brush and lasso tools. Users can currently erase by painting the background label. That is functionally possible, but it is weak UX and not discoverable for repeated desktop/iPad annotation.

The existing RB-070 draft correctly identifies the gap:

- `src/features/editor/EditorClient.tsx` defines tools such as `brush`, `lasso_free`, and `lasso_poly`.
- The label palette includes background labels, so erasing is possible indirectly.
- There is no explicit Eraser control or mode.

RB-068 already decomposed the editor into smaller modules, so RB-070 should implement the eraser using that structure instead of adding another large block back into `EditorClient.tsx`.

RB-070 is a user-facing editor UX ticket, not a schema/API/export/review ticket.

---

## 2. Goal

Add an explicit eraser tool to the editor for semantic and support-mask editing.

At the end of RB-070:

1. Users can select an explicit Eraser control.
2. Eraser works for semantic mask mode.
3. Eraser works for slice support mask mode.
4. Eraser uses the current brush size control.
5. Eraser works with mouse, touch, and Apple Pencil-compatible pointer input.
6. Eraser changes participate in dirty/save/reload behavior.
7. Existing brush/lasso behavior remains unchanged.
8. Existing tests and E2E flows remain green.

---

## 3. Non-Goals

Do not implement these in this ticket:

- new mask serialization format,
- API/schema changes,
- review/export/prediction semantic changes,
- advanced multi-touch gestures,
- zoom/pan redesign,
- multi-slice/multi-object editor,
- new brush engine,
- full undo/redo system if not already present,
- visual redesign unrelated to eraser,
- editor rewrite.

If explicit undo/redo is not currently supported, do not invent a large history system in this ticket. Ensure eraser participates in the same dirty/save/reload behavior as brush strokes and document undo/redo limitations honestly.

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

Work in focused slices and commit after each meaningful slice.

---

## 5. Editor Tool Model

### 5.1 Add explicit eraser tool

Extend the editor tool model with an explicit eraser option, for example:

```ts
type Tool = "brush" | "eraser" | "lasso_free" | "lasso_poly"
```

Adapt to the actual extracted editor type file from RB-068.

### 5.2 Eraser value by mode

The eraser must write the correct background value for the active editor mode:

```text
Semantic mask mode:
  eraser writes semantic background value, e.g. Labels.BG / background.

Slice support mode:
  eraser writes support background value, e.g. 0 / background.
```

Do not hardcode values in UI components if label/schema helpers already exist. Prefer centralized label/mode helpers.

### 5.3 Brush size

The eraser should reuse the current brush size/diameter control.

Do not add a separate eraser-size system unless trivial and explicitly justified.

### 5.4 Existing background label behavior

If the label palette still exposes background, background painting should remain valid.

The eraser is a discoverability and workflow improvement, not a removal of existing behavior.

---

## 6. UI Requirements

### 6.1 Toolbar control

Add an explicit eraser control to the editor toolbar.

Requirements:

- visible/discoverable on desktop,
- usable at iPad-sized widths,
- touch target size consistent with other controls,
- active state visually clear,
- accessible label/title, e.g. `Eraser`,
- no hover-only interaction.

### 6.2 Mode-specific affordance

When eraser is active, the UI should make it clear what it erases:

```text
Semantic mode: erase to background
Support mode: erase support pixels
```

This can be a tooltip, small helper text, or mode label.

### 6.3 Cursor/preview

Optional but useful:

- keep existing brush cursor/preview behavior if present,
- if cursor preview changes are too broad, do not implement in RB-070.

### 6.4 iPad considerations

Ensure:

- eraser can be selected with touch,
- drawing/erasing on canvas does not scroll the page,
- page scroll outside canvas still works,
- no hover-only control,
- Apple Pencil uses same pointer path as brush.

Real iPad Safari execution remains pending until deployment/device access exists.

---

## 7. Behavior Requirements

### 7.1 Semantic mask erasing

Flow:

```text
open editor
select semantic mask mode
draw sapwood/heartwood/copper
select eraser
erase part of the mask
save
reload
erased pixels remain background
```

### 7.2 Support mask erasing

Flow:

```text
open editor
select support mask mode
draw support pixels
select eraser
erase part of support
save
reload
erased pixels remain support background
```

### 7.3 Assisted correction compatibility

Eraser must work when editing a human correction draft created from a prediction.

It must not mutate the read-only prediction overlay.

### 7.4 Review/export boundaries

Eraser is only a pixel-editing tool.

It must not change:

- review states,
- approved/export eligibility,
- prediction immutability,
- artifact provenance,
- mask serialization.

Saving after erasing should behave like saving after brush editing.

---

## 8. Implementation Guidance

Use the decomposed editor structure from RB-068.

Likely areas:

```text
src/features/editor/editorTypes.ts
src/features/editor/editorConstants.ts
src/features/editor/components/EditorToolbar.tsx
src/features/editor/components/EditorCanvas.tsx
src/features/editor/hooks/useEditorCanvasInteraction.ts
src/features/editor/editorState.ts
src/features/editor/editorHelpers.ts
```

Exact names may differ.

Preferred approach:

1. Add eraser to tool type/config.
2. Add helper such as `getEraseValueForEditorMode(...)`.
3. In pointer/brush application logic, if tool is eraser, write erase value instead of active label value.
4. Keep all save/dirty handling unchanged.
5. Add tests around helper and mask mutation behavior.

Do not add logic directly back into `EditorClient.tsx` if extracted modules exist.

---

## 9. Tests

### 9.1 Unit tests

Add/extend tests for:

- eraser tool config,
- mode → erase value mapping,
- semantic eraser writes semantic background,
- support eraser writes support background,
- eraser uses brush size/path mutation helper if pure helper exists,
- eraser does not affect prediction overlay state if helper exists.

### 9.2 Integration tests

Only if current test patterns make it easy.

Useful coverage:

- save semantic mask after erasing and verify persisted bytes,
- save support mask after erasing and verify persisted bytes.

### 9.3 E2E tests

Extend Playwright if stable:

```text
login
→ open project/image editor
→ draw semantic mask
→ select eraser
→ erase
→ save/reload
→ verify editor still loads and no error
→ switch support mode
→ draw support
→ erase support
→ save/reload
```

If pixel-level verification is brittle, use robust assertions around save success and persisted reload, and cover exact byte mutation in unit/integration tests.

Existing E2E must remain green.

---

## 10. Documentation Updates

Update:

```text
docs/src/components/editor.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- explicit eraser exists,
- semantic eraser writes background,
- support eraser writes support background,
- indirect background-label painting remains valid if still available,
- real iPad Safari validation remains pending until deployed/device access exists,
- any undo/redo limitations.

---

## 11. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Editor has an explicit Eraser control.
3. Eraser works in semantic mask mode.
4. Eraser works in support mask mode.
5. Eraser uses the same size control/path as brush.
6. Eraser works with pointer/mouse/touch input using the existing pointer path.
7. Eraser changes mark editor dirty and persist after save/reload.
8. Assisted correction prediction overlay remains read-only and unaffected by eraser.
9. Existing brush/lasso behavior remains unchanged.
10. No API/schema/mask-format/review/export semantics change.
11. Tests cover eraser helper/mutation behavior.
12. E2E remains green, with eraser coverage if stable.
13. Docs and smoke checklists are updated.
14. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

15. Final validation passes:

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

16. Final Codex report includes:
    - commits created,
    - editor files/components changed,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 12. Suggested Commit Sequence

```bash
git commit -m "docs: define editor eraser workflow"
git commit -m "feat: add editor eraser tool"
git commit -m "test: cover editor eraser behavior"
git commit -m "docs: document eraser workflow"
git commit -m "chore: finalize editor eraser ticket"
```

---

## 13. Notes for Codex

- This is a focused UX improvement.
- Do not rewrite the editor.
- Do not implement advanced gestures.
- Do not change mask persistence semantics.
- Preserve iPad pointer behavior.
