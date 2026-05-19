# ADR-0001 - Rename Product And Repository To SaPen Annotate

## Status

Accepted - 2026-05-19

## Context

The repository was previously named `sapen-refine`. That name fits a future workflow where model predictions are corrected, but the standalone app scope is broader: scratch annotation, metadata capture, mask versioning, review/approval, and reproducible training-data exports.

Evidence in the baseline repository included `package.json` and `package-lock.json` using `sapen-refine`, root README content still using the Create Next App template, and stale nested monorepo leftovers under `src/app/package.json` and `src/app/docker-compose.yml`.

## Decision

Use:

- Product/UI name: SaPen Annotate.
- Repository/package identifier: `sapen-annotate`.
- Session cookie name: `sapen_annotate_session`.

The word "refine" remains available only for a future prediction-correction mode, not for the app or repository identity.

## Consequences

- Existing local browser sessions from earlier builds are invalidated because the cookie name changed.
- Documentation should use SaPen Annotate for the app and "future refine/correction mode" only when discussing prediction-assisted workflows.
- MVP schema names such as `MaskKind.REFINED` remain for now because schema/domain redesign is outside RB-040.

## Follow-Up

Track domain terminology cleanup, mask kind normalization, editor consolidation, and export workflows in [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md).
