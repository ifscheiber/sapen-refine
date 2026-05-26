# RB-090 — Auto Slice Classification from Semantic Masks

## Status

Proposed / Ready for Codex

## Priority

Medium / High

## Type

Classification / Derived Metadata / Semantic Provenance / Review / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design
- RB-088 — Crop Editor: Mandatory Pixel-Perfect Slice Support Mask
- RB-089 — Crop-Constrained Semantic Annotation

## Blocks

- RB-091 — Crop / Original Coordinate Export Contract
- RB-092 — Crop Workflow Review / Approval Integration

---

## 1. Context

RB-089 implemented support-constrained semantic crop annotation:

- crop semantic masks link to `DerivedSliceCrop`, `SliceInstance`, source image and the exact `supportMaskVersionId`;
- semantic masks use `CROP_PIXEL`;
- server-side constraint enforcement rejects outside-support labels with `SEMANTIC_OUTSIDE_SUPPORT`;
- Copper semantic masks remain separate from support geometry.

RB-090 now derives slice classification suggestions from semantic crop masks.

The original RB-090 draft has the right core idea:

```text
Copper pixels present → COPPER_SLICE
Sapwood/Heartwood pixels present → SAP_HEARTWOOD_SLICE
Empty/unknown → UNKNOWN / REVIEW_REQUIRED
```

It also correctly requires provenance, manual override, and no forced auto-approval.

This optimized ticket tightens lineage, threshold policy, trigger behavior, override behavior and review/export boundaries.

---

## 2. Goal

Automatically derive auditable slice classification suggestions from semantic crop masks.

At the end of RB-090:

1. A classification derivation helper can classify semantic crop mask content.
2. Copper semantic masks derive `COPPER_SLICE`.
3. Sapwood/Heartwood semantic masks derive `SAP_HEARTWOOD_SLICE`.
4. Empty/unknown/ambiguous masks derive `UNKNOWN` or `REVIEW_REQUIRED`.
5. Derived classifications are stored as versioned `SliceClassificationVersion` records or equivalent.
6. Derived classifications link to the semantic mask version that produced them.
7. Manual override remains possible and creates a new version.
8. Auto-derived classification does not silently become approved/export-ready.
9. Existing crop support/semantic workflows remain green.

---

## 3. Non-Goals

Do **not** implement:

- crop-aware export implementation,
- review/approval redesign,
- model inference,
- training orchestration,
- classification dashboard,
- automatic approval of classifications,
- changing Copper/support geometry semantics,
- changing semantic mask format,
- deriving support masks from semantic masks.

Export/readiness integration belongs to RB-091/RB-092.

---

## 4. Required Baseline

Run before editing:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

---

## 5. Classification Derivation Rules

### 5.1 Inputs

The derivation helper must use:

```text
semanticMaskVersionId
semanticMode = SAP_HEARTWOOD | COPPER
semantic mask bytes
label schema / label value mapping
derivedCropId
sliceInstanceId
supportMaskVersionId
```

The helper must not infer classification from:

```text
BBox alone
Derived crop alone
Support mask alone
Prediction mask
Copper semantic mask as support geometry
```

### 5.2 Copper mode

If `semanticMode = COPPER` and Copper/penetration pixels exceed threshold:

```text
classification = COPPER_SLICE
reason = COPPER_PIXELS_PRESENT
```

If no Copper pixels exist:

```text
classification = UNKNOWN or REVIEW_REQUIRED
reason = NO_CLASSIFYING_PIXELS
```

### 5.3 Sap/Heartwood mode

If `semanticMode = SAP_HEARTWOOD` and Sapwood or Heartwood pixels exceed threshold:

```text
classification = SAP_HEARTWOOD_SLICE
reason = SAP_HEARTWOOD_PIXELS_PRESENT
```

If only background/unknown exists:

```text
classification = UNKNOWN or REVIEW_REQUIRED
reason = NO_CLASSIFYING_PIXELS
```

### 5.4 Conflict / ambiguous case

If labels appear inconsistent with semantic mode:

```text
classification = REVIEW_REQUIRED
reason = SEMANTIC_MODE_LABEL_CONFLICT
```

or stable equivalent.

### 5.5 Threshold policy

Recommended MVP:

```text
classifyingPixelThreshold = 1
```

Rationale: the mask is human-authored, not a noisy model prediction. One intentional classifying pixel is enough to suggest the slice class.

If a different threshold is chosen, document and test it.

---

## 6. Persistence / Provenance

Use existing `SliceClassificationVersion` where possible.

Required concepts:

```text
sliceInstanceId
classification
source/provenance = AUTO_FROM_SEMANTIC_MASK
derivedFromSemanticMaskVersionId
derivedFromSupportMaskVersionId if useful
derivedFromCropId
createdById or system/triggering user
createdAt
reviewState = DRAFT / NEEDS_REVIEW / SUBMITTED according to existing model
reason
metadataJson optional
```

If schema lacks provenance/source fields, add a minimal migration.

Manual overrides must remain separate versions:

```text
source/provenance = MANUAL
```

Do not mutate the auto-derived version.

---

## 7. Trigger Behavior

Codex must choose and document one trigger strategy.

Preferred MVP:

```text
After successful semantic crop mask save, derive classification automatically.
```

Alternative:

```text
User clicks “Derive classification from semantic mask.”
```

Preferred reason: save-time derivation removes a manual click and matches the sprint goal.

If save-time derivation is implemented:

- derivation failure must not corrupt semantic mask save;
- classification failure should surface as warning and be logged/audited safely;
- semantic save response may include classification summary.

---

## 8. Manual Override

Users must be able to override auto classification.

Rules:

- manual override creates a new `SliceClassificationVersion`;
- manual override does not mutate the auto version;
- latest/current classification resolution must be clear;
- UI should show whether classification is auto-derived or manual.

If existing manual classification UI exists, reuse it and add provenance/source display if practical.

---

## 9. Review / Export Boundary

RB-090 must not silently mark derived classifications export-ready.

Default policy:

```text
auto classification starts as DRAFT or NEEDS_REVIEW
export readiness requires approved classification
or an explicit accepted-auto policy defined later
```

RB-092 will finalize crop workflow review/readiness integration.

RB-090 should keep existing export behavior green and avoid broadening export eligibility.

---

## 10. API / Server Scope

Add domain/API functionality as needed.

Possible routes:

```text
POST /api/semantic-mask-versions/[versionId]/derive-classification
GET  /api/slices/[sliceInstanceId]/classification
POST /api/slices/[sliceInstanceId]/classification
```

Or integrate derivation into semantic crop save response.

Requirements:

- authenticated user;
- project access;
- annotate-capable role for derivation/override;
- stable JSON errors;
- no private storage keys.

Stable errors may include:

```text
SEMANTIC_MASK_NOT_FOUND
SEMANTIC_MASK_LINEAGE_INVALID
CLASSIFICATION_DERIVATION_UNSUPPORTED
CLASSIFICATION_REVIEW_REQUIRED
```

---

## 11. UI Scope

Minimum UI:

- show current classification on crop semantic/support pages or slice panel;
- indicate source:
  - auto-derived,
  - manual,
  - unknown/review-required;
- show source semantic mask version if available;
- allow manual override if current role permits;
- do not require separate click if save-time derivation is implemented.

Example:

```text
Auto classification: COPPER_SLICE
Source: semantic mask v...
Reason: Copper pixels present
```

---

## 12. Tests

### Unit tests

- Copper semantic mask → `COPPER_SLICE`;
- Sapwood/Heartwood mask → `SAP_HEARTWOOD_SLICE`;
- empty/unknown mask → `UNKNOWN` or `REVIEW_REQUIRED`;
- label/mode conflict → review required;
- threshold behavior;
- idempotency if implemented.

### Integration/API tests

- saving Copper semantic mask creates/derives classification;
- saving Sap/Heartwood semantic mask creates/derives classification;
- derived classification links to semantic mask version;
- manual override creates a new version;
- manual override does not mutate auto version;
- viewer cannot override;
- auto classification is not silently approved/export-ready;
- existing export behavior remains unchanged.

### E2E tests

Add focused E2E if stable:

```text
open crop semantic editor
save Copper or Sap/Heartwood semantic mask
see auto classification displayed
manual override if feasible
reload
classification remains visible
```

Avoid brittle pixel-level browser assertions; use unit/API tests for exact mask values.

---

## 13. Documentation Updates

Update:

```text
docs/06-data/crop-based-slice-annotation.md
docs/06-data/mask-and-artifact-versioning.md
docs/06-data/coordinate-spaces-and-transforms.md
docs/03-features/editor.md
docs/03-features/images.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- classification can be auto-derived from semantic crop masks;
- threshold policy;
- auto-derived classification provenance;
- manual override behavior;
- auto classification does not auto-approve;
- export/readiness integration is finalized later;
- Copper/support separation remains intact.

---

## 14. Acceptance Criteria

1. `git status --short` is clean.
2. Auto classification helper exists.
3. Copper semantic mask derives `COPPER_SLICE`.
4. Sap/Heartwood semantic mask derives `SAP_HEARTWOOD_SLICE`.
5. Empty/unknown/ambiguous masks derive `UNKNOWN` or `REVIEW_REQUIRED`.
6. Classification version links to semantic mask version.
7. Provenance/source indicates `AUTO_FROM_SEMANTIC_MASK`.
8. Manual override creates a new version and remains auditable.
9. Auto classification is not silently approved/export-ready.
10. Tests cover derivation and override.
11. Existing crop support/semantic workflows remain green.
12. Docs are updated.
13. Ticket is moved to the crop sprint done folder.
14. Full validation gate passes.

---

## 15. Suggested Commit Sequence

```bash
git commit -m "docs: define auto slice classification scope"
git commit -m "feat: add semantic mask classification derivation"
git commit -m "feat: surface auto classification and override"
git commit -m "test: cover auto slice classification"
git commit -m "docs: document auto classification provenance"
git commit -m "chore: finalize auto classification ticket"
```

---

## 16. Notes for Codex

- Do not implement export integration here.
- Do not auto-approve classifications.
- Preserve Copper/support separation.
- Classification is derived metadata, not a semantic mask.
- Manual override must stay possible.
