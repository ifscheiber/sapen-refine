# ADR-001 - Architecture And UI Baseline

## Status

Accepted for RB-043 implementation.

## Decision

SaPen Annotate will keep stable public URLs while moving implementation into thin routes, reusable shell components, feature modules, and a central design-token layer.

## Consequences

- `/app` remains a valid URL but should redirect to `/app/projects`.
- The old prototype AppShell should not remain as a parallel active workflow.
- Design values should move to `src/design`.
