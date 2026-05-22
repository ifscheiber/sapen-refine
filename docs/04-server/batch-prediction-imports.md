# Batch Prediction Imports

## Purpose

RB-061 adds a single-host, DB-backed batch import baseline for prediction masks. RB-065 hardens that baseline with a small PostgreSQL lease model and optional Compose worker for the Strato-style customer trial. It is intended for trial-sized customer/model runs where importing one prediction per browser request is too brittle, but a full external queue is not justified.

Implemented evidence:

- `prisma/schema.prisma` - `PredictionImportBatchJob`, `PredictionImportBatchItem`, and batch status/source enums.
- `src/server/domain/predictionImportBatches.ts` - ZIP manifest parsing, private staging, item claiming, lease/stale recovery, processing, retry, and sanitized serialization.
- `src/server/domain/predictionImportBatchLeases.ts` - RB-065 lease expiry and stale-recovery helpers.
- `src/server/domain/storageCleanup.ts` - RB-066 retention cleanup for completed/failed staging objects and presigned-upload orphans.
- `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts` - ZIP batch creation.
- `src/app/api/prediction-import-batches/*` and `src/app/api/projects/[projectId]/prediction-import-batches/route.ts` - inspect/process/process-due/retry APIs.
- `src/features/projects/ProjectPredictionImportBatchPanel.tsx` - minimal prediction-imports route UI for owner/QA batch management.
- `scripts/process-prediction-import-batch.mjs` - optional API-based processing script.
- `deploy/docker-compose.trial.yml` - optional `worker` profile for API-based background processing.

## Input Format

RB-061 chooses ZIP upload. The ZIP must contain `manifest.json` plus prediction files referenced from the manifest. The server stages files into private object storage under an internal prefix; API and UI responses never expose those staging keys.

Manifest version:

```text
sapen-annotate-prediction-batch-import-v1
```

Minimal manifest:

```json
{
  "manifestVersion": "sapen-annotate-prediction-batch-import-v1",
  "predictionRunId": "optional-must-match-route-id",
  "items": [
    {
      "clientItemId": "stable-operator-id",
      "imageId": "image-id",
      "targetType": "SEMANTIC_MASK",
      "fileName": "predictions/image-1.u8raw",
      "checksum": "sha256:<64 hex chars>",
      "width": 1024,
      "height": 768,
      "contentType": "application/octet-stream",
      "format": "u8raw-v1",
      "coordinateSpace": "IMAGE_PIXEL",
      "confidenceScore": 0.91,
      "uncertaintyScore": 0.09,
      "perClassScores": {},
      "outputStats": {}
    }
  ]
}
```

Supported RB-061 targets are `SEMANTIC_MASK` and `SLICE_SUPPORT_MASK`, matching the RB-057 import service. Slice-classification batch imports remain deferred because they do not use the current mask artifact import path.

## Processing Model

The create request validates the ZIP and manifest, verifies that referenced images belong to the `PredictionRun` project, stages item files privately, and creates a `PENDING` batch with `PENDING` items.

Processing is explicit and bounded:

- UI button on `/app/projects/[projectId]/prediction-imports`.
- API call to `POST /api/prediction-import-batches/[batchId]/process`.
- API call to `POST /api/prediction-import-batches/process-due` for due pending/retry/stale batches.
- Optional script:

```bash
npm run jobs:prediction-import -- --batch <batch-id> --limit 25 --email owner@example.com --password '<password>'
```

Without `--batch`, the script processes due batches:

```bash
npm run jobs:prediction-import -- --limit 25 --max-jobs 5 --email qa@example.com --password '<password>'
```

Loop mode is for the optional single-host worker:

```bash
npm run jobs:prediction-import -- --loop --interval 30 --limit 25 --max-jobs 5 --email qa@example.com --password '<password>'
```

The processor claims only `PENDING` or due `RETRY_PENDING` items, marks them `PROCESSING`, sets `processorId`, `processorRunId`, `leaseExpiresAt`, and `lastHeartbeatAt`, increments `attemptCount`, reads staged bytes, and calls `importPredictionMaskForUser` from `src/server/domain/predictionImport.ts`. Successful items store the created `AnnotationArtifactVersion` and `PredictionArtifactProvenance` ids and clear the lease.

Re-running process is idempotent at the batch-item level: `SUCCEEDED` items are not processed again, and batch-created `PredictionArtifactProvenance.sourceBatchItemId` prevents a retry from creating a second prediction artifact if a worker crashes after the provenance transaction but before the batch item is marked succeeded.

Normal annotator concurrency is unrelated to this runner. Browser users can log in, draw, save, review, approve, and export without a queue. The DB lease model applies only to prediction-import batch items.

## Trial Worker Model

RB-065 chooses Option A for the customer trial: an optional Docker Compose worker service using PostgreSQL as the queue/lease store. There is no Redis, BullMQ, RabbitMQ, distributed coordination, GPU execution, or model inference in this slice.

Enable the optional worker profile after creating a named project `OWNER` or `QA` account for `SAPEN_JOB_EMAIL`/`SAPEN_JOB_PASSWORD` in `deploy/trial.env` as described in [deployment-trial.md](deployment-trial.md):

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile worker up -d prediction-import-worker
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs -f prediction-import-worker
```

One-shot processing remains available when an always-on worker is not desired:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run jobs:prediction-import -- --base-url http://localhost:3000 --limit 25 --max-jobs 5 --email 'qa@example.com' --password '<password>'
```

For a single batch:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run jobs:prediction-import -- --base-url http://localhost:3000 --batch '<batch-id>' --limit 25 --email 'qa@example.com' --password '<password>'
```

Use a named job account, not shared demo credentials, so batch processing remains attributable. The processor metadata records the configured `PREDICTION_IMPORT_PROCESSOR_ID`; the audit actor remains the authenticated named account used by the script.

RB-076 verified the no-op due-processing command and optional worker profile startup in a local Compose dry run. No prediction ZIP fixture was used in that dry run.

## Retry And Failure Behavior

Validation failures such as checksum, dimension, content-type, coordinate-space, or label-value errors become item `FAILED` rows with stable error codes. They are not retried automatically.

Storage/object failures use `RETRY_PENDING` while attempts remain. Manual retry is available through:

```bash
curl -X POST https://annotate.example.com/api/prediction-import-batches/<batch-id>/retry
```

Manual retry resets failed/retry-pending items to `PENDING`; successful items are never reset by the batch retry endpoint.

RB-066 adds staging retention tracking. After a terminal failed/skipped item source object is purged, the item keeps its failed/skipped status and `stagingPurgedAt`/`stagingPurgeReason` explain why the staged source is no longer retryable. Re-upload the batch if that item still needs processing.

Stale `PROCESSING` recovery:

- `leaseExpiresAt <= now` marks the item stale.
- Legacy rows without a lease fall back to `startedAt + PREDICTION_BATCH_LEASE_SECONDS`.
- Stale items with remaining attempts become `RETRY_PENDING` with error code `BATCH_ITEM_STALE_PROCESSING_RECOVERED`.
- Stale items without remaining attempts become `FAILED` with the same stable error code.
- The next processing pass may immediately claim due recovered retry items.
- `SUCCEEDED` items are terminal and are never reprocessed by process/process-due/retry.

Batch statuses:

- `PENDING` - created but not processed.
- `PROCESSING` - some items are still pending/processing/retry-pending after processing started.
- `COMPLETED` - all items succeeded.
- `COMPLETED_WITH_ERRORS` - at least one item succeeded and at least one item failed/skipped.
- `FAILED` - no items succeeded and all items are terminal.
- `CANCELLED` - enum reserved; no cancel endpoint in RB-061.

Predictions remain proposals only. Batch import does not create correction tasks, approvals, human ground truth, or training-export eligibility. Use the existing RB-058 correction-task workflow after successful imports.

## Limits

Runtime variables:

- `PREDICTION_BATCH_UPLOAD_MAX_BYTES` - whole ZIP upload cap, default `104857600`.
- `PREDICTION_BATCH_MAX_ITEMS` - max manifest items, default `200`.
- `PREDICTION_BATCH_PROCESS_LIMIT` - default and maximum process-pass limit, default `25`.
- `PREDICTION_BATCH_ITEM_MAX_ATTEMPTS` - attempts per item, default `3`.
- `PREDICTION_BATCH_LEASE_SECONDS` - processing lease/stale timeout, default `900`.
- `PREDICTION_BATCH_MAX_JOBS_PER_TICK` - max due batches per worker tick, default `5`.
- `PREDICTION_BATCH_WORKER_INTERVAL_SECONDS` - loop sleep interval for the optional worker, default `30`.
- `PREDICTION_IMPORT_PROCESSOR_ID` - non-secret processor label stored on claimed items/audit details, default `sapen-annotate-worker`.
- `MASK_UPLOAD_MAX_BYTES` - per-item staged mask cap, default `52428800`.
- `BATCH_STAGING_COMPLETED_RETENTION_DAYS` - completed batch staging retention, default `7`.
- `BATCH_STAGING_FAILED_RETENTION_DAYS` - failed/cancelled/error batch staging retention, default `14`.
- `PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS` - abandoned presigned image/mask upload retention, default `24`.
- `STORAGE_CLEANUP_MAX_DELETE_PER_RUN` - maximum cleanup deletes per execute run, default `500`.

For customer trials, keep `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` and `CADDY_MAX_BODY_SIZE` above `PREDICTION_BATCH_UPLOAD_MAX_BYTES`; otherwise the Next proxy or Caddy can reject the request before the app returns JSON.

## Authorization

Project `OWNER` and `QA` can create, inspect, process, process due batches, and retry batch imports. `LABELER`, `VIEWER`, and non-members cannot access the batch import UI or per-batch processing APIs. The `process-due` runner path only sees projects where the authenticated job account has an owner/QA role.

Direct `ModelRun` details remain admin-only elsewhere. Batch responses include reduced prediction-run/model summaries and never expose private storage keys.

Storage cleanup is a separate operational path. `POST /api/storage-cleanup` and `npm run storage:cleanup` require a named global `ADMIN` account, default to dry-run, and never expose presigned URLs.

## Retention Cleanup

Run dry-run first:

```bash
npm run storage:cleanup -- --category batch-staging --batch '<batch-id>' --email admin@example.com --password '<admin-password>'
```

Execute with an explicit limit:

```bash
npm run storage:cleanup -- --execute --category batch-staging --batch '<batch-id>' --limit 100 --email admin@example.com --password '<admin-password>'
```

The cleanup service deletes only eligible temporary staging objects after the configured retention period. It never deletes committed raw images, committed artifact versions, imported prediction artifact versions, export manifests/packages, or active/retryable batch item sources. Full runbook: [storage-retention-cleanup.md](storage-retention-cleanup.md).

## Deferred

- Slice-classification batch prediction imports.
- Metrics dashboards and model-to-model analysis reports. RB-067 computes basic export-time Dice/IoU/confusion metrics for prediction-analysis manifests only.
- Production-scale queue infrastructure. RB-065 intentionally keeps the trial path to one default single-host worker and PostgreSQL leases; revisit Redis/BullMQ/RabbitMQ only if real usage outgrows this model.
