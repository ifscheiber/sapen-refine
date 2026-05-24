# Auth, RBAC, And Audit Hardening

## Purpose

RB-064 centralizes project permission decisions and hardens the local trial auth surface before customer-facing access.

## Evidence

- `src/server/auth/policies.ts` defines the central project/global permission helpers.
- `src/server/auth/redirects.ts` normalizes login redirects to app-relative `/app...` URLs.
- `src/server/auth/loginThrottle.ts` persists hashed login failure buckets in `AuthLoginThrottle`.
- `src/server/auth/requestGuards.ts` defines same-origin mutation checks used by `src/proxy.ts`.
- `src/server/auth/sessionActivity.ts` defines last-seen throttling.
- `src/server/domain/audit.ts` writes append-only `AuditLog` rows.

## Permission Policy

Project permissions are intentionally role-based for the trial:

- Read project data: `OWNER`, `QA`, `LABELER`, `VIEWER`.
- Manage project metadata: `OWNER`, `QA`.
- Upload images, edit metadata, annotate, and submit review: `OWNER`, `QA`, `LABELER`.
- Review/approve/reject: `OWNER`, `QA`.
- Create training exports: `OWNER`.
- Create prediction-analysis exports, prediction imports, prediction runs, correction-task management, and batch processing: `OWNER`, `QA`.
- Create model runs, view full audit data, and run storage cleanup: global `ADMIN`.

The UI may hide unavailable actions, but backend/domain services remain the source of truth.

## Login Hardening

`POST /api/auth/login` now:

- accepts an optional `next` value and returns a sanitized `redirectTo`;
- rejects unsafe redirects to absolute, protocol-relative, non-`/app`, or API/login paths;
- applies DB-backed login throttling by hashed email and, when available, hashed client IP;
- returns `429 AUTH_RATE_LIMITED` for locked buckets;
- records audit events for login success, failure, and lockout.

Shared demo credentials are displayed only in `NODE_ENV=development` or when `SHOW_DEMO_CREDENTIALS=true`. Customer trials should use named tester accounts created with `npm run trial:user:create`.

## Same-Origin Mutation Guard

`src/proxy.ts` rejects unsafe `/api/**` methods when browser request metadata shows a cross-site mutation:

- `Sec-Fetch-Site: cross-site` is rejected.
- If `Origin` is present, it must match the request origin or configured `APP_BASE_URL`.
- Requests without browser Origin/Fetch metadata are allowed so server-side CLI scripts can still call the API.

For unauthenticated requests, `/api/**` returns JSON `401` with `{ ok: false, error: "UNAUTHENTICATED" }`. Browser workspace pages redirect to `/login` with a sanitized `next` target. RB-079 extends this browser behavior to stale or invalid session cookies: `src/app/(workspace)/app/layout.tsx` checks the DB-backed session and redirects instead of throwing `UNAUTHORIZED`.

## Audit Coverage

RB-064 adds audit coverage for:

- login success/failure/lockout,
- project create/update,
- image metadata update,
- slice classification commit,
- review decisions,
- model-run creation,
- prediction-run creation.

Existing RB-055 through RB-061 coverage remains in place for image upload acceptance/rejection, semantic/support mask commits, export creation/download, prediction imports, correction-task updates, assisted corrections, and prediction batch processing. RB-065 extends prediction batch processing audit details with `processorId`, `processorRunId`, item claim/success/failure/retry events, stale recovery events, and due-batch worker pass summaries.

RB-066 adds storage-cleanup audit events for dry-run summaries, execute summaries, per-object deletion, skipped objects, and deletion failures. Cleanup requires a named global `ADMIN` account so temporary-object purge actions remain attributable. RB-115 defines the current system actor model: current operator and worker scripts are attributed to authenticated named users as `triggeredBy`, while `processorId` and `processorRunId` are non-secret `performedBy` execution metadata rather than authenticated principals.

RB-115-A adds the concrete structured representation for these mixed human/worker audit events. `AuditLog.actorId` remains the backwards-compatible primary user/operator reference. Worker and operator paths that need split attribution add `details.actorContext` with `triggeredBy` and `performedBy` objects. Canonical actor types are `USER`, `OPERATOR`, `SYSTEM`, `WORKER`, and `EXTERNAL_SYSTEM`; current labels are `export-worker`, `prediction-import-worker`, and `storage-cleanup`. Actor context must not include secrets, passwords, tokens, signed URLs, raw headers, or cookies.

RB-116 adds `docs/testing/audit-coverage-matrix.md` as the current mutation attribution matrix and `tests/unit/audit-coverage-matrix.test.ts` as the guard. New API mutation methods must be classified in the matrix before the test suite passes. The matrix also classifies operational scripts and high-cost rate-limit bucket writes.

## Deferred

Audit UI, full user-management workflows, cleanup UI, unattended worker system actors, and external-system/Core handoff provenance remain deferred. RB-065/RB-112 use named owner/QA job accounts plus non-secret processor metadata for the single-host trial worker paths; RB-066/RB-114 use a named admin account for cleanup and consistency reporting. RB-115-A supplies structured actor context for the current worker/operator audit rows without changing the `AuditLog` schema.
