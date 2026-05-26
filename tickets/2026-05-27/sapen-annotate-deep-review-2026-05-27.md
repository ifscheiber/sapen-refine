# SaPen Annotate Deep Review - 2026-05-27

## Scope

This review started from [../../AGENTS.md](../../AGENTS.md) and [../../ARCHITECTURE.md](../../ARCHITECTURE.md), then checked the docs against current implementation, deployment templates, scripts, tests, and recent ticket history. The review is production-focused: priority is preventing data loss, data mix-up, false readiness claims, and operator misconfiguration.

No production code was changed as part of this review. The output is this report plus ordered sprint tickets.

## Baseline

Initial worktree state: clean.

Validation run before edits:

| Command | Result |
| --- | --- |
| `git status --short` | clean |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run check:docs-links` | passed |
| `npm run check:design-hardcoding` | passed |
| `git diff --check` | passed |
| `npm run handoff:archive -- --dry-run` | passed; archive dry-run reported dirty worktree `no` |
| `npm run test` | passed |

## Executive Summary

No immediate corruption bug was proven in the green tested baseline. The highest production concern is configuration drift: the trial env template exposes RB-111 rate-limit/export-cap controls, but the trial app service does not pass those variables into the container. That can leave operators believing protections are active or tuned when runtime defaults are still in use.

The second concern is governance drift: current-state and architecture docs remain mostly useful, but several high-level statements are stale after RB-111, RB-119/RB-120, RB-121 through RB-129, design/performance slices, and EX-001 through EX-005. Because agents start from `AGENTS.md` and `ARCHITECTURE.md`, stale top-level statements can drive future work toward already-resolved gaps.

The third concern is attribution preservation during account lifecycle operations. Docs warn that deleting users can weaken attribution, but there is no supported deactivation path yet. That should be addressed before broader production operation.

## Findings

### F-01 - Trial rate-limit and export-cap env values are not propagated to the app container

Priority: P1
Ticket: [RB-130](RB-130-trial-runtime-config-env-propagation-for-rate-limits-and-export-caps.md)

Evidence:

- [../../src/server/runtime/config.ts](../../src/server/runtime/config.ts) reads `HIGH_COST_*`, `TRAINING_EXPORT_MAX_*`, and `PREDICTION_ANALYSIS_EXPORT_MAX_*`.
- [../../deploy/trial.env.example](../../deploy/trial.env.example) documents these values for customer-trial configuration.
- [../../docs/04-server/deployment.md](../../docs/04-server/deployment.md) and [../../docs/04-server/deployment-trial.md](../../docs/04-server/deployment-trial.md) describe tuning these controls through trial env configuration.
- [../../deploy/docker-compose.trial.yml](../../deploy/docker-compose.trial.yml) does not pass those variables into the `app` service environment.

Risk:

An operator can set a rate limit or export cap in `deploy/trial.env` and reasonably believe the app is using it, while the running app falls back to defaults. This affects high-cost write paths and export packaging limits. It is an operational guardrail gap, not a direct persisted-data corruption finding.

Recommended action:

Propagate these variables through trial Compose and add a deployment hygiene guard so future runtime cap variables cannot drift silently.

### F-02 - Runtime environment docs and templates are no longer fully aligned

Priority: P2
Ticket: [RB-131](RB-131-runtime-environment-docs-templates-and-secret-input-parity.md)

Evidence:

- [../../docs/operations/environment.md](../../docs/operations/environment.md) does not list the full post-RB-111/RB-112/RB-117/EX environment surface.
- [../../.env.example](../../.env.example) lacks several file-secret variants and SaPen-CNN materializer variables used by [../../scripts/materialize-sapen-cnn-dataset.mjs](../../scripts/materialize-sapen-cnn-dataset.mjs).
- [../../docs/operations/local-sapen-cnn-training-handoff.md](../../docs/operations/local-sapen-cnn-training-handoff.md) documents materializer-specific variables, but the global environment inventory does not.

Risk:

Operators can miss required variables, keep using deprecated password flags, or assume a variable is global when it is script-specific. This can block worker/materializer operations and complicate audit attribution.

Recommended action:

Create a governed runtime environment inventory and align `.env.example`, trial env templates, runtime config docs, and operator-script docs.

### F-03 - High-level architecture/auth docs still say general write-rate limiting is absent

Priority: P2
Ticket: [RB-132](RB-132-current-state-and-architecture-doc-drift-cleanup.md)

Evidence:

- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) still says general write-rate limiting beyond login throttling and same-origin mutation protection is not implemented.
- [../../docs/src/server/auth.md](../../docs/src/server/auth.md) has the same stale gap.
- [../../src/server/http/highCostRateLimit.ts](../../src/server/http/highCostRateLimit.ts), [../../tests/integration/high-cost-rate-limit.test.ts](../../tests/integration/high-cost-rate-limit.test.ts), and [../../tests/unit/high-cost-route-inventory.test.ts](../../tests/unit/high-cost-route-inventory.test.ts) show RB-111 high-cost route limiting exists.

Risk:

Future work may duplicate or mischaracterize the existing limiter. The real remaining limitation is more specific: the current limiter is a single-host trial guard, not a distributed quota/billing system.

Recommended action:

Update docs to describe the implemented RB-111 limiter and precisely name the remaining production-scale gap.

### F-04 - Current-state docs lag behind recent implementation slices

Priority: P2
Ticket: [RB-132](RB-132-current-state-and-architecture-doc-drift-cleanup.md)

Evidence:

- [../../docs/00-overview/current-state.md](../../docs/00-overview/current-state.md) describes the state through RB-118, but current repo history includes RB-119/RB-120, RB-121 through RB-129, design/performance slices, and EX-001 through EX-005.
- [../../docs/03-features/editor.md](../../docs/03-features/editor.md) still says RB-093 adds planned user-facing orchestration for the next sprint, although later tickets implemented the current crop flow.
- [../../docs/06-data/crop-based-slice-annotation.md](../../docs/06-data/crop-based-slice-annotation.md) still says "The planned workflow is" for the current crop path.
- [../../docs/src/components/editor.md](../../docs/src/components/editor.md) still frames iPad Safari checklist work as planned in RB-045 instead of the current deferred RB-113/RB-077-B evidence gate.

Risk:

Current-state docs are used as orientation and can send future work toward stale route/state assumptions. This is especially risky around editor/crop/export flows where duplicate routes or misleading review state could affect annotation workflow integrity.

Recommended action:

Refresh current-state, editor, crop, and component docs without changing historical ADR records.

### F-05 - User deletion remains an attribution preservation risk

Priority: P1/P2
Ticket: [RB-134](RB-134-user-lifecycle-deactivation-and-attribution-preservation.md)

Evidence:

- The schema keeps many attribution relations nullable and uses `onDelete: SetNull` in places where user rows can disappear.
- [../../docs/04-server/deployment.md](../../docs/04-server/deployment.md) already warns not to delete users to disable access unless direct user-row attribution loss is acceptable.
- No supported deactivation flow is currently documented or implemented.

Risk:

If operators revoke access by deleting user rows, historic annotation, review, audit, export, and membership attribution can become weaker. That does not delete the domain rows, but it undermines auditability for production investigations and data provenance.

Recommended action:

Introduce a deactivation policy and implementation so access can be revoked while preserving user-row attribution.

### F-06 - The large-module decomposition map is stale after editor/export growth

Priority: P3
Ticket: [RB-133](RB-133-opportunistic-decomposition-map-refresh-and-hotspot-guard.md)

Evidence:

Current measured hotspots:

- `src/features/editor/EditorClient.tsx` - 2167 lines
- `src/features/editor/CropSemanticEditorClient.tsx` - 1657 lines
- `src/server/domain/exports.ts` - 1998 lines
- `src/server/domain/storageCleanup.ts` - 1100 lines
- `src/server/domain/predictionImportBatches.ts` - 1326 lines
- `src/server/domain/sapenCnnTrainingSnapshot.ts` - 821 lines

[../../docs/01-architecture/opportunistic-decomposition-map.md](../../docs/01-architecture/opportunistic-decomposition-map.md) still reflects earlier counts and does not fully capture the newer SaPen-CNN snapshot/export surface.

Risk:

Large modules increase production-change risk when adjacent bug fixes touch them. This is a maintainability risk, not an immediate functional defect.

Recommended action:

Refresh the map and optionally add a reporting guard for large-module drift. Do not refactor production code without adjacent feature/bug work.

### F-07 - Docs-link governance only covers one ticket README

Priority: P2
Ticket: [RB-135](RB-135-ticket-and-docs-governance-scope-extension.md)

Evidence:

[../../tests/unit/docs-link-governance.test.ts](../../tests/unit/docs-link-governance.test.ts) scans `AGENTS.md`, `ARCHITECTURE.md`, `docs/**/*.md`, and `tickets/2026-05-23/README.md`. It does not dynamically include newer active sprint README files.

Risk:

Newer active sprint tickets and review reports can accumulate broken local links while the docs-link guard stays green. That weakens the ticket system as a production planning and evidence record.

Recommended action:

Extend governance to active sprint README files while excluding historical `done/` tickets unless explicitly opted in.

## Verified Non-Findings

- [../../docs/08-adr/remediation-backlog.md](../../docs/08-adr/remediation-backlog.md) is intentionally a pointer to [../../docs/adr/remediation-backlog.md](../../docs/adr/remediation-backlog.md), not a stale duplicate.
- [../../docs/src/app/routes.md](../../docs/src/app/routes.md) and [../../docs/src/app/api.md](../../docs/src/app/api.md) are broadly aligned with the current route/API inventory, including SaPen-CNN snapshot and materialization-ref endpoints.
- Normal export summaries and public manifests are documented as storage-key-safe. The private materialization refs path is owner/operator scoped and audited by design; no broad storage-key exposure was identified in this review.
- RB-113/RB-077-B remain evidence-gated and must not be completed without physical iPad Safari results.

## Recommended Sprint Order

1. RB-130 - Fix the trial runtime config propagation gap first because it directly affects operational guardrails.
2. RB-131 - Align environment docs/templates so operators know which knobs and secret inputs are real.
3. RB-134 - Add a deactivation path before production user lifecycle operations begin.
4. RB-132 - Refresh stale architecture/current-state docs after the safety-critical config/user-lifecycle work is planned.
5. RB-135 - Extend governance so newer sprint links do not drift.
6. RB-133 - Refresh maintainability/decomposition maps once the higher-risk production-readiness items are tracked.

## Existing Work To Keep Separate

- RB-113/RB-077-B: real iPad Safari manual gate, still blocked on physical device/deployed URL evidence.
- RB-115-B/RB-115-C: explicit actor context for broader unattended workers and external/Core handoff.
- RB-118-A through RB-118-E: upload quarantine/scanning/normalization/rejection/reverse-proxy hardening before broad public uploads.
- RB-120-A through RB-120-F: opportunistic module decomposition, activated only when adjacent work touches those modules.
