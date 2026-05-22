# Customer Trial Readiness

## Status

RB-069 and RB-073 prepare the repository for a real single-host customer trial handoff. RB-076 completed a local single-host Compose dry run on 2026-05-22 and verified build, migrate, trial bootstrap, named users, Caddy-routed health/readiness, desktop browser smoke, large-mask save regression, worker/cleanup commands, and backup/restore commands. Real Strato deployment, public HTTPS certificate issuance, and real iPad Safari validation remain pending until a deployed URL and device access exist.

## Ready

- Browser annotation workflow: login, project navigation, image upload, metadata, editor, semantic masks, support masks, and slice classification.
- Review and export workflow: submit/approve/reject, training export manifests/packages, and app-mediated download routes.
- Prediction workflow: prediction provenance, single prediction imports, correction tasks, assisted correction, prediction-analysis exports, QA metrics, and bounded batch prediction imports.
- Trial operations: Compose deployment shape, private MinIO, Caddy-only public exposure, named user creation, upload limits, optional single-host prediction-import worker, backup/restore, and storage cleanup runbooks.
- Trial dry-run evidence: [../04-server/trial-deployment-dry-run-2026-05-22.md](../04-server/trial-deployment-dry-run-2026-05-22.md).
- Handoff hygiene: `npm run handoff:archive` creates a clean ZIP with a generated `handoff-manifest.json`, excludes private/local artifacts, and refuses dirty worktrees unless `--allow-dirty` is explicit.
- Docker/Compose hygiene: Docker build context excludes local/private/generated artifacts, and `minio-init` no longer embeds MinIO credentials in the Compose command string.
- Header hygiene: app-mediated image/export download routes use shared `Content-Disposition` filename sanitization with ASCII fallback and UTF-8 `filename*`.
- Dependency audit hygiene: RB-075 aligns Prisma CLI/client/adapter versions, overrides Prisma CLI's vulnerable `@hono/node-server` transitive dependency within the 1.19.x line, and brings `npm audit --json` to 0 vulnerabilities without `npm audit fix --force`.

## Pending Before Customer Pilot

- Deploy to the actual customer/Strato server.
- Create named customer tester accounts and avoid shared demo credentials unless the risk is explicitly accepted.
- Run and verify at least one PostgreSQL, MinIO, and Caddy backup on the real host. RB-076 verified the commands in a local dry run.
- Complete the operator deployment smoke in [../07-testing/manual-smoke-customer-browser-trial.md](../07-testing/manual-smoke-customer-browser-trial.md).
- Complete the real iPad Safari gate in [../07-testing/manual-smoke-ipad-safari-gate.md](../07-testing/manual-smoke-ipad-safari-gate.md). Current status: pending until deployed URL and device access are available; tracked by `tickets/deferred/RB-077-B-real-ipad-safari-trial-gate-execution.md`.
- Re-run `npm audit --json` as part of final handoff validation if dependencies change again.

## Intentionally Not Included

- High availability, object replication, point-in-time recovery, and production monitoring.
- Enterprise IdP or external identity provider integration.
- Public MinIO console or S3 API exposure.
- GPU inference, model training orchestration, or distributed queue infrastructure.
- Advanced iPad multi-touch zoom/pan gestures beyond current pointer-event drawing behavior.
- Large asynchronous export jobs or production-scale metrics dashboards.

## Related Docs

- [../04-server/deployment-trial.md](../04-server/deployment-trial.md)
- [../04-server/backup-restore.md](../04-server/backup-restore.md)
- [../04-server/batch-prediction-imports.md](../04-server/batch-prediction-imports.md)
- [../04-server/storage-retention-cleanup.md](../04-server/storage-retention-cleanup.md)
- [../operations/handoff-zip-checklist.md](../operations/handoff-zip-checklist.md)
