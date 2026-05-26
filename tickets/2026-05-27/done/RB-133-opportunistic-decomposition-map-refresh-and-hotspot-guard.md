# RB-133 - Opportunistic Decomposition Map Refresh And Hotspot Guard

Status: Done
Priority: P3
Type: Maintainability / production-change risk reduction

## Context

[../../docs/01-architecture/opportunistic-decomposition-map.md](../../docs/01-architecture/opportunistic-decomposition-map.md) was created by RB-120 as a map for future opportunistic refactors. Since then, editor and export work increased several module sizes.

Current review measurements:

- `src/features/editor/EditorClient.tsx` - 2167 lines
- `src/features/editor/CropSemanticEditorClient.tsx` - 1657 lines
- `src/server/domain/exports.ts` - 1998 lines
- `src/server/domain/storageCleanup.ts` - 1100 lines
- `src/server/domain/predictionImportBatches.ts` - 1326 lines
- `src/server/domain/sapenCnnTrainingSnapshot.ts` - 821 lines

The map still lists older post-RB-119 line counts for some files and does not yet reflect the newer SaPen-CNN export snapshot/materializer surface.

## Impact

Large modules are not automatically defects, but stale maintainability maps reduce the value of the guardrail. Future production fixes in editor, export, and storage cleanup paths could become broader than necessary if engineers rely on outdated decomposition targets.

## Goal

Refresh the decomposition map and add a lightweight guard so large-module drift is visible without forcing disruptive refactors.

## Non-Goals

- Do not refactor production modules in this ticket.
- Do not block small urgent bug fixes solely because a module is large.
- Do not create abstractions without adjacent feature or bug work.

## Implementation Plan

1. Update [../../docs/01-architecture/opportunistic-decomposition-map.md](../../docs/01-architecture/opportunistic-decomposition-map.md) with current line counts and newly grown export/CNN snapshot hotspots.
2. Add explicit "activate only when touched" guidance for each hotspot to prevent refactor-only churn.
3. Consider a lightweight test or script that reports major line-count drift for mapped hotspots without failing normal CI until a threshold policy is accepted.
4. If a failing guard is introduced, set thresholds conservatively and document the rationale.

## Files to Inspect

- `docs/01-architecture/opportunistic-decomposition-map.md`
- `src/features/editor/EditorClient.tsx`
- `src/features/editor/CropSemanticEditorClient.tsx`
- `src/server/domain/exports.ts`
- `src/server/domain/storageCleanup.ts`
- `src/server/domain/predictionImportBatches.ts`
- `src/server/domain/sapenCnnTrainingSnapshot.ts`
- `tests/unit`

## Acceptance Criteria

- The map reflects current major editor, export, prediction-import, cleanup, and SaPen-CNN snapshot modules.
- Refactor activation guidance remains opportunistic and scoped.
- Any guard added is documented and does not force unrelated refactors.
- Validation includes the guard if added, `npm run check:docs-links`, and `git diff --check`.

## Validation Commands

```bash
wc -l src/features/editor/EditorClient.tsx src/features/editor/CropSemanticEditorClient.tsx src/server/domain/exports.ts src/server/domain/storageCleanup.ts src/server/domain/predictionImportBatches.ts src/server/domain/sapenCnnTrainingSnapshot.ts
npm run check:docs-links
git diff --check
```
