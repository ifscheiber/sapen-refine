# RB-124 Refine BBox Editor Toolbar and Status UX Cleanup

## Context

The Refine Annotation Editor BBox stage currently shows a verbose toolbar/status/workflow area above the canvas. This area consumes vertical space, duplicates state, and does not match the visual style used in the Core Quick Analysis instance segmentation toolbar.

The BBox editor should become more canvas-focused and visually consistent with the existing Core annotation tooling.

## Goal

Clean up the BBox editor UI by removing the verbose workflow/status strip from the main canvas area, aligning the toolbar with the Core Quick Analysis instance segmentation toolbar, and moving persistent state into a more appropriate location.

## Scope

### In scope

- Remove the current workflow/status strip from the main BBox canvas area.
- Replace verbose toolbar button labels with icon-only controls.
- Reuse or match the visual styling of the Quick Analysis instance segmentation toolbar in `sapen-core`.
- Remove the explicit `Resize` button.
- Keep only the required BBox actions:
  - Add BBox;
  - Delete selected BBox;
  - Fit image;
  - Zoom slider.
- Add tooltips for all icon-only controls.
- Move BBox/Slice status to a right-rail status card or another compact location.
- Preserve or improve accessibility labels for icon-only buttons.

### Out of scope

- BBox autosave implementation.
- Automatic slice regeneration.
- BBox validation rule changes.
- Backend schema changes unless strictly necessary for UI state display.

## UX Decision

Preferred implementation:

Move the current BBox/workflow state into a right-rail status card below the existing slices/preview area.

Suggested right-rail card:

```text
BBoxes
2 valid · 0 issues
Save state: Saved
Slices: 0 current · 0 ready
Last action: BBox proposal replaced
```

Alternative accepted implementation:

A compact one-line header status may be used if the right rail layout becomes too crowded.

Do not keep the current full-width workflow/status strip in the main canvas area.

## Required behavior

### Toolbar

The toolbar should visually match the Core Quick Analysis instance segmentation toolbar:

- icon-only buttons;
- same button dimensions where feasible;
- same border/hover/active/disabled treatment;
- same tooltip behavior;
- consistent keyboard-focus styling;
- no text labels inside buttons except where unavoidable.

Recommended controls:

```text
[Add BBox] [Delete selected]        Zoom slider        [Fit]
```

### Resize removal

Remove the `Resize` button.

Rationale: resize behavior is already available through selected BBox handles. A separate resize mode adds complexity without providing a distinct user value.

### Status display

The following information should no longer be displayed as a full-width workflow strip above the canvas:

- BBox counts;
- BBox proposal messages;
- workflow instruction text;
- slice-readiness details;
- long-form status strings.

Move required persistent status into the right rail or compact header. Use toast messages for transient action feedback.

## Acceptance criteria

- The verbose workflow/status strip is no longer rendered in the main BBox canvas area.
- The BBox toolbar uses icon-only controls.
- The toolbar styling matches the Quick Analysis instance segmentation toolbar in `sapen-core`.
- The `Resize` button is removed.
- Tooltips explain all icon-only controls.
- Delete is disabled when no BBox is selected.
- The right rail or compact header shows the relevant BBox/Slice state without reducing canvas height.
- Existing BBox creation, deletion, selection, and slice preparation behavior remains functional.
- Existing tests are updated or added for removed/relocated UI elements.
- Documentation/screenshots are updated if applicable.

## Validation

Run the relevant Refine checks, for example:

```bash
npm run lint
npm run typecheck
npm run test
```

If the repo has targeted Refine UI tests, run the targeted suite for the Annotation Editor / BBox editor.

## Notes

This ticket intentionally does not change persistence or slice lifecycle behavior. Those are covered by follow-up tickets.
