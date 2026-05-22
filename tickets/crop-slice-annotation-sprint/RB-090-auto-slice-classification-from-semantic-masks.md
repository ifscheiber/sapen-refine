# RB-090 — Auto Slice Classification from Semantic Masks

## Status

Proposed / Depends on RB-089

## Priority

Medium / High

## Type

Classification / Derived Metadata / Review / Tests

## Goal

Automatically derive slice classification suggestions from semantic crop masks.

---

## Context

Separate manual classification clicks can be reduced.

Semantic labels provide enough evidence in many cases:

```text
Copper pixels present → COPPER_SLICE
Sapwood/Heartwood present → SAP_HEARTWOOD_SLICE
```

Classification must remain auditable and overridable.

---

## Non-Goals

Do **not** implement:

- new semantic labels unless required by existing contract,
- model inference,
- export changes except metadata/docs,
- forced auto-approval.

---

## Implementation Scope

### 1. Classification derivation helper

Rules:

```text
if copper pixels > threshold:
  COPPER_SLICE

else if sapwood or heartwood pixels > threshold:
  SAP_HEARTWOOD_SLICE

else:
  UNKNOWN / REVIEW_REQUIRED
```

Thresholds should be documented and configurable if needed.

### 2. Provenance

Create `SliceClassificationVersion` with source/provenance:

```text
AUTO_FROM_SEMANTIC_MASK
derivedFromSemanticMaskVersionId
createdBy = system or triggering user
```

If schema lacks source/provenance field, add a minimal migration.

### 3. Override

User can override classification manually.

Manual override must create a new version and remain auditable.

### 4. Review

Define whether auto classification needs review before export-ready.

Recommended:

```text
auto classification may be draft/submitted but should not silently become approved unless policy says so
```

### 5. Tests

- Copper semantic mask derives COPPER_SLICE.
- Sap/Heartwood semantic mask derives SAP_HEARTWOOD_SLICE.
- Empty/unknown derives UNKNOWN/REVIEW_REQUIRED.
- Manual override wins/latest version behavior.
- Review/export respects classification state.

---

## Acceptance Criteria

1. Auto classification helper exists.
2. Classification is derived from semantic mask content.
3. Provenance links to semantic mask version.
4. User override is possible.
5. Classification review/export rules are documented.
6. Tests cover derivation and override.
7. Docs updated.
8. Ticket moved to done.
9. Full validation gate passes.
