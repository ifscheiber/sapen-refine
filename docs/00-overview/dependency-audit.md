# Dependency Audit

## Purpose

This page records the RB-042 dependency audit baseline.

## RB-042 Results

Initial `npm audit --json` reported 26 findings:

- 13 moderate
- 12 high
- 1 critical

`npm audit fix` was run without `--force`. A non-major Next.js security update to `next@16.2.6` and `eslint-config-next@16.2.6` was then applied, plus a narrow PostCSS override to `^8.5.14`.

Final `npm audit --json` reports 3 remaining moderate findings:

- direct `prisma`
- transitive `@prisma/dev`
- transitive `@hono/node-server`

The npm-proposed fix is `npm audit fix --force`, which would install `prisma@6.19.3` and is marked as semver-major. It is intentionally deferred.

## Validation

After RB-042 dependency changes, the root baseline passed:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Related Docs

- [baseline-checks.md](baseline-checks.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
