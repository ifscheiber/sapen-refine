# DESIGN-004D — Editor Polish Validation and Smoke Tests

## Status

Completed

## Implementation notes

- Updated affected E2E tests for the new `Annotation Editor` BBox shell, active `BBoxes` tab, compact BBox toolbar, and navigator-only rail.
- Automated checks run:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run build`: passed.
  - `npx playwright test tests/e2e/slice-bbox-proposals.spec.ts`: passed.
  - `npx playwright test tests/e2e/crop-workflow-closeout.spec.ts tests/e2e/desktop-browser-smoke.spec.ts tests/e2e/large-mask-upload.spec.ts tests/e2e/annotator-surface.spec.ts`: passed.
  - `npm run check:design-hardcoding`: passed.
  - Prototype artifact grep for CDN/font imports in `src docs`: passed.
  - `npm test`: attempted; local non-editor failures remained. Integration suites could not connect to `127.0.0.1:55432` (`EPERM`), and unrelated CLI-output unit expectations for secret handling, handoff archive, and trial bootstrap saw empty stdout.

## Type

Validation / regression ticket

## Repository / path context

Work in the `sapen-annotate` repository.

Codex has read-only access to the SaPen reference repository at `../sapen`.

When inspecting SaPen Core / SaPen Refine reference files, use paths prefixed with `../sapen/...`.

Do **not** assume that `apps/sapen-core/...` or `apps/sapen-refine/...` exists inside `sapen-annotate`.

## Sprint boundary

This is a focused design/UI polish sprint after commit `b52669f` (`design: align crop editor with core workspace`).

Preserve the existing annotation logic, BBox logic, mask semantics, API contracts, storage contracts, autosave/commit behavior, and Core handoff contracts.

Do not rewrite the canvas engine.
Do not port SaPen Core editor logic into `sapen-annotate`.
Use `../sapen` only as read-only visual/layout reference.


## Goal

Validate that the editor polish sprint did not break BBox editing, semantic/support mask editing, navigator rendering, or editor routing.

## Scope

Validate after:

- right rail simplified to navigator-only
- BBox editor integrated into the main editor tab system
- BBox instruction panel replaced by compact toolbar

## Automated validation

Inspect local `package.json` and run repo-appropriate commands.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If scripts differ, use the correct scripts.

Also run grep checks for prototype artifacts:

```text
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols
```

## Manual smoke checklist

Codex should either run this or provide it explicitly for manual execution if app launch is not possible.

1. Open an existing project image editor.
2. Verify editor header/context/tabs render.
3. Verify right rail shows only slice info + navigator image.
4. Verify no right-rail `Edit BBoxes` button.
5. Verify no right-rail slice boxes/list.
6. Verify no right-rail `Refresh navigator` button.
7. Click/open `BBoxes` tab.
8. Verify BBox editor remains inside the same editor shell.
9. Verify `BBoxes` tab is active.
10. Verify no separate `Step 1` page feel.
11. Verify no large instruction card above BBox editor.
12. Verify compact BBox toolbar renders.
13. Select BBox proposals.
14. Edit/replace/delete BBox proposal where supported.
15. Continue to slice annotation.
16. Switch to `Semantic Masks`.
17. Select Polygon and annotate a label.
18. Select Background and clear an area.
19. Commit/save mask.
20. Switch to `Support Mask` if available.
21. Save classification if available.
22. Verify no console errors from removed right-rail controls.

## Acceptance criteria

- [ ] Automated checks reported.
- [ ] Manual smoke checklist completed or provided.
- [ ] BBox tab integration works.
- [ ] BBox compact toolbar works.
- [ ] Right rail simplification works.
- [ ] Semantic/support editing still works.
- [ ] No canvas/mask/API/storage regressions identified.
- [ ] Any remaining follow-ups listed.

## Codex implementation prompt

```text
Implement DESIGN-004D after DESIGN-004A through DESIGN-004C.

Run validation checks and smoke-test the redesigned editor and BBox workflow.

Do not add new design/features unless fixing a regression caused by this sprint.

Report:
A. commands run
B. results
C. smoke-test findings
D. regressions fixed
E. remaining follow-ups
```
