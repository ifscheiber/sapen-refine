# Testing And Quality Gates

## Purpose

This page defines the current validation baseline and the intended testing direction.

## Current Commands

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Current Unit Coverage

- `tests/unit/mask-serialize.test.ts` covers mask serialization round trips and invalid headers.
- `tests/unit/editor-canvas-geometry.test.ts` covers editor coordinate mapping, coordinate clamping, fit zoom, and display sizing helpers.

## Baseline From RB-041

- `npm install` completed.
- `npm run prisma:generate` passed.
- `npm run lint` passed with warnings only.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test` passed with the initial mask serialization unit tests.

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

- Current tests cover stable mask serialization and editor canvas geometry utilities.
- Prototype editor hook warnings remain and are deferred to the architecture/UI cleanup.
- API and DB integration tests are not configured yet.

## Related Tickets / Docs

- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
