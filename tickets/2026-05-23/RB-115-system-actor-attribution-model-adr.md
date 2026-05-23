# RB-115 - System Actor Attribution Model ADR

## Status

Planned

## Priority

P3 now, P2 before broader automation

## Type

ADR / Attribution / Audit / Background Workers

## Source

- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- `AGENTS.md` attribution invariant

## Depends On

- Current auth/RBAC/audit model.

## Blocks

- Clear attribution for scheduled workers, cleanup, import processors, and future Core handoffs.

## Context

`AGENTS.md` requires every write to be attributable to an authenticated user or explicitly identified system actor. Current trial flows mostly attribute writes to `User` rows, while worker paths also use processor IDs and nullable creator fields. Before automation expands, the repo needs an explicit system actor strategy.

## Goal

Create an ADR that defines how non-human actors are represented and audited.

## Non-Goals

- Do not implement schema changes unless the ADR explicitly chooses and scopes them.
- Do not change existing user authentication flows.
- Do not add Core handoff behavior.

## Requirements

- Compare options:
  - special `User` rows for system actors,
  - separate actor table/type,
  - explicit audit actor type fields.
- Define attribution for cleanup jobs, prediction batch workers, automatic derivations, supersede operations, scheduled exports, and future Core handoff.
- Define how actor identity appears in `AuditLog`, review/export records, and operational logs.
- Document migration implications and compatibility with existing rows.
- Add a follow-up implementation ticket if schema/code changes are chosen.

## Acceptance Criteria

- ADR is accepted or explicitly marked proposed with open questions.
- Future automation work has a single attribution model to follow.
- No current production code behavior changes unless separately scoped.

## Validation

Run:

```bash
git status --short
git diff --check
npm run lint
```

If this remains docs-only and lint is skipped, record why.
