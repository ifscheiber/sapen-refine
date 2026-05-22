# Customer Trial Deployment Runbook

## Purpose

This runbook is the copy-paste baseline for the current single-host customer trial. It uses Docker Compose for Caddy, the Next.js app, PostgreSQL, and MinIO. Caddy is the only public service.

This is trial-ready, not HA. PostgreSQL and MinIO store local data on the host through Docker volumes; backup/restore is the compensation for missing replication.

RB-076 local dry-run evidence is recorded in [trial-deployment-dry-run-2026-05-22.md](trial-deployment-dry-run-2026-05-22.md). The dry run used local HTTP through Caddy; real trial deployment still requires the HTTPS/DNS steps below.

## Host Prerequisites

- Linux server with enough disk for raw images, masks, exports, PostgreSQL, MinIO, Caddy data, and backups.
- Docker Engine with the Compose plugin.
- DNS `A`/`AAAA` record for `TRIAL_HOSTNAME` pointing to the server.
- Firewall allows inbound `80/tcp`, `443/tcp`, and optionally `443/udp` for HTTP/3.
- Outbound HTTPS access for image pulls and Let's Encrypt certificate issuance.
- Repository handoff archive created with `npm run handoff:archive` or a clean git checkout.

Do not expose MinIO console or S3 API publicly for the customer trial. If temporary admin exposure is required, protect it separately and document the risk before enabling it.

## Prepare Environment

On the server:

```bash
cp deploy/trial.env.example deploy/trial.env
chmod 600 deploy/trial.env
```

Edit `deploy/trial.env` and replace every placeholder. Use long random values for `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`. Keep `S3_ACCESS_KEY` and `S3_SECRET_KEY` free of double quotes and backslashes because `deploy/minio-init.sh` writes a temporary MinIO client JSON config inside the one-shot init container.

Required public values:

```text
TRIAL_HOSTNAME=annotate.example.com
APP_BASE_URL=https://annotate.example.com
SHOW_DEMO_CREDENTIALS=false
```

Keep shared demo credentials hidden for customer trials. Create named tester accounts so annotation, review, export, and operations remain attributable.

## Build Context And Secret Hygiene

Docker builds use the repository root as context. [.dockerignore](../../.dockerignore) excludes local secrets, generated build output, dependency folders, caches, test artifacts, reports, traces, archives, backup output, and local PostgreSQL/MinIO/storage volumes. It intentionally keeps source, Prisma schema/migrations, public assets, package lockfiles, deployment templates, and example env files available to the image build and handoff docs.

Real trial secrets belong only in `deploy/trial.env` on the server. `deploy/trial.env.example` is a placeholder template and may be committed.

`minio-init` uses [../../deploy/minio-init.sh](../../deploy/minio-init.sh) instead of embedding `mc alias set ... <secret>` in the Compose entrypoint. The rendered Compose command should show only:

```text
/bin/sh /scripts/minio-init.sh
```

Do not share `docker compose config` output generated with a real `deploy/trial.env`: Compose still expands secret values in service `environment` blocks even though the MinIO init command no longer embeds them.

Safe config checks with placeholder values:

```bash
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

MinIO S3 and console endpoints remain private on the Compose network. Do not add public MinIO ports for the customer trial.

## Dependency Audit Policy

RB-075 aligns `prisma`, `@prisma/client`, and `@prisma/adapter-pg` on 7.8.x and uses a narrow npm override for Prisma CLI's transitive `@hono/node-server` dependency. Current trial handoff validation expects `npm audit --json` to report 0 vulnerabilities.

Do not run `npm audit fix --force` on the trial server or in a handoff hotfix. If a future audit reintroduces Prisma findings, inspect the Prisma CLI/client/adapter version relationship first and update [../00-overview/dependency-audit.md](../00-overview/dependency-audit.md) with the decision.

## Build, Migrate, Start

Run from the repository root:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml build
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d postgres minio
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm app npm run trial:bootstrap
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d
```

After schema changes, run deployed migrations before restarting the app:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d app
```

Do not use `prisma migrate dev` on the trial server.

Do not run `npm run seed` or `prisma db seed` for customer-facing trials unless shared demo credentials have been explicitly accepted. The seed command is for local development/demo resets and creates `admin@sapen.local`, `labeler@sapen.local`, and `demo_project`. `npm run trial:bootstrap` creates only global roles and the default label schema required by real named trial users.

## Create Named Users

Create the first named administrator/project owner:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm app npm run trial:user:create -- --email alice@example.com --password 'replace-with-unique-password' --name 'Alice Tester' --global-role ADMIN
```

This account can log in, create the first project, and run global-admin operational commands such as storage cleanup dry-runs. After a project exists, add additional named testers to the project:

Add a tester to an existing project:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm app npm run trial:user:create -- --email bob@example.com --password 'replace-with-unique-password' --name 'Bob Tester' --project-id '<project-id>' --project-role LABELER
```

Rotate a password by rerunning the command for the same email with a new password. To revoke active sessions:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "UPDATE \"Session\" SET \"revokedAt\" = now() WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = '\''alice@example.com'\'');"'
```

## Verify Runtime

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml ps
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=100 app
curl -fsS https://annotate.example.com/api/health
curl -fsS https://annotate.example.com/api/ready
```

Expected:

- `caddy`, `app`, `postgres`, and `minio` are running.
- `/api/health` returns `status: ok`.
- `/api/ready` returns `status: ok` for database and storage.
- Browser upload/download routes do not expose MinIO URLs.

## Upload And Batch Limits

Default trial limits:

- App image upload: 100 MiB.
- App mask upload: 50 MiB.
- Prediction batch ZIP upload: 100 MiB.
- Prediction batch items per ZIP: 200.
- Prediction batch process pass: 25 items.
- Next proxy request body: 120mb.
- Caddy request body: 120 MB.

Raise app, Next proxy, and Caddy limits together:

- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, or `PREDICTION_BATCH_UPLOAD_MAX_BYTES` in `deploy/trial.env`.
- `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` in `deploy/trial.env`; rebuild/restart the app image when changing it.
- `CADDY_MAX_BODY_SIZE` in `deploy/trial.env`.

Supported raw image uploads are PNG and JPEG. Oversized app-mediated uploads return `413` and `UPLOAD_TOO_LARGE` when the request reaches the app. If the Next proxy or Caddy rejects/truncates first, the app may not produce the intended JSON error, so keep both proxy limits above the app limits. Trial full-resolution annotation supports normal images up to `6000x4000`, large-warning images up to `8000x6000`, and rejects larger images with `IMAGE_DIMENSIONS_UNSUPPORTED`.

## Optional Prediction Import Worker

Normal annotation work does not use a queue. The optional worker is only for bounded prediction-import batch processing.

Set `SAPEN_JOB_EMAIL` and `SAPEN_JOB_PASSWORD` to a named project `OWNER` or `QA` account, then start:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile worker up -d prediction-import-worker
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs -f prediction-import-worker
```

One-shot processing remains available:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run jobs:prediction-import -- --base-url http://localhost:3000 --limit 25 --max-jobs 5 --email 'qa@example.com' --password '<password>'
```

Keep one default worker process for the trial. There is no Redis, RabbitMQ, distributed worker coordination, GPU execution, or inference execution in this deployment.

## Backup, Cleanup, Restart

Before customer data collection, run or schedule the PostgreSQL, MinIO, and Caddy backup commands in [backup-restore.md](backup-restore.md). Without a completed backup, host disk loss destroys all data since the previous successful backup.

Storage cleanup is dry-run first:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --dry-run
```

Execute only after inspecting candidates:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --execute --category all --limit 100
```

Restart app:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d app
```

Stop:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml down
```

Destructive reset for dev/trial only:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml down -v
```

`down -v` deletes PostgreSQL, MinIO, and Caddy volumes.

## Gates Before Customer Pilot

- Handoff archive created from a clean worktree.
- Named tester accounts created.
- Backup command executed or backup schedule accepted.
- Desktop customer smoke checklist completed.
- Real iPad Safari gate in [../07-testing/manual-smoke-ipad-safari-gate.md](../07-testing/manual-smoke-ipad-safari-gate.md) completed against the deployed URL.

## Known Trial Limits

- No HA, object replication, point-in-time recovery, or production monitoring stack.
- No enterprise identity provider.
- No public MinIO access.
- Export and prediction-analysis export generation are synchronous and trial-sized.
- Prediction-import batch processing is single-host and PostgreSQL-backed.
