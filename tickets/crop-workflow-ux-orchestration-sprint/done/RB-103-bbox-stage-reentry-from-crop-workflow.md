# RB-103 — BBox Stage Re-Entry From Crop Workflow

## Status

Proposed / Ready for Codex

## Priority

High

## Type

UX / Navigation / BBox Workflow / Crop Editor Integration / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-094 — Image-Level BBox Stage and Confirm BBox Set
- RB-095 — Slice Navigator with Whole-Image Context and Status Badges
- RB-101 — Embedded Slice Navigator and Ensure Current Crops

## Blocks

- RB-098 — Crop Workflow Smoke Test and Final Workflow Polish
- RB-104 — Remove Legacy Full-Image Editor Route and Surface, if navigation links overlap

---

## 1. Context

Manual smoke testing showed that users can lose an obvious path back to the BBox editor after BBoxes are created/confirmed and the workflow redirects into crop semantic/support editors.

The route itself exists:

```text
/app/projects/[projectId]/images/[imageId]/crop/bboxes
```

But the current crop workflow can redirect selected-slice navigator routes directly into the semantic crop editor. The crop editor header still exposes legacy `Editor` links, while the actual desired escape hatch is:

```text
Return to BBox stage
```

Annotators need this flexibility because BBoxes are rough crop work areas and may need adjustment after crop inspection.

---

## 2. Goal

Make the image-level BBox stage reachable from every crop workflow editing context.

At the end of RB-103:

1. User can return from crop semantic/support editing to the BBox stage.
2. The BBox stage remains usable after `BBOX_CONFIRMED`.
3. Confirmed BBoxes remain protected until the user explicitly unlocks editing.
4. Editing confirmed BBoxes marks the workflow as needing re-confirmation using the existing state model.
5. Crop workflow navigation no longer sends users to the legacy full-image editor.

---

## 3. Non-Goals

Do **not** implement:

- semantic family exclusivity,
- full-image editor removal; that is RB-104,
- new BBox review/approval semantics,
- new BBox persistence model,
- crop regeneration policy changes beyond preserving existing ensure/regenerate behavior.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with baseline:

```bash
git status --short
npm run lint
npm run typecheck
npm run test -- tests/integration/slice-bbox-workflow.test.ts tests/integration/slice-crop-workflow.test.ts tests/unit/crop-slice-navigator.test.ts
```

Run stronger validation before commit if the touched surface is broader.

---

## 5. Required UX Changes

### 5.1 Crop editor re-entry action

Add a visible action in both crop editor pages:

```text
Edit BBoxes
```

The action must link to:

```text
/app/projects/[projectId]/images/[imageId]/crop/bboxes
```

Do not link to:

```text
/app/projects/[projectId]/images/[imageId]/edit
```

### 5.2 Navigator rail action

If practical, add the same `Edit BBoxes` action in the right-side slice navigator rail so it remains visible while annotators scroll within the editor.

### 5.3 BBox stage after confirmation

When users open `/crop/bboxes` after confirmation:

```text
show existing BBoxes
show confirmed status
lock mutation controls by default
show explicit Edit BBoxes unlock action
after edits, require Re-confirm BBox set
```

This should reuse the current `BBOX_CONFIRMED` / `BBOX_NEEDS_UPDATE` behavior.

### 5.4 Remove legacy escape hatches from crop workflow

Replace crop-workflow `Editor` / `Full editor` links with crop-workflow actions:

```text
Image
Edit BBoxes
Semantic
Support
Refresh navigator
```

---

## 6. Tests

### Unit / integration

- BBox workflow status remains `BBOX_CONFIRMED` after navigation-only re-entry.
- Editing a confirmed BBox still produces `BBOX_NEEDS_UPDATE`.
- Re-confirming returns the workflow to `BBOX_CONFIRMED`.

### E2E

Extend the crop workflow smoke:

```text
upload image
draw BBoxes
confirm BBox set
continue to crop semantic editor
click Edit BBoxes
land on /crop/bboxes
confirmed set is visible and locked
unlock editing
replace or delete a BBox
workflow shows needs update
re-confirm BBox set
continue back to crop annotation
```

---

## 7. Documentation Updates

Update:

```text
docs/workflows/crop-workflow-ux-orchestration.md
docs/src/app/routes.md
docs/03-features/editor.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/testing/README.md
```

Docs must state that BBox confirmation is reversible workflow planning and that users can return to the BBox stage from crop editors.

---

## 8. Acceptance Criteria

1. `Edit BBoxes` is available from crop semantic and support editors.
2. `Edit BBoxes` opens `/crop/bboxes`.
3. Confirmed BBoxes are displayed but locked until explicit edit unlock.
4. BBox edits after confirmation require re-confirmation.
5. Crop workflow no longer points users to the legacy full-image editor.
6. Tests cover the re-entry path.
7. Docs updated.
8. Ticket is moved to done.
9. Relevant validation passes.
