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
- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES` - app-side upload caps. Supported raw image MIME types are fixed in code to PNG/JPEG for RB-055.

## Customer Trial Variables

Use `deploy/trial.env.example` as the trial template and copy it to `deploy/trial.env` on the server. Do not commit `deploy/trial.env`.

Required trial values:

- `TRIAL_HOSTNAME` - public HTTPS hostname served by Caddy.
- `APP_BASE_URL` - public app URL, for example `https://annotate.example.com`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - internal PostgreSQL settings.
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` - internal MinIO/S3 settings.
- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, `CADDY_MAX_BODY_SIZE` - upload/body limits.

## Upload Limits

Default app limits:

- Images: `104857600` bytes, 100 MiB.
- Masks: `52428800` bytes, 50 MiB.
- Caddy request body: `120MB` in the trial template.

The app returns `413` with `UPLOAD_TOO_LARGE` when an app-mediated upload exceeds the configured limit. Raise the app limit and Caddy limit together; keep Caddy slightly higher than the app limit so oversized uploads fail with an app-level JSON error where possible.

Image content type is not environment-configurable in RB-055. The accepted types are:

- `image/png`
- `image/jpeg`

Unsupported formats return `UNSUPPORTED_CONTENT_TYPE`. Malformed PNG/JPEG files return `IMAGE_DIMENSIONS_UNREADABLE`.

## Session Secret Note

The current session model uses random server-generated tokens stored as hashes in the database. There is no signed client-side session payload, so RB-046 does not add `SESSION_SECRET` or `AUTH_SECRET`.
