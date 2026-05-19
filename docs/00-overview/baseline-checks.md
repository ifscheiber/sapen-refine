# Baseline Checks

## Purpose

This page records the validation commands run for RB-041 and whether failures pre-existed before implementation.

## Pre-Change Baseline

- `git status --short`: clean.
- `npm install`: passed.
- `npx prisma generate`: passed.
- `npm run lint`: failed with 6 errors and 17 warnings in pre-existing editor/UI/mask files.
- `npm run build`: failed on `src/app/app/AppShell.tsx:379`, passing `string | null` to `apiGetLatestMask`.
- `npx tsc --noEmit`: failed on the known `AppShell` issue plus missing types from unused copied UI primitives.

## Final RB-041 Baseline

- `npm run prisma:generate`: passed.
- `npm run lint`: passed with warnings only.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run test`: passed, 1 file and 2 tests.

## Non-Blocking Warnings

- `npm run lint` reports React hook dependency warnings in `src/app/app/projects/[projectId]/images/[imageId]/edit/EditorClient.tsx`.
- `npm run lint` reports `next/no-img-element` warnings in `src/components/AppFooter.tsx` and `src/components/TabSidebar.tsx`.
- `npm run build` reports the Next.js middleware-to-proxy convention warning for `src/middleware.ts`.

These are not baseline failures. They are deferred to the architecture/UI cleanup and remediation backlog.

## Optional Local Smoke

Because the repo is in development, local data may be destroyed when validating the full stack:

```bash
npm run db:reset
npm run prisma:migrate
npm run seed
npm run dev
```

This smoke path is optional and intentionally separate from the root green baseline.
