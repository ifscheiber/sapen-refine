# RB-104 — Remove Legacy Full-Image Editor Route and Surface

## Status

Done / Implemented

## Priority

High

## Type

UX Simplification / Route Removal / Editor Refactor / Documentation / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-096 — Unified Slice Crop Annotation Workbench
- RB-103 — BBox Stage Re-Entry From Crop Workflow

## Blocks

- RB-098 — Crop Workflow Smoke Test and Final Workflow Polish

---

## 1. Context

The product direction is now crop-first. The old full-image editor is no longer needed and creates confusion by exposing full-image semantic/support/classification primitives beside the crop workflow.

Important implementation detail:

```text
EditorClient currently powers:
  legacy /images/[imageId]/edit
  crop BBox stage via workflowMode="bboxStage"
  assisted correction task editing
```

RB-104 must remove the legacy full-image annotation surface without breaking BBox-stage drawing or assisted correction if those are still required.

---

## 2. Goal

Remove the full-image editor as a user-facing route and delete stale full-image annotation code paths.

At the end of RB-104:

1. `/app/projects/[projectId]/images/[imageId]/edit` no longer exists as a product route.
2. No visible UI links point to `/edit`.
3. Full-image semantic/support/classification/review annotation controls are removed.
4. BBox-stage editing remains available through the crop workflow.
5. Assisted correction remains available only through a correction-specific surface, if still in scope.
6. Docs and tests describe crop workflow as the primary annotation path.

---

## 3. Non-Goals

Do **not** implement:

- semantic family exclusivity; that is RB-097,
- new export contract,
- new crop support policy,
- model inference,
- Core integration,
- a compatibility full-editor fallback route.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with baseline:

```bash
git status --short
npm run lint
npm run typecheck
npm run build
npm run test
```

Run focused E2E after route/test rewrites:

```bash
npx playwright test tests/e2e/slice-bbox-proposals.spec.ts
```

Run full E2E before final commit if practical.

---

## 5. Required Implementation Strategy

### 5.1 Remove product route and links

Remove:

```text
/app/projects/[projectId]/images/[imageId]/edit
```

Remove or replace visible links labelled:

```text
Open editor
Full editor
Editor
```

Replacement actions:

```text
Crop workflow
Edit BBoxes
Support
Semantic
Tasks
```

Old `/edit` deep links should use normal workspace not-found behavior. Do not add a compatibility redirect unless a later ticket explicitly requires it.

### 5.2 Split reusable editor code before deletion

Do not delete BBox-stage or correction functionality accidentally.

Refactor toward explicit surfaces:

```text
Crop BBox stage editor
Correction task editor, if retained
Crop support editor
Crop semantic editor
```

After refactor, remove full-image-only behavior:

```text
full-image semantic mask mode
full-image support mask mode
full-image slice classification controls
full-image review/export readiness panel
full-image mask PNG export
workflowMode="fullEditor"
```

### 5.3 API/domain boundary

Do not delete existing full-image mask APIs or historical data unless a separate schema/API removal ticket is created. RB-104 removes the stale UI/product route and dead client code only.

If APIs become unused but still serve exports/tests/history, leave them and document the boundary.

---

## 6. Tests

### Unit

- Remove or update tests that assume `/edit` is a protected workspace path.
- Add route/link assertions that primary image actions point to crop workflow.
- Preserve tests for shared helpers still used by crop/correction editors.

### E2E

Update smoke coverage:

```text
image list -> Crop workflow
metadata page -> Crop workflow
crop BBox stage opens
crop semantic/support editors open from crop workflow
no Open editor / Full editor links are visible
```

Remove legacy full-image editor smoke expectations.

If assisted correction is retained, keep a focused correction E2E path that uses the correction-specific route.

---

## 7. Documentation Updates

Update:

```text
docs/00-overview/current-state.md
docs/01-architecture/app-router.md
docs/03-features/editor.md
docs/src/app/routes.md
docs/src/components/editor.md
docs/workflows/crop-workflow-ux-orchestration.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/testing/README.md
docs/08-adr/ADR-006-crop-workflow-ux-orchestration.md
docs/known-gaps.md
```

Docs must state that crop workflow is the annotation workflow and the old full-image editor route has been removed.

---

## 8. Acceptance Criteria

1. Full-image `/edit` route is removed.
2. No visible UI links route to `/edit`.
3. Full-image annotation client code is removed or split so only non-legacy surfaces remain.
4. Crop BBox workflow remains functional.
5. Crop support and semantic editors remain functional.
6. Assisted correction remains functional if still in product scope.
7. Tests are updated away from full-image editor smoke.
8. Docs updated.
9. Ticket is moved to done.
10. Full validation gate passes.

## 9. Implementation Notes

- Removed `/app/projects/[projectId]/images/[imageId]/edit` by deleting the App Router page and `EditImagePage`.
- Image list and metadata pages now expose `Crop workflow` as the annotation entry point and no longer link to the legacy full-image editor.
- `EditorClient` now has explicit non-legacy props for BBox-stage and assisted-correction use, with no `fullEditor` workflow mode.
- Full-image mask APIs and historical artifacts remain intact for compatibility/history; RB-104 removes product UI and route surface only.
- E2E smoke coverage was updated to exercise crop workflow annotation paths and old `/edit` workspace not-found behavior.
