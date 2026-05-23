# RB-097 — Semantic Family Exclusivity and Classification UX Guards

## Status

Proposed / Depends on RB-096

## Priority

High

## Type

UX / Semantic Annotation / Classification / Guardrails / Tests

## Goal

Prevent user confusion and invalid mixed semantic families on one slice.

## Core Rule

For a single slice, semantic annotation mode must be exclusive:

```text
SAP_HEARTWOOD mode
or
COPPER mode
never both unless the user explicitly resets/replaces semantic annotation
```

## Desired Behavior

- If a slice already has Sap/Heartwood semantic annotation, Copper mode is disabled or requires explicit reset.
- If a slice already has Copper annotation, Sap/Heartwood mode is disabled or requires explicit reset.
- Classification auto-fills from semantic mode.
- Ambiguous/conflicting state shows warning and `REVIEW_REQUIRED`.
- Manual override remains possible.

## Scope

- UI guardrails in crop workbench/semantic editor.
- Clear warnings for existing conflicting data.
- Reset/replacement confirmation if switching semantic family.
- Classification display aligned with auto-derived source.
- Tests for mode exclusivity.

## Non-Goals

- No new semantic labels unless already needed.
- No review/export redesign.
- No model inference.

## Tests

- Copper mode blocked when Sap/Heartwood annotation exists.
- Sap/Heartwood mode blocked when Copper annotation exists.
- Reset flow creates new version or marks old version superseded according to existing versioning rules.
- Auto classification follows semantic mode.
- Conflicting state displays warning.

## Acceptance Criteria

1. Semantic family exclusivity is enforced in UI/server where necessary.
2. Classification display follows semantic annotation.
3. Conflicts are visible and cannot silently become ready.
4. Manual override remains possible.
5. Docs updated.
6. Full validation passes.
