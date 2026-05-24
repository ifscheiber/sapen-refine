# RB-120-F - Governance Guard Utilities

## Status

Planned / Opportunistic

## Priority

P3

## Type

Maintainability / Test Utilities / Governance

## Source

- `docs/01-architecture/opportunistic-decomposition-map.md`
- RB-120 follow-up

## Activation Condition

Activate only when another governance guard is added or clear duplication appears between docs-link, audit matrix, route inventory, and handoff archive tests.

## Goal

Extract shared test utilities for governance guards where doing so reduces duplication without changing production handoff or audit behavior.

## Requirements

- Keep production `scripts/create-handoff-archive.mjs` behavior unchanged unless a separate handoff ticket schedules it.
- Do not weaken audit matrix or docs-link coverage.
- Keep helpers test-only unless a production script explicitly needs them.

## Validation

- `npm run check:docs-links`
- `npm run test -- tests/unit/audit-coverage-matrix.test.ts tests/unit/handoff-archive.test.ts`
