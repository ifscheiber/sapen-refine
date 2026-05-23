# RB-092 — Crop Workflow Review / Approval Integration

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Review / Approval / Workflow Readiness / Crop Annotation / Export Readiness / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-085 — Crop-Based Slice Annotation Workflow ADR / Design
- RB-088 — Crop Editor: Mandatory Pixel-Perfect Slice Support Mask
- RB-089 — Crop-Constrained Semantic Annotation
- RB-090 — Auto Slice Classification from Semantic Masks
- RB-091 — Crop / Original Coordinate Export Contract

## Blocks

- Manual crop workflow smoke test
- Crop-based customer annotation trial
- Post-sprint crop workflow triage

---

## 1. Context

RB-091 implemented the crop training export contract:

- `ExportTarget.CROP_TRAINING`,
- `ExportItem.derivedCropId`,
- crop manifest `sapen-annotate-crop-training-export-v1`,
- crop readiness and skipped reasons,
- ZIP package layout,
- export item provenance,
- UI crop training export option and readiness counts.

RB-092 is the final crop-sprint integration slice.

The existing RB-092 draft correctly states that the crop workflow introduces new derived artifacts — BBox versions, derived crops, crop support masks, crop semantic masks and auto classifications — and that review/approval must define what is required before export. It also correctly says BBox/crop are provenance artifacts, not ground-truth targets; support/semantic masks require approval; classification requires approval or an explicit accepted-auto policy; and lineage mismatches must be `REVIEW_REQUIRED`. fileciteturn36file0

This optimized ticket keeps RB-092 focused on:

```text
review/readiness policy
crop-slice readiness summaries
UI integration
export-readiness consistency
tests
```

It must not redesign the export manifest again and must not add a review dashboard.

---

## 2. Goal

Integrate crop-based support, semantic and classification artifacts into the existing review/approval and export-readiness workflow.

At the end of RB-092:

1. Crop-slice readiness is consistently computed.
2. UI shows crop readiness per slice/image/project.
3. Crop training export readiness uses the same readiness rules.
4. Lineage mismatches are detected and surfaced.
5. Approved support + approved semantic + approved/accepted classification can become crop-export-ready.
6. Missing/draft/rejected/stale artifacts are not export-ready.
7. Existing full-image review/export workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- new review dashboard,
- multi-reviewer workflow,
- notification system,
- export manifest redesign,
- model inference,
- external Core integration,
- new annotation tools,
- new crop editor features,
- prediction-analysis export changes,
- automatic approval of support/semantic masks,
- broad RBAC changes.

If a richer review dashboard is needed, create a follow-up ticket.

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

## 5. Review / Readiness Policy

### 5.1 Artifact roles

Define crop workflow roles:

```text
BBox version:
  provenance / crop proposal only
  not a ground-truth target
  does not require approval for export if derived crop lineage is valid

Derived crop:
  provenance / derived image artifact
  not a ground-truth target
  does not require approval by itself
  must be lineage-valid and available

Support mask:
  ground-truth instance geometry target
  requires approval for export-ready crop item

Semantic mask:
  ground-truth semantic target
  requires approval for export-ready crop item

Classification:
  derived or manual target
  requires approved manual classification or explicit accepted-auto policy
```

### 5.2 Default classification policy

Recommended default for RB-092:

```text
Auto-derived classification does not become export-ready by itself.
It must either be approved through the existing review/classification flow,
or a clearly documented accepted-auto policy must be enabled.
```

If accepted-auto policy is implemented, it must be explicit, documented, tested and visible in readiness reasons.

If not implemented, mark auto classification as `NEEDS_REVIEW` / `NOT_APPROVED`.

### 5.3 Export-ready rule

A crop slice is export-ready when:

```text
support mask is approved
semantic mask is approved
classification is approved or accepted by explicit auto policy
support, semantic and classification share the same crop/support/semantic lineage
```

### 5.4 Not-ready reasons

Use stable readiness reasons such as:

```text
MISSING_CROP
MISSING_SUPPORT_MASK
SUPPORT_NOT_APPROVED
MISSING_SEMANTIC_MASK
SEMANTIC_NOT_APPROVED
MISSING_CLASSIFICATION
CLASSIFICATION_NOT_APPROVED
AUTO_CLASSIFICATION_NEEDS_REVIEW
LINEAGE_MISMATCH
SUPPORT_SEMANTIC_MISMATCH
CLASSIFICATION_SEMANTIC_MISMATCH
COORDINATE_SPACE_MISMATCH
CROP_NOT_CURRENT
```

Exact names may follow repo conventions.

### 5.5 Lineage checks

Readiness must verify:

```text
support.derivedCropId === crop.id
semantic.derivedCropId === crop.id
semantic.supportMaskVersionId === support.versionId
classification.derivedFromSemanticMaskVersionId === semantic.versionId
classification.sliceInstanceId === crop.sliceInstanceId
support.sliceInstanceId === crop.sliceInstanceId
semantic.sliceInstanceId === crop.sliceInstanceId
coordinateSpace === CROP_PIXEL for crop masks
```

A semantic mask saved against an older support/crop version must not be export-ready with a newer support/crop without regeneration/re-review.

---

## 6. Domain / Service Scope

Create or extend a central crop readiness resolver.

Suggested location:

```text
src/server/domain/cropReadiness.ts
src/server/domain/exports/cropReadiness.ts
```

The resolver should return per crop/slice:

```ts
{
  sliceInstanceId: string;
  derivedCropId: string;
  status: "READY" | "NOT_READY" | "PARTIAL" | "REVIEW_REQUIRED";
  reasons: string[];
  support?: {...};
  semantic?: {...};
  classification?: {...};
  lineage: {...};
}
```

Reuse the same resolver for:

- project/image/slice UI summaries,
- crop export readiness,
- tests.

Do not duplicate readiness logic in UI and export service.

---

## 7. API Scope

Add or extend read-only readiness endpoints if needed.

Suggested routes:

```text
GET /api/images/[imageId]/crop-readiness
GET /api/projects/[projectId]/crop-readiness
GET /api/slices/[sliceInstanceId]/crop-readiness
```

or integrate into existing project/image/crop APIs if cleaner.

Requirements:

- authenticated user,
- project access,
- stable JSON errors,
- no private storage keys,
- no mutation in readiness endpoints.

No new approval mutation APIs unless existing review APIs cannot handle crop support/semantic/classification versions.

---

## 8. UI Scope

### 8.1 Per-slice readiness

Show crop readiness in the existing crop/BBox panel or slice panel.

Must display:

```text
support: missing / draft / submitted / approved / rejected
semantic: missing / draft / submitted / approved / rejected
classification: auto/manual + review state
lineage: ok / mismatch / stale
export readiness: ready / not ready / review required
```

### 8.2 Per-image/project summaries

Add compact summary counts where useful:

```text
ready crop slices
not-ready crop slices
missing support
missing semantic
missing classification
lineage mismatch
```

Do not build a full dashboard.

### 8.3 Guidance

For not-ready items, UI should guide the next action:

```text
Open support editor
Open semantic editor
Review support mask
Review semantic mask
Review classification
Regenerate crop / semantic mask due to lineage mismatch
```

### 8.4 Existing export UI

Crop training export UI should use the same readiness resolver or at least the same readiness reasons.

Do not duplicate inconsistent readiness logic.

---

## 9. Review Integration

### 9.1 Support and semantic review

Crop support and semantic masks should use existing review decision infrastructure if possible.

Ensure:

- submitted/approved/rejected states are visible,
- approval is role-protected,
- rejected versions are not export-ready,
- latest approved version resolution is deterministic.

### 9.2 Classification review

If classification review already exists, integrate auto/manual classification versions into it.

If no classification review UI exists, implement minimal support needed for readiness:

- show classification source and review state;
- allow permitted reviewer/owner/QA to approve/reject classification if current workflow supports it;
- otherwise mark classification review UI as deferred and keep export readiness not-ready.

Do not silently accept unreviewed auto classification.

---

## 10. Export Integration

RB-091 already added crop training export. RB-092 must ensure export uses the final readiness resolver.

Requirements:

- export includes only READY crop items by default;
- skipped/not-ready items have clear reasons;
- lineage mismatch prevents export;
- existing full-image export remains unchanged;
- prediction-analysis export remains unchanged.

Do not redesign manifest unless a field is missing to express readiness reasons.

---

## 11. Tests

### 11.1 Unit tests

Cover:

- readiness resolver with all approved artifacts = READY;
- missing support = NOT_READY;
- missing semantic = NOT_READY;
- missing classification = NOT_READY;
- support not approved = NOT_READY;
- semantic not approved = NOT_READY;
- auto classification not approved = NOT_READY unless accepted-auto policy enabled;
- lineage mismatch = REVIEW_REQUIRED / NOT_READY;
- coordinate space mismatch = NOT_READY.

### 11.2 Integration/API tests

Cover:

- readiness endpoint returns expected reasons;
- crop export uses readiness resolver;
- export includes only ready crops;
- manual override classification is respected;
- stale semantic from old support version is not ready;
- existing export target still works.

### 11.3 E2E tests

Add a focused E2E if stable:

```text
create/use crop workflow fixture
approve support
approve semantic
approve or manually accept classification
see crop readiness become ready
create crop training export
```

If browser review flow is too heavy, cover readiness thoroughly in integration tests and update manual smoke docs.

---

## 12. Documentation Updates

Update:

```text
docs/06-data/crop-based-slice-annotation.md
docs/06-data/training-export-contract.md
docs/06-data/mask-and-artifact-versioning.md
docs/03-features/projects.md
docs/03-features/editor.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/07-testing/manual-smoke-ipad-safari-gate.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Docs must state:

- crop readiness policy;
- support/semantic/classification approval requirements;
- accepted-auto policy status;
- lineage mismatch behavior;
- export readiness behavior;
- BBox/crop are provenance artifacts, not ground-truth review targets;
- prediction-analysis export remains separate.

---

## 13. Acceptance Criteria

1. `git status --short` is clean.
2. Central crop readiness resolver exists.
3. UI shows crop-slice readiness.
4. Project/image/crop export readiness uses consistent rules.
5. Approved support + approved semantic + approved/accepted classification can be ready.
6. Missing/draft/rejected artifacts are not ready.
7. Lineage mismatch is detected and prevents export readiness.
8. Manual classification override is respected.
9. Auto classification is not silently export-ready unless explicit accepted-auto policy is implemented and documented.
10. Existing full-image export remains green.
11. Crop training export uses readiness rules.
12. Tests cover readiness cases.
13. Docs are updated.
14. Ticket is moved to the crop sprint done folder.
15. Full validation gate passes.

---

## 14. Suggested Commit Sequence

```bash
git commit -m "docs: define crop readiness review policy"
git commit -m "feat: add crop readiness resolver"
git commit -m "feat: surface crop workflow readiness"
git commit -m "test: cover crop review readiness rules"
git commit -m "docs: document crop workflow review integration"
git commit -m "chore: finalize crop review integration ticket"
```

---

## 15. Notes for Codex

- This is the final crop sprint integration slice.
- Do not build a full review dashboard.
- Do not silently approve auto classifications.
- Keep export/readiness rules centralized.
- Prefer explicit not-ready reasons over permissive export behavior.
