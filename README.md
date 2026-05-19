# SaPen Annotate

SaPen Annotate is a standalone annotation app for creating attributable, exportable wood-slice ground-truth data for SaPen model training. The current MVP supports local authentication, project creation, image upload through S3-compatible storage, and mask editing/saving. Broader annotation metadata, review, approval, and training export workflows are planned but not implemented yet.

The app is separate from SaPen Core. Future integration should happen through explicit handoff/export contracts rather than shared implicit project state.

## Start Here

- Agent and contributor rules: [AGENTS.md](AGENTS.md)
- High-level architecture map: [ARCHITECTURE.md](ARCHITECTURE.md)
- Detailed docs index: [docs/README.md](docs/README.md)
- Known gaps and deferred work: [docs/known-gaps.md](docs/known-gaps.md)

## Local Setup

```bash
npm install
cp .env.example .env
cp .env.example .env.local
npm run db:rebuild
npm run prisma:generate
npm run dev
```

Open `http://localhost:3000`. The seed data currently creates a demo login documented on the login page.

The session cookie was renamed to `sapen_annotate_session` during the repository rename. Existing local browser sessions from earlier builds are expected to be invalidated.

## Environment

`.env.example` contains placeholders only. Do not commit real `.env` or `.env.local` files.

Required local variables:

- `DATABASE_URL` for Prisma/PostgreSQL.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` for Docker Compose.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` for local MinIO.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` for presigned image and mask uploads.

## Commands

```bash
npm run db:up              # Start PostgreSQL and MinIO
npm run db:down            # Stop local services
npm run db:reset           # Recreate local service volumes
npm run db:rebuild         # Recreate local volumes, apply migrations, and seed demo data
npx prisma generate        # Generate Prisma Client
npm run prisma:generate    # Generate Prisma Client through the package script
npm run prisma:migrate     # Apply local Prisma migrations
npm run db:bootstrap       # Apply deployed migrations and seed an existing local DB
npm run prisma:studio      # Open Prisma Studio
npm run seed               # Seed local data
npm run dev                # Start Next.js development server
npm run lint               # Run ESLint
npm run typecheck          # Run TypeScript without emitting files
npm run build              # Run production build/typecheck
npm run test               # Run unit tests
```

The required root validation baseline is `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run check:design-hardcoding`.

## Storage Assumptions

Images and mask artifacts are uploaded to S3-compatible object storage using presigned URLs. Local development uses MinIO from [docker-compose.yml](docker-compose.yml). The database stores object keys and metadata; it does not store image or mask binary data.

## MVP Limitations

- The Prisma schema still uses MVP names such as `MaskKind.PREDICTION` and `MaskKind.REFINED`; this is legacy terminology, not the final standalone annotation domain.
- Image metadata, review/approval state, audit events, export batches, and label-schema versioning are incomplete.
- The editor and mask serialization paths need follow-up hardening before production training-data workflows.
- The validation baseline is green; remaining product and deployment gaps are tracked in [docs/known-gaps.md](docs/known-gaps.md) and [docs/adr/remediation-backlog.md](docs/adr/remediation-backlog.md).

## Repository Hygiene

Local secrets, build output, dependency folders, generated caches, and local storage data are ignored by [.gitignore](.gitignore). The stale nested `src/app/package.json` and `src/app/docker-compose.yml` files from an earlier monorepo layout were removed; root [package.json](package.json) and [docker-compose.yml](docker-compose.yml) are the intended entry points.
