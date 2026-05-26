# RB-102 — Full Crop Mask Tool Palette and Shared Mask Operations

## Status

Proposed / Ready for Codex

## Priority

Medium / High

## Type

Editor / Tool Palette / Mask Operations / Crop UX / Tests

## Goal

Add the full mask-editing tool palette to crop support and semantic editors and share mask operation logic instead of duplicating pointer code.

## Context

Crop support and semantic editors need practical editing parity with the full editor except BBox proposal mode.

Required tools:

```text
brush
eraser
freehand lasso
polygon lasso
undo
redo
brush size
opacity
label selection
```

BBox proposal remains only in the image-level BBox stage.

## Non-Goals

Do not implement BBox creation inside crop editors, support policy changes, navigator relocation, advanced zoom/pan, or new mask format.

## Implementation Scope

### 1. Shared mask operation path

Refactor or reuse existing editor helpers so crop editors share mask operation logic.

Centralize constraints:

```text
Sap/Heartwood supportless:
  edit within crop
  derive support from semantic foreground

Copper supportless:
  edit draft freely
  not export-ready

Copper with support:
  validate foreground against support for readiness/export
```

### 2. Crop editor tool palette

Add to crop support and semantic editors:

- brush,
- eraser,
- freehand lasso,
- polygon lasso,
- undo,
- redo,
- brush size,
- opacity,
- label palette.

Exclude:

```text
BBox proposal tool
```

### 3. UX requirements

- touch-friendly controls,
- no hover-only interactions,
- mode-specific labels,
- support editor shows support/background only,
- semantic editor shows mode-specific semantic labels only.

## Tests

- Lasso works in crop support editor.
- Polygon works in crop support editor.
- Lasso works in crop semantic editor.
- Polygon works in crop semantic editor.
- Undo/redo works in crop editors or limitation is documented.
- BBox tool is not shown in crop editors.
- Existing full editor tools remain green.

## Acceptance Criteria

1. Crop editors have full mask-editing palette except BBox proposal.
2. Shared mask operations reduce duplication.
3. Lasso/polygon work in crop support and semantic editors.
4. Undo/redo works or limitation is explicitly documented.
5. Constraints are enforced in shared operation path.
6. Full validation gate passes.
