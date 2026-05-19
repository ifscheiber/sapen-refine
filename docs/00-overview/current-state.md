# Current State

## Purpose

This page records the repository state established by RB-041 before architecture and domain expansion.

## Important Files

- `package.json` - root scripts for install, Prisma generation, lint, typecheck, build, and tests.
- `vitest.config.ts` - unit test runner configuration.
- `tests/unit/mask-serialize.test.ts` - first unit test coverage for mask serialization.
- `src/app/login/page.tsx` and `src/app/login/LoginForm.tsx` - login route split to satisfy the Next.js Suspense requirement for `useSearchParams`.

## Current Baseline

The root validation baseline is green:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

`npm run lint` currently exits successfully with warnings in prototype editor/image components. Those warnings are tracked as cleanup debt and do not block the baseline.

## Invariants And Constraints

- Baseline commands should stay green before starting domain-model work.
- Destructive local database reset is allowed in development, but it is not part of the required root gate.
- UI and domain refactors should preserve URL-first workflows.

## Known Gaps

- Architecture/UI cleanup is still pending in the renamed RB-043 ticket.
- Dependency audit findings are tracked separately for RB-042.
- The active editor remains prototype-level and will be reorganized before domain expansion.

## Related Tickets / Docs

- [baseline-checks.md](baseline-checks.md)
- [../testing/README.md](../testing/README.md)
