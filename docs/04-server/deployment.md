# Customer Trial Deployment

## Purpose

RB-046 defined the initial customer-facing browser trial deployment for one server. The current copy-paste RB-069 runbook is [deployment-trial.md](deployment-trial.md).

This page is retained as the historical deployment entry and summary. Use [deployment-trial.md](deployment-trial.md) for operator execution.

Chosen shape: Docker Compose runs `caddy`, `app`, `postgres`, and `minio`. Caddy is the only public service.

## Prepare Environment

On the server:

```bash
cp deploy/trial.env.example deploy/trial.env
chmod 600 deploy/trial.env
```

Edit `deploy/trial.env` and replace every placeholder. Generate long random values for `POSTGRES_PASSWORD`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`.

Required public values:

```text
TRIAL_HOSTNAME=annotate.example.com
APP_BASE_URL=https://annotate.example.com
SHOW_DEMO_CREDENTIALS=false
```

## Build And Start

Run from the repository root:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml build
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d postgres minio
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d
```

After schema changes, run migrations before restarting the app:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d app
```

Do not use `prisma migrate dev` for the customer trial. `migrate dev` is local development tooling; trial deployment uses `prisma migrate deploy` through the `migrate` Compose service.

## Verify Runtime

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml ps
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=100 app
curl -fsS https://annotate.example.com/api/health
curl -fsS https://annotate.example.com/api/ready
```

`/api/health` is a cheap liveness check. `/api/ready` checks database and storage connectivity and returns `503` when a dependency is unavailable.

## Trial User Accounts

Do not expose shared demo credentials for customer-facing access unless that risk is explicitly accepted. Use named accounts per tester so image uploads, mask versions, and future annotation history remain attributable.

RB-064 hides shared seed credentials in production/trial unless `SHOW_DEMO_CREDENTIALS=true`. Keep that value `false` for customer-facing trials and create named tester accounts instead.

Create the first named tester:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm app npm run trial:user:create -- --email alice@example.com --password 'replace-with-unique-password' --name 'Alice Tester'
```

The first tester can log in and create a project. Add additional testers to a known project ID from the project URL:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm app npm run trial:user:create -- --email bob@example.com --password 'replace-with-unique-password' --name 'Bob Tester' --project-id '<project-id>' --project-role LABELER
```

To rotate a trial user's password, rerun the same command with a new password. To revoke active sessions for that user:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "UPDATE \"Session\" SET \"revokedAt\" = now() WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = '\''alice@example.com'\'');"'
```

Do not delete users to disable access unless you intentionally accept losing direct user-row attribution for historical rows that use `onDelete: SetNull`.

## Login And Mutation Guard

Default trial auth hardening values are in `deploy/trial.env.example`:

```text
LOGIN_RATE_LIMIT_MAX_FAILURES=5
LOGIN_RATE_LIMIT_WINDOW_SECONDS=900
LOGIN_RATE_LIMIT_LOCK_SECONDS=900
SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS=900
```

Login failures are persisted as hashed email/IP buckets in PostgreSQL and return `AUTH_RATE_LIMITED` while locked. Unsafe cross-site browser mutations are rejected before route handlers run; API calls from the app UI and documented server-side scripts continue to work.

## Upload Limits

Default trial limits:

- App image upload: 100 MiB.
- App mask upload: 50 MiB.
- App prediction batch ZIP upload: 100 MiB.
- Prediction batch items per ZIP: 200.
- Prediction batch process pass: 25 items.
- Caddy request body: 120 MB.

Oversized app-mediated uploads return `413` and `UPLOAD_TOO_LARGE` where the request reaches the app. If Caddy rejects the request first, the tester sees a Caddy `413`.

Supported customer-trial image uploads are `image/png` and `image/jpeg`. Other formats, including SVG, return `UNSUPPORTED_CONTENT_TYPE`. RB-057 prediction mask imports use the mask upload limit and accept only `application/octet-stream` `u8raw-v1` bytes through the app; they do not expose MinIO/S3 upload URLs. RB-061 batch imports accept ZIP files through the app, privately stage the contained mask files, and process a limited number of items per pass.

Raise limits in both places:

- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, or `PREDICTION_BATCH_UPLOAD_MAX_BYTES` in `deploy/trial.env`.
- `CADDY_MAX_BODY_SIZE` in `deploy/trial.env`.

## Batch Prediction Import Processing

Project `OWNER`/`QA` users can create, inspect, process, and retry prediction import batches from `/app/projects/[projectId]/prediction-imports`. RB-065 keeps this separate from normal annotator concurrency: browser annotation actions do not use a queue, while batch prediction imports use a small PostgreSQL lease model.

For one-shot operational runs, use the API-based script while the app container is running:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run jobs:prediction-import -- --batch '<batch-id>' --limit 25 --email 'owner@example.com' --password '<owner-password>'
```

To process due pending/retry/stale batches without naming one batch:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run jobs:prediction-import -- --limit 25 --max-jobs 5 --email 'qa@example.com' --password '<qa-password>'
```

The script logs in through the normal app API and calls bounded processing passes. It does not run inference and does not expose MinIO.

Optional always-on worker for the single-host trial:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile worker up -d prediction-import-worker
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs -f prediction-import-worker
```

Before enabling the worker, set `SAPEN_JOB_EMAIL` and `SAPEN_JOB_PASSWORD` in `deploy/trial.env` to a named project `OWNER` or `QA` account. Keep `PREDICTION_BATCH_PROCESS_LIMIT`, `PREDICTION_BATCH_MAX_JOBS_PER_TICK`, `PREDICTION_BATCH_LEASE_SECONDS`, and `PREDICTION_BATCH_WORKER_INTERVAL_SECONDS` bounded. The default trial path is one worker process; do not scale multiple worker replicas unless the lease assumptions are reviewed.

## Storage Retention Cleanup

RB-066 adds admin-only cleanup for temporary storage objects. It covers completed/failed prediction batch staging objects and identifiable abandoned presigned image/mask uploads. It does not delete committed raw images, committed mask/prediction artifacts, training export packages, prediction-analysis export packages, backup files, or Docker volume data.

Set a named global `ADMIN` cleanup account in `deploy/trial.env` if you want to use env-based credentials:

```text
SAPEN_CLEANUP_EMAIL=admin@example.com
SAPEN_CLEANUP_PASSWORD=<admin-password>
```

Dry-run is the default:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --dry-run
```

Execute requires an explicit flag:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --execute --category all --limit 100
```

Cleanup retention variables are:

```text
BATCH_STAGING_COMPLETED_RETENTION_DAYS=7
BATCH_STAGING_FAILED_RETENTION_DAYS=14
PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS=24
STORAGE_CLEANUP_MAX_DELETE_PER_RUN=500
```

See [storage-retention-cleanup.md](storage-retention-cleanup.md) for protected-object rules, presigned route inventory, audit events, and project/batch-scoped commands.

## Backup And Restore

Before customer data collection, set a backup cadence. At minimum, run the PostgreSQL, MinIO, and Caddy backup commands in [backup-restore.md](backup-restore.md).

Without a completed backup, host disk loss destroys all trial data stored since the previous backup.

## Stop Or Rebuild

Stop:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml down
```

Destructive reset for dev/trial only:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml down -v
```

`down -v` deletes PostgreSQL, MinIO, and Caddy volumes.
