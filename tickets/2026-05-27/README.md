# 2026-05-27 Production Readiness Deep Review Sprint

This sprint reconciles two independent 2026-05-27 production-readiness reviews for SaPen Annotate. The Codex review created RB-130 through RB-135; the assistant-side review supplied additional RB-136 through RB-142 files. This README is the authoritative, de-duplicated sprint index.

Review reports and inputs:

- [sapen-annotate-deep-review-2026-05-27.md](sapen-annotate-deep-review-2026-05-27.md) - reconciled Codex deep-review report.
- [README-chatGPT.md](README-chatGPT.md) - preserved assistant-side renumbering input, superseded by this README.

## Baseline

The original Codex review started from a clean worktree and passed `npm run lint`, `npm run typecheck`, `npm run test`, `npm run check:docs-links`, `npm run check:design-hardcoding`, `git diff --check`, and `npm run handoff:archive -- --dry-run`.

The reconciliation baseline found the assistant-side RB-136 through RB-142 files and `README-chatGPT.md` present as untracked files. The current `npm run check:docs-links` baseline passed before reconciliation edits.

## Active Risk-First Order

1. [RB-137 - Storage cleanup coverage for crop object prefixes](RB-137-storage-cleanup-crop-object-prefixes.md) - P1; depends on current RB-114 cleanup semantics and must preserve protected-object behavior.
2. [RB-134 - User lifecycle deactivation and attribution preservation](RB-134-user-lifecycle-deactivation-and-attribution-preservation.md) - P1/P2; should precede broader production user operations.
3. [RB-140 - Export job processor RBAC and audit alignment](RB-140-export-job-processor-rbac-audit-alignment.md) - P2; use explicit `export:processJobs` authorization while preserving existing worker audit context.
4. [RB-131 - Runtime environment docs, templates, and secret-input parity](RB-131-runtime-environment-docs-templates-and-secret-input-parity.md) - P2; follows RB-130 so the environment inventory reflects the propagation fix.
5. [RB-132 - Current-state and architecture documentation drift cleanup](RB-132-current-state-and-architecture-doc-drift-cleanup.md) - P2; follows higher-risk operational/data-integrity tickets.
6. [RB-135 - Ticket and docs governance scope extension](RB-135-ticket-and-docs-governance-scope-extension.md) - P2; should make future active sprint README drift visible.
7. [RB-138 - Deep checksum consistency for primary storage objects](RB-138-storage-consistency-primary-object-checksums.md) - P1/P2; keep explicit/deep mode only, after cleanup-category behavior is clear.
8. [RB-142 - Mask statistic metadata for readiness performance](RB-142-mask-stat-metadata-for-readiness-performance.md) - P2; performance/scalability work after correctness tickets.
9. [RB-133 - Opportunistic decomposition map refresh and hotspot guard](RB-133-opportunistic-decomposition-map-refresh-and-hotspot-guard.md) - P3; maintainability map, no production refactor by itself.

## Done

- [RB-130 - Trial runtime config env propagation for rate limits and export caps](done/RB-130-trial-runtime-config-env-propagation-for-rate-limits-and-export-caps.md) - completed; `deploy/docker-compose.trial.yml` now passes documented RB-111 high-cost write limit and export cap vars into the app service, guarded by `tests/unit/deployment-hygiene.test.ts`.
- [RB-136 - Approved snapshot freshness gating](done/RB-136-approved-snapshot-freshness-gating.md) - completed; training exports now report and block stale approved snapshots when newer non-approved support, semantic, or classification work exists in the requested export scope.
- [RB-139 - Prediction batch ZIP inflation guard](done/RB-139-prediction-batch-zip-inflation-guard.md) - completed; prediction batch create now checks expected and metadata-reported uncompressed mask sizes before staging ZIP entries.

## Reviewed But Not Active

- [RB-141 - ReviewDecision target DB invariant](RB-141-review-decision-target-db-invariant.md) is not active. The same invariant was already implemented by RB-109 through `ReviewDecision_exactly_one_target_chk` in `prisma/migrations/20260524090000_review_export_integrity_constraints/migration.sql`, with docs and tests in `docs/prisma/schema.md` and `tests/integration/review-export-db-constraints.test.ts`.

## Merge Decisions

- No active assistant-side ticket was merged into RB-130 through RB-135 because the remaining scopes are semantically distinct.
- RB-141 was not duplicated as active work because it is already covered by resolved RB-109.
- RB-130 and RB-131 remain separate: runtime env propagation is not the same as broader environment inventory/documentation parity.
- RB-137 and RB-138 remain separate: crop-prefix cleanup classification is not the same as explicit deep checksum verification.
- RB-134 and RB-141 remain separate conceptually, but RB-141 is already resolved by RB-109.

## Existing Carry-Over Not Duplicated

- Real iPad Safari execution remains deferred until physical device and deployed URL access exist. Do not mark RB-113/RB-077-B complete from simulated evidence.
- RB-115-B and RB-115-C remain the existing actor-context follow-ups for unattended workers and external/Core handoff provenance.
- RB-118-A through RB-118-E remain the upload content-safety implementation follow-ups before broad public upload exposure.
- RB-120-A through RB-120-F remain opportunistic decomposition follow-ups and should activate only when adjacent feature or bug work touches those modules.
- EX-001 through EX-005 SaPen-CNN export/materialization work is treated as implemented in this repo and must not be duplicated by this reconciliation sprint.
