# RB-126 Refine BBox Slice Lifecycle, Validation Text, and Zoom Centering

## Context

The BBox editor currently relies on explicit slice preparation and exposes technical validation enums such as `BBOX_TOO_SMALL`. The zoom slider can also cause the image to drift in ways that make BBox drawing and review less stable.

Slices should be derived from the current BBox geometry and regenerated automatically when the user leaves the BBox stage, so the slice state cannot silently diverge from the current BBox.

## Goal

Automatically prepare/regenerate missing or stale slices when leaving the BBox tab, replace technical validation enums with user-facing text, and improve zoom centering behavior.

## Scope

### In scope

- Track whether generated slices are missing or stale relative to current BBox geometry.
- Automatically prepare slices when switching away from the BBox tab if:
  - a valid BBox exists and no slice exists for it; or
  - the BBox changed after the existing slice was generated.
- Replace/override stale slices when the underlying BBox changed.
- Move any manual `Prepare slices` action out of the main canvas toolbar.
- Keep an optional manual retry/debug action in the right rail if useful.
- Replace raw `BBOX_TOO_SMALL` enum display with user-facing text.
- Improve zoom slider behavior so the image remains horizontally centered/stable.

### Out of scope

- Full toolbar restyling.
- Autosave implementation for BBoxes.
- New annotation families or semantic label changes.
- Major backend schema redesign unless needed to track slice staleness safely.

## Required behavior

### Slice lifecycle

Slices should correspond to current BBox geometry.

Recommended model:

```text
BBox geometry/version changes → generated slice becomes stale
Tab switch away from BBoxes → prepare missing/stale slices
Successful generation → clear stale state
```

Automatic preparation should run when the user leaves/switches away from the BBox tab and all of the following are true:

- BBox exists;
- BBox is valid;
- slice is missing or stale.

If a BBox changed, the previous slice generated from that BBox must be replaced/overridden so that the current slice always corresponds to the current BBox.

The system must avoid ambiguous duplicate slices for the same BBox.

### Manual prepare action

Remove the main canvas `Prepare slices` button.

If a manual action remains needed, place it in the right rail as secondary/debug/retry action:

```text
Regenerate slices
```

It should be disabled when there are no missing/stale valid BBoxes.

### Validation text

Do not expose raw enum text such as:

```text
BBOX_TOO_SMALL
```

Use user-facing copy:

```text
BBox too small. Enlarge the selection before preparing slices.
```

If a concrete threshold is available, show it in tooltip/detail text, for example:

```text
Minimum crop size is 128 × 128 px.
```

The implementation should preserve the internal enum/code for diagnostics and tests, but never show the raw enum as the primary user-facing message.

### Zoom behavior

When using the zoom slider:

- preserve the visible viewport center where possible;
- keep the image horizontally centered relative to the visible canvas area;
- avoid unexpected left/right drift;
- after zooming out below viewport width, center the image horizontally.

When using Fit:

- fit the image to the available viewport;
- center the fitted image horizontally and vertically where possible.

For pointer/wheel zoom, preserving the cursor focus is acceptable, but the slider should prioritize stable canvas-center behavior.

## Acceptance criteria

- Switching away from the BBox tab prepares missing slices for valid BBoxes.
- Switching away from the BBox tab regenerates stale slices after BBox geometry changes.
- Stale/generated slices are replaced/overridden rather than duplicated ambiguously.
- Manual `Prepare slices` is no longer shown in the main canvas toolbar.
- Optional retry/regenerate action, if implemented, lives in the right rail.
- `BBOX_TOO_SMALL` is not shown raw to users.
- The too-small-BBox message is human-readable.
- Zoom slider preserves stable horizontal centering/viewport center.
- Fit centers the image after fitting.
- Tests cover missing slice generation, stale slice regeneration, validation copy, and zoom-centering behavior where feasible.

## Validation

Run the relevant Refine checks, for example:

```bash
npm run lint
npm run typecheck
npm run test
```

Add or update targeted tests for:

- tab switch triggers missing slice preparation;
- changed BBox marks slice stale;
- stale slice is regenerated/replaced;
- raw enum is mapped to user-facing copy;
- zoom fit/slider centering behavior if covered by UI tests.
