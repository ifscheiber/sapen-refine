# RB-130 - Trial Runtime Config Env Propagation For Rate Limits And Export Caps

Status: Planned
Priority: P1
Type: Production configuration / data-safety guardrail

## Context

RB-111 added DB-backed high-cost write limits and export item/byte caps in [../../src/server/runtime/config.ts](../../src/server/runtime/config.ts). The customer-trial environment template [../../deploy/trial.env.example](../../deploy/trial.env.example) exposes these settings, and deployment docs tell operators to tune them through `deploy/trial.env`.

The app service in [../../deploy/docker-compose.trial.yml](../../deploy/docker-compose.trial.yml) does not currently pass the `HIGH_COST_*`, `TRAINING_EXPORT_MAX_*`, or `PREDICTION_ANALYSIS_EXPORT_MAX_*` variables into the container. In the trial stack, changing those values in `deploy/trial.env` can therefore leave the app using runtime defaults.

## Impact

Operators may believe rate limits or export caps were tightened while the running app is still using defaults. That is a production-readiness risk because those caps protect expensive upload, editor-save, prediction-import, cleanup, and export paths from accidental or scripted overload.

This is not a data-loss bug by itself, but it weakens the operational controls intended to prevent resource exhaustion and confusing partial export failures.

## Goal

Make the customer-trial runtime path honor documented high-cost write-limit and export-cap configuration.

## Non-Goals

- Do not change default limit values unless a separate capacity decision is made.
- Do not replace the single-host RB-111 limiter with a distributed quota or billing system.
- Do not change export manifest/package semantics.

## Implementation Plan

1. Add all RB-111 high-cost limit variables and export cap variables to the app service environment in [../../deploy/docker-compose.trial.yml](../../deploy/docker-compose.trial.yml).
2. Keep the variables sourced from `${...}` values so `deploy/trial.env` remains the operator-facing control surface.
3. Add or extend a focused deployment hygiene test that checks the trial Compose app service includes every runtime config variable documented as customer-trial configurable.
4. Update environment/deployment docs only as needed to make the propagation path explicit.

## Files to Inspect

- `src/server/runtime/config.ts`
- `deploy/docker-compose.trial.yml`
- `deploy/trial.env.example`
- `.env.example`
- `docs/04-server/deployment.md`
- `docs/04-server/deployment-trial.md`
- `docs/04-server/runtime-config.md`
- `docs/operations/environment.md`
- `tests/unit` or existing deployment hygiene tests

## Acceptance Criteria

- A value set in `deploy/trial.env` for a high-cost limit or export cap is passed to the `app` container by the trial Compose file.
- The test suite fails if a future runtime cap variable is documented in the trial env template but omitted from the app service environment.
- Existing rate-limit and export-cap behavior remains backward-compatible when the variables are unset.
- Validation includes `npm run test`, `npm run check:docs-links`, and `git diff --check`.

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run check:docs-links
git diff --check
```
