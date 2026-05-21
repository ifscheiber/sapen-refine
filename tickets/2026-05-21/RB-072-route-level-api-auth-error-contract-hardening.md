# RB-072 - Route-Level API Auth/Error Contract Hardening

## Status

Proposed / Ready for Planning

## Priority

High

## Type

API / Auth / Customer Trial Hardening

## Context

The deep review found that several API routes call `requireUser()` or `requireProjectRole()` before structured route-level error handling.

This can produce inconsistent failures for unauthenticated, forbidden, missing-project, or validation/conflict cases. Customer-facing trial workflows need predictable JSON error contracts for browser UI handling and debugging.

## Goal

Standardize representative route-level API error handling for authentication, authorization, project access, and common domain errors.

## Requirements

- Add or reuse a small API error helper for stable JSON responses.
- Ensure representative project, image, export, prediction, batch, cleanup, and auth routes return canonical JSON errors for `401`, `403`, `404`, and conflict/validation cases where applicable.
- Keep backend authorization as the source of truth.
- Add route-handler or integration tests for representative unauthenticated/forbidden/project-access failures.
- Preserve existing successful response shapes unless a test-protected bug requires a narrow correction.

## Non-Goals

- Do not add new roles or permission semantics.
- Do not rewrite every route in one broad refactor unless required by a shared helper.
- Do not change proxy/session cookie architecture unless needed for stable API errors.
- Do not change UI flows beyond handling already-defined errors.

## Acceptance Criteria

- Representative protected API routes return stable JSON errors instead of generic exceptions or HTML redirects when reached as API calls.
- Tests cover unauthenticated and forbidden cases for multiple route families.
- Docs describe the route-level API error contract and any remaining deferred routes.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- Add focused integration tests for the changed routes.

