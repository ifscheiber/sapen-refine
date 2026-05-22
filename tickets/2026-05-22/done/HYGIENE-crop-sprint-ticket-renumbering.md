# HYGIENE - Crop Sprint Ticket Renumbering

## Status

Implemented

## Priority

Medium

## Type

Ticket Hygiene / Backlog Consistency

## Context

The crop-slice annotation sprint tickets currently conflict with the active RB-084 Docker/Prisma follow-up and contain inconsistent numbering between filenames, headings, dependencies, and the sprint overview.

## Goal

Renumber the crop-slice annotation sprint tickets into a consistent RB-085 through RB-092 sequence while leaving the active RB-084 Docker/Prisma follow-up unchanged.

## Scope

- Rename crop sprint ticket files into logical sprint order.
- Update ticket headings, status/dependency lines, and sprint overview references.
- Do not change product behavior, schema, APIs, runtime code, or implementation scope.

## Acceptance Criteria

- Crop sprint files use RB-085 through RB-092 in logical order.
- Internal sprint references match the final numbering.
- Active `tickets/2026-05-22/RB-084-docker-prisma-openssl-runtime-warning.md` remains unchanged.
- This ticket is marked implemented and moved to `tickets/2026-05-22/done/`.
