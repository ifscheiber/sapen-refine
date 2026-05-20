# Customer Trial Deployment

## Purpose

RB-046 defines a minimal customer-facing browser trial deployment for one server. It is production-shaped but not HA.

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

## Upload Limits

Default trial limits:

- App image upload: 100 MiB.
- App mask upload: 50 MiB.
- Caddy request body: 120 MB.

Oversized app-mediated uploads return `413` and `UPLOAD_TOO_LARGE` where the request reaches the app. If Caddy rejects the request first, the tester sees a Caddy `413`.

Supported customer-trial image uploads are `image/png` and `image/jpeg`. Other formats, including SVG, return `UNSUPPORTED_CONTENT_TYPE`. If testers use large camera originals, check both the app limit and Caddy body limit before the trial.

Raise limits in both places:

- `IMAGE_UPLOAD_MAX_BYTES` or `MASK_UPLOAD_MAX_BYTES` in `deploy/trial.env`.
- `CADDY_MAX_BODY_SIZE` in `deploy/trial.env`.

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
