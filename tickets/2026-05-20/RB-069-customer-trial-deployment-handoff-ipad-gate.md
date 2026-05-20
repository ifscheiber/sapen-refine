# RB-069 - Customer Trial Deployment, Handoff Hygiene, And iPad Safari Gate

## Status

Proposed / Ready for Codex

## Priority

Medium

## Type

Deployment / Handoff / iPad Smoke / Storage Hygiene / Trial Readiness

## Depends on

- RB-062 - Repository State and Documentation Consistency Sweep
- RB-063 - Project Operations UX Split
- RB-064 - Auth, RBAC, and Audit Hardening

## Goal

Prepare the repository and runbooks for real customer-trial deployment and manual iPad Safari validation.

Current risks:

- Internal ZIP handoffs can accidentally include `.git`, caches, local test results, build outputs, or secrets if created ad hoc.
- Real iPad Safari smoke is still deferred until deployment/device access exists.
- `src/server/storage.ts` is an unused legacy duplicate helper.
- Asset download routes should defensively encode or sanitize filenames in `Content-Disposition`.

## Non-Goals

- Do not implement HA, object replication, or production monitoring.
- Do not run the real iPad Safari smoke until deployment/device access exists.
- Do not change annotation domain semantics.
- Do not expose MinIO publicly for the customer trial.

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

- Create or document a reproducible handoff archive command that excludes `.git`, `.env*` except examples, `.next`, `node_modules`, coverage, `test-results`, TypeScript build info, local storage/db volumes, screenshots, and traces unless explicitly requested.
- Keep Compose-based trial deployment as the default operational shape unless a later decision changes it.
- Add a manual iPad Safari gate checklist for the deployed trial URL.
- Clean up `src/server/storage.ts` by deleting it or making it a re-export of the active helper if safe.
- Harden image asset `Content-Disposition` filename handling.
- Update deployment, backup/restore, and smoke docs.

## Acceptance Criteria

- Handoff archive creation is reproducible and excludes local/private artifacts.
- Trial docs say exactly what remains blocked until deployment/device access is available.
- Storage helper duplication is removed or neutralized.
- Filename/header sanitization is covered by a focused test if code changes are made.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

