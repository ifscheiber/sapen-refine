# RB-072 — Route-Level API Auth/Error Contract Hardening

## Status

Proposed / Ready for Codex

## Priority

High

## Type

API / Auth / Error Contracts / Customer Trial Hardening / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-064 — Auth, RBAC & Audit Hardening
- RB-071 — Architecture / Docs / Backlog Consistency Hotfix

## Blocks

- RB-073 — Trial Deployment Secret & Build-Context Hygiene
- RB-070 — Editor Eraser Tool UX
- Customer-facing trial deployment confidence

---

## 1. Context

The post-RB-069 review found that API authentication and authorization failures are not consistently handled at the route level.

Some API routes call helpers such as `requireUser()` or `requireProjectRole()` before structured route-level error handling. That can produce inconsistent failures for API clients, especially for:

- unauthenticated requests,
- forbidden access,
- missing project or image,
- project access denied,
- validation errors,
- conflict/domain errors.

The existing RB-072 draft correctly defines the core goal: protected API routes should return stable JSON errors for representative unauthenticated/forbidden/project-access failures instead of generic exceptions or HTML redirects. The draft also correctly says that this should not add new roles, rewrite every route, or change successful response shapes.

RB-071 was a docs-only hotfix. Its validation was acceptable for that scope, but RB-072 changes customer-facing API failure behavior and should therefore use the full trial validation gate, including build and E2E.

---

## 2. Goal

Standardize route-level API error handling for representative auth, authorization, project-access, validation and conflict failures.

At the end of RB-072:

1. Representative protected API routes return stable JSON errors.
2. API callers receive predictable status codes and error codes.
3. Route handlers do not leak raw framework exceptions for common auth/RBAC/domain failures.
4. Successful response shapes remain unchanged unless a narrowly scoped bug fix is required.
5. Tests cover negative unauthenticated/forbidden/project-access cases across route families.
6. Existing browser workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- new roles or permission semantics,
- broad RBAC redesign,
- UI flow changes,
- proxy/session cookie architecture changes,
- auth provider changes,
- route rewrites for every endpoint,
- domain behavior changes,
- schema changes,
- large API response redesign,
- new product features.

If a route family is too large to fully migrate, document remaining deferred routes.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with the full validation baseline:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Notes:

- RB-071 was docs-only and did not require the full app gate.
- RB-072 changes API behavior and must use the full gate.
- `handoff:archive -- --dry-run` should remain part of the trial-readiness confidence check.
- If a command is unavailable or intentionally skipped, document why in the final report and backlog if needed.

Work in focused slices and commit after each meaningful slice.

---

## 5. Error Contract Principles

### 5.1 JSON only for API errors

API routes should return JSON for common failures.

Canonical RB-072 v1 error shape:

```json
{
  "ok": false,
  "error": "UNAUTHENTICATED"
}
```

This flat shape matches the current app convention. Do not introduce a nested `error` object in RB-072 unless a route already returns one and a test-protected compatibility reason requires preserving it.

### 5.2 Stable status codes

Use canonical status codes where applicable:

```text
401 UNAUTHENTICATED
403 FORBIDDEN / PROJECT_ACCESS_DENIED
404 NOT_FOUND / PROJECT_NOT_FOUND / IMAGE_NOT_FOUND
409 CONFLICT
422 VALIDATION_ERROR
500 INTERNAL_ERROR
```

Do not expose stack traces or raw Prisma/Next errors.

### 5.3 Preserve success responses

Do not change successful response shapes unless a test-protected bug requires a narrow correction.

### 5.4 Do not weaken backend authorization

UI hiding controls is not relevant here.

Backend route/domain authorization remains the source of truth.

### 5.5 Representative route families, not every route

This ticket should harden representative high-risk route families.

Do not attempt a risky broad refactor of all routes unless a shared wrapper makes it safe.

---

## 6. Scope

### 6.1 API error helper / wrapper

Add or reuse a small helper for API route errors.

Possible locations:

```text
src/server/api/errors.ts
src/server/http/apiErrors.ts
src/server/api/routeHandler.ts
```

Capabilities:

- convert known auth/RBAC/domain errors into stable JSON responses,
- sanitize unknown errors,
- preserve status codes,
- keep route handlers concise,
- testable mapping.

Possible helper API:

```ts
jsonError(code, message, status, details?)
withApiErrorHandling(handler)
requireApiUser(request)
```

Use existing conventions if already present.

### 6.2 Known error categories

Support at least:

```text
UNAUTHENTICATED
FORBIDDEN
PROJECT_ACCESS_DENIED
PROJECT_NOT_FOUND
IMAGE_NOT_FOUND
ARTIFACT_NOT_FOUND
EXPORT_NOT_FOUND
PREDICTION_RUN_NOT_FOUND
CORRECTION_TASK_NOT_FOUND
VALIDATION_ERROR
CONFLICT
INTERNAL_ERROR
```

Exact list may differ based on existing code.

### 6.3 Representative route families

Harden representative endpoints from these families:

- project routes,
- image / metadata / asset routes,
- annotation / review routes,
- training export routes,
- prediction-analysis export routes,
- model/prediction routes,
- prediction import routes,
- correction task routes,
- batch import/process/retry routes,
- storage cleanup route,
- auth login/logout where applicable.

Focus on:

```text
unauthenticated
forbidden
missing resource
project access denied
validation error
invalid transition / conflict
```

### 6.4 Same-origin guard interaction

RB-064 added same-origin mutation protection in `src/proxy.ts`.

RB-072 must ensure that API error contract work does not break the same-origin guard.

If cross-origin mutation is blocked by proxy before route handler, document expected behavior and test representative route-level behavior separately.

For unauthenticated API requests, the proxy should return JSON `401` with the RB-072 error shape instead of redirecting to `/login`. Workspace page requests should continue to redirect to `/login`.

---

## 7. Tests

### 7.1 Unit tests

Add tests for:

- API error mapping,
- known error classes/codes,
- unknown error sanitization,
- helper/wrapper behavior,
- validation error formatting if helper supports it.

### 7.2 Integration / route-handler tests

Add representative tests across route families.

Minimum coverage:

```text
project route:
  unauthenticated -> JSON 401
  forbidden/non-member -> JSON 403 or 404 according to policy

image metadata route:
  unauthenticated -> JSON 401
  inaccessible image -> JSON 403/404

review route:
  viewer/labeler forbidden to approve -> JSON 403

training export route:
  unauthorized export creation/download -> JSON 403

prediction import route:
  unauthorized import -> JSON 403
  missing prediction run -> JSON 404

batch process/cleanup route:
  unauthorized mutation -> JSON 403
```

Use existing test helpers and fixtures.

### 7.3 E2E tests

Existing E2E must remain green.

No new E2E is required unless a browser-visible error flow changes.

---

## 8. Documentation Updates

Update:

```text
docs/04-server/auth-rbac-audit.md
docs/04-server/api-error-contracts.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/adr/remediation-backlog.md
docs/known-gaps.md
```

Create `docs/04-server/api-error-contracts.md` if it does not exist.

Docs should state:

- canonical error shape,
- common error codes,
- representative route coverage,
- what remains deferred,
- relation to proxy same-origin guard,
- no successful response shape changes.

---

## 9. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. A shared API error helper/wrapper exists or existing helper is consistently reused.
3. Representative route families return stable JSON errors for unauthenticated/forbidden/project-access failures.
4. Known domain validation/conflict errors are mapped to stable JSON where representative routes exercise them.
5. Unknown errors are sanitized.
6. Successful response shapes remain unchanged unless explicitly documented.
7. Tests cover representative negative cases across project, image, review, export, prediction, batch/cleanup and auth route families.
8. Same-origin guard behavior remains compatible.
9. Docs describe the API error contract and deferred route families.
10. Ticket is moved to:

```text
tickets/2026-05-21/done/
```

11. Final validation passes:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

12. Final Codex report includes:
    - commits created,
    - routes/helpers changed,
    - error codes introduced/standardized,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - remaining deferred routes or limitations.

---

## 10. Suggested Commit Sequence

```bash
git commit -m "docs: define api error contract hardening scope"
git commit -m "feat: add api error response helpers"
git commit -m "refactor: apply api error handling to representative routes"
git commit -m "test: cover api auth and authorization error contracts"
git commit -m "docs: document api error contracts"
git commit -m "chore: finalize route api error hardening ticket"
```

---

## 11. Notes for Codex

- This is a customer-trial hardening ticket.
- Do not change domain permissions.
- Do not rewrite every route if representative coverage is sufficient.
- Prefer stable JSON errors over raw thrown exceptions.
- Keep all existing success paths green.
