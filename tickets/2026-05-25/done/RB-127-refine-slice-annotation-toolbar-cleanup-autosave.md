# RB-127 Refine Slice Annotation Toolbar Cleanup and Autosave

## Context

The Refine Slice Annotation editor currently uses a very tall and verbose toolbar/header area above the canvas. It includes status text, annotation family information, labels, tool instructions, drawing tools, and action buttons across multiple rows. This consumes vertical editor space and makes the annotation canvas smaller than necessary.

The Slice Annotation toolbar should follow the same visual language as the Core Quick Analysis semantic segmentation toolbar and the cleaned-up BBox editor toolbar:

- compact;
- icon-first;
- tooltip-driven;
- canvas-focused;
- with persistent state moved to the right rail.

Current UX issue: semantic mask edits must be manually committed. If the user changes slices before committing, edits may be lost or redrawn, which is a bad annotation workflow.

## Goal

Simplify the Slice Annotation editor toolbar, align it with the Core Quick Analysis semantic segmentation toolbar, move informational/status content to the right rail, remove redundant polygon action buttons, and replace manual commit with autosave.

## Scope

### In scope

- Refactor the Slice Annotation toolbar into a compact, preferably single-row toolbar.
- Match the visual style of the Core Quick Analysis semantic segmentation toolbar.
- Use icon-only buttons for drawing tools and action tools.
- Move explanatory/status rows out of the main canvas header area.
- Move annotation state and tool help to the right rail.
- Remove the `Unknown` label from this workflow.
- Remove redundant toolbar buttons:
  - `Apply polygon`;
  - `Close polygon`;
  - `Cancel`;
  - `Commit semantic mask`.
- Add autosave for committed semantic mask operations.
- Ensure safe slice switching when there are dirty semantic edits.
- Reuse the BBox editor zoom component/hook and behavior.

### Out of scope

- Semantic label model redesign beyond removing `Unknown` from this workflow.
- Backend schema redesign unless required to persist autosave state safely.
- BBox editor changes already covered by RB-124 through RB-126.
- Export pipeline changes beyond readiness/status display.
- New annotation tools beyond existing polygon/lasso/brush.

## UX direction

The editor should move from this vertical structure:

```text
status row
family row
labels row
instruction row
action row
canvas
```

to this:

```text
compact icon toolbar row
canvas
```

Persistent state and help should move to the right rail.

## Required changes

### 1. Compact icon-only toolbar

Refactor the toolbar to match the Core Quick Analysis semantic segmentation toolbar.

Toolbar requirements:

- icon-only buttons for drawing tools and actions;
- compact segmented controls for family and labels;
- tooltips for all icon-only controls;
- accessible labels for screen readers;
- same button height, border, hover, active, disabled, and focus states as the Core toolbar where feasible;
- shared toolbar primitives/styles should be reused where feasible.

Suggested compact toolbar layout:

```text
[S/H] [Cu]   [Bg] [Sap] [Heart]   [Polygon] [Lasso] [Brush]   [Undo] [Redo] [Fit]   Zoom
```

For the Cu family:

```text
[S/H] [Cu]   [Bg] [Cu]            [Polygon] [Lasso] [Brush]   [Undo] [Redo] [Fit]   Zoom
```

Drawing tools must be represented by icons only:

- polygon icon;
- lasso/freehand icon;
- brush icon;
- undo/redo icons;
- fit icon.

### 2. Move info/status to the right rail

Remove informational/status text rows from above the canvas.

Move these items to the right rail:

- annotation family;
- current label;
- save state;
- classification state;
- export readiness;
- support mask/source information;
- current tool help;
- semantic draft status;
- relevant validation issues.

Suggested right rail card:

```text
Current slice
Family: Sapwood / Heartwood
Label: Sapwood
Tool: Polygon
Save: Saved
Readiness: not ready
Support: semantic foreground
Issue: classification missing
```

Suggested tool help card for polygon:

```text
Polygon
Click to add points.
Double-click or press Enter to apply.
Press Esc to cancel.
Drag points to refine.
```

The main canvas area must gain vertical space after this change.

### 3. Remove `Unknown` label

For this workflow, `Unknown` is not needed and should not be shown.

For Sapwood/Heartwood family, labels should be:

- Background;
- Sapwood;
- Heartwood.

For Cu family, labels should be:

- Background;
- Cu.

If old data or backend contracts still allow `Unknown`, it may remain as an internal value for compatibility, but the current annotation UI should not offer it as a selectable label.

### 4. Remove redundant action buttons

Remove these toolbar buttons:

- `Apply polygon`;
- `Close polygon`;
- `Cancel`;
- `Commit Sap/Heartwood semantic mask` / `Commit semantic mask`.

Canvas/keyboard interactions should replace them:

- double-click closes/applies polygon;
- Enter applies polygon;
- Escape cancels current polygon;
- clicking the first point may close/apply polygon if this is already supported or easy to add;
- brush/lasso operations commit locally on pointer up;
- autosave persists committed edits.

If a manual save/debug action remains useful, it must not be a primary toolbar button. Put it into the right rail as a secondary action, for example:

```text
Save now
```

or

```text
Retry save
```

only when relevant.

### 5. Autosave semantic mask edits

Semantic mask edits must autosave after committed user operations.

Autosave triggers:

- polygon applied;
- lasso operation completed;
- brush stroke completed;
- erase/clear operation completed, if supported;
- undo/redo applied;
- label/family change if it mutates the semantic draft;
- pending dirty edits before slice switch.

Autosave must happen after operation completion, not during every pointer movement.

Recommended model for brush/lasso:

```text
pointerdown → draw locally
pointermove → update local canvas only
pointerup → commit local operation → debounce autosave
```

Recommended debounce after committed operation:

```text
500–800 ms
```

If the editor already has robust operation-end events, saving immediately after operation end is acceptable.

### 6. Save state and failure handling

Show minimal save-state feedback in the right rail or compact status location:

- `Saving…`;
- `Saved`;
- `Save failed`.

Save failures must not be silent.

If save fails:

- keep the local edited mask visible;
- mark the slice/draft dirty;
- show a retry affordance if available;
- prevent accidental loss on slice switch unless there is robust local draft persistence.

### 7. Safe slice switching

When switching to another slice:

- pending dirty changes must be saved first;
- next slice should not replace the editor state until save succeeds, unless robust local draft preservation exists;
- failed save should show a clear error and prevent accidental loss.

This fixes the current UX issue where uncommitted edits can be lost or redrawn when changing slices.

### 8. Shared zoom behavior

Reuse the BBox editor zoom component/hook and behavior.

Zoom requirements:

- same slider and Fit control as BBox editor;
- preserve viewport center where possible;
- keep image horizontally centered relative to the visible canvas area;
- avoid unexpected image drift during slider zoom;
- Fit should fit the image to the available viewport and center it horizontally and vertically where possible.

## Acceptance criteria

- Slice Annotation toolbar is reduced to a compact toolbar, preferably one row.
- Drawing tools are icon-only.
- Tooltips and accessible labels exist for all icon-only controls.
- Toolbar styling matches the Core Quick Analysis semantic segmentation toolbar where feasible.
- Top informational/status/instruction rows are removed from the main canvas header area.
- Right rail shows annotation family, current label, save state, readiness, support information, and current tool help.
- `Unknown` label is no longer offered in the Slice Annotation UI.
- `Apply polygon`, `Close polygon`, `Cancel`, and `Commit semantic mask` buttons are removed from the primary toolbar.
- Polygon can be applied via canvas/keyboard interaction.
- Semantic mask edits autosave after committed operations.
- Save state is visible.
- Save failures are surfaced.
- Switching slices does not lose dirty edits.
- Zoom behavior matches the BBox editor zoom behavior.
- Existing annotation operations still work for polygon, lasso, and brush.
- Relevant UI tests are updated or added.

## Suggested tests

Add/update tests for:

- toolbar no longer renders removed buttons;
- drawing tools render as icon-only buttons with accessible labels;
- `Unknown` label is not available;
- right rail shows current family/label/save state;
- polygon apply through Enter or double-click;
- Escape cancels current polygon;
- brush/lasso autosave after pointer up;
- slice switch flushes dirty changes;
- failed save blocks or safely preserves dirty state;
- zoom component is shared or behavior matches BBox editor.

## Validation

Run the relevant Refine checks, for example:

```bash
npm run lint
npm run typecheck
npm run test
```

If targeted tests exist, run the Annotation Editor / Slice Annotation test suite.

## Notes

This ticket should likely follow RB-124 through RB-126 because it can reuse:

- compact icon toolbar primitives;
- right-rail status patterns;
- autosave state patterns;
- shared zoom component/hook.
