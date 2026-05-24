# RB-115-B - Unattended Worker Actor Context

## Status

Planned

## Priority

P2 before scheduled workers

## Type

Workers / Attribution / Operations

## Source

- `docs/08-adr/ADR-007-system-actor-attribution-model.md`
- RB-112 async export jobs
- RB-114 cleanup/consistency reporting

## Goal

Make export, prediction-import, and cleanup workers safe to run unattended by giving each run explicit `triggeredBy` and `performedBy` actor context.

## Scope

- Define required actor labels for scheduled export processing, prediction-import processing, cleanup, and consistency checks.
- Keep `processorId` / `processorRunId` as non-secret execution metadata.
- Decide how unattended runs authenticate or obtain authorization without normal human login.
- Update worker scripts, APIs, docs, and tests only after RB-115-A establishes the audit representation.

## Acceptance Criteria

- Scheduled/unattended worker runs are not attributed only to a human placeholder or anonymous audit row.
- Operators can identify the trigger, worker label, and processor run id for each worker pass.
- Current named-user trial scripts remain compatible or have a documented migration path.
