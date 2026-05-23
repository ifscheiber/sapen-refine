# RB-099 — Crop Semantic Editor Reload Stability Hotfix

## Status

Proposed / Ready for Codex

## Priority

Critical / Hotfix

## Type

Editor / React Effects / Crop Semantic Editor / Stability / Tests

## Goal

Fix the crop semantic editor reload/fetch loop by separating data-fetch effects from state-derived canvas render callbacks.

## Context

`CropSemanticEditorClient` can repeatedly reload or fetch when loading effects depend on unstable callbacks or render functions. This can reset canvas state and make annotation unstable.

## Non-Goals

Do not implement support policy changes, embedded navigator changes, tool palette changes, export/readiness changes, or semantic family UX guards here.

## Implementation Scope

### 1. Refactor semantic editor data loading

The load effect should depend only on stable identity inputs:

```text
cropId
selected semantic mode
route params
explicit reload token
```

It must not depend on canvas render callbacks or state-derived callbacks whose identity changes while drawing.

### 2. Separate rendering effects

Move overlay/canvas rendering into separate effects/helpers that use refs/current state without changing loader identity.

### 3. Abort / sequence guards

Add stale response protection:

```text
loadSequence++
only latest sequence may commit loaded data
abort previous request on crop/mode change
ignore stale response
```

### 4. Apply same pattern to support editor if useful

If `CropSupportEditorClient` has the same risk, apply the same pattern narrowly.

## Tests

Add tests/E2E coverage for:

- semantic editor does not repeatedly fetch over a short observation window;
- stale fetch cannot overwrite newer loaded state;
- switching semantic mode causes only intended reload;
- drawing/saving remains possible.

## Acceptance Criteria

1. Crop semantic editor load effect uses stable dependencies.
2. Canvas overlay rendering no longer triggers data reload loops.
3. Stale fetches cannot reset newer state.
4. Focused test/E2E coverage exists.
5. Existing crop support/semantic workflows remain green.
6. Ticket is moved to done.
7. Full validation gate passes.
