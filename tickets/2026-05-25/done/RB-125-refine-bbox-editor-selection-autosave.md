# RB-125 Refine BBox Editor Selection Model and Autosave

## Context

The BBox editor currently keeps the active BBox selected even when the user clicks on empty/unannotated canvas space, especially when only one BBox exists. This makes the editor feel sticky and keeps resize/edit handles visible when the user expects the selection to be cleared.

Additionally, BBox edits should be autosaved after committed changes so that the editor no longer depends on explicit manual save/preparation actions for basic persistence.

## Goal

Improve the BBox editor interaction model and add reliable autosave for committed BBox changes.

## Scope

### In scope

- Clicking empty/unannotated canvas/image space deselects the active BBox.
- Deselect behavior works even when only one BBox exists.
- Selected BBox handles are hidden when nothing is selected.
- Delete action is disabled when nothing is selected.
- BBox changes autosave after committed edits:
  - creation;
  - move;
  - resize;
  - deletion;
  - proposal replacement.
- Autosave is triggered after edit completion or debounced drag end, not on every pointer move.
- Minimal save-state feedback is shown:
  - `Saving…`;
  - `Saved`;
  - `Save failed`.
- Save failures are surfaced clearly and are not silent.

### Out of scope

- Automatic slice preparation/regeneration.
- Backend slice lifecycle changes.
- Toolbar restyling, except where needed for save-state feedback.
- Reworking BBox validation thresholds.

## Required behavior

### Selection model

The canvas should behave naturally:

- click existing BBox → select that BBox;
- click selected BBox → keep selected;
- click another BBox → select the other BBox;
- click empty/unannotated image/canvas area → deselect current BBox;
- when no BBox is selected:
  - edit/resize handles are hidden;
  - delete is disabled;
  - BBox outlines may remain visible in passive/hover state.

This must work with one BBox and with multiple BBoxes.

### Add/edit model

Recommended model:

- default mode is select/edit;
- Add BBox button enters draw mode;
- after drawing a BBox, the new BBox is selected and autosaved;
- after creation completes, editor returns to select/edit mode;
- moving/resizing selected BBox is direct manipulation via canvas handles;
- no separate resize mode is needed.

### Autosave

Autosave should occur only after a committed edit:

- pointer up after drag-created BBox;
- pointer up after move;
- pointer up after resize;
- delete confirmation/action;
- proposal replacement action.

Avoid autosaving on every pointer move.

Recommended debounce window for committed edits:

```text
500–800 ms
```

However, if the implementation already has a clear drag-end event, saving directly on drag end is acceptable.

### Failure handling

If autosave fails:

- show visible `Save failed` state;
- keep the local edited geometry visible;
- allow retry on next edit or via a small retry affordance if existing UI patterns support it;
- do not silently mark the BBox as saved.

## Acceptance criteria

- Clicking empty canvas deselects the active BBox.
- Deselect works when there is only one BBox.
- Edit handles disappear after deselection.
- Delete is disabled when no BBox is selected.
- BBox creation autosaves.
- BBox move autosaves after move completion.
- BBox resize autosaves after resize completion.
- BBox deletion autosaves.
- Proposal replacement autosaves.
- Autosave does not spam requests during pointer movement.
- Save state is visible and accurate.
- Save failures are shown to the user.
- Existing editor workflows remain usable with keyboard/mouse.
- Unit/UI tests cover selection clearing and autosave triggers.

## Validation

Run the relevant Refine checks, for example:

```bash
npm run lint
npm run typecheck
npm run test
```

Add or update targeted tests for:

- empty canvas click deselection;
- single-BBox deselection;
- autosave after create/move/resize/delete;
- save-failure display.
