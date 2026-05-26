# DESIGN-006 — BBox Editor Toolbar and Safety Guardrails

## Status

Completed

## Implementation notes

- Replaced the BBox-stage proposal/selected/action block with a compact toolbar showing BBox counts, validity, lock state, tool controls, selected geometry, confirm/re-confirm, and continue actions.
- Added direct BBox-stage canvas interaction for Add BBox, Select/Edit move, selected-handle resize, and safe Delete.
- Added additive `/api/images/[imageId]/slice-bboxes` metadata: `bboxIssues`, `bboxSummary`, and per-box dependency/protection summaries. Existing `image`, `myRole`, `canEdit`, `boxes`, and `bboxWorkflow` fields remain.
- Enforced server-side no-overlap rules for create, replace, and confirm. Edge-touching BBoxes remain valid; positive intersections fail with `BBOX_OVERLAP`.
- Enforced server-side dependency protection for BBoxes with semantic mask, support/instance mask, or classification versions. Delete fails with `BBOX_DELETE_PROTECTED_DEPENDENCIES`; geometry mutation fails with `BBOX_GEOMETRY_PROTECTED_DEPENDENCIES`.
- Kept derived crops as non-blocking dependencies because crop history is append-only and stale/current crop state already handles BBox lineage.
- Preserved routes, storage contracts, mask formats, review/export contracts, auth/RBAC, and Core handoff behavior.

## Type

Editor UX / BBox interaction / safety-guard ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as visual/layout/reference material. Do not port editor logic from SaPen Core unless explicitly safe and local contracts are preserved.

## Background

The current BBox editor redesign did not yet capture the intended workflow.

The current UI still shows a large proposal/selected/action block similar to:

```text
BBOX WORK AREAS
PROPOSALS
Proposal 1 ...
Proposal 2 ...
SELECTED x ... y ... width ...
Replace geometry
Delete proposal
Re-confirm BBox set
Continue to slice annotation
```

This block should be removed completely and replaced by a compact BBox editing toolbar.

The BBox editor must let the user directly work with bounding boxes:

- add new BBoxes
- select BBoxes
- move BBoxes
- resize BBoxes
- delete BBoxes where safe
- confirm/re-confirm the BBox set
- continue to slice annotation

The image/canvas must remain large. Vertical space must not be wasted. Users should not have to scroll vertically just because of the toolbar.

## Goal

Replace the current proposal-heavy BBox panel with a compact SaPen-Core-style BBox toolbar and enforce the key BBox safety rules:

1. Users can create, select, move, resize, and delete BBoxes through toolbar/canvas interaction.
2. BBoxes must not overlap.
3. BBoxes that already have dependent semantic segmentation or support mask data must not be deleted unless the dependent data is explicitly removed in a safe destructive flow.
4. The toolbar must be compact enough that the image remains large and no vertical scrolling is required during normal editing.

## Important distinction

This is not just a visual cleanup. The BBox editor toolbar must expose the real BBox editing capabilities.

However, Codex must not rewrite the full canvas engine or change storage contracts. Reuse existing local BBox interaction logic wherever possible.

## Reference inspection

Inspect local SaPen Annotate BBox/editor files first. Likely relevant files include:

```text
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/app/app/projects/[projectId]/images/[imageId]/bbox
src/app/app/projects/[projectId]/images/ui.tsx
src/lib/projectsClient.ts
```

If paths differ, locate the equivalent files.

Inspect SaPen Core / SaPen Refine only as read-only visual/layout references:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/apps/sapen-core/src/components/workspace
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
```

Use `rg` for terms such as:

```text
bbox
BBox
bounding
proposal
geometry
overlap
delete
resize
drag
```

## Required UI

### Remove current block

Remove the large current BBox/proposal block entirely from the default BBox editor UI.

Specifically remove the persistent vertical space used by:

- `BBOX WORK AREAS` large section
- proposal chip rows as a large area
- selected coordinate row as a large separate row
- large action-row layout
- duplicated re-confirm/continue controls if they waste vertical space

This information may be reintroduced compactly inside the toolbar where needed.

### Add compact BBox toolbar

Replace it with a compact toolbar above the canvas.

The toolbar should be one compact row if possible, or two very compact rows maximum.

Suggested groups:

#### Mode / status

```text
BBOXES
4 boxes · 4 valid · 0 issues
```

If there are issues:

```text
BBOXES
4 boxes · 1 overlap issue
```

#### Tools

```text
Select / Move
Add BBox
Resize
Delete
```

Behavior:

- `Select / Move`: select a BBox and drag it.
- `Add BBox`: create a new BBox by dragging on the canvas.
- `Resize`: select a BBox and resize via handles.
- `Delete`: delete selected BBox only when deletion is safe.

If move and resize are already unified through selection handles, the toolbar can use:

```text
Select / Edit
Add BBox
Delete
```

#### Proposal/helper actions

If BBox proposals still exist and are useful, expose them compactly:

```text
Use proposals
```

or:

```text
Proposals: 10
```

Do not show all proposal chips by default if that wastes vertical space.

If proposals must be selectable, place them in a compact dropdown/popover, not a multi-row chip block.

#### Primary actions

```text
Re-confirm BBox set
Continue to slice annotation
```

Keep these compact and right-aligned if possible.

Use `Continue to slice annotation` as the primary action only when the BBox set is valid.

### Canvas interaction expectations

The canvas should support the intended editing workflow:

- BBoxes have visible borders.
- Selected BBox has clear active styling.
- Resize handles are visible for the selected BBox.
- Dragging moves the selected BBox if allowed.
- Dragging handles resizes the selected BBox if allowed.
- Add mode allows drawing a new BBox.
- Delete removes selected BBox only when safe.

If some interaction already exists but is hidden or awkward, surface it. If major interaction support is missing, implement the smallest safe local addition or document a follow-up if it would require a canvas-engine rewrite.

## Safety rules

### Rule 1: No overlapping BBoxes

BBoxes must not overlap.

Implement or preserve validation that prevents saving/re-confirming overlapping BBoxes.

Expected behavior:

- While editing, overlap should be visibly indicated if detected.
- `Re-confirm BBox set` and `Continue to slice annotation` must be disabled while overlaps exist.
- A compact warning should explain the issue:

```text
BBox overlap detected. Move or resize boxes before continuing.
```

Overlap validation should run for:

- newly added boxes
- moved boxes
- resized boxes
- imported/applied proposal sets

Do not silently accept overlapping BBoxes.

### Rule 2: Do not delete BBoxes with dependent masks

If a BBox/slice already has semantic segmentation or support mask data, deleting its BBox must be blocked unless the dependent data is explicitly removed through a safe destructive flow.

Dependencies include, where modeled:

- semantic segmentation mask
- support mask
- committed semantic draft
- committed support draft
- slice classification if it is tied to the BBox/slice
- any persisted crop/slice data that would become orphaned

Expected default behavior:

- Delete button is disabled for protected BBoxes.
- Tooltip or inline compact message:

```text
Cannot delete: semantic/support data exists for this slice.
```

If a full destructive removal flow already exists, Codex may wire to it only if safe and explicit:

```text
Delete slice and all dependent masks
```

This must require explicit confirmation.

If no such flow exists, do not implement destructive deletion in this ticket. Disable delete and document a follow-up.

### Rule 3: Preserve dependent data on move/resize only if safe

If a BBox already has semantic/support masks, moving/resizing the BBox may invalidate dependent crop/mask geometry.

Codex must inspect the existing local behavior.

- If the system already supports safe geometry replacement and downstream invalidation, preserve that behavior.
- If changing geometry would orphan or desynchronize masks, block resize/move for protected BBoxes or require an explicit re-confirm/invalidating action that already exists.
- Do not invent an unsafe geometry mutation.

Minimum safe behavior:

- Protected BBoxes may be selectable.
- Protected BBoxes may show locked status.
- Delete is blocked.
- Move/resize is blocked or routed through existing safe replacement flow.

## Vertical space / layout requirement

This is critical.

The toolbar must not consume excessive vertical space.

Design target:

- compact toolbar height comparable to SaPen Core Quick Analysis toolbar
- one or two compact rows maximum
- no large instruction panels
- no multi-row proposal chip fields by default
- canvas image should remain large enough for precise editing
- normal editing should not require top/down scrolling

## Visual style

Use the established SaPen Annotate / SaPen Core design style:

- dark toolbar surface
- thin muted borders
- compact grouped controls
- uppercase micro-labels
- indigo/violet active states
- amber for overlap/protection warnings
- muted disabled controls
- no green debug-style panels
- no large grey instruction blocks

## Functional boundaries

Do not change:

- mask label IDs
- mask serialization format
- storage key conventions
- Core handoff contracts
- semantic/support mask commit contracts
- auth/RBAC
- project/image upload APIs

Do not rewrite:

- the entire editor canvas
- semantic mask drawing logic
- support mask drawing logic

## Acceptance criteria

### UI

- [x] The screenshot-shown proposal/selected/action block is removed from the default BBox editor UI.
- [x] A compact BBox toolbar replaces it.
- [x] Toolbar exposes add/select-move/resize/delete capabilities or the closest safe equivalent supported by existing logic.
- [x] Proposal selection, if still needed, is compact and does not consume multiple rows by default.
- [x] The canvas remains large and normal BBox editing does not require vertical scrolling.
- [x] UI matches SaPen Core compact toolbar style.

### BBox editing

- [x] User can add a new BBox where supported.
- [x] User can select an existing BBox.
- [x] User can move an editable BBox where safe.
- [x] User can resize an editable BBox where safe.
- [x] User can delete an editable, unprotected BBox.
- [x] Protected BBoxes cannot be deleted by accident.

### Safety

- [x] Overlapping BBoxes cannot be confirmed/continued.
- [x] Overlap is detected after add/move/resize/proposal application.
- [x] BBoxes with semantic/support mask dependencies cannot be deleted unless a full explicit destructive flow exists.
- [x] If protected BBox geometry cannot safely change, move/resize is blocked or routed through existing safe invalidation flow.
- [x] User sees compact explanations for disabled actions.

### Regression

- [x] Existing BBox proposal workflow still works if required by current data model.
- [x] Existing re-confirm BBox set behavior still works.
- [x] Existing continue-to-slice-annotation flow still works.
- [x] Semantic/support mask editor behavior is unchanged.
- [x] Existing tests are updated only for UI changes and new guardrails.

## Validation

Completed validation:

- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run test` - passed, 56 files / 284 tests.
- `npm run build` - passed.
- `npm run check:design-hardcoding` - passed.
- `npm run check:docs-links` - passed.
- `npx vitest run tests/unit/slice-domain.test.ts tests/unit/editor-canvas-geometry.test.ts` - passed.
- `npx vitest run tests/integration/slice-bbox-workflow.test.ts` - passed.
- `npx playwright test tests/e2e/slice-bbox-proposals.spec.ts` - passed.
- `git diff --check` - passed.

Run repo-appropriate checks from `sapen-annotate`.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If different scripts exist, use the correct ones.

Manual smoke checklist:

1. Open an image with existing BBoxes.
2. Verify compact BBox toolbar is visible and old block is gone.
3. Add a new BBox.
4. Select and move an editable BBox.
5. Resize an editable BBox using handles or equivalent UI.
6. Delete an unprotected BBox.
7. Attempt to create overlapping BBoxes and verify confirmation/continue is blocked.
8. Attempt to delete a BBox with semantic/support data and verify deletion is blocked or requires explicit destructive confirmation.
9. Re-confirm a valid BBox set.
10. Continue to slice annotation.
11. Verify Semantic Masks tab still works.
12. Verify Support Mask tab still works.
13. Verify no vertical scrolling is needed for normal BBox editing at desktop size.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-006: BBox Editor Toolbar and Safety Guardrails.

Goal:
Replace the current proposal-heavy BBox block with a compact SaPen-Core-style BBox toolbar that supports real BBox editing:
- add BBox
- select/move BBox
- resize BBox
- delete BBox where safe
- re-confirm BBox set
- continue to slice annotation

Remove the screenshot-shown large BBOX WORK AREAS / PROPOSALS / SELECTED block from the default UI.

Important:
The toolbar must be compact. Avoid vertical space waste. Normal BBox editing should not require top/down scrolling and the image must remain large.

Safety rules:
1. BBoxes must not overlap. Confirmation/continue must be blocked while overlaps exist.
2. BBoxes with existing semantic segmentation or support mask data must not be deleted unless there is an explicit destructive flow that removes all dependent data.
3. If moving/resizing protected BBoxes would invalidate masks, block it or use an existing safe invalidation/replacement flow. Do not invent unsafe geometry mutation.

Inspect local BBox/editor code first. Use ../sapen only as read-only visual/reference material.

Do not change:
- canvas engine unless a minimal local interaction addition is clearly safe
- mask storage format
- mask label IDs
- semantic/support mask contracts
- Core handoff contracts
- auth/RBAC
- project/image APIs

Run typecheck/lint/tests/build if available.

Report:
A. What changed
B. Files changed
C. How BBox add/move/resize/delete is surfaced
D. How overlap validation works
E. How protected BBoxes are detected and guarded
F. Validation results
G. Follow-ups if any interaction support is still missing
```

## Suggested commit message

```text
Refine BBox editor toolbar and guard unsafe geometry changes
```
