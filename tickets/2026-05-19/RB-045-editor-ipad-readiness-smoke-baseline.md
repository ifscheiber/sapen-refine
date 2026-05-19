# RB-045 — Editor / iPad Readiness & Manual Smoke Baseline

## Status

In Progress

## Priority

High

## Type

Stabilization / Editor UX / Browser Readiness / iPad Readiness

## Repository

`sapen-annotate`

## Depends on

- RB-040 — Rename + Repo-Hygiene Baseline
- RB-041 — Green Validation Baseline and Test Harness
- RB-042 — Dependency Audit Baseline
- RB-043 — Architecture & UI Baseline Before Domain Expansion
- RB-044 — Restore Login DB Bootstrap Baseline

## Blocks

- Customer-facing browser trial
- Annotation domain model implementation
- Admin training export
- Model-assisted preprediction / correction workflow

---

## Codex Planning Notes

Added before implementation.

Numbering note:

- This ticket was provided as `RB-044-editor-ipad-readiness-smoke-baseline.md`.
- `RB-044` is already used by the completed login DB bootstrap ticket.
- The editor/iPad ticket is therefore renumbered to `RB-045` for a consistent ticket sequence.

Concrete implementation plan:

1. Run the required baseline gates exactly as listed in this ticket and record current results in `docs/00-overview/baseline-checks.md`.
2. Audit `src/features/editor/EditorClient.tsx` and document the current route, canvas/input model, save/autosave behavior, undo/redo behavior, and limitations in `docs/03-features/editor.md` and `docs/src/components/editor.md`.
3. Extract small pure editor helpers before behavior changes where useful, especially coordinate conversion and canvas display/backing-size calculations. Add focused unit tests for those helpers under `tests/unit/`.
4. Resolve the current React hook warnings by stabilizing editor callbacks and effect dependencies with `useCallback`/pure helpers instead of eslint disables.
5. Harden pointer behavior in the existing editor, keeping Pointer Events as the single input system. Cover pointer capture, pointer cancel/leave, out-of-bounds coordinate clamping, and intentional `touch-action` behavior on the drawing surface.
6. Review high-DPI/iPad canvas behavior. Keep the mask coordinate space image-sized; only fix backing/display sizing and coordinate mapping issues that fit this baseline ticket. Defer advanced zoom/pan gestures if they require a larger interaction model.
7. Make narrow trial-readiness UI improvements only where they support browser/iPad use: touch target sizing, active tool/label clarity, save/dirty status clarity, loading/error text, and unsaved-change protection if it can be done without a large state rewrite.
8. Add `docs/07-testing/manual-smoke-editor-ipad.md` with desktop and iPad Safari checklists and result tracking.
9. Update `docs/08-adr/remediation-backlog.md` or the active `docs/adr/remediation-backlog.md` for any real editor limitations that are too large for RB-045.
10. Run the full final validation block, move the ticket to `tickets/2026-05-19/done/`, and commit focused slices.

Expected focused commits:

- `docs: record editor ipad readiness baseline`
- `test: add editor canvas coordinate helpers`
- `fix: stabilize editor hooks and pointer input`
- `refactor: improve editor canvas ipad readiness`
- `docs: add editor ipad smoke checklist`

Potential follow-up candidates if discovered during implementation:

- Advanced iPad zoom/pan/gesture model for large images.
- Dedicated editor state reducer if callback stabilization becomes too broad.
- Playwright/browser automation for login-upload-open-editor once the manual smoke path is stable.

## 1. Context

SaPen Annotate now has a green technical baseline and a cleaner architecture/UI foundation:

- Prisma generate, lint, typecheck, build, test and design-hardcoding check are green.
- Routes are organized into public/workspace route groups.
- Active UI is now under `src/features/**`.
- Shell components live under `src/components/shell/**`.
- Design tokens/themes live under `src/design/**`.
- Old prototype shell/layout duplication has been removed.

The next priority is not domain expansion yet. The standalone annotation app must become usable by customers in the browser soon. In particular, iPad usage is a first-class requirement because customer staff already have iPads and drawing annotations directly on them is expected to make the workflow easier.

The current Codex report still notes known hook warnings in:

```text
src/features/editor/EditorClient.tsx
```

Because the editor is the central work surface of SaPen Annotate, this remaining technical/UX risk should be handled before implementing the real annotation domain model, export logic, or preprediction workflows.

---

## 2. Goal

Make the current editor stable and realistically usable as the foundation for desktop and iPad browser-based annotation.

This ticket shall establish an explicit editor/iPad readiness baseline:

- no unresolved hook warnings in the editor,
- robust pointer/touch/stylus input handling,
- canvas behavior suitable for iPad Safari and desktop browsers,
- documented manual smoke-test procedure,
- preserved green validation baseline,
- no domain-model expansion.

The outcome should be a trustworthy technical foundation for later annotation features, not a complete editor rewrite.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- new annotation domain schema,
- T-number/specimen/slice/acquisition metadata model,
- admin export/download,
- model preprediction or active-learning ranking,
- Core handoff/correction workflow,
- full editor redesign,
- advanced review/approval workflow,
- full Playwright/E2E suite,
- PWA deployment work beyond documenting iPad browser behavior,
- cosmetic redesign unrelated to editor usability.

If these issues are discovered, add them to the remediation backlog instead of expanding scope.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Mandatory process:

1. Start with:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

2. Record the current baseline in docs before making editor changes.
3. Work in meaningful slices.
4. At the end of each slice:
   - run relevant checks,
   - update docs,
   - create a detailed focused Git commit.
5. Do not mix unrelated completed slices in one commit.
6. Keep the app deployable/runnable after every meaningful slice.

---

## 5. Scope

### 5.1 Baseline review of current editor

Inspect the current editor implementation, especially:

```text
src/features/editor/EditorClient.tsx
src/features/editor/**
src/features/images/**
src/components/shell/**
src/design/**
```

Document:

- current editor entry route(s),
- current canvas/input handling model,
- current save/commit flow,
- current undo/redo behavior if present,
- known limitations,
- exact hook warnings and whether they are real bugs or dependency-list issues.

Update or create:

```text
docs/03-features/editor.md
docs/00-overview/baseline-checks.md
docs/08-adr/remediation-backlog.md
```

### 5.2 Resolve editor hook warnings

Fix all known hook warnings in `EditorClient.tsx` without suppressing them unless there is a narrow and documented reason.

Rules:

- Prefer correct dependency handling over disabling lint rules.
- Avoid broad refactors unrelated to the warning.
- If a function/object dependency causes repeated re-renders, stabilize it intentionally with `useMemo`, `useCallback`, local reducer state, or module-level pure helpers as appropriate.
- Do not hide actual stale-closure bugs.

Acceptance:

- `npm run lint` passes without known editor hook warnings.
- Any remaining warning must be explicitly justified in docs/backlog, but preferred outcome is zero warnings.

### 5.3 Establish robust pointer/touch/stylus input baseline

Review and harden the editor input model for:

- mouse,
- touch,
- Apple Pencil / stylus via pointer events where supported,
- trackpad/mouse desktop use.

Target behavior:

- drawing works with mouse on desktop,
- drawing works with finger/stylus on iPad Safari,
- canvas does not accidentally scroll the page while drawing,
- page navigation/scrolling remains usable outside the drawing surface,
- pointer capture is used where appropriate,
- pointer cancellation and pointer leave/up cases are handled safely,
- repeated draw/save cycles do not corrupt local editor state.

Implementation guidance:

- Prefer Pointer Events as the unified input layer.
- Avoid parallel mouse/touch event systems unless there is a documented compatibility reason.
- Use CSS such as `touch-action` intentionally on the drawing surface.
- Keep input handling centralized in editor-specific code, not scattered across route components.

### 5.4 Canvas/device-pixel-ratio readiness

Ensure the canvas/image drawing surface is usable on high-DPI displays and iPad Retina displays.

Check:

- canvas backing resolution vs CSS display size,
- coordinate mapping from pointer position to image/mask coordinates,
- resize behavior,
- zoom/fit behavior if currently present,
- mask drawing accuracy after viewport changes,
- no hardcoded visual colors outside approved design-token/canvas-label config.

If full zoom/pan support is not currently implemented, do not implement a large new system here. Instead:

- make the current coordinate model correct,
- document current limitations,
- add backlog entries for advanced zoom/pan if needed.

### 5.5 Editor usability baseline for customer trial

Make small targeted improvements only where needed for a realistic browser trial.

Candidate areas:

- clear active tool/label state,
- clear save/dirty state,
- obvious loading/error/empty states,
- accidental navigation protection if unsaved changes exist,
- sufficiently large touch targets for iPad,
- responsive layout within the existing app shell,
- no route-local layout hacks.

Rules:

- Use existing shell/design tokens.
- Do not hardcode colors/fonts/styles in production components.
- Do not redesign the entire editor UI.

### 5.6 Minimal tests for editor-critical pure logic

Add focused tests only where they are stable and valuable.

Good candidates:

- pointer-to-canvas coordinate conversion helper,
- device-pixel-ratio canvas sizing helper,
- brush/mask mutation pure helper if already isolated or easy to isolate,
- editor reducer if present.

Avoid:

- brittle DOM/canvas screenshot tests,
- large E2E tests,
- tests that require real iPad/Safari automation,
- tests tied to prototype UI markup likely to change soon.

### 5.7 Manual smoke-test checklist

Create a manual smoke-test document for desktop and iPad.

Required file:

```text
docs/07-testing/manual-smoke-editor-ipad.md
```

It must include at least:

#### Desktop browser smoke

- login,
- open workspace,
- open/create project if currently supported,
- upload/open an image if currently supported,
- open editor,
- select label/tool,
- draw mask stroke,
- undo/redo if supported,
- save/commit,
- reload and confirm persisted state if supported,
- verify no console errors for normal use.

#### iPad Safari smoke

- open app in Safari,
- login,
- open editor,
- draw with finger,
- draw with Apple Pencil if available,
- verify the page does not scroll while drawing on canvas,
- verify page can still scroll outside canvas,
- change labels/tools using touch,
- save/commit,
- reload and confirm state if supported,
- rotate iPad or change viewport if relevant,
- document known limitations.

#### Result tracking

Include a small checklist table:

```text
Environment | Tester | Date | Result | Notes
```

Codex does not need to run the iPad smoke itself, but must provide a checklist humans can execute.

---

## 6. Suggested Implementation Slices

Codex may adapt the sequence, but commits should remain focused.

### Slice 1 — Baseline editor audit and docs

- Inspect editor structure.
- Run checks.
- Document current behavior and known gaps.

Suggested commit:

```bash
git commit -m "docs: record editor ipad readiness baseline"
```

### Slice 2 — Fix hook warnings and editor state stability

- Fix `EditorClient.tsx` hook warnings.
- Add small tests if helpers are extracted.
- Run lint/typecheck/test.

Suggested commit:

```bash
git commit -m "fix: stabilize editor hooks and state dependencies"
```

### Slice 3 — Harden pointer/canvas input behavior

- Review pointer/touch handling.
- Centralize input behavior if needed.
- Ensure canvas does not conflict with iPad scrolling.
- Keep behavior simple and documented.

Suggested commit:

```bash
git commit -m "fix: harden editor pointer input for ipad drawing"
```

### Slice 4 — Canvas sizing and customer-trial usability

- Check high-DPI coordinate/canvas behavior.
- Improve targeted loading/error/dirty/touch-target states if needed.
- Keep within existing design-system boundaries.

Suggested commit:

```bash
git commit -m "refactor: improve editor canvas readiness for browser trial"
```

### Slice 5 — Smoke checklist and final validation

- Add manual smoke checklist.
- Update docs/backlog.
- Run full validation baseline.

Suggested commit:

```bash
git commit -m "docs: add editor ipad smoke checklist"
```

---

## 7. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before the final Codex report.
2. The editor current state and limitations are documented.
3. `npm run lint` no longer reports known hook warnings in `EditorClient.tsx`.
4. Pointer/touch/stylus handling is reviewed and hardened for desktop and iPad browser use.
5. Canvas coordinate/device-pixel-ratio behavior is reviewed and fixed or explicitly documented if deferred.
6. Drawing on the canvas is not expected to scroll the page on iPad Safari.
7. Page scrolling outside the canvas remains possible.
8. Touch targets and editor shell layout are reasonable for iPad use.
9. No production components introduce hardcoded colors/fonts/styles outside the approved token/config layer.
10. At least one stable editor-related unit test is added if a suitable pure helper is available; otherwise the reason is documented.
11. Manual smoke checklist exists at:

```text
docs/07-testing/manual-smoke-editor-ipad.md
```

12. Full final validation passes:

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

13. Any remaining limitations are added to:

```text
docs/08-adr/remediation-backlog.md
```

14. Ticket is moved to:

```text
tickets/2026-05-19/done/
```

15. Final Codex report includes:
    - commits created,
    - commands run,
    - pass/fail status,
    - remaining known gaps,
    - whether manual browser/iPad smoke was run by a human or only documented.

---

## 8. Final Validation Command Block

Codex should finish with:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run check:design-hardcoding
```

Optional if available:

```bash
npm run check:docs-links
```

---

## 9. Notes for Codex

- This is an editor/browser readiness ticket, not a product-domain ticket.
- iPad support is a first-class customer requirement.
- Prefer small correctness fixes over a large editor rewrite.
- Do not add heavy E2E infrastructure unless it already exists and is trivial to use.
- Keep routes thin and use the established `src/features/**`, `src/components/shell/**`, and `src/design/**` boundaries from RB-043.
- Preserve the green baseline from RB-041/RB-043.
- If a limitation is real but too large for this ticket, document it precisely and continue.
