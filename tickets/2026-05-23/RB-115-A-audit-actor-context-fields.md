# RB-115-A - Audit Actor Context Fields

## Status

Planned

## Priority

P2 before unattended automation

## Type

Audit / Attribution / Schema Design

## Source

- `docs/08-adr/ADR-007-system-actor-attribution-model.md`
- RB-115 system actor attribution ADR

## Goal

Add a concrete audit representation for RB-115 actor context so audit rows can distinguish `triggeredBy` from `performedBy` without relying only on free-form details.

## Scope

- Decide whether to add typed `AuditLog` fields or a documented structured details shape.
- Cover `actorType`, `actorLabel`, `triggeredByUserId`, `performedBy`, `processorId`, `processorRunId`, and external actor labels where needed.
- Preserve existing `AuditLog.actorId` behavior for authenticated human users.
- Add migration/tests/docs if schema fields are chosen.

## Acceptance Criteria

- Audit records can be classified by the RB-115/RB-116 attribution categories.
- Existing human-user audit consumers remain compatible.
- No anonymous production write path is introduced.
