# RB-120-E - Storage Cleanup Classification Split

## Status

Planned / Opportunistic

## Priority

P3 unless cleanup or consistency reporting work makes it blocking

## Type

Maintainability / Storage Cleanup / Refactor

## Source

- `docs/01-architecture/opportunistic-decomposition-map.md`
- RB-120 follow-up

## Activation Condition

Activate only when cleanup categories, consistency reporting, hard-drift visibility, or RB-118-D quarantine cleanup is already being changed.

## Goal

Separate cleanup key classification, consistency finding summarization, and response/result formatting from deletion execution.

## Requirements

- Do not change RB-114 hard-drift policy in the same mechanical extraction.
- Keep protected-object deletion boundaries unchanged.
- Preserve existing `cleanup.summary` and `cleanup.results` API response fields.
- Ensure ordinary cleanup candidates remain findings/warnings only unless protected object drift exists.

## Validation

- `npm run test -- tests/unit/storage-cleanup.test.ts tests/unit/storage-cleanup-route-contract.test.ts tests/integration/storage-cleanup.test.ts`
- RB-118-D tests when quarantine cleanup is implemented.
