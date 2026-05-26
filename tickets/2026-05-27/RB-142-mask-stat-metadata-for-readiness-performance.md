# RB-142 - Mask Statistic Metadata For Readiness Performance

Status: Planned
Priority: P2
Type: Scalability / operational performance

## Context

Crop readiness and semantic-family checks currently inspect mask bytes from object storage to determine foreground labels, support coverage, and family conflicts. This is correctness-focused and appropriate for small trial datasets, but it may become expensive for large annotation projects.

## Impact

Project readiness/export pages can become slow or object-store-heavy as crop counts grow. Repeated byte reads also increase failure surface for transient storage issues.

## Non-goals

- Do not remove deep byte-level validation.
- Do not change mask format.
- Do not weaken semantic-family conflict enforcement.

## Implementation plan

1. Define a stable per-mask stats metadata shape, for example:
   - `foregroundPixelCount`;
   - `labelHistogram`;
   - `foregroundBBox`;
   - `containsUnknownLabel`;
   - `supportCoveredSemanticPixelCount` where applicable;
   - `statsVersion`.
2. Compute stats during mask upload/import after validation.
3. Persist stats in `metadataJson` or a dedicated column/table if justified.
4. Update readiness/family checks to prefer stats where present.
5. Fall back to byte reads for legacy rows and add a migration/backfill script if needed.
6. Keep an optional deep validation path that recomputes stats from bytes and compares to stored metadata.
7. Add tests for stats generation, legacy fallback, and stale/mismatched stats detection.

## Files to inspect

- `src/server/domain/cropReadiness.ts`
- `src/server/domain/cropAnnotationFamilies.ts`
- `src/server/domain/cropSemanticMasks.ts`
- `src/server/domain/cropSupportMasks.ts`
- `src/server/uploads/integrity.ts`
- `prisma/schema.prisma`
- `tests/integration/crop-semantic-mask-workflow.test.ts`
- `tests/integration/crop-support-mask-workflow.test.ts`

## Acceptance criteria

- New crop support/semantic mask versions persist mask stats.
- Readiness checks use stats without reading bytes in normal case.
- Legacy masks without stats still work through byte-read fallback.
- Deep validation can detect stats drift.
- Tests cover large-ish masks without excessive object reads by mocking storage reads.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test -- tests/integration/crop-semantic-mask-workflow.test.ts
npm run test -- tests/integration/crop-support-mask-workflow.test.ts
npm run check:docs-links
git diff --check
```


---

Renumbering note: This ticket was renumbered to avoid collision with Codex deep-review tickets RB-130 through RB-135.
