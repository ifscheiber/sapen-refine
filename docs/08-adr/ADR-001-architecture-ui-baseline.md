# ADR-001 - Architecture And UI Baseline

## Status

Accepted and implemented by RB-043.

## Decision

SaPen Annotate will keep stable public URLs while moving implementation into thin routes, reusable shell components, feature modules, and a central design-token layer.

## Consequences

- `/app` remains a valid URL but should redirect to `/app/projects`.
- The old prototype AppShell was removed; `src/components/shell/AppShell.tsx` is the active workspace shell.
- Design values should move to `src/design`.
