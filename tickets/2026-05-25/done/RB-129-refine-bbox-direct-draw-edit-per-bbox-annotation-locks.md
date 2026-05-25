# RB-129 Refine BBox Direct Draw/Edit Mode and Per-BBox Annotation Locks

## Context

The Refine BBox editor currently requires the user to repeatedly click an `Add BBox` button before drawing new BBoxes. This becomes very inefficient when many BBoxes need to be created. The editor also appears to use mode/edit-lock behavior that prevents natural correction of BBoxes unless editing is manually unlocked.

For high-volume crop/slice setup, the BBox editor should behave more like a direct manipulation canvas:

- draw new BBoxes by dragging on empty image space;
- select/edit existing BBoxes directly;
- deselect by clicking empty space;
- autosave committed changes;
- only lock BBoxes when changing them would invalidate existing downstream annotations.

The current persistent `Regenerate slices` button in the right rail is also unnecessary if slice generation is automatic and stale-state driven.

## Goal

Replace the mode-heavy BBox workflow with a direct Select/Edit/Draw interaction model, remove the need to repeatedly click `Add BBox`, remove manual edit unlock for normal BBoxes, and introduce per-BBox locks only when semantic/support annotation data already exists for that generated slice.

## Scope

### In scope

- Change BBox default interaction model to combined Select/Edit/Draw.
- Allow creating new BBoxes by dragging on empty image area.
- Allow selecting existing BBoxes by clicking them.
- Allow moving/resizing existing editable BBoxes directly via canvas and handles.
- Allow deselecting by clicking empty image/canvas area without dragging.
- Remove or demote the `Add BBox` button.
- Remove manual edit unlock for normal editable BBoxes.
- Add per-BBox lock rules based on downstream annotation existence.
- Add destructive confirmation flow when attempting to modify a locked BBox.
- Remove persistent `Regenerate slices` button from the right rail.
- Keep contextual retry only if slice generation fails.
- Ensure autosave/slice stale-state logic from RB-125/RB-126 remains compatible.

### Out of scope

- Redesigning semantic/support annotation tools.
- Changing BBox validation thresholds.
- Changing export format or downstream metric computation.
- Reworking the entire right rail beyond removing persistent regenerate action and showing lock/status information.
- Full implementation of autosave if RB-125 is not implemented yet; this ticket should integrate with RB-125 behavior when available.

## Interaction model

### Default mode: Select/Edit/Draw

The BBox editor should not require users to switch modes for common actions.

Required behavior:

- Click existing BBox → select it.
- Drag selected BBox body → move it, if editable.
- Drag selected BBox handle → resize it, if editable.
- Drag empty image area → create a new BBox.
- Click empty image/canvas area without dragging → deselect current BBox.
- Press Delete/Backspace or click trash icon → delete selected editable BBox.
- If the selected BBox is locked, delete/edit actions require explicit destructive confirmation or are disabled with explanation.

### Add BBox button

The `Add BBox` button should no longer be required for normal drawing.

Preferred implementation:

- Remove the `Add BBox` button from the primary toolbar.

Acceptable alternative:

- Keep it only as an optional helper action or shortcut hint, but dragging empty canvas must still create a BBox by default.
- The button must not be required for each new BBox.

### Manual edit unlock

There should be no global/manual edit unlock for normal BBoxes.

A BBox is editable by default unless it is individually locked because downstream annotation data exists for its generated slice.

## Per-BBox downstream lock

### Lock condition

A BBox should become locked only if changing it would invalidate existing downstream annotation data.

A BBox is locked if its generated slice has any of the following:

- semantic annotation draft;
- committed semantic mask/version;
- support mask;
- explicit correction/refinement mask tied to that slice;
- downstream export/evaluation artifact tied to that slice, if applicable in current data model.

Locking must be per BBox, not global.

Examples:

```text
BBox A: no semantic/support annotation → editable
BBox B: semantic mask exists → locked
BBox C: support mask exists → locked
BBox D: slice stale but no semantic/support annotation → editable, stale slice can be regenerated
```

### Locked BBox UI

Locked BBoxes should remain visible and selectable.

When selected, the UI should indicate that the BBox is locked and why:

```text
Locked: this BBox already has semantic/support annotation.
```

The right rail should show lock status for the selected BBox:

```text
Selected BBox
Status: Locked
Reason: semantic mask exists
```

or:

```text
Selected BBox
Status: Editable
```

### Attempting to edit a locked BBox

If the user tries to move/resize/delete a locked BBox, show a confirmation dialog instead of silently blocking or allowing accidental invalidation.

Suggested dialog copy:

```text
This BBox already has semantic/support annotations.

Changing this BBox will delete the existing annotations for its generated slice and regenerate the slice from the new BBox geometry.

This action cannot be undone automatically.

Do you want to continue?
```

Buttons:

- Cancel
- Delete annotations and unlock BBox

If possible, list the affected artifacts:

```text
Will delete:
- semantic mask draft/version for this slice
- support mask for this slice
- generated slice image will be regenerated
```

### Confirmation behavior

If the user confirms:

1. Delete or invalidate downstream semantic/support annotations for that BBox/slice.
2. Mark the generated slice as stale or delete it.
3. Unlock the BBox.
4. Allow the edit operation.
5. Autosave the changed BBox geometry.
6. Regenerate the slice automatically according to RB-126 lifecycle rules.

If the user cancels:

- no downstream data is deleted;
- the BBox remains locked;
- no geometry change is applied.

## Slice lifecycle integration

This ticket assumes the automatic stale/missing slice lifecycle from RB-126.

Required behavior:

- New BBox creation marks slice as missing.
- BBox move/resize marks generated slice as stale.
- If no downstream semantic/support annotation exists, slice regeneration can happen automatically.
- If downstream semantic/support annotation exists, BBox is locked until destructive confirmation.
- Stale/missing slices are generated automatically when:
  - switching away from BBox tab;
  - opening Slice Annotation;
  - running export readiness checks;
  - or any existing RB-126 trigger.

## Remove persistent `Regenerate slices` button

The right rail should not show a persistent `Regenerate slices` button in normal operation.

Rationale:

- Slice generation should be automatic and state-driven.
- Users should not need to manage slice lifecycle manually.
- A persistent button suggests manual workflow and clutters the right rail.

Accepted replacement:

- Show no button when slice state is healthy.
- Show only contextual action if generation failed:

```text
Slice generation failed.
[Retry]
```

The retry button should only appear in failure state.

## Toolbar implications

After this ticket, the BBox toolbar can be even smaller.

Recommended toolbar controls:

```text
[Delete selected]     [Zoom slider]     [Fit]
```

Optional controls:

- Add BBox helper, if retained, but not required.
- Undo/Redo, if supported by editor state.

No `Resize` button.
No persistent `Regenerate slices` button.
No manual edit unlock button.

## User feedback

Provide minimal but clear feedback:

- BBox saved / Saving / Save failed.
- BBox locked and reason.
- Destructive confirmation when modifying locked BBox.
- Slice stale/missing counts in right rail.
- Slice generation failure with contextual retry.

Avoid verbose workflow instructions in the main canvas area.

## Acceptance criteria

### Direct draw/edit

- Dragging empty image area creates a new BBox without pressing `Add BBox`.
- Clicking an existing BBox selects it.
- Clicking empty image/canvas area without dragging deselects current BBox.
- Existing editable BBoxes can be moved/resized directly.
- No manual edit unlock is required for editable BBoxes.
- `Add BBox`, if still present, is not required for normal drawing.

### Per-BBox lock

- Locking is per BBox, not global.
- BBoxes without semantic/support annotation remain editable even if other BBoxes have annotated slices.
- BBoxes with semantic/support annotation are locked.
- Locked BBoxes are selectable and explain why they are locked.
- Attempting to edit/delete a locked BBox shows destructive confirmation.
- Canceling confirmation preserves existing annotations and geometry.
- Confirming deletes/invalidates associated semantic/support annotations and unlocks the BBox for editing.

### Slice lifecycle

- Editing an unlocked BBox marks its generated slice missing/stale.
- Slice regeneration is automatic according to RB-126 behavior.
- No persistent `Regenerate slices` button is shown in normal state.
- Contextual retry appears only when slice generation fails.

### Autosave / persistence

- BBox create/move/resize/delete integrates with autosave behavior from RB-125.
- Save failures are visible and do not silently discard local geometry changes.

### Tests

Add/update tests for:

- drag empty area creates BBox without Add button;
- click empty area deselects;
- editable BBox move/resize works without unlock;
- BBox with no downstream annotation remains editable;
- BBox with semantic mask is locked;
- BBox with support mask is locked;
- locked BBox edit attempt shows confirmation;
- cancel confirmation preserves data;
- confirm deletes/invalidates downstream annotations and permits edit;
- persistent regenerate button is absent;
- contextual retry appears only on generation failure.

## Validation

Run relevant Refine checks:

```bash
npm run lint
npm run typecheck
npm run test
```

If targeted suites exist, run:

```bash
npm run test -- bbox
npm run test -- annotation
```

Adjust commands to the repository's actual test scripts.

## Dependency / sequencing

Recommended sequencing:

1. RB-124: toolbar/status cleanup.
2. RB-125: selection model and autosave.
3. RB-126: slice lifecycle and zoom.
4. RB-129: direct draw/edit mode and per-BBox locks.

However, RB-129 may require adjusting RB-124/RB-125/RB-126 assumptions:

- RB-124 should not require an `Add BBox` button.
- RB-125 should treat drag-empty-area as create.
- RB-126 should remove persistent `Regenerate slices` from normal right rail.
