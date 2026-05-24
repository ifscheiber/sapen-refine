# RB-116-A - Trial Bootstrap Operator Attribution

## Status

Planned

## Priority

P3 before treating bootstrap scripts as production operations

## Type

Audit / Operator Attribution / CLI Hardening

## Source

- RB-116 audit coverage matrix.
- `docs/testing/audit-coverage-matrix.md`
- `scripts/trial-bootstrap.mjs`
- `scripts/create-trial-user.mjs`
- `scripts/trial-bootstrap-lib.mjs`

## Context

RB-116 classifies the trial bootstrap scripts as partial audit coverage. They currently create or update trial roles, label schema, users, global roles, project membership, and audit rows, but they do not require or record an authenticated operator as the actor.

This is acceptable for local development/bootstrap setup, but it must not become the production operations model for customer-facing administrative writes.

## Goal

Add explicit operator attribution to trial bootstrap and trial-user scripts before those scripts are used as production operational tooling.

## Requirements

- Preserve local development bootstrap ergonomics.
- Do not record passwords, tokens, raw headers, or secrets in `AuditLog.details`.
- Prefer the repository's current documented operator secret mechanism once RB-117 is complete.
- Record a named operator or documented system actor in bootstrap audit rows.
- Update `docs/testing/audit-coverage-matrix.md` from `partial` to `sufficient` only after implementation and tests.
- Keep RB-113 unchanged.

## Acceptance Criteria

- `TRIAL_BOOTSTRAP` audit rows have non-anonymous operator or explicit system actor context.
- `TRIAL_USER_UPSERT` audit rows have non-anonymous operator or explicit system actor context.
- Tests cover both scripts' audit payload shape without recording secrets.
- Audit docs and the RB-116 matrix are updated.
