# RB-120-C - Export Manifest Builder Split

## Status

Planned / Opportunistic

## Priority

P3 unless export manifest/package work makes it blocking

## Type

Maintainability / Export / Refactor

## Source

- `docs/01-architecture/opportunistic-decomposition-map.md`
- RB-120 follow-up

## Activation Condition

Activate only when training, crop-training, or prediction-analysis export manifest/package behavior is already being changed.

## Goal

Split pure manifest and package-source builders from export job lifecycle logic without changing RB-112 async processing or package writer boundaries.

## Requirements

- Preserve manifest versions and package paths.
- Keep `exportPackageWriter` as the verified object-byte package boundary.
- Do not merge training export and prediction-analysis export semantics.
- Preserve RB-109 export item role/reference constraints.

## Validation

- `npm run test -- tests/integration/export-workflow.test.ts tests/integration/prediction-analysis-export.test.ts`
- Export cap and QA metric unit tests if affected.
