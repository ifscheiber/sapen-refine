# SaPen Annotate Documentation

This folder is the implementation-level documentation source for SaPen Annotate. The root [../ARCHITECTURE.md](../ARCHITECTURE.md) is the short map; this tree should hold evidence-backed details with real file paths.

## Start Here

- Contributor and Codex rules: [../AGENTS.md](../AGENTS.md)
- Architecture map: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Known gaps: [known-gaps.md](known-gaps.md)
- Current state: [00-overview/current-state.md](00-overview/current-state.md)
- Baseline checks: [00-overview/baseline-checks.md](00-overview/baseline-checks.md)
- Dependency audit: [00-overview/dependency-audit.md](00-overview/dependency-audit.md)
- Remediation backlog: [adr/remediation-backlog.md](adr/remediation-backlog.md)
- Naming ADR: [architecture/decisions/ADR-0001-sapen-annotate-naming.md](architecture/decisions/ADR-0001-sapen-annotate-naming.md)
- Desktop-first/iPad-deferred ADR: [08-adr/ADR-002-desktop-browser-first-ipad-deferred.md](08-adr/ADR-002-desktop-browser-first-ipad-deferred.md)
- Annotation domain model ADR: [08-adr/ADR-003-annotation-domain-model.md](08-adr/ADR-003-annotation-domain-model.md)
- Model preprediction/active-learning ADR: [08-adr/ADR-004-model-preprediction-active-learning.md](08-adr/ADR-004-model-preprediction-active-learning.md)

## Module Docs

- Overview: [00-overview/current-state.md](00-overview/current-state.md)
- Architecture: [01-architecture/module-boundaries.md](01-architecture/module-boundaries.md)
- App routes/API: [02-app/routes.md](02-app/routes.md)
- Features: [03-features/README.md](03-features/README.md)
- Server: [04-server/db.md](04-server/db.md)
- Auth/RBAC/audit hardening: [04-server/auth-rbac-audit.md](04-server/auth-rbac-audit.md)
- Runtime config: [04-server/runtime-config.md](04-server/runtime-config.md)
- Customer trial deployment: [04-server/deployment.md](04-server/deployment.md)
- Trial backup/restore: [04-server/backup-restore.md](04-server/backup-restore.md)
- Batch prediction imports: [04-server/batch-prediction-imports.md](04-server/batch-prediction-imports.md)
- Storage retention cleanup: [04-server/storage-retention-cleanup.md](04-server/storage-retention-cleanup.md)
- Design system: [05-design-system/tokens.md](05-design-system/tokens.md)
- Data: [06-data/prisma.md](06-data/prisma.md)
- Current-to-target schema map: [06-data/current-to-target-schema-map.md](06-data/current-to-target-schema-map.md)
- Annotation domain model: [06-data/annotation-domain-model.md](06-data/annotation-domain-model.md)
- Prisma schema proposal: [06-data/prisma-schema-proposal.md](06-data/prisma-schema-proposal.md)
- Training export contract: [06-data/training-export-contract.md](06-data/training-export-contract.md)
- Prediction analysis export contract: [06-data/prediction-analysis-export-contract.md](06-data/prediction-analysis-export-contract.md)
- Model prediction contract: [06-data/model-prediction-contract.md](06-data/model-prediction-contract.md)
- Active-learning task model: [06-data/active-learning-task-model.md](06-data/active-learning-task-model.md)
- Quality gates: [07-testing/quality-gates.md](07-testing/quality-gates.md)
- Desktop browser manual smoke checklist: [07-testing/manual-smoke-desktop-browser.md](07-testing/manual-smoke-desktop-browser.md)
- Editor manual smoke checklist: [07-testing/manual-smoke-editor-ipad.md](07-testing/manual-smoke-editor-ipad.md)
- Customer browser trial smoke checklist: [07-testing/manual-smoke-customer-browser-trial.md](07-testing/manual-smoke-customer-browser-trial.md)
- App routes and API handlers: [src/app/README.md](src/app/README.md)
- Server auth, DB, and storage: [src/server/README.md](src/server/README.md)
- Mask helpers and formats: [src/mask/README.md](src/mask/README.md)
- Components and editor UI: [src/components/README.md](src/components/README.md)
- Client API wrappers: [src/lib/README.md](src/lib/README.md)
- Prisma schema and migrations: [prisma/README.md](prisma/README.md)
- Testing strategy: [testing/README.md](testing/README.md)

## Workflow And Operations Docs

- Scratch annotation workflow: [workflows/annotation-from-scratch.md](workflows/annotation-from-scratch.md)
- Prediction-assisted annotation/correction: [workflows/future-prediction-assisted-annotation.md](workflows/future-prediction-assisted-annotation.md)
- Local development: [operations/local-development.md](operations/local-development.md)
- Environment variables: [operations/environment.md](operations/environment.md)
- Caddy reverse proxy: [04-server/reverse-proxy-caddy.md](04-server/reverse-proxy-caddy.md)
- Storage retention cleanup: [04-server/storage-retention-cleanup.md](04-server/storage-retention-cleanup.md)
- Handoff ZIP checklist: [operations/handoff-zip-checklist.md](operations/handoff-zip-checklist.md)

## Structure Note

The docs mirror the actual repository where practical. Source docs live under `docs/src/...` because implementation code lives under `src/...`; operational and architectural docs live in topic folders.
