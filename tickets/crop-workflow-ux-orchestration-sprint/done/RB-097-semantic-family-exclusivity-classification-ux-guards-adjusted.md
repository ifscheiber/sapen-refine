# RB-097 — Semantic Family Exclusivity and Classification UX Guards

## Status

Proposed / Ready for Codex

## Priority

High

## Type

UX / Semantic Annotation / Classification / Guardrails / Server Validation / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-096 — Unified Slice Crop Annotation Workbench
- RB-100 — Mode-Aware Support Policy for Crop Semantics
- RB-090 — Auto Slice Classification from Semantic Masks

## Blocks

- RB-098 — Crop Workflow Smoke Test, Legacy Full-Image Boundary and UX Polish

---

## 1. Context

A slice must not silently contain both semantic families:

```text
SAP_HEARTWOOD
COPPER
```

The user should not accidentally annotate a slice as both Copper and Sap/Heartwood. However, the mode-aware support policy must remain intact:

```text
Sap/Heartwood:
  support optional
  semantic foreground can define support geometry

Copper:
  draft semantic save allowed without support
  readiness/export requires explicit support
```

RB-097 enforces semantic family exclusivity and classification UX guards.

---

## 2. Goal

Prevent user confusion and invalid mixed semantic families on one slice while preserving manual override and auditability.

At the end of RB-097:

1. Each slice has a clear active semantic family or unresolved/conflict state.
2. If Sap/Heartwood semantic annotation exists, Copper mode is blocked or requires explicit reset/replacement.
3. If Copper semantic annotation exists, Sap/Heartwood mode is blocked or requires explicit reset/replacement.
4. Existing versions are not mutated silently.
5. Conflicting state is visible and cannot become export-ready.
6. Classification display follows the current semantic family and latest valid version.
7. Manual classification override remains possible.

---

## 3. Non-Goals

Do **not** implement:

- new semantic labels unless unavoidable,
- crop export redesign,
- review dashboard,
- model inference,
- support policy changes already handled in RB-100,
- full editor rewrite.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Run the full validation baseline before and after.

---

## 5. Semantic Family Policy

### 5.1 Family detection

Determine active family from latest non-deleted semantic crop mask versions for the slice/crop.

Possible states:

```text
NONE
SAP_HEARTWOOD
COPPER
CONFLICT
```

### 5.2 Blocking rules

If active family is `SAP_HEARTWOOD`:

```text
Copper mode disabled
or requires explicit reset/replace flow
```

If active family is `COPPER`:

```text
Sap/Heartwood mode disabled
or requires explicit reset/replace flow
```

If active family is `CONFLICT`:

```text
show warning
block export readiness
require explicit resolution
```

### 5.3 Reset / replacement

If switching family is allowed, it must be explicit:

```text
Confirm reset semantic annotation for this slice?
Existing versions remain historical.
New semantic family creates new version lineage.
Classification is recalculated.
```

Do not mutate or delete historical versions silently.

### 5.4 Server guard

Do not rely on UI only.

Server should reject or flag attempts to create a conflicting active semantic family unless request explicitly uses the reset/replacement path.

Stable error examples:

```text
SEMANTIC_FAMILY_CONFLICT
SEMANTIC_FAMILY_RESET_REQUIRED
```

---

## 6. Classification UX

Show classification status aligned to semantic family:

```text
Auto classification: SAP_HEARTWOOD_SLICE
Source: Sap/Heartwood semantic mask

Auto classification: COPPER_SLICE
Source: Copper semantic mask

Conflict: REVIEW_REQUIRED
```

Manual override remains possible but must not hide semantic conflict.

If manual override conflicts with semantic family, show warning and not-ready state.

---

## 7. Tests

### Unit tests

- family detection: none, Sap/Heartwood, Copper, conflict;
- reset eligibility;
- classification display mapping.

### Integration/API tests

- Copper mode blocked when Sap/Heartwood annotation exists;
- Sap/Heartwood blocked when Copper annotation exists;
- explicit reset creates new version and preserves history;
- conflict state is not export-ready;
- manual override remains possible but does not silence conflict.

### E2E tests

If stable:

```text
create Sap/Heartwood semantic
attempt Copper mode
see block/reset prompt
perform reset or cancel
classification state updates correctly
```

---

## 8. Documentation Updates

Update:

```text
docs/06-data/crop-based-slice-annotation.md
docs/03-features/editor.md
docs/06-data/training-export-contract.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/known-gaps.md
docs/adr/remediation-backlog.md
```

Docs must state:

- only one semantic family can be active per slice;
- conflicts require resolution;
- historical versions remain;
- manual override does not erase semantic conflict;
- mode-aware support policy remains valid.

---

## 9. Acceptance Criteria

1. Semantic family state is detectable.
2. UI prevents accidental family mixing.
3. Server guards against unintended conflicting semantic family writes.
4. Explicit reset/replacement path preserves history.
5. Classification display follows semantic family.
6. Conflict state cannot be export-ready.
7. Tests cover exclusivity and reset/override behavior.
8. Docs updated.
9. Full validation gate passes.

---

## 10. Notes for Codex

- Preserve append-only versioning.
- Do not silently delete semantic masks.
- Do not block Copper drafts merely because support is missing.
- Do block Copper/SapHeartwood coexistence unless explicitly reset.
