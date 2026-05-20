# Batch Prediction Imports

## Purpose

RB-061 adds a single-host, DB-backed batch import baseline for prediction masks. It is intended for trial-sized customer/model runs where importing one prediction per browser request is too brittle, but a full external queue is not yet justified.

Implemented evidence:

- `prisma/schema.prisma` - `PredictionImportBatchJob`, `PredictionImportBatchItem`, and batch status/source enums.
- `src/server/domain/predictionImportBatches.ts` - ZIP manifest parsing, private staging, item claiming, processing, retry, and sanitized serialization.
- `src/app/api/prediction-runs/[predictionRunId]/batch-imports/route.ts` - ZIP batch creation.
- `src/app/api/prediction-import-batches/*` and `src/app/api/projects/[projectId]/prediction-import-batches/route.ts` - inspect/process/retry APIs.
- `src/features/projects/ProjectPredictionImportBatchPanel.tsx` - minimal project overview UI for owner/QA batch management.
- `scripts/process-prediction-import-batch.mjs` - optional API-based processing script.

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

Processing is explicit:

- UI button in the project overview.
- API call to `POST /api/prediction-import-batches/[batchId]/process`.
- Optional script:

```bash
npm run jobs:prediction-import -- --batch <batch-id> --limit 25 --email owner@example.com --password '<password>'
```

The processor claims only `PENDING` or due `RETRY_PENDING` items, marks them `PROCESSING`, increments `attemptCount`, reads staged bytes, and calls `importPredictionMaskForUser` from `src/server/domain/predictionImport.ts`. Successful items store the created `AnnotationArtifactVersion` and `PredictionArtifactProvenance` ids.

Re-running process is idempotent at the batch-item level: `SUCCEEDED` items are not processed again, so repeated process calls do not create duplicate prediction provenance rows.

## Retry And Failure Behavior

Validation failures such as checksum, dimension, content-type, coordinate-space, or label-value errors become item `FAILED` rows with stable error codes. They are not retried automatically.

Storage/object failures use `RETRY_PENDING` while attempts remain. Manual retry is available through:

```bash
curl -X POST https://annotate.example.com/api/prediction-import-batches/<batch-id>/retry
```

Manual retry resets failed/retry-pending items to `PENDING`; successful items are never reset by the batch retry endpoint.

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
- `MASK_UPLOAD_MAX_BYTES` - per-item staged mask cap, default `52428800`.

For customer trials, keep `CADDY_MAX_BODY_SIZE` above `PREDICTION_BATCH_UPLOAD_MAX_BYTES`; otherwise Caddy can reject the request before the app returns JSON.

## Authorization

Project `OWNER` and `QA` can create, inspect, process, and retry batch imports. `LABELER`, `VIEWER`, and non-members cannot access the batch import UI or APIs in RB-061.

Direct `ModelRun` details remain admin-only elsewhere. Batch responses include reduced prediction-run/model summaries and never expose private storage keys.

## Deferred

- Dedicated always-on worker process or scheduler.
- Stale `PROCESSING` lease recovery.
- Retention cleanup for staged batch source objects.
- Slice-classification batch prediction imports.
- Metrics dashboards such as Dice/IoU/confusion matrices.
