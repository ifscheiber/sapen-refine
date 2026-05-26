# SaPen Annotate

SaPen Annotate is a standalone annotation app for creating attributable, exportable wood-slice ground-truth data for SaPen model training. The current MVP supports local authentication, project creation, validated image upload through S3-compatible storage, image/sample metadata, semantic and slice-support mask editing, slice classification, minimal review/approval, owner-created training exports, prediction provenance/imports, assisted correction tasks, prediction-analysis exports, and trial-sized ZIP batch prediction imports.

The app is separate from SaPen Core. Future integration should happen through explicit handoff/export contracts rather than shared implicit project state.

## Start Here

- Agent and contributor rules: [AGENTS.md](AGENTS.md)
- High-level architecture map: [ARCHITECTURE.md](ARCHITECTURE.md)
- Detailed docs index: [docs/README.md](docs/README.md)
- Known gaps and deferred work: [docs/known-gaps.md](docs/known-gaps.md)
- Deferred manual and backlog tickets: [tickets/deferred/README.md](tickets/deferred/README.md)

## Local Setup

```bash
npm install
cp .env.example .env
cp .env.example .env.local
npm run db:rebuild
npm run prisma:generate
npm run dev
```

Open `http://localhost:3000`. The seed data currently creates local demo logins for development. Customer-facing trials should use named tester accounts instead of shared seed credentials.

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
npm run handoff:archive    # Create a clean customer/deployment handoff ZIP
```

The required root validation baseline is `npm run db:rebuild`, `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:e2e`, and `npm run check:design-hardcoding` when local Docker services are available.

## Storage Assumptions

Images and mask artifacts are stored in S3-compatible object storage. The current browser-trial path uploads through the app server so MinIO can remain private; presigned URL routes remain for compatibility. Local development uses MinIO from [docker-compose.yml](docker-compose.yml). The database stores object keys and metadata; it does not store image or mask binary data.

## Customer Trial Deployment

The browser-trial baseline uses Docker Compose for Caddy, the Next.js app, PostgreSQL, and MinIO. Start with [docs/04-server/deployment-trial.md](docs/04-server/deployment-trial.md), [docs/04-server/reverse-proxy-caddy.md](docs/04-server/reverse-proxy-caddy.md), and [docs/04-server/backup-restore.md](docs/04-server/backup-restore.md).

Customer-facing trials should use named user accounts per tester. Do not expose shared demo credentials unless that risk is explicitly accepted.

Before external handoff, run `npm run handoff:archive` from a clean worktree. The generated archive includes `handoff-manifest.json` and excludes local secrets, `.git`, build output, caches, test artifacts, backups, and local data volumes.

Docker trial builds use [.dockerignore](.dockerignore) to exclude the same classes of local/private/generated artifacts from build context. `deploy/minio-init.sh` initializes the private MinIO bucket without embedding MinIO credentials in the Compose command string; do not share `docker compose config` output produced with real trial secrets because service `environment` blocks still expand values.

## MVP Limitations

- Export generation and prediction-analysis export are synchronous and intended for trial-sized datasets.
- Project operations are split into route-addressable overview, exports, and prediction-import pages; advanced history dashboards remain deferred.
- Real iPad Safari validation remains a pending customer-pilot gate until a deployed HTTPS URL and device access exist.
- `MaskKind.PREDICTION` and `MaskKind.REFINED` have been removed from the active Prisma schema; remaining "refine" wording is historical or refers to future prediction correction.
- The validation baseline is green; remaining product and deployment gaps are tracked in [docs/known-gaps.md](docs/known-gaps.md) and [docs/adr/remediation-backlog.md](docs/adr/remediation-backlog.md).

## Repository Hygiene

Local secrets, build output, dependency folders, generated caches, and local storage data are ignored by [.gitignore](.gitignore) and excluded from Docker build context by [.dockerignore](.dockerignore). The stale nested `src/app/package.json` and `src/app/docker-compose.yml` files from an earlier monorepo layout were removed; root [package.json](package.json) and [docker-compose.yml](docker-compose.yml) are the intended entry points.
