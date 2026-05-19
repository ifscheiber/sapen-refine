# Local Development

## Purpose

This page lists the current local setup path.

## Commands

```bash
npm install
cp .env.example .env
cp .env.example .env.local
npm run db:up
npx prisma generate
npm run prisma:migrate
npm run seed
npm run dev
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

- `npm run lint` and `npm run build` are not green at the RB-040 baseline.
- There is no local test command yet.

## Related Tickets / Docs

- [../testing/README.md](../testing/README.md)
