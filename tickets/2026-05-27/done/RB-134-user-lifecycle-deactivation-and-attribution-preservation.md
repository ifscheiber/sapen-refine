# RB-134 - User Lifecycle Deactivation And Attribution Preservation

Status: Done
Priority: P1/P2
Type: Auth / audit / data-integrity policy

## Context

The docs correctly warn operators not to delete users to disable access unless they accept loss of direct user-row attribution. The Prisma model still uses nullable user references in many attribution-bearing rows, often with `onDelete: SetNull`, including audit, review, artifact, export, and project membership relations.

There is no explicit production user-deactivation model yet. Existing scripts can create named users, and login/session logic authenticates active users, but the repository does not define a supported "disable this user while preserving attribution" flow.

## Impact

In a production or customer-trial setting, access revocation is inevitable. If operators delete user rows instead of deactivating accounts, historical attribution can become indirect or null even when the underlying artifact/review/export rows remain. That weakens auditability and can complicate investigations around data mix-up, improper review, or export provenance.

## Goal

Add a supported deactivation policy that disables access while preserving historical attribution.

## Non-Goals

- Do not implement full GDPR erasure or anonymization.
- Do not change historical audit rows.
- Do not delete users as part of access revocation.
- Do not build a broad admin user-management UI unless explicitly scoped later.

## Implementation Plan

1. Define the domain policy in an ADR or auth docs: production access revocation uses deactivation, not deletion.
2. Add persisted deactivation fields to `User` if not already present, such as `disabledAt`, `disabledById`, and optional `disabledReason`.
3. Update login/session validation so disabled users cannot create or continue authenticated sessions.
4. Add a minimal owner/admin CLI or API path for deactivation if needed for customer-trial operations.
5. Preserve foreign-key attribution in existing domain rows.
6. Add tests proving disabled users cannot log in, existing sessions are rejected, and historical attribution rows remain readable.
7. Update deployment/operator docs with the approved deactivation procedure.

## Files to Inspect

- `prisma/schema.prisma`
- `src/server/auth/session.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `scripts/create-trial-user.mjs`
- `docs/04-server/auth-rbac-audit.md`
- `docs/04-server/deployment.md`
- `tests/unit/auth-hardening.test.ts`
- `tests/integration`

## Acceptance Criteria

- Operators have a documented way to revoke user access without deleting user rows.
- Disabled users cannot log in or continue workspace/API sessions.
- Existing attribution-bearing records continue to resolve the user row after deactivation.
- Tests cover login/session rejection and attribution preservation.
- Docs explicitly warn that deletion is not the supported revocation mechanism.
- Validation includes auth/session tests, affected route/API tests, `npm run test`, and `git diff --check`.

## Validation Commands

```bash
npm run prisma:generate
npm run lint
npm run typecheck
npm run test -- tests/unit/auth-hardening.test.ts
npm run test
npm run check:docs-links
git diff --check
```
