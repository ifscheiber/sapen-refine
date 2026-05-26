# RB-139 - Prediction Batch ZIP Inflation Guard

Status: Planned
Priority: P1/P2
Type: Production hardening for prediction import uploads

## Context

Prediction batch import already validates manifest version, project ownership, item count, safe paths, checksum, and mask size after decompression. In the reviewed snapshot, each ZIP entry is decompressed with `zipFile.async("uint8array")` before per-item staging size is enforced.

## Impact

A compressed ZIP entry can inflate beyond safe memory limits before `assertMaskStagingSize(bytes)` runs. Upload size and item count caps reduce risk, but production ingestion should guard uncompressed size before decompression where possible.

## Non-goals

- Do not replace the entire batch import format.
- Do not add support for new prediction target types.
- Do not remove post-decompression checksum/size validation.

## Implementation plan

1. Add pre-decompression expected byte length checks for `u8raw-v1`: `width * height`.
2. Use JSZip file metadata for uncompressed size if available; reject entries exceeding expected length or configured max before `async()`.
3. Add aggregate expected/uncompressed byte limit for all manifest items.
4. Keep post-decompression `assertMaskStagingSize()` and checksum validation.
5. Add clear error codes, for example:
   - `BATCH_ITEM_UNCOMPRESSED_SIZE_EXCEEDED`
   - `BATCH_UNCOMPRESSED_BYTES_EXCEEDED`
   - `BATCH_ITEM_EXPECTED_SIZE_MISMATCH`
6. Update batch import docs/runbooks.

## Files to inspect

- `src/server/domain/predictionImportBatches.ts`
- `src/server/uploads/validation.ts`
- `tests/integration/prediction-import-batches.test.ts`
- `tests/integration/prediction-import.test.ts`
- `docs/04-server/batch-prediction-imports.md`
- `docs/04-server/deployment-trial.md`

## Acceptance criteria

- Oversized expected dimensions are rejected before object staging.
- If ZIP metadata exposes uncompressed size, oversized entries are rejected before `zipFile.async()`.
- Aggregate uncompressed size is capped.
- Post-decompression validation remains in place.
- Tests cover safe batch, oversized single item, aggregate oversized batch, path traversal, and checksum mismatch.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test -- tests/integration/prediction-import-batches.test.ts
npm run test -- tests/integration/prediction-import.test.ts
npm run check:docs-links
git diff --check
```


---

Renumbering note: This ticket was renumbered to avoid collision with Codex deep-review tickets RB-130 through RB-135.
