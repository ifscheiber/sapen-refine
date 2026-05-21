# Storage Retention Cleanup

## Purpose

RB-066 adds a safe cleanup baseline for temporary storage objects in the single-host trial deployment. It is scoped to staged prediction-batch objects and identifiable presigned-upload orphans. It must not delete committed raw images, committed artifact versions, imported prediction artifact versions, training exports, prediction-analysis exports, backups, or Docker volume data.

Implemented evidence:

- `src/server/domain/storageCleanup.ts` - retention policy parsing, candidate classification, protected-object checks, dry-run/execute behavior, and audit events.
- `src/app/api/storage-cleanup/route.ts` - admin-only operational API.
- `scripts/storage-cleanup.mjs` - API-based operational CLI.
- `src/server/storage/s3.ts` - object listing and strict delete helper.
- `prisma/schema.prisma` - `PredictionImportBatchItem.stagingPurgedAt` and `stagingPurgeReason`.
- `prisma/migrations/20260521103000_storage_retention_cleanup/migration.sql` - RB-066 migration.

## Retention Policy

Defaults are suitable for the Strato-style customer trial:

```text
completed batch staging objects: 7 days
failed/cancelled/error batch staging objects: 14 days
abandoned presigned image/mask uploads: 24 hours
maximum deletions per execute run: 500
active or retryable batch staging objects: never cleaned
```

Runtime variables:

```env
BATCH_STAGING_COMPLETED_RETENTION_DAYS=7
BATCH_STAGING_FAILED_RETENTION_DAYS=14
PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS=24
STORAGE_CLEANUP_MAX_DELETE_PER_RUN=500
```

## Protected Object Rules

Cleanup uses the database as the safety boundary before deleting. A candidate must be under an allowed temporary prefix, older than its retention threshold, and unreferenced by durable rows.

Never delete:

- `ImageAsset.storageKey` raw image objects.
- `AnnotationArtifactVersion.storageKey` semantic, support, prediction, correction, or derived artifact objects.
- `ExportBatch` manifest/package objects. Export prefixes are not classified as cleanup candidates.
- Successful imported prediction artifact objects.
- Active, pending, processing, or retryable batch item staging objects.
- PostgreSQL, MinIO, Caddy, or backup volume data.

If a failed batch item source is purged, the item is marked with `stagingPurgedAt` and `stagingPurgeReason`. The retry endpoint ignores purged items because the source object no longer exists. Re-upload the batch if the failed item still needs processing.

## Candidate Categories

Cleanup classifies only known private temporary prefixes:

```text
BATCH_STAGED_ITEM
BATCH_SOURCE_ZIP
ABANDONED_PRESIGNED_UPLOAD
UNKNOWN_STAGING_OBJECT
```

Current RB-061 batch creation stages extracted item files under:

```text
projects/<projectId>/prediction-import-batches/<batchId>/<item>.msk
```

The current code does not persist the original uploaded ZIP as a separate source object. `BATCH_SOURCE_ZIP` exists as an explicit category for possible temporary ZIP objects under the same batch prefix.

Presigned compatibility routes remain enabled:

- `POST /api/projects/[projectId]/images/presign`
- `POST /api/projects/[projectId]/images/commit`
- `POST /api/images/[imageId]/mask/presign`
- `POST /api/images/[imageId]/mask/commit`

Uncommitted objects from these routes are identifiable by age and prefix under `projects/<projectId>/images/...` or `projects/<projectId>/masks/<imageId>/...msk`. RB-066 handles them as `ABANDONED_PRESIGNED_UPLOAD` after the presigned retention window. App-mediated upload/read paths remain preferred for the customer trial.

## Operational Commands

Dry-run is the default. On a trial deployment prepared with [deployment-trial.md](deployment-trial.md), run it first:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --email 'admin@example.com' --password '<admin-password>'
```

Project-scoped dry-run:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --project '<project-id>' --category all --email 'admin@example.com' --password '<admin-password>'
```

Batch-staging dry-run:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --category batch-staging --batch '<batch-id>' --email 'admin@example.com' --password '<admin-password>'
```

Execute requires `--execute`:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --execute --category all --limit 100 --email 'admin@example.com' --password '<admin-password>'
```

Use a named global `ADMIN` account for cleanup. Do not use shared demo credentials for customer-facing trial operations.

The same script can run outside Compose against a deployed app:

```bash
SAPEN_CLEANUP_BASE_URL=https://annotate.example.com SAPEN_CLEANUP_EMAIL=admin@example.com SAPEN_CLEANUP_PASSWORD='<admin-password>' npm run storage:cleanup -- --dry-run
```

## API

`POST /api/storage-cleanup` accepts JSON matching the CLI flags:

```json
{
  "execute": false,
  "category": "all",
  "projectId": "optional-project-id",
  "batchId": "optional-batch-id",
  "limit": 100
}
```

Valid categories are `all`, `batch-staging`, and `upload-orphans`. The route requires an authenticated global `ADMIN` user through the same audit-view permission used for admin audit access. Browser same-origin mutation protection still applies.

The response includes options, summary counts, and item-level results with key, category, status, reason, age, project id, batch id, and item id. It does not expose presigned URLs or credentials.

## Audit

Cleanup writes append-only `AuditLog` rows:

```text
STORAGE_CLEANUP_DRY_RUN
STORAGE_CLEANUP_EXECUTED
STORAGE_CLEANUP_OBJECT_DELETED
STORAGE_CLEANUP_OBJECT_SKIPPED
STORAGE_CLEANUP_OBJECT_DELETE_FAILED
```

Audit details include category, reason, project id, batch id, item id, mode, limit, and summary counts. They must not include credentials or private URLs.

## Deferred

- No cleanup UI/dashboard exists.
- No provider lifecycle rules, replication, HA, or point-in-time recovery are added.
- Committed-artifact retention remains a separate governance problem and is intentionally not part of RB-066.
- Production-scale queue infrastructure remains deferred; this cleanup is for the current single-host PostgreSQL/MinIO trial model.
