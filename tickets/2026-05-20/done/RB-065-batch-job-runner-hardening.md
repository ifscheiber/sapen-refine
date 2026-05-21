# RB-065 - Batch Job Runner Hardening

## Status

Proposed / Ready for Codex

## Priority

High

## Type

Operations / Background Jobs / Prediction Import / Reliability / Tests

## Depends on

- RB-061 - Batch Prediction Import and Background Job Baseline
- RB-062 - Repository State and Documentation Consistency Sweep

## Goal

Make RB-061 batch prediction import processing safer for trial operations by defining and implementing a reliable single-host runner path.

Current risks:

- Processing is explicit through UI/API/script calls, not an always-on worker.
- `PROCESSING` items need stale recovery rules if a process is interrupted.
- Processor identity and operational logs need to be clear and attributable.
- Compose/cron/systemd usage is not fully specified for the trial server.

## Non-Goals

- Do not introduce Kubernetes, Redis, RabbitMQ, BullMQ, or distributed queue infrastructure unless a later ticket explicitly chooses it.
- Do not run model inference.
- Do not change prediction import validation semantics from RB-057/RB-061.
- Do not create ground truth or correction tasks automatically from batch import.

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

- Define the chosen trial runner model: Compose service, cron, systemd timer, or documented manual run command.
- Add stale `PROCESSING` recovery with explicit age/lease semantics.
- Ensure retry and idempotency still do not duplicate succeeded prediction artifacts.
- Define processor identity for audit/logging.
- Update operational docs with copy-paste run commands and failure recovery.
- Add tests for stale recovery and idempotent processing.

## Acceptance Criteria

- Operators can run prediction batch processing without relying on a browser tab.
- Stale in-progress items can recover deterministically.
- Processing remains project-authorized and proposal-only.
- Docs explain normal run, retry, stale recovery, and known limits.
- Ticket is moved to `tickets/2026-05-20/done/` after completion.

