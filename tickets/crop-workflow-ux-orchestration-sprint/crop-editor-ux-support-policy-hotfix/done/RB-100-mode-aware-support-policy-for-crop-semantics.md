# RB-100 — Mode-Aware Support Policy for Crop Semantics

## Status

Proposed / Ready for Codex

## Priority

Critical / Hotfix

## Type

Domain Policy / Crop Semantics / Readiness / Export / Tests

## Goal

Replace the blanket “support required before semantic annotation” rule with mode-aware support policy.

## Policy

### Sap/Heartwood

```text
support required for save: no
support required for review/readiness/export: no
support geometry source: SEMANTIC_FOREGROUND
```

### Copper

```text
support required for draft save: no
support required for readiness/export: yes
support geometry source: EXPLICIT_SUPPORT_MASK
```

## Rationale

For Sap/Heartwood, the non-background semantic foreground can define the relevant slice geometry. For Copper, the copper mask only describes penetration and cannot define the full physical wood piece.

## Non-Goals

Do not implement embedded navigator, full tool palette, export redesign, model inference, or new semantic taxonomy unless unavoidable.

## Implementation Scope

### 1. Replace boolean support policy

Replace `supportRequired: boolean` or equivalent with mode-aware policy.

### 2. Semantic save logic

- Sap/Heartwood semantic save without support succeeds.
- Copper semantic draft save without support succeeds.
- Missing support no longer returns `SUPPORT_MASK_REQUIRED` for draft semantic saves.
- Sap/Heartwood and Copper semantic drafts may have nullable `supportMaskVersionId`.

### 3. Derived support geometry

For Sap/Heartwood:

```text
derived support = all non-background Sap/Heartwood semantic foreground pixels
```

Important:

```text
crop padding is not support
unlabeled/background crop pixels are not support
```

### 4. Readiness/export logic

- Remove `MISSING_SUPPORT_MASK` blocker for Sap/Heartwood crops.
- Keep Copper blockers for missing/unapproved support.
- Add/export readiness metadata:

```text
supportGeometrySource = SEMANTIC_FOREGROUND
supportGeometrySource = EXPLICIT_SUPPORT_MASK
```

### 5. Auto classification lineage

Allow Sap/Heartwood classification derived from semantic masks to have:

```text
derivedFromSupportMaskVersionId = null
```

## Tests

Add integration tests for:

- Sap/Heartwood semantic save without support succeeds;
- Sap/Heartwood readiness/export works via `SEMANTIC_FOREGROUND`;
- Copper semantic save without support succeeds as draft;
- Copper not export-ready without approved support;
- Copper export-ready only with approved support + approved semantic + approved/accepted classification;
- crop padding is not treated as support;
- no implicit full-crop support is created.

## Docs

Update ADR/crop workflow/API/export/editor/testing docs to describe mode-aware support policy.

## Acceptance Criteria

1. Sap/Heartwood supportless semantic save works.
2. Copper supportless semantic draft save works.
3. Sap/Heartwood support geometry derives from semantic foreground.
4. Copper readiness/export still requires explicit approved support.
5. Readiness/export manifest includes support geometry source.
6. Tests cover policy.
7. Full validation gate passes.
