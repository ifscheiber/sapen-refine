# DESIGN-010 — Tools-Only BBox Toolbar and Role-Based BBox Submission Semantics

## Status

Ready for implementation

## Type

Editor UX / BBox toolbar simplification / role-aware workflow ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only visual/layout reference. Do not import directly from `../sapen` at runtime unless the repo is intentionally configured for this.

## Background

After the recent BBox editor redesign, the toolbar still contains too much non-tool information and several controls that are unnecessary or conceptually wrong for the actual workflow.

Current problems:

- The toolbar mixes editing tools with status/metadata.
- The toolbar shows BBox counts and issue counts.
- The toolbar shows a BBox select dropdown.
- The toolbar shows selected geometry metadata.
- The toolbar includes `Confirmed`, `Edit BBoxes`, and `Continue to slice annotation` controls.
- BBoxes are treated as if they require a separate confirmation.
- The image/canvas loses vertical space because the BBox toolbar area is still too tall/noisy.

This must be simplified.

## Goal

Make the BBox toolbar a **true tools-only toolbar**.

The toolbar should contain only tools and direct editing controls needed while working on BBoxes.

Status and metadata should move out of the toolbar:

- BBox counts / validity / lock information → right rail below navigator or left sidebar `IMAGE SUMMARY`
- selected coordinate metadata → hidden by default, tooltip, status inspector, or right rail if genuinely useful
- active BBox selection → done by clicking the BBox on the canvas, not through a dropdown
- workflow actions → handled by tabs or role-based submit/confirm area, not mixed into the tool toolbar

## Required product decisions

### 1. Toolbar only contains tools

The BBox toolbar should contain only direct tools/actions for BBox editing.

Suggested toolbar contents:

```text
Select/Edit
Add BBox
Resize
Delete
Zoom
Fit
```

If move and resize are unified through selection handles, use:

```text
Select/Edit
Add BBox
Delete
Zoom
Fit
```

Zoom controls are required. The user must be able to zoom while editing BBoxes.

Possible zoom controls:

```text
Zoom slider
Zoom in
Zoom out
Fit
100%
```

Use whichever pattern matches the existing SaPen Core / Quick Analysis toolbars best.

### 2. Remove BBox select dropdown

Remove the BBox selection dropdown from the toolbar.

BBox selection should happen directly through interaction with the canvas:

- click on a BBox to select it
- selected BBox receives visible active styling
- active state updates after click
- keyboard shortcuts are optional only if already available

Reason:

- The dropdown consumes too much horizontal space.
- It adds noise.
- Canvas-based selection is the natural editing interaction.

### 3. Remove selected geometry metadata from toolbar

Remove from toolbar:

```text
Selected x 2089 · y 866 · 914 x 454 · v1
Confirmed by Admin
```

This metadata does not belong in a tool toolbar.

If still useful:

- move to right rail below navigator
- or show in tooltip/inspector
- or show only in a compact debug/details area
- or omit if not needed during normal editing

### 4. Remove redundant workflow buttons from toolbar

Remove:

```text
Confirmed
Edit BBoxes
Continue to slice annotation
```

Rationale:

- `Edit BBoxes` is unnecessary because the user is already in the BBox editor.
- `Continue to slice annotation` is unnecessary because navigation happens through the workspace tabs.
- `Confirmed` should not be a BBox-level action/status in the toolbar.

### 5. BBoxes are not independently “confirmed”

BBoxes should not have a separate final confirmation concept in the toolbar.

The final confirmation applies to the overall segmentation / annotation result, not to individual BBox editing as a separate confirmation flow.

Role-based workflow:

- A simple `Labeler` can edit and submit.
- A simple `Labeler` cannot confirm.
- An `Owner` can submit and may also confirm their own work if the existing role model allows this.
- Confirmation is role-based and applies to the broader segmentation/review state, not to a local toolbar `Confirmed` button for BBoxes.

Expected UI direction:

- If role is `Labeler`, show an appropriate submit action where the broader workflow expects it.
- If role is `Owner`, show submit/confirm affordances only in the correct review/workflow area.
- Do not show a misleading BBox-level `Confirmed` button in the toolbar.

Important:

This ticket should not invent a new backend role model. Codex must inspect the existing role/permission model and preserve it. If the necessary role-based confirmation workflow is not fully present yet, Codex should:

- remove misleading BBox confirmation UI
- keep existing safe save/submit behavior
- document the missing role-confirmation follow-up

## Information placement

### Move BBox state out of toolbar

The following information should not be in the toolbar:

```text
BBoxes 7 boxes · 5 valid · 1 issues · 1 locked
```

Move this to one of:

1. right rail below navigator image, as compact BBox state summary
2. left sidebar `IMAGE SUMMARY`
3. omit if redundant

Preferred:

- high-level image state in `IMAGE SUMMARY`
- BBox-specific state below navigator image if still helpful

Example right rail compact state:

```text
BBOXES
7 boxes · 5 valid · 1 issue · 1 locked
```

Example left sidebar image summary:

```text
BBoxes      7
Issues      1
Locked      1
```

Keep it compact.

### Warning placement

The overlap warning can remain visible, but not as part of the tool list.

Example compact warning row:

```text
⚠ BBox overlap detected. Move or resize boxes before continuing.
```

Place it below the toolbar or in a slim status strip, not as a toolbar control.

## Required UI structure

### BBox toolbar

Compact, one row preferred:

```text
[Select/Edit] [Add BBox] [Resize] [Delete]     [Zoom - 100% +] [Fit]
```

If the toolbar needs grouping:

```text
TOOLS      [Select/Edit] [Add BBox] [Resize] [Delete]
VIEW       [Zoom - 100% +] [Fit]
```

No metadata dropdown.
No BBox status counts.
No selected x/y/width/height line.
No confirmation buttons.
No continue button.

### Status/warning strip

Below toolbar, if needed:

```text
BBox overlap detected. Move or resize boxes before continuing.
```

Keep this strip compact.

### Right rail / image summary

Move BBox state summary there if useful:

```text
BBOXES
7 boxes · 5 valid · 1 issue · 1 locked
```

This should not consume much space.

## Safety rules from DESIGN-006 still apply

Keep these rules:

1. BBoxes must not overlap.
2. Overlap blocks save/submit/continue where applicable.
3. BBoxes with semantic/support mask dependencies must not be deleted accidentally.
4. If moving/resizing protected BBoxes would invalidate masks, block it or route through existing safe invalidation/replacement flow.
5. Protected BBoxes should show disabled delete or lock indication.

But these safety rules should be presented through:

- disabled tool states
- compact warnings
- right rail/image summary
- tooltips

not through a large toolbar metadata area.

## Required reference inspection

Inspect local BBox/editor implementation:

```text
src/features/editor/CropSemanticEditorPage.tsx
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/app/app/projects/[projectId]/images/ui.tsx
src/lib/projectsClient.ts
```

Inspect role/auth/permission helpers:

```text
src/lib
src/features
src/app/api
```

Search for:

```text
role
OWNER
Labeler
labeler
confirm
submit
review
permission
canConfirm
canSubmit
```

Inspect SaPen Core / Refine toolbar patterns only as read-only reference:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/apps/sapen-core/src/components/workspace
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
```

## Functional boundaries

Do not change:

- BBox coordinate storage format
- mask storage format
- label IDs
- semantic/support mask contracts
- Core handoff contracts
- project/image API contracts unless a tiny read-only UI-support addition is clearly needed
- auth/RBAC model
- canvas engine, unless only wiring existing interactions to simpler controls

Do not introduce:

- fake role model
- new confirmation backend
- large workflow refactor
- new component library
- CDN fonts/icons/Tailwind

## Acceptance criteria

### Toolbar cleanup

- [ ] Toolbar contains only editing/view tools.
- [ ] BBox count/status summary is removed from toolbar.
- [ ] BBox select dropdown is removed.
- [ ] Selected geometry metadata is removed from toolbar.
- [ ] `Confirmed` button/status is removed from toolbar.
- [ ] `Edit BBoxes` button is removed from toolbar.
- [ ] `Continue to slice annotation` button is removed from toolbar.
- [ ] Toolbar includes zoom controls.
- [ ] Toolbar fits in one compact row or at most two very compact rows.

### Interaction

- [ ] BBox selection works by clicking BBoxes on the canvas.
- [ ] Selected BBox has clear visual active state.
- [ ] Add BBox is available if supported.
- [ ] Resize/move/edit remains available if supported.
- [ ] Delete is available only when safe.
- [ ] Zoom works in BBox editing mode.

### Workflow semantics

- [ ] BBoxes are not presented as separately final-confirmed in the toolbar.
- [ ] Misleading BBox-level confirmation controls are removed.
- [ ] Existing safe save/submit behavior is preserved.
- [ ] If role-based submit/confirm flow exists, UI respects it.
- [ ] If role-based flow is incomplete, Codex documents the follow-up instead of inventing a backend.

### Safety

- [ ] Overlap warning remains visible in compact form.
- [ ] Overlap blocks unsafe progression/submission as currently intended.
- [ ] Protected/locked BBoxes cannot be deleted accidentally.
- [ ] Protected/locked state is communicated compactly outside the toolbar or via disabled tool state/tooltip.

### Layout

- [ ] Vertical space above the image is reduced.
- [ ] Normal BBox editing does not require top/down scrolling at desktop size.
- [ ] The image remains large enough for precise editing.

## Validation

Run repo-appropriate checks from `sapen-annotate`.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm run build
```

Run tests if relevant and feasible:

```bash
npm test
```

Manual smoke checklist:

1. Open BBox editor.
2. Verify toolbar is tools-only.
3. Verify old metadata/action controls are gone.
4. Select a BBox by clicking it on the canvas.
5. Add a BBox.
6. Move/resize selected BBox if supported.
7. Delete an unprotected BBox.
8. Attempt to delete a protected/locked BBox.
9. Verify overlap warning appears compactly.
10. Verify unsafe overlap blocks progression/submission.
11. Use zoom controls.
12. Switch to Semantic Masks tab via workspace tabs.
13. Verify editor still works.
14. Verify no vertical scrolling is needed just because of the toolbar.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement DESIGN-010: Tools-Only BBox Toolbar and Role-Based BBox Submission Semantics.

Goal:
Simplify the BBox toolbar so it contains only tools and direct view controls:
- Select/Edit
- Add BBox
- Resize if separate
- Delete if safe
- Zoom controls
- Fit

Remove from the toolbar:
- BBoxes count/status summary
- BBox select dropdown
- Selected x/y/width/height metadata
- Confirmed button/status
- Edit BBoxes button
- Continue to slice annotation button

Selection must happen by clicking the BBox on the canvas, not through a dropdown.

Move BBox state information such as “7 boxes · 5 valid · 1 issue · 1 locked” to the right rail below the navigator image or to the left sidebar IMAGE SUMMARY, not the toolbar.

Keep overlap/protection warnings compact and outside the tool list.

Important workflow semantics:
BBoxes are not separately final-confirmed. Final confirmation applies to the overall segmentation/review result and is role-based:
- Labeler can submit but not confirm.
- Owner can submit and confirm if existing role model allows it.
Do not invent a new backend. Inspect existing role/permission logic. Remove misleading BBox-level confirmation UI and document follow-up if role-based submit/confirm is not fully implemented.

Preserve:
- BBox logic
- canvas interactions
- mask storage
- semantic/support mask behavior
- Core handoff contracts
- auth/RBAC model
- API contracts

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. How toolbar was simplified
D. How BBox selection by canvas click works
E. Where BBox status info moved
F. How role-based confirmation semantics are handled or what follow-up remains
G. Validation results
```

## Suggested commit message

```text
Simplify BBox toolbar and remove misleading confirmation controls
```
