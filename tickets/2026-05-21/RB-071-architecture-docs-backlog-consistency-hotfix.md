# RB-071 - Architecture / Docs / Backlog Consistency Hotfix

## Status

Ready for Implementation

## Priority

High

## Type

Documentation / Repository Hygiene / Trial Readiness

## Context

The post-RB-069 deep review found that the implementation docs are mostly current, but the top-level architecture and backlog entry points still contain stale statements.

Known drift includes:

- `ARCHITECTURE.md` still references removed `src/server/storage.ts` cleanup work.
- `ARCHITECTURE.md` still lists always-on workers and staged-object cleanup as missing, although RB-065 and RB-066 implemented the trial-sized worker and cleanup paths.
- `ARCHITECTURE.md` still says rate limiting / brute-force protection are not implemented, although RB-064 added login throttling and same-origin mutation protection.
- `docs/src/lib/README.md` documents client wrappers that are now stale and should be handled by RB-074.

## Goal

Restore source-of-truth consistency for the current repository state before continuing with trial hardening work.

## Requirements

- Update `ARCHITECTURE.md` to match the current implementation after RB-064 through RB-069.
- Keep `ARCHITECTURE.md` high-level and defer detailed implementation facts to `docs/`.
- Update current-state, known-gaps, and remediation backlog docs only where they conflict with the current state or need the new RB-071+ sequence.
- Mark stale client API wrappers as an explicit follow-up for RB-074 instead of changing code in this ticket.
- Preserve the distinction between implemented trial-sized workflows and deferred production-scale features.

## Non-Goals

- Do not change product code.
- Do not change API behavior.
- Do not change Docker/Compose behavior.
- Do not implement eraser UX.
- Do not remove or rewrite `src/lib` wrappers.
- Do not change dependencies.

## Acceptance Criteria

- Top-level architecture docs no longer mention removed legacy storage helper cleanup as pending.
- Known follow-up areas distinguish implemented RB-065/RB-066 trial paths from deferred production-scale workers/cleanup UI/HA.
- Security docs acknowledge login throttling and same-origin mutation protection without overstating general API rate limiting.
- The RB-071 through RB-078 follow-up sequence is represented in the docs/backlog.
- RB-071 is moved to `tickets/2026-05-21/done` after completion.

## Validation

- `git status --short`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

