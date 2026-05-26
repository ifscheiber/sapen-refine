# RB-120 - Opportunistic Large Module Decomposition Map (Optimized Post-RB-119)

## Status

Completed

## Priority

P3

## Type

Maintainability / Refactoring Plan / Risk Reduction / Architecture Hygiene

## Source

- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Completed RB-107: safe version allocation via PostgreSQL advisory locks.
- Completed RB-112: async export job processing and export package writer boundary.
- Completed RB-114: storage/DB consistency reporting.
- Completed RB-116: audit coverage matrix and guard.
- Completed RB-119: documentation governance polish and docs link guard.

## Depends On

- Current post-RB-119 repository state.
- Existing tests and module boundaries.
- RB-113 remains open and must not be completed or modified by this ticket.
- RB-115-B and RB-115-C remain deferred unless the implementation discovers tiny documentation cross-links.
- RB-118-A through RB-118-E remain deferred public-upload hardening follow-ups.

## Blocks

- Lower-risk future work on editor save state, crop editors, export package generation, prediction import processing, and operations tooling.
- Avoiding accidental big-bang refactors in high-churn modules.
- Clear future ticket slicing when feature work touches large files.

## Context

The deep reviews identified several large editor/domain modules as real maintainability debt. This is not a production blocker by itself, but it increases change risk whenever future work touches editor state, crop workflows, exports, prediction imports, cleanup, or worker processing.

Since the original RB-120 ticket was created, several major hardening slices were implemented:

- RB-107 centralized version allocation behavior.
- RB-112 introduced async export jobs and `exportPackageWriter`.
- RB-114 added storage/DB consistency reporting.
- RB-116 added an audit coverage matrix and guard.
- RB-119 added docs governance/link validation.

Therefore, RB-120 should not perform broad refactors. It should produce a practical decomposition map and a small set of future implementation slices that can be activated opportunistically when those areas are next changed.

## Goal

Create an opportunistic decomposition map for the largest/highest-risk modules in SaPen Annotate.

The output should help future Codex/human work answer:

- Which files are too large or high-churn?
- What concerns are mixed together?
- What extraction seams are safe and valuable?
- Which extractions should only happen when touching that area for real feature/bug work?
- Which tests must protect behavior before/after extraction?
- Which refactors should be explicitly avoided as low-value or risky?

## Non-Goals

- Do not perform a big-bang rewrite.
- Do not refactor unrelated modules merely because they are large.
- Do not change product behavior.
- Do not change database schema.
- Do not rewrite editor/canvas internals without a concrete, tested extraction slice.
- Do not alter RB-112 async export architecture.
- Do not alter RB-114 cleanup behavior.
- Do not implement RB-115-B/C or RB-118 follow-ups.
- Do not complete or fabricate RB-113 iPad evidence.
- Do not remove or bypass existing tests/guards.

Tiny behavior-preserving extractions are acceptable only if they are clearly low-risk, directly support the decomposition map, and are fully covered by tests. If uncertain, produce docs/tickets only.

## Required Investigation

Inspect the current post-RB-119 codebase and identify high-churn/large modules.

At minimum, investigate:

### Editor / Canvas / Annotation

Likely areas:

- main editor client modules,
- crop semantic editor client,
- crop support editor client,
- editor save/reload hooks,
- canvas state and drawing tools,
- review controls and export eligibility integration.

Identify whether logic is mixed across:

- UI layout,
- canvas interaction,
- API orchestration,
- local dirty/save state,
- mask serialization/deserialization,
- review state,
- error handling.

### Export / Jobs / Package Generation

Likely areas after RB-112:

- export job creation,
- export processor/claim/lease/retry logic,
- export package writer,
- export manifest builders,
- prediction-analysis export writer,
- download/status APIs.

Identify whether logic is mixed across:

- DB job state,
- object packaging,
- manifest generation,
- checksum/integrity verification,
- UI status behavior,
- worker/operator concerns.

### Prediction Import / Assisted Correction

Likely areas:

- prediction import batch processing,
- prediction provenance,
- assisted correction domain functions,
- correction task routes/services,
- actor-context/audit interactions.

Identify extraction seams around:

- validation,
- storage key building,
- provenance mapping,
- version allocation,
- job/lease handling,
- API response formatting.

### Storage / Cleanup / Consistency

Likely areas after RB-114:

- storage cleanup classification,
- consistency reporting,
- object-family key parsing,
- hard-drift policy,
- dry-run vs execute behavior,
- operator output formatting.

Identify whether classification, reporting, and deletion policy can be separated more clearly later.

### Docs / Governance Tests

Consider whether docs-link/audit-route guards are now in a good shape or whether small extraction/shared helper opportunities exist.

## Required Output

Create a decomposition plan document, for example:

- `docs/architecture/decomposition-map.md`, or
- `docs/maintenance/opportunistic-decomposition-map.md`

Follow repo conventions if an existing location is better.

The document should include:

1. **Scope and principle**
   - opportunistic refactoring only;
   - no big-bang rewrite;
   - behavior-preserving extractions must be test-backed.

2. **Module inventory**
   - file/module path;
   - rough concern areas;
   - risk level;
   - current tests protecting it;
   - related tickets/features.

3. **Recommended extraction seams**
   - small, concrete extraction candidates;
   - what would move;
   - what should not move;
   - required tests;
   - when to activate.

4. **Suggested future tickets**
   - narrow, implementation-ready slices;
   - linked to the relevant module/feature area;
   - explicitly marked opportunistic/deferred unless blocking a feature.

5. **Do-not-refactor-yet list**
   - areas where a broad rewrite would be high-risk;
   - reasons to wait.

6. **Validation expectations**
   - minimum test commands for each extraction area.

## Suggested Extraction Candidates To Evaluate

Do not blindly implement these; evaluate against the current code.

### Candidate 1 - Editor Save/API Orchestration

Possible future ticket:

`RB-120-A-editor-save-orchestration-extraction.md`

Potential seam:

- save request assembly,
- dirty/error state,
- stable API error handling,
- reload after save,
- version/result handling.

### Candidate 2 - Crop Canvas Interaction Hooks

Possible future ticket:

`RB-120-B-crop-canvas-interaction-hooks.md`

Potential seam:

- pointer/touch/Pencil interaction,
- brush/eraser tools,
- zoom/pan state,
- canvas coordinate transforms,
- Safari/iPad-specific guardrails.

This should likely wait until RB-113 real iPad evidence exists.

### Candidate 3 - Export Manifest Builders

Possible future ticket:

`RB-120-C-export-manifest-builder-split.md`

Potential seam:

- manifest construction,
- package writing,
- DB job lifecycle,
- object integrity verification.

Ensure alignment with RB-112 `exportPackageWriter`.

### Candidate 4 - Prediction Import Processor Boundaries

Possible future ticket:

`RB-120-D-prediction-import-processor-boundaries.md`

Potential seam:

- validation,
- object reads/writes,
- provenance mapping,
- correction task creation,
- worker/lease state.

### Candidate 5 - Storage Cleanup Classification

Possible future ticket:

`RB-120-E-storage-cleanup-classification-split.md`

Potential seam:

- object key family classification,
- consistency findings,
- deletion eligibility,
- output formatting.

Ensure RB-114 behavior remains unchanged.

### Candidate 6 - Governance Guard Utilities

Possible future ticket:

`RB-120-F-governance-guard-utils.md`

Potential seam:

- docs link/path guard helpers,
- audit matrix route scanner helpers,
- handoff archive policy helpers,
- shared test utilities.

Only if duplication is clear and extraction reduces future maintenance.

## Requirements

- Use the current repository state; do not rely on stale line counts from the original review if files have changed.
- Prefer current complexity and risk over raw file length alone.
- For each future slice, state whether it should wait for:
  - RB-113 iPad evidence,
  - RB-115-B unattended worker context,
  - RB-115-C Core handoff contract,
  - RB-118 public upload hardening,
  - a future feature request touching that area.
- If small docs-only follow-up tickets are created, make them narrow and avoid duplicating existing RB-115/RB-118 follow-ups.
- Update relevant architecture/maintenance docs and sprint README/backlog.
- Keep the active RB-120 ticket as the implemented ticket and move it to done only after the decomposition map exists.

## Acceptance Criteria

- A decomposition map document exists.
- It inventories the main large/high-risk modules in the current post-RB-119 repo.
- It identifies safe extraction seams and explicitly avoids big-bang rewrites.
- It creates or lists narrow future tickets for opportunistic extraction.
- It marks RB-113-dependent editor/iPad work as waiting for real-device evidence where appropriate.
- It does not implement broad refactors.
- It does not change product behavior.
- It does not close RB-113.
- It does not implement RB-118 public-upload follow-ups.
- Worktree is clean and handoff dry-run passes.

## Validation

For docs/planning-only work:

```bash
git status --short
git diff --check
npm run lint
npm run check:docs-links
npm run handoff:archive -- --dry-run
```

If small code/test helpers are extracted, also run:

```bash
npm run typecheck
npm run test
npm run build
```

If editor or export code is touched, also run:

```bash
npm run test:e2e
```

## Completion Protocol

1. Create the decomposition map document.
2. Create narrow future extraction tickets only if they add value.
3. Update sprint README/remediation backlog/known-gaps if applicable.
4. Move this optimized RB-120 ticket to the appropriate `done/` folder.
5. Leave RB-113 open unless real physical iPad evidence exists.
6. Leave RB-115-B/C and RB-118-A through RB-118-E deferred unless separately scheduled.
7. Commit the completed planning slice.
8. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- This is primarily a planning/maintainability ticket.
- Do not rewrite large modules.
- Do not create broad “refactor everything” follow-ups.
- Prefer concrete future slices with clear activation conditions.
- Keep RB-113, RB-115-B/C, and RB-118 follow-ups separate.
