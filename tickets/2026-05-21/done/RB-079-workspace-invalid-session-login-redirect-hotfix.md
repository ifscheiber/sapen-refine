# RB-079 - Workspace Invalid Session Login Redirect Hotfix

## Status

Completed

## Priority

High

## Type

Hotfix / Auth / Workspace Routing

## Context

After RB-072, API requests without a session correctly return JSON `401 UNAUTHENTICATED`. Browser workspace pages should still redirect to `/login`.

A stale or invalid `sapen_annotate_session` cookie can currently pass `src/proxy.ts` because the cookie exists. The workspace layout then calls `requireUser()`, receives no valid DB session, throws `UNAUTHORIZED`, and the browser sees a `500`.

Observed error:

```text
GET /app/projects/demo_project/images/.../edit 500
Uncaught Error: UNAUTHORIZED
src/server/auth/rbac.ts:7
src/app/(workspace)/app/layout.tsx:5
```

## Goal

Workspace browser routes with missing, stale, or invalid sessions should redirect to `/login?next=<requested-app-path>` instead of throwing a server error.

API routes must keep the RB-072 JSON `401` behavior.

## Requirements

- Preserve RB-072 behavior for `/api/**` unauthenticated requests.
- Preserve same-origin mutation guard precedence for unsafe API mutations.
- Redirect unauthenticated or invalid-session `/app/**` server component rendering to `/login`.
- Preserve the requested workspace path as `next` where practical.
- Fall back to `/app` if the forwarded request path is missing or invalid.
- Add tests for proxy path forwarding and workspace login redirect target helper.
- Add E2E coverage for a stale session cookie on a protected workspace URL.

## Non-Goals

- Do not change global `requireUser()` behavior.
- Do not change API error contracts.
- Do not change login form behavior.
- Do not add new roles or session schema changes.

## Acceptance Criteria

- Browser navigation to a protected workspace route with a stale session cookie redirects to `/login?next=...`.
- No `UNAUTHORIZED` 500 is thrown from the workspace layout for stale sessions.
- `/api/**` without session still returns JSON `401 UNAUTHENTICATED`.
- Existing RB-072 API contract tests remain green.
- Ticket is moved to `tickets/2026-05-21/done/` after completion.

## Implementation Notes

- Added `src/server/auth/workspaceRedirect.ts` for the workspace request-path header and login `next` target helper.
- Added `src/server/auth/workspaceSession.ts` for browser-workspace auth helpers that redirect stale sessions instead of throwing.
- Updated `src/proxy.ts` to forward `/app/**` request paths when a session cookie is present.
- Updated `src/app/(workspace)/app/layout.tsx` to use `getUserFromSessionCookie()` and redirect invalid/stale sessions to login.
- Updated workspace feature server components to use the workspace-specific auth helpers.
- Preserved RB-072 JSON `401` behavior for `/api/**`.
- Added unit coverage for redirect target fallback/preservation and proxy header behavior.
- Added E2E coverage for stale workspace sessions redirecting to login.

## Validation

- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run test` - passed
- `npx vitest run tests/unit/proxy-public-paths.test.ts tests/unit/workspace-redirect.test.ts tests/unit/api-errors.test.ts` - passed
- `npm run build` - passed
- `npm run test:e2e` - passed
