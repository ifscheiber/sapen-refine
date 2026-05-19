# Current State

## Purpose

This page records the repository state after RB-041 through RB-043 baseline work and before domain expansion.

## Important Files

- `package.json` - root scripts for install, Prisma generation, lint, typecheck, build, and tests.
- `vitest.config.ts` - unit test runner configuration.
- `tests/unit/mask-serialize.test.ts` - first unit test coverage for mask serialization.
- `src/app/(public)/login/page.tsx` and `src/app/(public)/login/LoginForm.tsx` - public login route.
- `src/app/(workspace)/app/**` - protected route group for authenticated workspace URLs.
- `src/features/projects`, `src/features/images`, and `src/features/editor` - feature-owned workflow composition.
- `src/components/shell` - reusable authenticated workspace shell.
- `src/design` - CSS tokens, themes, and editor canvas preview constants.

## Current Baseline

The root validation baseline is green:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run check:design-hardcoding`

`npm run lint` currently exits successfully with four hook dependency warnings in `src/features/editor/EditorClient.tsx`. Those warnings are tracked as cleanup debt and do not block the baseline.

## Invariants And Constraints

- Baseline commands should stay green before starting domain-model work.
- Destructive local database reset is allowed in development, but it is not part of the required root gate.
- UI and domain refactors should preserve URL-first workflows.

## Known Gaps

- Dependency audit findings are tracked separately for RB-042.
- The active editor remains prototype-level and needs focused iPad/Pencil UX and hook cleanup before production annotation work.

## Related Tickets / Docs

- [baseline-checks.md](baseline-checks.md)
- [../testing/README.md](../testing/README.md)
