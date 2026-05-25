# DESIGN-004C — Replace BBox Instruction Panel with Compact SaPen Core-Style Toolbar

## Status

Completed

## Implementation notes

- Replaced the large BBox instruction card with a compact dark toolbar.
- Proposal chips, selected geometry metadata, replace/delete, edit-unlock, confirm/re-confirm, and continue actions remain available with the existing enabled/disabled rules.
- Removed the visible `Step 1: Mark slice work areas` treatment from the BBox stage.

## Type

Design / BBox toolbar ticket

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


## Useful read-only reference areas in `../sapen`

Use these as visual/layout references only:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/quick-analysis/components
../sapen/apps/sapen-core/src/features/image-review
../sapen/apps/sapen-core/src/features/experiments/preparation/images
../sapen/apps/sapen-core/src/components/workspace
../sapen/apps/sapen-core/src/features/shell
../sapen/packages/ui/src/styles/theme.css
```

Because exact file names may differ, use `rg` inside `../sapen/apps/sapen-core/src/features` for terms such as:

```text
toolbar
Toolbar
Instance
Segmentation
Image
QuickAnalysisTopBars
SliceBrowser
CanvasSurface
```

Reference goal:
The BBox editor toolbar should visually resemble the compact SaPen Core image/quick-analysis/instance-segmentation toolbars, not the current large instruction card.


## Goal

Replace the large grey/green BBox instruction box with a compact toolbar similar to the SaPen Core Images / Quick Analysis / instance-segmentation toolbar style.

The BBox editor should feel like an editor mode, not a guided form page.

## Current problem

The current BBox editor contains a large instruction card:

- `Step 1: Mark slice work areas`
- long explanatory copy
- proposal chips inside the large panel
- selected source pixels text
- action buttons inside the large panel

This takes too much space and visually differs from the rest of the editor.

## Required UI

Create a compact BBox toolbar area above the canvas.

Suggested toolbar groups:

### Mode / helper

```text
BBOX WORK AREAS
Draw rough boxes around visible slices.
```

This should be compact microcopy, not a large card.

### Proposal selection

Show proposal chips compactly:

```text
Proposal 1 1029 × 623
Proposal 2 1023 × 551
Proposal 3 944 × 518
Proposal 4 957 × 531
```

Active proposal uses indigo/violet active styling.

### Geometry info

Show selected geometry compactly:

```text
SELECTED  x 1991 · y 536 · 1029 × 623 · v1
```

This should be a metadata row or small inline text, not a large paragraph.

### Actions

Use compact buttons:

```text
Edit BBoxes
Replace geometry
Delete proposal
Continue to slice annotation
```

Disable unavailable actions instead of hiding if that is current behavior.

Primary action:

```text
Continue to slice annotation
```

Secondary actions should be subtle.

## Visual style

Mirror SaPen Core toolbar style:

- dark panel background
- thin top/bottom border
- compact height
- grouped controls
- uppercase micro-labels
- indigo/violet active states
- muted disabled states
- no large green/grey card
- no large instructional area

Use `../sapen` only as read-only visual reference.

## Functional boundary

Do not change:

- BBox proposal generation
- proposal data model
- geometry replacement logic
- deletion logic
- confirmation logic
- route/API contracts

Only restyle/restructure the controls.

## Acceptance criteria

- [ ] Large BBox instruction panel is removed.
- [ ] BBox controls render as compact editor toolbar.
- [ ] Proposal chips remain usable.
- [ ] Selected geometry metadata remains visible but compact.
- [ ] Existing BBox actions remain available.
- [ ] Primary flow to continue to slice annotation remains clear.
- [ ] BBox canvas/image area gains vertical space.

## Codex implementation prompt

```text
Implement DESIGN-004C in the sapen-annotate repository.

Goal:
Replace the large BBox instruction panel with a compact SaPen Core-style toolbar above the canvas.

Keep:
- proposal chips
- selected geometry metadata
- Edit BBoxes
- Replace geometry
- Delete proposal
- Continue to slice annotation

Do not change BBox logic, proposal generation, route/API contracts, or canvas behavior.

Use ../sapen SaPen Core image/quick-analysis/instance-segmentation toolbar patterns as read-only visual reference.

Run validation and report results.
```
