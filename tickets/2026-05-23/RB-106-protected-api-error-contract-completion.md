# RB-106 - Protected API Error Contract Completion

## Status

Planned

## Priority

P1

## Type

API / Auth / Error Contracts / Tests

## Source

- `docs/adr/remediation-backlog.md` RB-106
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- RB-072 representative API error contract hardening.

## Blocks

- Reliable client handling of stale sessions, forbidden access, and domain errors.
- Safe future API route additions.

## Context

RB-072 added flat JSON API error helpers and representative route coverage. The review reports verified that many protected routes still call `requireUser()` or `requireProjectRole()` without `withApiErrorHandling`. The verification report notes that the issue is broader than the examples listed in the combined report.

## Goal

Make stable JSON error handling an enforceable convention for all protected API routes.

## Non-Goals

- Do not redesign successful API response shapes.
- Do not add new roles or permission semantics.
- Do not change browser route redirects.
- Do not rewrite every domain service unless required for error mapping.

## Requirements

- Inventory all `src/app/api/**/route.ts` files and classify public vs protected routes.
- Wrap protected handlers with `withApiErrorHandling` or replace them with a shared protected route factory.
- Preserve existing successful payloads.
- Map auth, project access, validation, conflict, and not-found errors to stable flat JSON responses.
- Add a static/unit guard that fails when protected routes call `requireUser()` or `requireProjectRole()` without the wrapper/factory or an explicit allowlist.
- Keep any allowlist short and documented in the test.

## Acceptance Criteria

- Every protected API route is wrapped or explicitly allowlisted.
- Stale-session API requests return JSON, not framework HTML or raw exceptions.
- Representative negative tests cover auth, forbidden access, validation, conflict, and missing resource cases.
- Existing E2E workflows remain green.

## Validation

Run:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
```
