# Baseline Checks

## Purpose

This page records validation commands run for baseline tickets and whether failures pre-existed before implementation.

## Pre-Change Baseline

- `git status --short`: clean.
- `npm install`: passed.
- `npx prisma generate`: passed.
- `npm run lint`: failed with 6 errors and 17 warnings in pre-existing editor/UI/mask files.
- `npm run build`: failed on the pre-RB-043 prototype AppShell, passing `string | null` to `apiGetLatestMask`.
- `npx tsc --noEmit`: failed on the known `AppShell` issue plus missing types from unused copied UI primitives.

## Final RB-041 Baseline

- `npm run prisma:generate`: passed.
- `npm run lint`: passed with warnings only.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run test`: passed, 1 file and 2 tests.

## Final RB-043 Baseline

- `git status --short`: clean before RB-043 implementation.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed with warnings only.
- `npm run typecheck`: passed after regenerating Next route types with `next typegen`.
- `npm run build`: passed on Next.js 16.2.6.
- `npm run test`: passed, 1 file and 2 tests.
- `npm run check:design-hardcoding`: passed.

## RB-044 Local DB/Login Baseline

- `docker compose ps`: no local compose services were running when the login failure was reproduced.
- `npx prisma migrate status`: failed with `P1001` before rebuild because the configured database was not reachable.
- `POST /api/auth/login` with seeded credentials: failed with Prisma `P2021` before rebuild because `public.User` was missing.
- Local `.env` and `.env.local` were stale and pointed at the old `sapen_refine` database name.
- `npm run db:rebuild`: intended local recovery path; destructive and allowed only for development.
- `npm run db:rebuild`: passed after replacing stale prototype migrations with `prisma/migrations/20260519090000_init/migration.sql`.
- `npx prisma migrate status`: passed after rebuild; database schema is up to date on `sapen_annotate` at local port `55432`.
- `POST /api/auth/login` with `admin@sapen.local` / `admin1234`: passed with `200 OK` and `sapen_annotate_session` cookie.
- Standard gates after RB-044 passed: `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run check:design-hardcoding`.

## RB-045 Editor/iPad Readiness Start Baseline

- `git status --short`: one untracked ticket file, `tickets/2026-05-19/RB-045-editor-ipad-readiness-smoke-baseline.md`.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed with four React hook dependency warnings in `src/features/editor/EditorClient.tsx`.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.2.6 with the known middleware-to-proxy warning.
- `npm run test`: passed, 1 file and 2 tests.
- `npm run check:design-hardcoding`: passed.

## RB-045 Editor Hook Stabilization

- `npm run lint`: passed with no warnings after stabilizing editor effect dependencies.
- `npm run typecheck`: passed.
- `npm run test`: passed, 2 files and 6 tests.

## RB-045 Pointer Input Hardening

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 2 files and 6 tests.

## RB-045 Editor Trial Usability

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 2 files and 6 tests.
- `npm run check:design-hardcoding`: passed.

## Final RB-045 Baseline

- `git status --short`: clean before final validation.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed with no warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.2.6 with the known middleware-to-proxy warning.
- `npm run test`: passed, 2 files and 6 tests.
- `npm run check:design-hardcoding`: passed.

## RB-046 Customer Browser Trial Readiness Start Baseline

- `git status --short`: one untracked ticket file, `tickets/2026-05-19/RB-046-customer-browser-deployment-trial-readiness.md`.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.2.6 with the known middleware-to-proxy warning.
- `npm run test`: passed, 2 files and 6 tests.
- `npm run check:design-hardcoding`: passed.

## RB-046 Customer Browser Trial Readiness Final Baseline

- `git status --short`: clean before final validation.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.2.6 with no middleware-to-proxy warning.
- `npm run test`: passed, 6 files and 21 tests.
- `npm run check:design-hardcoding`: passed.
- `docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config`: passed.
- `docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile tools config`: passed.
- `npm run start -- -p 3100`: started the production server after sandbox escalation for local port binding.
- `curl -i http://localhost:3100/api/health`: returned `200 OK` with `status: ok`.
- `curl -i http://localhost:3100/api/ready`: returned `200 OK` with database and storage checks `ok`.

## RB-047 Desktop Browser E2E/iPad Preparation Start Baseline

- `git status --short`: one untracked ticket file, `tickets/2026-05-19/RB-047-desktop-browser-e2e-ipad-preparation.md`.
- `npm run prisma:generate`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.2.6.
- `npm run test`: passed, 6 files and 21 tests.
- `npm run check:design-hardcoding`: passed.

## Resolved Warnings

- RB-046 replaced `src/middleware.ts` with `src/proxy.ts`. `npm run build` no longer reports the Next.js middleware-to-proxy convention warning.

## Optional Local Smoke

Because the repo is in development, local data may be destroyed when validating the full stack:

```bash
npm run db:reset
npm run prisma:migrate
npm run seed
npm run dev
```

The current development reset path is `npm run db:rebuild`; this destructive smoke path is optional and intentionally separate from the root green baseline.
