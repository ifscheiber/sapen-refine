# RB-115-C - Core Handoff Actor Provenance Contract

## Status

Planned

## Priority

P2 before Core handoff implementation

## Type

External Integration / Provenance / Attribution

## Source

- `docs/08-adr/ADR-007-system-actor-attribution-model.md`
- Future SaPen Core handoff workflow

## Goal

Define the external-system actor and provenance contract required before SaPen Core handoff can write or enqueue work in SaPen Annotate.

## Scope

- Define required external actor labels, source system ids, request ids, timestamps, and provenance fields.
- Specify how Core-triggered work maps to `triggeredBy` and `performedBy`.
- Preserve SaPen Annotate's boundary: Core handoff must use explicit contracts, not implicit shared project semantics.
- Add schema/API tickets if the contract requires persisted fields.

## Acceptance Criteria

- Core-originated writes cannot be anonymous or confused with human annotation.
- Export/review/audit records can show that Core triggered or supplied the work.
- The contract is ready to feed future Core handoff implementation tickets.
