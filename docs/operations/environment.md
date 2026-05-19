# Environment Variables

## Purpose

This page documents environment variables required by the current app and local infrastructure.

## Variables

- `DATABASE_URL` - PostgreSQL URL used by Prisma.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` - Docker Compose PostgreSQL settings.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` - Docker Compose MinIO settings.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` - S3/MinIO settings used by `src/server/storage/s3.ts`.

Local defaults in `.env.example` use project-specific ports:

- PostgreSQL: `55432`
- MinIO API: `59000`
- MinIO console: `59001`

These avoid accidentally connecting to older SaPen Refine/Core services on standard ports.

## Important Files

- `.env.example`
- `docker-compose.yml`
- `src/server/storage/s3.ts`
- `src/server/db.ts`
- `prisma.config.ts`

## Invariants And Constraints

- `.env` and `.env.local` are ignored and must not be committed.
- `.env.example` must contain placeholders only.
- If local login fails with Prisma `P2021` for `public.User`, rebuild local development data with `npm run db:rebuild` and restart the Next dev server if it was already running.

## Known Gaps

- Production environment variable requirements are not separated from local development yet.

## Related Tickets / Docs

- [local-development.md](local-development.md)
