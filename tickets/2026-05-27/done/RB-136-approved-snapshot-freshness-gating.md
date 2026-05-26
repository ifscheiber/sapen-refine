# RB-136 - Approved Snapshot Freshness Gating

Status: Done
Priority: P1
Type: Export/training data integrity

## Context

Full-image and crop-training export/readiness paths currently select the latest `APPROVED` artifact/classification. This is safe only if the latest working version is also approved, or if the user explicitly chooses to export the last approved snapshot despite newer draft/submitted/rejected work.

In the reviewed snapshot, full-image export uses `loadLatestApprovedArtifact()` and `loadLatestApprovedClassification()` in `src/server/domain/exports.ts`. Crop readiness receives both latest-any and latest-approved values in `src/server/domain/cropReadiness.ts`, but does not consistently flag that the latest non-superseded version is newer than the approved one.

## Impact

A newer correction draft can exist while export/readiness still silently uses an older approved version. That can produce stale training datasets and undermine auditability.

## Non-goals

- Do not redesign the review workflow.
- Do not remove the ability to use last-approved data if a future explicit override is needed.
- Do not touch `../sapen-cnn`.

## Implementation plan

1. Add a shared helper to compare latest-any vs latest-approved reviewable versions.
2. For crop readiness, add explicit reasons such as:
   - `SUPPORT_APPROVED_VERSION_OUTDATED`
   - `SEMANTIC_APPROVED_VERSION_OUTDATED`
   - `CLASSIFICATION_APPROVED_VERSION_OUTDATED`
3. For full-image export readiness, load latest-any artifact/classification summaries in addition to latest-approved and add equivalent warnings/blocking reasons.
4. Default policy: export/create should block when a requested component has a newer non-approved version, unless a future explicit `useLastApprovedSnapshot` flag is introduced.
5. If an explicit override is added, record it in the export selection/manifest/audit details.
6. Update docs to define the approved snapshot freshness policy.

## Files to inspect

- `src/server/domain/exports.ts`
- `src/server/domain/cropReadiness.ts`
- `src/server/domain/review.ts`
- `src/server/domain/cropSemanticMasks.ts`
- `src/server/domain/cropSupportMasks.ts`
- `tests/integration/export-workflow.test.ts`
- `tests/integration/crop-semantic-mask-workflow.test.ts`
- `tests/integration/crop-support-mask-workflow.test.ts`
- `docs/06-data/training-export-contract.md`
- `docs/06-data/sapen-cnn-training-dataset-snapshot-contract.md`

## Acceptance criteria

- Crop readiness is not `READY` if a newer non-approved support/semantic/classification version exists after the latest approved version for the same crop/slice scope.
- Full-image export readiness reports and blocks stale approved components for requested targets.
- Export manifests include explicit freshness policy metadata.
- Tests cover:
  - approved v1 + draft v2 blocks export/readiness;
  - approved v1 + submitted v2 blocks export/readiness;
  - approved v2 after draft resolves the stale warning;
  - unrelated scope newer drafts do not block another crop/image.
- Public responses still do not expose `storageKey` or private object refs.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test -- tests/integration/export-workflow.test.ts
npm run test -- tests/integration/crop-semantic-mask-workflow.test.ts
npm run test -- tests/integration/crop-support-mask-workflow.test.ts
npm run check:docs-links
git diff --check
```


---

Renumbering note: This ticket was renumbered to avoid collision with Codex deep-review tickets RB-130 through RB-135.
