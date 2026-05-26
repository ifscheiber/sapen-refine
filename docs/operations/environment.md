# Environment Variables

## Purpose

This page documents environment variables required by the current app and local infrastructure.

## Variables

Application and infrastructure:

- `APP_BASE_URL` - public app origin used by redirects, scripts, and deployment docs.
- `DATABASE_URL` - PostgreSQL URL used by Prisma and server-side scripts.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` - local Docker Compose PostgreSQL settings. The trial template uses the first three to build `DATABASE_URL` inside Compose.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` - local Docker Compose MinIO settings.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` - S3/MinIO settings used by app storage helpers and the SaPen-CNN materializer. `S3_ACCESS_KEY` and `S3_SECRET_KEY` are secrets.
- `TRIAL_HOSTNAME`, `CADDY_MAX_BODY_SIZE` - customer-trial Caddy hostname and request-body cap.

Upload, worker, cleanup, and export limits:

- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_UPLOAD_MAX_BYTES`, `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` - app/proxy upload size caps. Keep proxy/Caddy caps above app caps.
- `PREDICTION_BATCH_MAX_ITEMS`, `PREDICTION_BATCH_PROCESS_LIMIT`, `PREDICTION_BATCH_ITEM_MAX_ATTEMPTS` - prediction batch item, per-pass, and retry caps.
- `PREDICTION_BATCH_LEASE_SECONDS`, `PREDICTION_BATCH_MAX_JOBS_PER_TICK`, `PREDICTION_BATCH_WORKER_INTERVAL_SECONDS`, `PREDICTION_IMPORT_PROCESSOR_ID` - prediction-import worker lease and loop controls.
- `EXPORT_JOB_LEASE_SECONDS`, `EXPORT_JOB_MAX_ATTEMPTS`, `EXPORT_JOB_RETRY_DELAY_SECONDS`, `EXPORT_JOB_MAX_JOBS_PER_TICK`, `EXPORT_JOB_WORKER_INTERVAL_SECONDS`, `EXPORT_JOB_PROCESSOR_ID` - async export worker lease, retry, and loop controls.
- `BATCH_STAGING_COMPLETED_RETENTION_DAYS`, `BATCH_STAGING_FAILED_RETENTION_DAYS`, `PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS`, `STORAGE_CLEANUP_MAX_DELETE_PER_RUN` - temporary object cleanup retention and delete limits.
- `SLICE_CROP_DEFAULT_PADDING_PX` - derived slice crop padding preset. Supported values are `0`, `16`, `32`, and `64`.
- `HIGH_COST_LIMITS_ENABLED`, `HIGH_COST_UPLOAD_MAX_REQUESTS`, `HIGH_COST_UPLOAD_WINDOW_SECONDS`, `HIGH_COST_EDITOR_SAVE_MAX_REQUESTS`, `HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS`, `HIGH_COST_EXPORT_CREATE_MAX_REQUESTS`, `HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS`, `HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS`, `HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS`, `HIGH_COST_OPERATIONS_MAX_REQUESTS`, `HIGH_COST_OPERATIONS_WINDOW_SECONDS` - RB-111 DB-backed single-host high-cost write limits.
- `TRAINING_EXPORT_MAX_ITEMS`, `TRAINING_EXPORT_MAX_BYTES`, `PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS`, `PREDICTION_ANALYSIS_EXPORT_MAX_BYTES` - trial-sized export caps.

Operational scripts and secret input:

- `SAPEN_JOB_BASE_URL`, `SAPEN_JOB_EMAIL`, `SAPEN_JOB_PASSWORD_FILE`, `SAPEN_JOB_PASSWORD` - API worker credentials for `scripts/process-prediction-import-batch.mjs` and `scripts/process-export-jobs.mjs`. Use a named project `OWNER` or `QA` account. Prefer `SAPEN_JOB_PASSWORD_FILE`.
- `SAPEN_CLEANUP_BASE_URL`, `SAPEN_CLEANUP_EMAIL`, `SAPEN_CLEANUP_PASSWORD_FILE`, `SAPEN_CLEANUP_PASSWORD` - API cleanup credentials for `scripts/storage-cleanup.mjs`. Use a named global `ADMIN` account. Prefer `SAPEN_CLEANUP_PASSWORD_FILE`.
- `SAPEN_TRIAL_USER_PASSWORD_FILE`, `SAPEN_TRIAL_USER_PASSWORD` - password input for `scripts/create-trial-user.mjs`. Prefer `SAPEN_TRIAL_USER_PASSWORD_FILE` or `--password-stdin`.
- `SAPEN_OPERATOR_EMAIL`, `SAPEN_REQUIRE_OPERATOR_ATTRIBUTION`, `SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR` - operator attribution controls for trial bootstrap, user creation, and user deactivation. Customer-trial/prod commands should use a named operator; `SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR` is for explicit local development fallback only.
- `SAPEN_DATASET_BASE_URL`, `SAPEN_DATASET_EMAIL`, `SAPEN_DATASET_PASSWORD_FILE`, `SAPEN_DATASET_PASSWORD` - SaPen-CNN dataset materializer fetch credentials for `scripts/materialize-sapen-cnn-dataset.mjs`. Prefer `SAPEN_DATASET_PASSWORD_FILE`; offline materialization can use manifest/ref files without these values.

Auth/session hardening:

- `SHOW_DEMO_CREDENTIALS`, `LOGIN_RATE_LIMIT_MAX_FAILURES`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_LOCK_SECONDS`, `SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS` - demo-credential visibility, login lockout, and throttled session activity settings.

Local defaults in `.env.example` use project-specific ports:

- PostgreSQL: `55432`
- MinIO API: `59000`
- MinIO console: `59001`

These avoid accidentally connecting to older SaPen Refine/Core services on standard ports.

## Important Files

- `.env.example`
- `docker-compose.yml`
- `src/server/storage/s3.ts`
- `src/server/runtime/config.ts`
- `src/server/auth/loginThrottle.ts`
- `src/server/auth/sessionActivity.ts`
- `src/server/uploads/validation.ts`
- `src/server/uploads/integrity.ts`
- `src/server/db.ts`
- `prisma.config.ts`

## Invariants And Constraints

- `.env` and `.env.local` are ignored and must not be committed.
- `.env.example` must contain placeholders only.
- Runtime config validation is server-only; secrets must not use `NEXT_PUBLIC_` names.
- If local login fails with Prisma `P2021` for `public.User`, rebuild local development data with `npm run db:rebuild` and restart the Next dev server if it was already running.
- Upload limits do not control accepted image formats. PNG/JPEG support is currently code-level policy and must be changed with tests/docs if expanded.
- Storage cleanup limits apply only to temporary/staged objects. They must not be used as a committed-artifact retention policy.

## Known Gaps

- Customer-trial deployment variables are documented in [../04-server/deployment-trial.md](../04-server/deployment-trial.md); `.env.example` remains a local-development template with placeholder values.

## Related Tickets / Docs

- [local-development.md](local-development.md)
- [../04-server/runtime-config.md](../04-server/runtime-config.md)
- [../04-server/storage-retention-cleanup.md](../04-server/storage-retention-cleanup.md)
- [../04-server/deployment-trial.md](../04-server/deployment-trial.md)
