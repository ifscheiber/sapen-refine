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
- `npm run test:e2e` after `npm run build` when local PostgreSQL/MinIO are running and seeded.
- `npm run test:e2e:ipad-prep` for the non-device iPad viewport/manifest preparation smoke.

## Current Unit Coverage

- `tests/integration/annotation-domain-schema.test.ts` covers RB-049 domain persistence invariants against local PostgreSQL: default label schema, image/project ownership, semantic/support artifact separation, Copper-not-support logic, attribution, and export references.
- `tests/integration/metadata-workflow.test.ts` covers RB-050 image metadata persistence, editable role behavior, viewer rejection, and rejection of immutable upload facts.
- `tests/integration/slice-workflow.test.ts` covers RB-051 default slice creation, support-mask artifact versions, classification versions, viewer rejection, dimension checks, and semantic-as-support rejection.
- `tests/integration/review-workflow.test.ts` covers RB-052 semantic/support/classification review transitions, permission checks, reject reason handling, review decisions, and latest-approved export readiness.
- `tests/integration/export-workflow.test.ts` covers export readiness, approved-only selection, manifest/package contents, exact image/artifact/classification references, owner-only access, the Copper-not-support invariant, RB-055 export audit events, and blocking missing integrity metadata.
- `tests/unit/mask-serialize.test.ts` covers mask serialization round trips and invalid headers.
- `tests/unit/metadata-validation.test.ts` covers RB-050 metadata parsing, completeness/readiness calculation, and immutable-field validation.
- `tests/unit/review-domain.test.ts` covers RB-052 review transition helpers, role capability mapping, reject reason requirements, and approved-only export readiness.
- `tests/unit/slice-domain.test.ts` covers RB-051 support artifact kind helpers and latest classification resolution.
- `tests/unit/editor-canvas-geometry.test.ts` covers editor coordinate mapping, coordinate clamping, fit zoom, and display sizing helpers.
- `tests/unit/runtime-config.test.ts` covers server runtime config defaults, required variables, and upload limit parsing.
- `tests/unit/upload-validation.test.ts` covers image/mask upload size validation, `413` payloads, SHA-256 checksum normalization, PNG/JPEG dimension parsing, image content-type rejection, mask dimension checks, and support-mask value validation.
- `tests/unit/health-readiness.test.ts` covers health payloads and dependency readiness aggregation.
- `tests/unit/proxy-public-paths.test.ts` covers public operational/auth/browser-asset paths and protected workspace paths.

## Current E2E Coverage

- `tests/e2e/desktop-browser-smoke.spec.ts` covers the desktop MVP browser path: login, project creation, PNG image upload with validated technical metadata, single missing T-number list signal before metadata is entered, editor open without aborted-fetch console/page errors, semantic mask save, support mask save, slice classification save, submit/approve for all three reviewable units, reload, latest-artifact/review API checks, and owner training export creation with manifest/package links.
- `tests/e2e/ipad-viewport-prep.spec.ts` checks the iPad-sized Chromium viewport and Web App Manifest availability. It is preparation only and does not replace real iPad Safari testing.
- `playwright.config.ts` uses the system Chrome channel by default because Playwright's bundled Chromium download is not available for the current `ubuntu26.04-x64` environment.
- E2E prerequisites: local DB/MinIO running, migrations applied, seed/admin login available, and a current production build for the Playwright `next start` web server.

## Manual Smoke

- `docs/07-testing/manual-smoke-desktop-browser.md` defines the current desktop browser MVP smoke path.
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

- `npm run test` now includes a local PostgreSQL integration test. Local DB must be running, migrated, and seeded; `npm run db:rebuild` is the clean recovery path.
- No real network calls to external hosted services in tests.
- Use deterministic fixtures and clean up DB rows created by tests.
- Mock object storage where possible.

## Known Gaps

- Current tests cover stable mask serialization and editor canvas geometry utilities.
- Advanced iPad zoom/pan gestures remain deferred; RB-045 resolved previous editor hook lint warnings.
- API route-handler tests remain limited; DB/domain integration coverage now protects annotation-domain persistence, metadata, slice/support, review, export, and RB-055 export integrity behavior.
- Real iPad Safari smoke remains manual and deferred until deployment/device access is available.

## Related Tickets / Docs

- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
