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
- Create model runs and view full audit data: global `ADMIN`.

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

## Deferred

Audit UI, general API write rate limiting, full user-management workflows, and dedicated system-actor login semantics remain deferred. RB-065 uses a named owner/QA job account plus non-secret processor metadata for the single-host trial worker path.
