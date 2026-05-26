# RB-042 — Dependency Audit Baseline

## Status

Proposed

## Priority

High

## Context

RB-040 and RB-041 reported `npm audit` findings. The repository is still in development, but dependency risk should be classified before the architecture/UI baseline and later domain work.

This ticket is intentionally small. It should not perform broad framework upgrades or force major dependency changes.

## Goal

Run a dependency audit, apply safe non-breaking fixes where available, document any remaining findings, and preserve the green validation baseline from RB-041.

## Scope

- Run `npm audit --json` and classify findings by severity and whether they affect direct or transitive dependencies.
- Run `npm audit fix` only if it does not require `--force`.
- Do not run `npm audit fix --force`.
- If findings remain, document them in `docs/adr/remediation-backlog.md` with exact summary and next step.
- Run the full root validation baseline after changes:
  - `npm run prisma:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test`

## Out Of Scope

- Major dependency upgrades.
- Next.js/React framework migration.
- UI architecture refactor.
- Domain-model work.

## Acceptance Criteria

- Audit output is reviewed and summarized.
- Safe audit fixes are applied if available.
- Remaining vulnerabilities are documented with severity and remediation path.
- Root validation remains green.
- Ticket is moved to `tickets/2026-05-19/done/`.
- A focused commit is created.
