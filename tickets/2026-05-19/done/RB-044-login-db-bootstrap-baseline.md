# RB-044 - Restore Login DB Bootstrap Baseline

## Status

Done

## Context

Local login currently returns a server error after submitting credentials because Prisma raises `P2021`: the table `public.User` does not exist in the configured PostgreSQL database.

The app is in development stage and local data may be reset. Prefer a clean local DB rebuild over preserving stale prototype data.

## Goal

Restore a working local login baseline by ensuring the configured development database can be reset, migrated, seeded, and used by `/api/auth/login`.

## Scope

- Verify the current DB/schema state.
- Align local development bootstrap scripts/docs where needed.
- Reset/rebuild the local development database if required.
- Verify seeded login credentials work through the API route.

## Acceptance Criteria

1. The local database contains the Prisma schema tables, including `User`.
2. Seed users exist for local login.
3. `/api/auth/login` returns success for a seeded user instead of Prisma `P2021`.
4. Relevant docs/scripts are updated if the bootstrap process was unclear.
5. Validation commands are run and documented in the handoff.

## Implementation Notes

- Updated ignored local `.env` and `.env.local` to use `sapen_annotate` and project-specific local ports.
- Updated `.env.example` to use PostgreSQL `55432` and MinIO `59000`/`59001`.
- Removed fixed Docker Compose container names to avoid collisions with older SaPen stacks.
- Replaced stale duplicate/empty prototype migrations with a single current development baseline migration.
- Added `db:bootstrap` and `db:rebuild` scripts.
- Updated local development, environment, baseline, and Prisma docs.

## Verification

- `npm run db:rebuild`: passed.
- `npx prisma migrate status`: passed; database schema is up to date.
- `POST /api/auth/login` with `admin@sapen.local` / `admin1234`: returned `200 OK` and a `sapen_annotate_session` cookie.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed with existing editor hook warnings only.
- `npm run typecheck`: passed.
- `npm run build`: passed with the existing middleware-to-proxy warning.
- `npm run test`: passed.
- `npm run check:design-hardcoding`: passed.
