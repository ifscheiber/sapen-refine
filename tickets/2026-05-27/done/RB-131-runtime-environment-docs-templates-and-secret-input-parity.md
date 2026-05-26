# RB-131 - Runtime Environment Docs, Templates, And Secret-Input Parity

Status: Done
Priority: P2
Type: Operations documentation / configuration governance

## Context

The runtime environment surface has grown through RB-111, RB-112, RB-116-A, RB-117, RB-118, and the EX-001 through EX-005 SaPen-CNN export sprint. The implementation now reads variables from app runtime config, operator scripts, and materialization tooling, including:

- high-cost write limit variables,
- training and prediction-analysis export caps,
- export worker credentials and file-mounted secret variants,
- storage cleanup credentials and file-mounted secret variants,
- operator attribution variables,
- SaPen-CNN materializer variables such as `SAPEN_DATASET_BASE_URL`, `SAPEN_DATASET_EMAIL`, and password inputs.

The docs and templates are not fully aligned:

- [../../docs/operations/environment.md](../../docs/operations/environment.md) does not list the full current environment surface.
- [../../.env.example](../../.env.example) does not show several post-RB-117 file-secret or post-EX materializer inputs.
- [../../docs/04-server/runtime-config.md](../../docs/04-server/runtime-config.md) and trial deployment docs mention tuning some controls without a single parity guard.

## Impact

Environment drift can cause production operators to miss required variables, set variables that are not consumed by the runtime, or fall back to deprecated password handling. This increases the chance of misconfigured rate limits, blocked workers, unaudited operator actions, or failed dataset materialization.

## Goal

Create a governed runtime environment inventory that keeps implementation, templates, and docs aligned.

## Non-Goals

- Do not introduce a new secret manager.
- Do not remove deprecated `--password` compatibility; RB-117 intentionally left that as a transition path.
- Do not change actual script authentication behavior unless a missing variable reveals a clear bug.

## Implementation Plan

1. Build an inventory from current implementation reads in [../../src/server/runtime/config.ts](../../src/server/runtime/config.ts), operator scripts under [../../scripts](../../scripts), and deployment templates under [../../deploy](../../deploy).
2. Update [../../docs/operations/environment.md](../../docs/operations/environment.md), [../../docs/04-server/runtime-config.md](../../docs/04-server/runtime-config.md), [../../.env.example](../../.env.example), and [../../deploy/trial.env.example](../../deploy/trial.env.example) so each active variable has a clear owner, purpose, default behavior, and secret-handling note.
3. Add a lightweight test or script-level guard for parity between documented runtime variables and templates where practical.
4. Keep local-development examples safe: use placeholders and file/env/stdin secret mechanisms instead of command-line password arguments.

## Files to Inspect

- `src/server/runtime/config.ts`
- `scripts/process-export-jobs.mjs`
- `scripts/process-prediction-import-batch.mjs`
- `scripts/storage-cleanup.mjs`
- `scripts/create-trial-user.mjs`
- `scripts/materialize-sapen-cnn-dataset.mjs`
- `.env.example`
- `deploy/trial.env.example`
- `docs/operations/environment.md`
- `docs/04-server/runtime-config.md`
- `docs/operations/local-sapen-cnn-training-handoff.md`

## Acceptance Criteria

- Current app runtime variables and operational script variables are documented in one environment inventory.
- `.env.example` and `deploy/trial.env.example` are intentionally different where local and customer-trial needs differ, and that difference is documented.
- File-mounted secret variables introduced by RB-117 are represented in docs/templates where applicable.
- SaPen-CNN dataset materializer variables are documented without exposing private storage keys or signed URLs.
- Validation includes the parity guard, `npm run check:docs-links`, and `git diff --check`.

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run check:docs-links
git diff --check
```
