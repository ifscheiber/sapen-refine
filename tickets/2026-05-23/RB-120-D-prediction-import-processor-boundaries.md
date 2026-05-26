# RB-120-D - Prediction Import Processor Boundaries

## Status

Planned / Opportunistic

## Priority

P3 unless prediction-import processing work makes it blocking

## Type

Maintainability / Prediction Import / Refactor

## Source

- `docs/01-architecture/opportunistic-decomposition-map.md`
- RB-120 follow-up

## Activation Condition

Activate only when batch import manifest parsing, retry, processing, or lease behavior is already being changed.

## Goal

Separate pure prediction-import batch parsing and processor helpers from DB state transitions while preserving current processing semantics.

## Requirements

- Keep RB-057 item import service calls unchanged.
- Do not alter claim/retry/stale recovery behavior without integration tests.
- Keep future Core handoff provenance out of scope until RB-115-C.
- Preserve sanitized responses without staging keys.

## Validation

- `npm run test -- tests/integration/prediction-import-batches.test.ts tests/unit/prediction-import-batch-leases.test.ts`
- Storage cleanup tests if staging cleanup interaction changes.
