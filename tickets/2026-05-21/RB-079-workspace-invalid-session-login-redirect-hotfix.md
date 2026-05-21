# RB-079 - Workspace Invalid Session Login Redirect Hotfix

## Status

Ready for Implementation

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

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

