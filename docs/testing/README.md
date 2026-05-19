# Testing And Quality Gates

## Purpose

This page defines the current validation baseline and the intended testing direction.

## Current Commands

- `npx prisma generate`
- `npm run lint`
- `npm run build`

There is no root `typecheck` or `test` script yet.

## Baseline From RB-040

- `npm install` completed.
- `npx prisma generate` passed after allowing Prisma to update its cache outside the workspace.
- `npm run lint` failed on pre-existing ESLint and React compiler issues.
- `npm run build` needed network access for Google font fetching, then failed on a pre-existing TypeScript issue in `src/app/app/AppShell.tsx`.

## Preferred Test Order

- Route-handler/API integration tests for auth, project membership, image upload, mask commit, and latest mask loading.
- DB/domain tests for attribution, versioning, ownership, review state, and export manifests.
- Unit tests for mask serialization, label handling, coordinate spaces, and patch application.
- Focused UI/E2E tests for login, create project, upload image, annotate, save, reload, review, and export.

## Invariants And Constraints

- No real network calls to external services in tests.
- Use deterministic fixtures and clean up DB rows created by tests.
- Mock object storage where possible.

## Known Gaps

- No test harness is configured yet.
- Baseline lint/build failures must be fixed before validation can serve as a reliable regression gate.

## Related Tickets / Docs

- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
