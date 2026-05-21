# RB-064 - Auth, RBAC, And Audit Hardening

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Security / Auth / RBAC / Audit / Customer Trial Readiness / Tests

## Depends on

- RB-062 - Repository State and Documentation Consistency Sweep

## Goal

Harden authentication, authorization, and attribution before customer-facing trial access.

Current risks:

- Project role rules are repeated across route handlers and domain services.
- The login page still exposes local demo credentials in the development-oriented flow.
- Login `next` handling should only allow safe same-app redirects.
- There is no login rate limiting, account lockout, or same-origin mutation guard.
- `Session.lastSeenAt` updates can write on every authenticated request.
- Audit logging exists but is not consistently attached to every mutation.
- Worker/system actor identity is not fully defined for background-style processing.

## Non-Goals

- Do not implement a full enterprise identity provider.
- Do not add multi-tenant organization billing or external user administration.
- Do not change the annotation data model unless a narrowly scoped audit enum or metadata addition is required and documented.
- Do not weaken existing project membership rules.

## Required Baseline

Run before editing:

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
```

## Implementation Notes

- Add a centralized permission/policy layer for common project actions such as read, annotate, review, training export, prediction-analysis export, prediction import, task management, and batch processing.
- Refactor route/domain checks incrementally to use the policy layer.
- Hide shared demo credentials unless explicitly in local development or explicitly accepted by configuration.
- Sanitize login redirect targets to safe app-relative paths.
- Remove token-bearing debug logs and throttle session last-seen writes.
- Add minimal rate-limit or brute-force protection suitable for the current single-host trial.
- Expand audit coverage for important mutation routes and document remaining gaps.

## Acceptance Criteria

- Permission rules are centralized for the main project actions.
- Login redirect handling cannot send users to arbitrary external URLs.
- Customer-facing login does not expose shared seed credentials by default.
- Audit coverage and remaining gaps are documented.
- Relevant auth/RBAC/audit tests are added or updated.
- Docs and trial runbooks are updated.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

