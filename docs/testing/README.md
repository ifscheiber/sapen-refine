# Testing And Quality Gates

## Purpose

This page defines the current validation baseline and the intended testing direction.

## Current Commands

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run check:design-hardcoding`

## Current Unit Coverage

- `tests/unit/mask-serialize.test.ts` covers mask serialization round trips and invalid headers.
- `tests/unit/editor-canvas-geometry.test.ts` covers editor coordinate mapping, coordinate clamping, fit zoom, and display sizing helpers.
- `tests/unit/runtime-config.test.ts` covers server runtime config defaults, required variables, and upload limit parsing.
- `tests/unit/upload-validation.test.ts` covers image/mask upload size validation and `413` payloads.
- `tests/unit/health-readiness.test.ts` covers health payloads and dependency readiness aggregation.
- `tests/unit/proxy-public-paths.test.ts` covers public operational/auth/browser-asset paths and protected workspace paths.

## Manual Smoke

- `docs/07-testing/manual-smoke-editor-ipad.md` defines the current desktop and iPad Safari editor trial checklist.
- `docs/07-testing/manual-smoke-customer-browser-trial.md` defines the deployment-oriented desktop and iPad Safari customer-trial checklist.

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
- Advanced iPad zoom/pan gestures remain deferred; RB-045 resolved previous editor hook lint warnings.
- API and DB integration tests are not configured yet.
- The editor/iPad smoke checklist is manual; automated browser coverage remains deferred.

## Related Tickets / Docs

- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
