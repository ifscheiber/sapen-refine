# Trial Deployment Dry Run - 2026-05-22

## Summary

RB-076 executed a local single-host Docker Compose dry run for the customer-trial deployment model. The dry run validated build, `migrate deploy`, trial bootstrap without demo credentials, named users, Caddy-routed health/readiness, desktop browser annotation smoke, large-mask upload regression, optional prediction-import worker startup, storage cleanup dry-run, PostgreSQL/MinIO backup and restore, and Caddy backup commands.

Overall result: pass for local dry-run scope.

Not claimed: real Strato deployment, public HTTPS certificate issuance, real iPad Safari, Apple Pencil, or customer network conditions.

## Environment

- Date: 2026-05-22.
- Host: local Linux development host.
- Compose project: `sapen-annotate-rb076`.
- Env file: temporary file under `/tmp/sapen-annotate-rb076/trial.env`, not committed.
- Public local URL used for browser smoke: `http://localhost`.
- Local deviation: `TRIAL_HOSTNAME=:80` was used so Caddy remained in the request path without local TLS trust setup. The real trial runbook still uses HTTPS with `TRIAL_HOSTNAME=annotate.example.com` and `APP_BASE_URL=https://annotate.example.com`.

## Commands And Results

| Area | Command or Check | Result |
| --- | --- | --- |
| Baseline | `npm run db:rebuild`, `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:e2e`, `npm run check:design-hardcoding` | Passed before implementation. Initial `handoff:archive -- --dry-run` was blocked by the intentionally untracked RB-076 ticket and was rerun after commit. |
| Compose config | `docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config` and with `--profile worker` | Passed. |
| Build | `docker compose -p sapen-annotate-rb076 --env-file /tmp/sapen-annotate-rb076/trial.env -f deploy/docker-compose.trial.yml build` | Passed. Prisma emitted an OpenSSL detection warning inside the Node slim image; follow-up RB-084 tracks the hardening. |
| Start DB/storage | `up -d postgres minio`, then `up -d minio-init` | Passed; PostgreSQL and MinIO healthy, `minio-init` exited 0. |
| Migrations | `--profile tools run --rm migrate` | Passed with all 10 migrations applied. |
| Trial bootstrap | `run --rm app npm run trial:bootstrap` | Passed; created `ADMIN`/`USER` roles and default label schema only. No demo users/projects were created. |
| Named users | `trial:user:create` for a named global admin/owner and a named project labeler | Passed. The labeler was attached to a project created during the desktop smoke. |
| Runtime | `up -d`, `ps -a`, service logs | Passed; `caddy`, `app`, `postgres`, `minio` running; `minio-init` exited 0. Logs were readable for app, Caddy, PostgreSQL, MinIO, and worker. |
| Health/readiness | `curl -fsS http://localhost/api/health` and `/api/ready` | Passed through Caddy. `/api/ready` returned database and storage `ok`. |
| Desktop smoke | `PLAYWRIGHT_BASE_URL=http://localhost E2E_EMAIL=<named-user> E2E_PASSWORD=<redacted> npm run test:e2e -- tests/e2e/desktop-browser-smoke.spec.ts tests/e2e/large-mask-upload.spec.ts` | Passed 2 tests through Caddy, including upload/editor/save/review/export and 6000x4000 mask upload regression. |
| Worker one-shot | `exec app npm run jobs:prediction-import -- --base-url http://localhost:3000 --limit 25 --max-jobs 5 ...` | Passed with `batchCount: 0`, `processedCount: 0`, `staleRecoveredCount: 0`. |
| Worker profile | `--profile worker up -d prediction-import-worker` and logs | Passed; worker logged one successful due-processing pass with no batches. Deliberate stop produced an npm SIGTERM log, not a processing failure. |
| Storage cleanup | `exec app npm run storage:cleanup -- --dry-run` | Passed; 0 candidates, 0 would-delete. |
| PostgreSQL backup | `pg_dump` through `docker compose exec -T postgres` to `/tmp/sapen-annotate-rb076/backups/...sql` | Passed. |
| MinIO backup | Docker volume tar backup to `/tmp/sapen-annotate-rb076/backups/...tgz` | Passed. |
| Caddy backup | Docker volume tar backup for `caddy_data` and `caddy_config` | Passed. |
| Restore | PostgreSQL schema reset + SQL restore, MinIO volume restore, restart app/Caddy, `/api/ready` | Passed. Caddy restore was not executed because the local HTTP dry run did not create meaningful certificate state; backup command and documented restore pattern remain verified at command level. |

## Findings

- The optimized RB-076 ticket fully replaced the older RB-076 ticket. The older ticket can be deleted when RB-076 is finalized.
- A trial-safe bootstrap command was required because `migrate deploy` alone creates tables only, and local `seed` creates shared demo credentials. RB-076 added `npm run trial:bootstrap` for roles and the default label schema without demo users/projects.
- Docker image build and `migrate` run emitted Prisma warnings that OpenSSL could not be detected in `node:22-bookworm-slim`. The commands passed, but RB-084 tracks installing OpenSSL in the image to remove that trial risk.
- The local dry run did not validate public HTTPS, DNS, Let's Encrypt, real Strato firewall behavior, real iPad Safari, or Apple Pencil.
- No prediction ZIP fixture was used. Batch processing was verified as no-op/due processing plus optional worker startup only.

## Follow-Up Tickets

- `tickets/2026-05-22/RB-084-docker-prisma-openssl-runtime-warning.md` - harden the Docker image so Prisma no longer warns about OpenSSL detection in build/migrate/runtime containers.
- RB-077 remains the real iPad Safari customer-trial gate and must not be marked passed from this local dry run.
- RB-078 remains post-trial findings triage.

## Cleanup

Temporary files and volumes were kept outside the repository. The dry-run stack can be removed with:

```bash
docker compose -p sapen-annotate-rb076 --env-file /tmp/sapen-annotate-rb076/trial.env -f deploy/docker-compose.trial.yml down -v
```
