# RB-090 — Crop Workflow Review / Approval Integration

## Status

Proposed / Depends on RB-086–RB-089

## Priority

Medium / High

## Type

Review / Approval / Workflow Readiness / Crop Annotation / Tests

## Goal

Integrate crop-based support, semantic and auto-classification artifacts into the existing review/approval and export-readiness workflows.

---

## Context

Crop workflow introduces new derived artifacts:

- BBox versions,
- derived crops,
- crop support masks,
- crop semantic masks,
- auto classifications.

Existing review/approval must clearly define what is required before export.

---

## Non-Goals

Do **not** implement:

- new review dashboard,
- multi-reviewer workflow,
- notification system,
- export contract changes beyond readiness integration,
- model inference.

---

## Review Scope

Define review requirements for:

```text
BBox proposal
Derived crop
Support mask
Semantic mask
Auto classification
Manual classification override
```

Recommended default:

```text
BBox/crop are provenance artifacts, not ground truth targets.
Support mask requires approval.
Semantic mask requires approval.
Classification requires approval or accepted auto policy.
```

---

## Readiness Rules

A crop slice is export-ready when:

```text
support mask approved
semantic mask approved
classification approved or accepted policy
all artifacts reference same crop/support lineage
```

If lineage mismatch occurs:

```text
REVIEW_REQUIRED
```

---

## UI Scope

Add/update readiness summaries:

- per slice,
- per image,
- project export readiness.

Show:

```text
support missing/draft/submitted/approved
semantic missing/draft/submitted/approved
classification auto/manual/review state
lineage mismatch warnings
```

---

## Tests

- approved support + semantic + classification = export-ready,
- missing support = not ready,
- Copper semantic without support = not ready,
- stale semantic from old crop/support version = review required,
- manual override classification respected,
- export includes only approved/ready artifacts.

---

## Acceptance Criteria

1. Review/readiness rules for crop workflow are documented.
2. UI shows crop-slice readiness.
3. Export readiness uses crop workflow rules.
4. Lineage mismatch is detected.
5. Existing review/export workflows remain green.
6. Tests cover readiness cases.
7. Docs updated.
8. Ticket moved to done.
9. Full validation gate passes.
