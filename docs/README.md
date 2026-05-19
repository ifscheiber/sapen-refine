# SaPen Annotate Documentation

This folder is the implementation-level documentation source for SaPen Annotate. The root [../ARCHITECTURE.md](../ARCHITECTURE.md) is the short map; this tree should hold evidence-backed details with real file paths.

## Start Here

- Contributor and Codex rules: [../AGENTS.md](../AGENTS.md)
- Architecture map: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Known gaps: [known-gaps.md](known-gaps.md)
- Current state: [00-overview/current-state.md](00-overview/current-state.md)
- Baseline checks: [00-overview/baseline-checks.md](00-overview/baseline-checks.md)
- Remediation backlog: [adr/remediation-backlog.md](adr/remediation-backlog.md)
- Naming ADR: [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)

## Module Docs

- App routes and API handlers: [src/app/README.md](src/app/README.md)
- Server auth, DB, and storage: [src/server/README.md](src/server/README.md)
- Mask helpers and formats: [src/mask/README.md](src/mask/README.md)
- Components and editor UI: [src/components/README.md](src/components/README.md)
- Client API wrappers: [src/lib/README.md](src/lib/README.md)
- Prisma schema and migrations: [prisma/README.md](prisma/README.md)
- Testing strategy: [testing/README.md](testing/README.md)

## Workflow And Operations Docs

- Scratch annotation workflow: [workflows/annotation-from-scratch.md](workflows/annotation-from-scratch.md)
- Future prediction-assisted annotation: [workflows/future-prediction-assisted-annotation.md](workflows/future-prediction-assisted-annotation.md)
- Local development: [operations/local-development.md](operations/local-development.md)
- Environment variables: [operations/environment.md](operations/environment.md)
- Handoff ZIP checklist: [operations/handoff-zip-checklist.md](operations/handoff-zip-checklist.md)

## Structure Note

The docs mirror the actual repository where practical. Source docs live under `docs/src/...` because implementation code lives under `src/...`; operational and architectural docs live in topic folders.
