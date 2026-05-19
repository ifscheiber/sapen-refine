# Local Development

## Purpose

This page lists the current local setup path.

## Commands

```bash
npm install
cp .env.example .env
cp .env.example .env.local
npm run db:rebuild
npm run prisma:generate
npm run dev
```

The default local ports in `.env.example` are intentionally project-specific (`55432` for PostgreSQL, `59000`/`59001` for MinIO) so SaPen Annotate does not accidentally talk to an older SaPen Refine/Core database on the standard ports.

For an already running local database that only needs schema and seed data:

```bash
npm run db:bootstrap
```

After RB-049 schema changes, prefer the destructive rebuild because the development baseline migration was replaced:

```bash
npm run db:rebuild
```

## Important Files

- `package.json` - root scripts.
- `docker-compose.yml` - local PostgreSQL and MinIO.
- `.env.example` - placeholder environment variables.
- `prisma.config.ts` - Prisma config.

## Invariants And Constraints

- Use placeholders from `.env.example`; never commit real local secrets.
- Root `package.json` and root `docker-compose.yml` are the intended entry points.

## Known Gaps

- Destructive DB reset is allowed during development. `npm run db:rebuild` removes Docker volumes, recreates local Postgres/MinIO, applies Prisma migrations, and runs the seed.
- Advanced iPad zoom/pan gestures remain deferred; RB-045 resolved the previous editor hook lint warnings.

## Related Tickets / Docs

- [../testing/README.md](../testing/README.md)
