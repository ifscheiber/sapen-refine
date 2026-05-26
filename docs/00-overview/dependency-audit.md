# Dependency Audit

## Purpose

This page records the dependency audit baseline and the RB-075 Prisma policy decision.

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

## RB-075 Results

Date: 2026-05-21.

Commands rerun:

- `npm audit --json`
- `npm ls prisma @prisma/client @prisma/adapter-pg @hono/node-server`
- `npm view prisma version dependencies --json`
- `npm view @prisma/client version peerDependencies dependencies --json`
- `npm view @prisma/adapter-pg version peerDependencies dependencies --json`
- `npm view @hono/node-server version versions --json`

Findings before RB-075:

- `npm audit --json` reported 3 moderate findings: direct `prisma`, transitive `@prisma/dev`, and transitive `@hono/node-server`.
- The advisory path was `prisma@7.8.0 -> @prisma/dev@0.24.3 -> @hono/node-server@1.19.11`.
- npm's automated fix suggestion still pointed at `prisma@6.19.3` and marked it semver-major, so `npm audit fix --force` was not used.
- The local dependency tree was mismatched: `prisma@7.8.0`, `@prisma/client@7.3.0`, and `@prisma/adapter-pg@7.3.0`.

Decision:

- Align `prisma`, `@prisma/client`, and `@prisma/adapter-pg` on `^7.8.0`.
- Add a narrow npm override for `@hono/node-server@1.19.14`, which is within the existing 1.19.x line and outside the advisory range `<1.19.13`.
- Do not perform broad dependency updates.
- Do not use `npm audit fix --force`.

Result after RB-075:

- `npm audit --json` reports 0 vulnerabilities.
- `npm ls prisma @prisma/client @prisma/adapter-pg @hono/node-server` reports `@prisma/adapter-pg@7.8.0`, `@prisma/client@7.8.0`, `prisma@7.8.0`, and overridden `@hono/node-server@1.19.14`.

Trial risk assessment:

- The original advisory chain was Prisma CLI/dev tooling, not app route code or the customer-facing Next.js HTTP server.
- Trial migrations and Prisma generate still use the Prisma CLI, so the safer choice is to keep the CLI/client/adapter aligned and remove the vulnerable transitive package from the installed tree.
- The override should be revisited during normal dependency maintenance when Prisma publishes a release that no longer requires the override.

## Validation

After RB-042 dependency changes, the root baseline passed:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

RB-075 validation additionally requires Prisma generate, DB rebuild, build, tests, E2E, deployment Compose config checks, and `npm audit --json` to remain green before handoff.

## Related Docs

- [baseline-checks.md](baseline-checks.md)
- [../adr/remediation-backlog.md](../adr/remediation-backlog.md)
