# Opportunistic Decomposition Map

## Purpose

This map records maintainability hotspots after RB-119. It is not a rewrite plan. Use it when a future feature, bug fix, or production hardening ticket already touches one of these areas and a small behavior-preserving extraction would reduce risk.

Rules:

- Prefer opportunistic extractions over broad module rewrites.
- Add or preserve tests before moving behavior.
- Keep public API, route, schema, and storage semantics unchanged unless the scheduled feature explicitly changes them.
- Do not extract code only because a file is long; extract only when a concern boundary is clear and tests can pin behavior.

## Current Hotspots

| Module | Size | Mixed concerns | Risk | Current protection |
| --- | ---: | --- | --- | --- |
| `src/server/domain/exports.ts` | 1770 lines | training/crop readiness, manifest construction, package-source construction, export caps, async job processing, download authorization | High | `tests/integration/export-workflow.test.ts`, export cap tests, RB-109 DB constraints |
| `src/server/domain/predictionAnalysisExports.ts` | 1685 lines | prediction-analysis readiness, QA metric inputs, manifest construction, package sources, caps, async job processing, downloads | High | `tests/integration/prediction-analysis-export.test.ts`, metric unit tests |
| `src/features/editor/EditorClient.tsx` | 1692 lines | source-image canvas, BBox planning, assisted correction, save state, review/classification actions, overlays | High | editor helper/canvas tests, desktop and crop E2E smoke |
| `src/features/editor/CropSemanticEditorClient.tsx` | 1365 lines | crop canvas, support overlay, semantic-family guards, save/reload, classification overrides, review actions | High | crop semantic integration tests, crop mask operation tests, E2E crop closeout |
| `src/features/editor/CropSupportEditorClient.tsx` | 953 lines | crop canvas, support mask state, save/reload, review actions | Medium | crop support integration tests, mask upload route contract tests |
| `src/server/domain/predictionImportBatches.ts` | 1335 lines | ZIP manifest parsing, staging, membership, item claiming, stale recovery, processing, retry, serialization | High | `tests/integration/prediction-import-batches.test.ts`, lease unit tests |
| `src/server/domain/storageCleanup.ts` | 1099 lines | option parsing, key classification, cleanup candidates, consistency findings, hard-drift policy, execution, audit | High | `tests/integration/storage-cleanup.test.ts`, cleanup unit/route-contract tests |
| `src/server/domain/cropReadiness.ts` | 1031 lines | readiness rules, review-action availability, lineage validation, serialization, summary counts | Medium | crop semantic/export integration tests, slice navigator tests |
| `src/server/domain/cropSemanticMasks.ts` | 1006 lines | state loading, support-lineage validation, semantic-family reset, value validation, version creation, readiness serialization | Medium | crop semantic integration tests, slice-domain unit tests |

## Recommended Extraction Slices

### RB-120-A - Editor Save Orchestration Extraction

Activate only when editor save/reload or dirty-state behavior is already being changed.

Move:

- request assembly for semantic/support/correction saves,
- dirty revision and save generation transitions,
- stable API error normalization,
- reload-after-save result handling.

Do not move:

- canvas drawing algorithms,
- pointer/Pencil behavior,
- review UI layout.

Required validation:

- `npm run typecheck`
- `npm run test -- tests/unit/editor-helpers.test.ts tests/unit/mask-upload-route-contracts.test.ts`
- focused E2E touching editor save if behavior changes.

### RB-120-B - Crop Canvas Interaction Hooks

Wait for RB-113 real iPad Safari evidence or a concrete canvas/pointer feature.

Move:

- shared pointer stroke/lasso state between crop semantic and crop support editors,
- fit/zoom/canvas backing setup shared by crop editors,
- preview overlay rendering helpers that are already behavior-identical.

Do not move:

- semantic-family policy,
- Copper support policy,
- iPad/Safari-specific behavior before evidence exists.

Required validation:

- `npm run test -- tests/unit/editor-canvas-geometry.test.ts tests/unit/crop-mask-operations.test.ts`
- crop workflow E2E when interaction behavior changes.

### RB-120-C - Export Manifest Builder Split

Activate when changing training, crop-training, or prediction-analysis manifest/package behavior.

Move:

- pure manifest builders into target-specific builder modules,
- package-source list construction into pure helpers,
- cap estimation helpers beside their target builders.

Do not move:

- RB-112 job claim/lease/retry behavior,
- `exportPackageWriter` object-byte verification boundary,
- RB-109 role/reference constraints.

Required validation:

- `npm run test -- tests/integration/export-workflow.test.ts tests/integration/prediction-analysis-export.test.ts`
- export cap and prediction metric unit tests when affected.

### RB-120-D - Prediction Import Processor Boundaries

Activate when changing batch import manifest, retry, processing, or lease behavior.

Move:

- ZIP manifest parsing and path safety into a pure parser module,
- item status/count summarization into pure helpers,
- processor context and actor-context creation into a narrow helper.

Do not move:

- RB-057 import service calls,
- DB claim/retry state transitions without integration coverage,
- future Core handoff provenance before RB-115-C.

Required validation:

- `npm run test -- tests/integration/prediction-import-batches.test.ts tests/unit/prediction-import-batch-leases.test.ts`
- storage cleanup tests when staging cleanup interaction changes.

### RB-120-E - Storage Cleanup Classification Split

Activate when changing cleanup categories, consistency reporting, or public-upload quarantine cleanup.

Move:

- object-key family classification and export-prefix classification into pure helpers,
- consistency finding summarization into a reporting helper,
- cleanup result formatting into a serializer helper.

Do not move:

- hard-drift policy semantics,
- protected-object deletion boundary,
- existing `cleanup.summary` / `cleanup.results` response fields.

Required validation:

- `npm run test -- tests/unit/storage-cleanup.test.ts tests/unit/storage-cleanup-route-contract.test.ts tests/integration/storage-cleanup.test.ts`
- RB-118-D tests when quarantine cleanup is implemented.

### RB-120-F - Governance Guard Utilities

Activate only if another governance guard is added or duplication becomes clear.

Move:

- shared Markdown file walking/link parsing from docs-link tests,
- shared route/file scanners from audit/API inventory tests,
- common path filtering if it stays aligned with handoff archive policy.

Do not move:

- handoff archive production behavior for test neatness alone,
- audit matrix semantics.

Required validation:

- `npm run check:docs-links`
- `npm run test -- tests/unit/audit-coverage-matrix.test.ts tests/unit/handoff-archive.test.ts`

## Do Not Refactor Yet

- Do not rewrite `EditorClient.tsx` or crop editor clients before RB-113 if the change affects touch, pointer, zoom, or Pencil behavior.
- Do not merge training export and prediction-analysis export flows into a generic exporter; they have different manifest semantics and QA/proposal boundaries.
- Do not split RB-112 worker/job lifecycle out of export modules unless a job-processing feature is already being changed.
- Do not split storage cleanup while changing hard-drift policy; classify first, then change behavior in a separate ticket.
- Do not use RB-120 to implement RB-115-B, RB-115-C, or RB-118-A through RB-118-E.

## Activation Checklist

Before starting any RB-120 follow-up:

1. Confirm the feature/bug ticket already touches the module.
2. Identify the smallest pure or boundary-preserving extraction.
3. Run the existing focused tests before editing.
4. Add or update tests for the extracted boundary.
5. Keep behavior changes and mechanical moves in separate commits where practical.
6. Update the module docs only for changed ownership, not for speculative future work.
