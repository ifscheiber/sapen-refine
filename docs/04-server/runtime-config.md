# Runtime Configuration

## Purpose

Runtime configuration is validated server-side by `src/server/runtime/config.ts`. Secrets must stay in server environment files and must not use `NEXT_PUBLIC_` names.

## Local Development Variables

Use `.env.example` as the local template:

- `APP_BASE_URL` - local origin, normally `http://localhost:3000`.
- `DATABASE_URL` - Prisma/PostgreSQL connection string.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` - local Docker Compose PostgreSQL.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` - local MinIO.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` - object storage.
- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_MAX_ITEMS`, `PREDICTION_BATCH_PROCESS_LIMIT`, `PREDICTION_BATCH_ITEM_MAX_ATTEMPTS` - app-side upload and batch-processing caps. Supported raw image MIME types are fixed in code to PNG/JPEG for RB-055.
- `SHOW_DEMO_CREDENTIALS`, `LOGIN_RATE_LIMIT_MAX_FAILURES`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_LOCK_SECONDS`, `SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS` - auth/session hardening controls.

## Customer Trial Variables

Use `deploy/trial.env.example` as the trial template and copy it to `deploy/trial.env` on the server. Do not commit `deploy/trial.env`.

Required trial values:

- `TRIAL_HOSTNAME` - public HTTPS hostname served by Caddy.
- `APP_BASE_URL` - public app URL, for example `https://annotate.example.com`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - internal PostgreSQL settings.
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` - internal MinIO/S3 settings.
- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_MAX_ITEMS`, `PREDICTION_BATCH_PROCESS_LIMIT`, `PREDICTION_BATCH_ITEM_MAX_ATTEMPTS`, `CADDY_MAX_BODY_SIZE` - upload/body and batch-processing limits.
- `SHOW_DEMO_CREDENTIALS=false` - keep shared seed credentials hidden for customer trials unless explicitly accepted.
- `LOGIN_RATE_LIMIT_MAX_FAILURES=5`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS=900`, `LOGIN_RATE_LIMIT_LOCK_SECONDS=900` - DB-backed login lockout defaults.
- `SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS=900` - throttle session activity writes.

## Upload Limits

Default app limits:

- Images: `104857600` bytes, 100 MiB.
- Masks: `52428800` bytes, 50 MiB.
- Prediction batch ZIPs: `104857600` bytes, 100 MiB.
- Prediction batch item count: `200`.
- Prediction batch process pass: `25` items.
- Prediction batch item attempts: `3`.
- Caddy request body: `120MB` in the trial template.

The app returns `413` with `UPLOAD_TOO_LARGE` when an app-mediated upload exceeds the configured limit. Raise the app limit and Caddy limit together; keep Caddy slightly higher than the app limit so oversized uploads fail with an app-level JSON error where possible.

Image content type is not environment-configurable in RB-055. The accepted types are:

- `image/png`
- `image/jpeg`

Unsupported formats return `UNSUPPORTED_CONTENT_TYPE`. Malformed PNG/JPEG files return `IMAGE_DIMENSIONS_UNREADABLE`.

RB-061 batch prediction imports add ZIP-level and item-count limits. Each item still uses the mask limit because the batch processor calls the same RB-057 prediction mask import service. Raise `PREDICTION_BATCH_UPLOAD_MAX_BYTES` and `CADDY_MAX_BODY_SIZE` together for larger ZIPs; raise `MASK_UPLOAD_MAX_BYTES` only when individual `u8raw-v1` prediction masks are expected to exceed 50 MiB.

## Session Secret Note

The current session model uses random server-generated tokens stored as hashes in the database. There is no signed client-side session payload, so RB-046 does not add `SESSION_SECRET` or `AUTH_SECRET`.

## Auth Defaults

Demo credentials are shown automatically only in `NODE_ENV=development`; production/trial deployments must opt in with `SHOW_DEMO_CREDENTIALS=true`.

Login throttling stores hashed email buckets and hashed IP buckets when an IP header is available. A successful login clears the buckets for that email/request source. `SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS` limits write amplification from repeated authenticated reads.
