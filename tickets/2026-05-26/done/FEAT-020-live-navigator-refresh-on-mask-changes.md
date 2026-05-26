# FEAT-020 — Live Navigator Refresh on Mask Changes

## Status

Done

## Type

Editor UX / navigator state synchronization ticket

## Target repository

Work in the `sapen-annotate` repository.

## Reference repository path

Codex has read-only access to the SaPen reference repository at:

```text
../sapen
```

Use `../sapen/...` only as read-only reference. Do not import directly from `../sapen` at runtime unless the repository is intentionally configured for this.

## Background

The editor navigator currently updates too late. In the current UX, the navigator image/overlay is only refreshed when the user leaves the current slice or switches context.

This is frustrating because the navigator is meant to provide an overview of which slices already have masks and what the current annotation state looks like.

Expected UX:

- User draws a polygon.
- User closes/applies the polygon.
- A new mask state exists.
- The navigator should update immediately.
- The user should not need to leave the slice to see the navigator update.

This is especially important after DESIGN-009, where the navigator should show semantic overlays and support contours.

## Goal

Update the right-side navigator as soon as a new mask state exists.

The navigator should refresh immediately after relevant local mask changes, for example:

- polygon close/apply
- lasso apply
- brush stroke commit/end
- background label apply
- support mask apply/replace
- undo/redo
- mask reload/latest refresh
- mask commit/save if that changes canonical state

The navigator must remain in sync with the current editor state, not only with persisted state after slice navigation.

## Product expectation

Navigator update should be immediate and transparent.

Example:

```text
Close polygon → semantic mask changes → navigator overlay updates immediately
```

No slice switch should be required.

## Required reference inspection

Inspect local editor/navigator state flow:

```text
src/features/editor/CropSemanticEditorClient.tsx
src/features/editor/CropEditorSliceNavigatorRailClient.tsx
src/features/editor/CropSemanticEditorPage.tsx
src/app/app/projects/[projectId]/images/[imageId]
src/lib/projectsClient.ts
```

Search local repo for:

```text
navigator
overview
maskPreview
semanticMask
supportMask
polygon
lasso
brush
undo
redo
commit
reload latest
activeSlice
selectedSlice
```

Inspect SaPen Core / Refine only as read-only reference for state synchronization patterns:

```text
../sapen/apps/sapen-core/src/features/quick-analysis
../sapen/apps/sapen-core/src/features/quick-analysis/components
../sapen/apps/sapen-refine/src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx
../sapen/apps/sapen-refine/src/mask
```

Search reference repo for:

```text
navigator
overview
overlay
mask
preview
version
revision
dirty
undo
redo
```

## Required behavior

### 1. Navigator uses current local mask state

The navigator should render from the current editor mask state when available, not only from last persisted/loaded state.

State priority should be:

1. current local editable mask state
2. latest committed/saved mask state
3. initial loaded mask state
4. empty/unannotated fallback

This applies to:

- semantic overlays
- support contours
- active/selected BBox/slice indicator
- annotated/unannotated visual state

### 2. Update immediately after mask-producing actions

Navigator must refresh after actions that produce a new mask state.

Required trigger examples:

```text
polygon closed/applied
lasso applied
brush stroke finished
background/clear operation applied
support mask drawn/replaced
undo
redo
reload latest
mask commit/save
```

It does not need to refresh on every mousemove during polygon preview unless inexpensive and already supported.

Minimum required timing:

- after operation is applied to the mask buffer/state
- before the user switches slice

### 3. Avoid expensive full re-render loops

Do not implement navigator refresh by repeatedly reloading image/mask from the server after every edit.

Preferred implementation:

- derive navigator overlay from in-memory mask state
- pass mask revision/version key to navigator component
- update navigator when local mask state changes
- debounce only where necessary, e.g. brush stroke end rather than every brush pixel

Suggested approach:

```text
maskRevision increments after every committed local mask operation
navigator receives maskRevision and current mask buffers
navigator recomputes lightweight overlay/contour from current state
```

If existing state management already has dirty/version counters, reuse them.

### 4. Brush performance

For brush operations, avoid refreshing the navigator for every pointer move if that causes performance issues.

Acceptable behavior:

- update navigator after brush stroke ends / pointer up
- update after undo/redo
- update after save/commit

Do not block smooth drawing because of navigator rendering.

### 5. Polygon/lasso responsiveness

For polygon/lasso:

- update immediately on apply/close
- if FEAT-019 re-editable polygon is implemented, update after vertex edit is applied
- if support replacement warning flow exists, update after user confirms replacement and new support mask is applied

### 6. Dirty vs persisted status

Navigator may show current unsaved edits.

This is desired.

If useful, a small dirty indicator may be shown elsewhere, but do not add a large UI element.

Example:

```text
Navigator shows current local mask overlay even before commit.
```

This improves transparency.

### 7. Consistency with semantic exclusivity/support rules

Navigator rendering must respect:

- semantic exclusivity: one semantic label per pixel
- support contour rendering rules from DESIGN-009
- Cu clipping/support validity rules from DESIGN-015 where implemented

## Functional boundaries

Do not change:

- mask storage format
- label IDs
- Core handoff contracts
- commit/autosave contracts
- BBox storage
- crop/slice generation
- auth/RBAC

Do not implement:

- server reload after every local edit
- heavy backend polling
- full editor state rewrite
- expensive navigator refresh on every brush pointer move if avoidable

## Acceptance criteria

### Immediate update

- [ ] Navigator updates after closing/applying a polygon.
- [ ] Navigator updates after applying lasso.
- [ ] Navigator updates after brush stroke end.
- [ ] Navigator updates after applying Background.
- [ ] Navigator updates after support mask apply/replace.
- [ ] Navigator updates after undo/redo.
- [ ] No slice switch is required for navigator update.

### State source

- [ ] Navigator uses current local mask state when available.
- [ ] Navigator can show unsaved local edits.
- [ ] Persisted state remains fallback after reload.
- [ ] Reload latest updates navigator correctly.

### Performance

- [ ] Brush drawing remains responsive.
- [ ] Navigator refresh does not trigger unnecessary server reloads.
- [ ] No infinite render/update loops.
- [ ] No major slowdown from overlay/contour recomputation.

### Regression

- [ ] Main editor mask rendering still works.
- [ ] Commit/save still works.
- [ ] Undo/redo still works.
- [ ] Slice switching still works.
- [ ] Existing navigator BBox click navigation still works.

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

Recommended targeted tests:

- mask revision increments after polygon apply
- navigator receives updated mask revision/state
- navigator overlay updates without slice switch
- undo/redo triggers navigator refresh
- brush refresh happens on stroke end, not every pointer move if performance-sensitive

Manual smoke checklist:

1. Open semantic mask editor.
2. Draw and close a polygon.
3. Verify navigator overlay updates immediately.
4. Do not leave the slice.
5. Draw another polygon and verify navigator updates again.
6. Use Background label to clear an area and verify navigator updates.
7. Use undo and verify navigator updates.
8. Use redo and verify navigator updates.
9. Draw a brush stroke and verify navigator updates after stroke end.
10. Draw/replace support mask and verify support contour updates.
11. Switch slices and verify navigator remains consistent.
12. Save/commit mask and verify navigator still shows correct state.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Implement FEAT-020: Live Navigator Refresh on Mask Changes.

Problem:
The right-side navigator currently updates only when leaving/switching the slice. It should update as soon as a new mask exists, e.g. after closing/applying a polygon.

Goal:
Make the navigator render current local editor mask state and refresh immediately after local mask-changing operations:
- polygon close/apply
- lasso apply
- brush stroke end
- Background/clear operation
- support mask apply/replace
- undo/redo
- reload latest
- commit/save if needed

Do not reload from the server after every edit. Prefer local state:
- current local editable mask state
- maskRevision/version counter
- pass current mask buffers/derived overlay data to navigator

Avoid performance problems:
- brush should refresh on stroke end, not necessarily every pointer move
- no infinite render loops
- no heavy polling

Preserve:
- mask storage format
- label IDs
- commit/autosave contracts
- Core handoff contracts
- BBox/crop logic
- auth/RBAC

Run:
- npm run typecheck
- npm run lint
- npm run build
- npm test if appropriate

Report:
A. What changed
B. Files changed
C. Which mask-changing actions trigger navigator refresh
D. How navigator reads current local mask state
E. How brush performance is protected
F. Validation results
G. Follow-ups
```

## Suggested commit message

```text
Refresh editor navigator on local mask changes
```
