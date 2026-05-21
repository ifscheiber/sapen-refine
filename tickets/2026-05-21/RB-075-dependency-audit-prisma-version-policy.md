# RB-075 - Dependency Audit / Prisma Version Policy

## Status

Proposed / Ready for Planning

## Priority

Medium

## Type

Dependency Hygiene / Security / Trial Readiness

## Context

The repo audit baseline is much improved, but `npm audit --json` still reports a known moderate Prisma CLI advisory chain involving `prisma`, `@prisma/dev`, and `@hono/node-server`.

The current npm recommendation may imply a semver-major or otherwise risky Prisma change, so this should be handled as a dedicated dependency decision.

## Goal

Resolve or explicitly document the Prisma CLI audit risk before customer-trial handoff.

## Requirements

- Re-run `npm audit --json`.
- Inspect current `prisma` and `@prisma/client` versions in `package.json`, lockfile, and installed tree.
- Decide whether to pin, upgrade, downgrade, override, or defer.
- Do not apply `npm audit fix --force` blindly.
- Document accepted risk if deferred.
- Keep Prisma generation and validation green.

## Non-Goals

- Do not perform a broad dependency upgrade spree.
- Do not change schema semantics.
- Do not migrate away from Prisma.

## Acceptance Criteria

- The Prisma audit advisory is either fixed or documented with a clear trial-risk decision.
- Prisma CLI/client version policy is explicit.
- Validation remains green.

## Validation

- `npm audit --json`
- `npm ls prisma @prisma/client`
- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

