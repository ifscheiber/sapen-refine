# RB-101 — Embedded Slice Navigator and Ensure Current Crops

## Status

Proposed / Ready for Codex

## Priority

High

## Type

UX / Navigation / Crop Workflow / Editor Integration / Tests

## Goal

Embed the slice navigator in the right side of crop support and semantic editors and ensure current crops exist defensively.

## Context

Users should keep whole-image context while editing each crop. The navigator should show BBoxes/statuses and allow selecting another slice without leaving the editor flow.

## Non-Goals

Do not implement support policy changes, tool palette expansion, review dashboard, or model inference here.

## Implementation Scope

### 1. Reusable right-rail navigator

Extract or reuse navigator as a component rendered beside:

```text
crop support editor
crop semantic editor
```

### 2. Navigation behavior

- In support editor, clicking a slice opens that slice’s support editor.
- In semantic editor, clicking a slice opens that slice’s semantic editor.
- Preserve editor mode where possible.

### 3. URL compatibility

Keep existing navigator routes URL-compatible. Normal flow should route into the selected crop editor.

### 4. Ensure current crops

Add idempotent helper/API:

```text
ensureCurrentCropsForImage(...)
ensureCurrentCropForSlice(...)
```

Reuse existing crop generation. Do not duplicate crops.

Call after BBox confirmation and defensively when a navigator slice lacks a current crop.

### 5. Status badges

Navigator shows compact status for:

```text
BBox
crop
support
semantic
classification
readiness
```

## Tests

- Navigator appears in support editor.
- Navigator appears in semantic editor.
- Clicking a slice opens same editor mode for selected slice.
- Ensure-current-crops is idempotent.
- No duplicate crop generation.
- Existing route URLs still work.

## Acceptance Criteria

1. Right-side navigator is embedded in crop support/semantic editors.
2. Slice selection works and preserves editor mode.
3. Current crop is ensured idempotently.
4. Status badges show progress.
5. Existing navigator routes remain compatible or redirect safely.
6. Full validation gate passes.
