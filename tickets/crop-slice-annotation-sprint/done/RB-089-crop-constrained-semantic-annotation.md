# RB-089 — Crop-Constrained Semantic Annotation

## Status

Done

## Priority

High

## Type

Editor / Semantic Annotation / Crop Workflow / Copper / Sapwood Heartwood / Tests

## Goal

Enable semantic annotation inside a slice crop constrained by the support mask.

---

## Context

Once a support mask exists, semantic annotation should be limited to the physical slice area.

This improves data quality and reduces work.

---

## Non-Goals

Do **not** implement:

- BBox creation,
- crop generation,
- support editor,
- auto classification,
- export changes beyond docs,
- new model inference.

---

## Implementation Scope

### 1. Semantic crop editor

Add semantic annotation route or mode for a slice crop.

Semantic annotation must reference:

- source image,
- crop,
- slice instance,
- support mask version.

### 2. Support-constrained editing

Outside support:

```text
locked
transparent
not editable
```

Inside support:

- Sap/Heartwood mode,
- Copper mode.

### 3. Sap/Heartwood mode

Support complement fill:

```text
paint sapwood, fill remaining support as heartwood
or
paint heartwood, fill remaining support as sapwood
```

Allow `UNKNOWN` or review-required area if required by design.

### 4. Copper mode

Copper requires support mask.

User paints Copper/Penetration.

Rest inside support is treated according to the documented contract:

```text
non-copper wood / negative / unknown
```

Do not treat Copper mask as instance mask.
Outside-support Copper pixels must be ignored or rejected and must not expand support geometry.

### 5. Tests

- cannot edit outside support,
- Sap/Heartwood complement fill,
- Copper requires support,
- Copper semantic mask not support geometry,
- save/reload semantic crop mask,
- review/export boundaries unchanged.

---

## Acceptance Criteria

1. Semantic crop annotation works inside support.
2. Outside-support edits are blocked/ignored.
3. Sap/Heartwood complement fill works or is explicitly deferred.
4. Copper mode requires support.
5. Copper mask is never used as support mask.
6. Semantic mask is versioned and attributable.
7. Docs updated.
8. Ticket moved to done.
9. Full validation gate passes.
