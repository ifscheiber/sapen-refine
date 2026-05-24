# Environment Variables

## Purpose

This page documents environment variables required by the current app and local infrastructure.

## Variables

- `DATABASE_URL` - PostgreSQL URL used by Prisma.
- `APP_BASE_URL` - public app origin used by deployment docs and browser-trial configuration.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` - Docker Compose PostgreSQL settings.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` - Docker Compose MinIO settings.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` - S3/MinIO settings used by `src/server/storage/s3.ts`.
- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES` - app-side upload size caps used by image and mask upload routes. RB-055 image content types are fixed in code to PNG/JPEG.
- `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` - Next.js proxy body-buffer cap. Keep it above image/mask/batch upload limits because `src/proxy.ts` covers API mutation requests.
- `PREDICTION_BATCH_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_MAX_ITEMS`, `PREDICTION_BATCH_PROCESS_LIMIT`, `PREDICTION_BATCH_ITEM_MAX_ATTEMPTS` - batch prediction import ZIP, item, pass, and retry caps.
- `PREDICTION_BATCH_LEASE_SECONDS`, `PREDICTION_BATCH_MAX_JOBS_PER_TICK`, `PREDICTION_BATCH_WORKER_INTERVAL_SECONDS`, `PREDICTION_IMPORT_PROCESSOR_ID` - RB-065 prediction-import worker lease/loop controls.
- `BATCH_STAGING_COMPLETED_RETENTION_DAYS`, `BATCH_STAGING_FAILED_RETENTION_DAYS`, `PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS`, `STORAGE_CLEANUP_MAX_DELETE_PER_RUN` - RB-066 storage cleanup retention and execute limits.
- `SAPEN_JOB_BASE_URL`, `SAPEN_JOB_EMAIL`, `SAPEN_JOB_PASSWORD_FILE`, `SAPEN_JOB_PASSWORD` - optional API script/worker settings; use a named owner/QA account for customer trials. Prefer the file variable for mounted secrets.
- `SAPEN_CLEANUP_BASE_URL`, `SAPEN_CLEANUP_EMAIL`, `SAPEN_CLEANUP_PASSWORD_FILE`, `SAPEN_CLEANUP_PASSWORD` - optional API cleanup script settings; use a named global admin account and dry-run first. Prefer the file variable for mounted secrets.
- `SAPEN_TRIAL_USER_PASSWORD_FILE`, `SAPEN_TRIAL_USER_PASSWORD` - optional `npm run trial:user:create` password input. Prefer file or stdin input for manual user creation.
- `SHOW_DEMO_CREDENTIALS`, `LOGIN_RATE_LIMIT_MAX_FAILURES`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_LOCK_SECONDS`, `SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS` - RB-064 auth/session hardening settings.

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
