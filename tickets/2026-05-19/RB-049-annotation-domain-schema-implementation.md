# RB-049 - Annotation Domain Schema Implementation

## Status

Proposed

## Priority

High

## Type

Schema / Domain Model / Persistence

## Depends on

- RB-048 - Annotation Domain Model ADR & Schema Design

## Goal

Implement the first Prisma schema baseline for the RB-048 annotation-domain model.

The implementation should introduce persisted concepts for label schema versions, image metadata, annotation tasks/sessions, semantic/support artifact versions, review state, and export records where needed for later slices.

## Scope

- Update `prisma/schema.prisma` and migrations.
- Because the app is still in development, prefer a clean migration baseline and local DB rebuild over complex preservation migrations.
- Preserve or deliberately replace MVP concepts according to `docs/06-data/prisma-schema-proposal.md`.
- Keep raw images, mask versions, review decisions, and export records attributable.
- Add focused DB/domain tests where practical.
- Update `docs/06-data/prisma.md`, `docs/prisma/schema.md`, and related docs.

## Non-Goals

- Full UI migration.
- Full review/approval UI.
- Training export implementation.
- Model preprediction implementation.
- Real customer data migration.

## Acceptance Criteria

- Prisma schema reflects the chosen RB-048 model shape.
- Local rebuild path is documented.
- `MaskKind.REFINED` is removed, replaced, or explicitly isolated as compatibility debt.
- Label schema, review state, semantic/support artifact separation, and attribution are represented.
- Validation baseline is green.
- Ticket is moved to `done` when complete.
