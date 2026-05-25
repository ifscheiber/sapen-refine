# DESIGN-003E — Editor Design Validation and Smoke-Test Pass

## Status

Completed

## Implementation notes

- Updated affected E2E tests for the redesigned heading, commit button names, Background-as-clear UX, compact review-row selectors, and explicit Brush/Polygon tool selection.
- Automated checks run:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run build`: passed.
  - `npm run check:design-hardcoding`: passed.
  - `npx playwright test tests/e2e/slice-bbox-proposals.spec.ts`: passed.
  - `npx playwright test tests/e2e/crop-workflow-closeout.spec.ts`: passed.
  - `npx playwright test tests/e2e/desktop-browser-smoke.spec.ts tests/e2e/large-mask-upload.spec.ts`: passed.
  - `npm test`: attempted, but local non-editor failures remained: integration tests could not connect to `127.0.0.1:55432` (`EPERM`), and unrelated CLI-output unit expectations for secret handling, handoff archive, and trial bootstrap saw empty stdout.
- Grep checks found no design-prototype CDN/font artifacts or demo credentials in `src`; broader `src docs` grep only found pre-existing local/trial credential references in documentation.
- No canvas, mask storage, API contract, or export/readiness regression was identified in the targeted editor smokes.

## Type

Validation / UI regression ticket

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

When inspecting SaPen Core / SaPen Refine reference files, use paths prefixed with `../sapen/...`.

Do **not** assume that `apps/sapen-core/...` or `apps/sapen-refine/...` exists inside `sapen-annotate`.

## Critical boundary

This is a **design/UI sprint**.

Codex must not port SaPen Core editor logic into `sapen-annotate`.

Use SaPen Core and SaPen Refine only as visual/layout/interaction references. Preserve the existing `sapen-annotate` annotation logic, API contracts, mask storage contracts, canvas rendering behavior, autosave/commit behavior, and handoff contracts.

Do not rewrite the canvas engine.


## Goal

Validate that the editor design sprint did not break annotation behavior.

This ticket is deliberately separate so Codex performs a focused regression pass after the UI/design changes.

## Scope

Verify the redesigned editor after:

- layout alignment with SaPen Core Quick Analysis
- toolbar redesign
- Background-as-erase UX
- right rail compact slice navigator
- optional polygon vertex adjustment UX

## Required validation

### Automated checks

Inspect `package.json` and run the repo-appropriate commands.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If different scripts exist, use the correct repo scripts.

### Grep checks

Ensure no CDN/design-prototype artifacts were introduced:

```text
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols
```

Ensure no demo credentials were introduced:

```text
Demo Credentials
admin1234
admin@sapen.local
```

### Manual smoke tests

Codex should describe the smoke-test result or, if it cannot run the app, provide an exact manual smoke checklist.

Required smoke checklist:

1. Open an existing project image editor.
2. Verify the image/canvas loads.
3. Verify the redesigned header/context rows render.
4. Verify the compact toolbar renders.
5. Select Polygon.
6. Draw/apply a polygon with a normal label.
7. Select Background and apply it over an existing annotation.
8. Verify Background clears/overwrites as expected.
9. Select Brush and perform a small touch-up.
10. Use Lasso if available.
11. Undo and redo.
12. Save/commit mask.
13. Save classification if available.
14. Open bbox edit mode.
15. Select slices from the compact right rail.
16. Verify no persistent detailed metadata cards are shown by default.
17. Verify export/readiness warnings remain visible.
18. Verify the canvas interactions still work.

## Acceptance criteria

- [ ] Typecheck/lint/tests/build status is reported.
- [ ] Grep checks are reported.
- [ ] Smoke-test checklist is completed or provided.
- [ ] No canvas/mask/storage behavior regression is identified.
- [ ] Any remaining design/logic follow-ups are explicitly listed.

## Codex prompt

```text
Implement DESIGN-003E after the editor UI redesign tickets.

Run validation checks and smoke-test the editor behavior.

Do not perform additional feature work unless fixing a regression caused by the design changes.

Report:
A. commands run
B. results
C. smoke-test findings
D. regressions fixed
E. remaining follow-ups
```
