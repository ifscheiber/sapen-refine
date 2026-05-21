# Trial Backup And Restore

## Purpose

The customer trial is a single-host deployment without HA. Backups are the compensation for local PostgreSQL and MinIO volumes.

PostgreSQL contains users, sessions, RB-064 login throttle buckets, projects, image metadata, review decisions, `ExportBatch` rows, `ExportItem` exact-version references, RB-061/RB-066 prediction import batch/job/item rows including processor lease state and staging-purge markers, and `AuditLog` rows for upload, artifact, auth, review, import, export, and cleanup actions. MinIO contains raw images, mask artifacts, RB-061 staged prediction batch item objects until cleanup, and export manifest/ZIP objects.

Run backups from the repository root on the server after following [deployment-trial.md](deployment-trial.md).

## PostgreSQL Dump

```bash
mkdir -p backups
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backups/sapen-annotate-postgres-$(date +%F).sql
```

This dump includes login throttle state, upload/artifact/auth/review/import/export/cleanup audit rows, prediction import batch statuses and staging-purge markers, and the exact image/artifact/classification references for generated training exports.

## PostgreSQL Restore Outline

Stop the app before restoring:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml stop app
```

Reset the public schema and restore a dump:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backups/sapen-annotate-postgres-YYYY-MM-DD.sql
```

Then restart the app:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d app
```

## MinIO Volume Backup

RB-046 chooses Docker volume tar backups for MinIO because MinIO is private and no public S3 API is exposed. The volume contains raw images, semantic/support masks, RB-061 staged batch prediction item files under `projects/<projectId>/prediction-import-batches/<batchId>/` until RB-066 cleanup purges them, final prediction mask artifacts under `projects/<projectId>/predictions/<predictionRunId>/`, and generated export files under `projects/<projectId>/exports/<exportId>/`.

```bash
mkdir -p backups
docker run --rm \
  -v sapen-annotate-trial_miniodata:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'tar -czf /backup/sapen-annotate-minio-$(date +%F).tgz -C /data .'
```

## MinIO Restore Outline

Stop the app and MinIO before replacing the data volume:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml stop app minio minio-init
docker run --rm \
  -v sapen-annotate-trial_miniodata:/data \
  -v "$PWD/backups":/backup \
  alpine sh -c 'rm -rf /data/* && tar -xzf /backup/sapen-annotate-minio-YYYY-MM-DD.tgz -C /data'
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d minio minio-init app
```

## Caddy Data And Config Backup

Caddy stores certificates and state in the `caddy_data` and `caddy_config` volumes:

```bash
mkdir -p backups
for volume in caddy_data caddy_config; do
  docker run --rm \
    -v sapen-annotate-trial_${volume}:/data:ro \
    -v "$PWD/backups":/backup \
    alpine sh -c "tar -czf /backup/sapen-annotate-${volume}-$(date +%F).tgz -C /data ."
done
```

Restore uses the same volume-tar pattern as MinIO. Caddy can usually reacquire certificates if DNS and Let's Encrypt access are healthy, but backing up these volumes avoids unnecessary certificate churn.

## Cleanup Before Backup

Storage cleanup is optional before a backup. If storage pressure is high, run a dry-run first:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --dry-run
```

Then execute only if the listed candidates are temporary/staged objects:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --execute --category all --limit 100
```

Cleanup reduces temporary MinIO data size, but it is not a backup substitute. Once a failed batch item's staged source is purged, that item cannot be retried without re-uploading the batch.

## Failure Window

If the host disk fails before a backup finishes, all database rows, login throttle/audit/cleanup state, raw images, masks, staged prediction batch sources that were not yet purged, imported prediction artifacts, export manifests/packages, sessions, Caddy state, and trial-account changes since the latest successful backup are lost. This runbook is not HA and does not provide point-in-time recovery.
