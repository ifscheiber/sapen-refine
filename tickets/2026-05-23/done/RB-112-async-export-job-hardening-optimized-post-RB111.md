# RB-112 - Async Export Job Hardening After RB-111 Caps

## Status

Done

## Priority

P2

## Type

Exports / Background Jobs / Operations / Scale Hardening / API Contracts

## Source

- `docs/adr/remediation-backlog.md` RB-112
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Post-RB-111 implementation report:
  - `5b9cd82 feat: add high-cost rate limit infrastructure`
  - `455557b feat: enforce high-cost write limits and export caps`

## Current Baseline

RB-111 is implemented and committed. The repo now has:

- DB-backed high-cost rate limiting in `src/server/http/highCostRateLimit.ts`.
- Runtime config for rate limits and export caps in `src/server/runtime/config.ts`.
- Stable `429 RATE_LIMITED` API errors with `Retry-After` and `retryAfterSeconds`.
- High-cost limiter coverage on upload, save, export, prediction-import, cleanup/admin routes.
- Export caps before ZIP generation for training/crop-training exports and prediction-analysis exports.
- A clean worktree and green validation, including full tests, E2E, design-hardcoding check, and strict handoff dry-run.

RB-112 must build on this baseline. Do **not** introduce a second cap/rate-limit system and do **not** change the `RATE_LIMITED` contract added by RB-111.

## Depends On

- RB-111 completed.
- RB-106 completed, so new async/job endpoints must use the protected API error contract and pass the route guard.
- RB-107 completed, so any append-only export/package records must use the existing safe version/allocation patterns where relevant.
- RB-109 completed, so new `ExportItem` rows must respect the DB role/reference constraints.
- RB-105 should be completed before broad production use. If export-time checksum verification is not yet present, include a narrow checksum-verification helper as the first RB-112 subtask or explicitly defer with a blocking note in docs/backlog.

## Blocks

- Production-scale training/crop-training export generation.
- Production-scale prediction-analysis export generation.
- Safe long-running export operation without request/proxy timeout dependence.

## Context

Training/crop-training and prediction-analysis exports are currently bounded by RB-111 caps, but package generation is still route-triggered and uses JSZip plus object-byte loading in the app/server process. RB-111 prevents unbounded export attempts and high-frequency abuse, but it does not make large or slow exports operationally robust.

The next hardening step is to decouple export creation from synchronous request/response execution and make export generation observable, retryable, and downloadable after completion. Streaming ZIP generation is desirable, but this ticket should avoid a risky big-bang rewrite. If full streaming is too invasive, keep JSZip only behind strict RB-111 byte/item caps and introduce a package-writer boundary so a later streaming implementation can replace it cleanly.

## Goal

Introduce a production-safer export job flow for training/crop-training and prediction-analysis exports that:

- reuses RB-111 caps and API error semantics,
- avoids long synchronous ZIP generation in user-facing request handlers,
- persists generated export packages as storage artifacts with checksum/size metadata,
- exposes clear job status and stable failure states,
- preserves existing export eligibility, manifest, provenance, and DB constraints.

## Non-Goals

- Do not change what qualifies as exportable ground truth.
- Do not weaken RB-111 caps or create duplicate cap configuration.
- Do not create a general-purpose queue platform beyond export needs unless an existing single-host job/lease pattern can be reused safely.
- Do not redesign training or prediction-analysis manifest semantics unless a versioned manifest bump is explicitly required.
- Do not expose private object-storage keys.
- Do not implement audit dashboards or export history UI beyond the minimum status/download path needed for this ticket.
- Do not touch RB-109 constraints except to keep new export rows valid.

## Requirements

### 1. Inventory Current Export Entry Points

- Identify all current routes/actions that create or download:
  - full-image training exports,
  - crop-training exports,
  - prediction-analysis exports.
- Document which paths already enforce RB-111 caps.
- Confirm whether current DB models (`ExportBatch` or prediction-analysis export records) can represent:
  - `PENDING`,
  - `PROCESSING`,
  - `COMPLETED`,
  - `FAILED`,
  - optional retry count / failure code / failure message,
  - generated package storage key, checksum, byte size, created/processed timestamps.
- Reuse existing models if practical. Add schema only where the current model cannot safely represent job state.

### 2. API Contract

- Export creation endpoints should return quickly after validating eligibility and caps.
- Prefer `202 Accepted` with a stable JSON payload containing an export/job identifier and current status.
- Add or adapt status endpoint(s) so the UI/client can poll export progress.
- Add or adapt download endpoint(s) that only return package bytes/redirect when the export is `COMPLETED`.
- Use `withApiErrorHandling` or the protected route factory for every new/changed protected API route.
- Reuse RB-111 error behavior:
  - cap violations should use the existing stable cap/rate-limit error convention where applicable,
  - high-frequency creation attempts should still return `429 RATE_LIMITED`,
  - missing/not-owned/not-ready jobs should return stable JSON errors.

### 3. Job Processing

- Implement a single-host-safe export processor using an existing lease/job pattern where reasonable.
- A job must be claimed atomically so two processors do not build the same package concurrently.
- Processing must be idempotent or safely retryable:
  - a failed job records a stable failure code/message without leaking secrets,
  - retry behavior is bounded and documented,
  - partially written package objects are cleaned up or written to staging keys first.
- Add a script or internal processor entry point suitable for trial deployment operations, for example:
  - `npm run exports:process`
  - or a documented reuse of an existing worker runner.

### 4. Package Generation Boundary

- Extract or isolate export package generation behind a package-writer boundary.
- Preserve current manifest content and provenance unless a versioned change is necessary.
- Enforce RB-111 item-count and byte-budget caps before package generation starts.
- If full streaming ZIP generation is feasible with current dependencies, implement it.
- If streaming is not feasible in this slice:
  - keep JSZip only behind strict caps,
  - make this explicit in docs/known-gaps,
  - keep the new boundary small enough that streaming can replace it later.

### 5. Integrity

- Verify object bytes against persisted checksum/size metadata before adding them to a package.
- If RB-105 already added a checksum verifier, reuse it.
- If not, add a narrow shared verifier and record RB-105 as still needed for presigned final-key immutability.
- A mismatch must fail the job with a stable integrity failure state; do not silently package mismatched bytes.
- Generated export package records must store checksum, size, and storage key metadata.

### 6. UI / UX Minimum

- Keep existing UI flows usable.
- If exports are now asynchronous, show a clear pending/processing/completed/failed state.
- Provide a download action only when the package is complete.
- Failure messages should be safe and actionable without exposing storage keys or secret/config values.
- Do not overbuild export history/reviewer dashboards; that remains outside this ticket.

### 7. Documentation

- Update export docs, known-gaps, deployment/operations docs, and remediation backlog.
- Document:
  - how to create an export,
  - how jobs are processed in the single-host trial setup,
  - relevant env/config settings from RB-111,
  - cap behavior,
  - retry/failure behavior,
  - remaining limitations if JSZip remains under caps.
- Update the sprint README/index and move the optimized ticket to `done/` when complete.

## Acceptance Criteria

- Export creation no longer performs unbounded or long-running ZIP generation in the user-facing request handler.
- Creation endpoints return quickly with a stable job/export status payload.
- Export jobs transition through clear states and can be processed by a documented worker/script.
- Completed packages can be downloaded only after successful generation.
- Failed jobs expose stable, safe failure information.
- RB-111 caps are reused and not duplicated.
- `RATE_LIMITED` behavior from RB-111 remains unchanged for high-frequency export attempts.
- Export package generation verifies source object checksum/size before packaging.
- New export records/items satisfy RB-109 DB constraints.
- Tests cover:
  - export job creation,
  - cap rejection,
  - worker claiming / no double-processing,
  - successful package generation,
  - checksum mismatch failure,
  - failed-job status response,
  - completed-job download behavior.
- Existing full-image, crop-training, and prediction-analysis export semantics remain intact.
- Handoff archive dry-run remains green.

## Suggested Implementation Notes

Codex should first inspect the current export schema and routes before choosing the smallest implementation shape. A likely low-risk path is:

1. Reuse or extend existing export batch records with job status fields.
2. Make create endpoints enqueue/mark pending after current eligibility/cap validation.
3. Add a processor that claims pending exports and calls existing package builders.
4. Extract package building enough that JSZip is no longer embedded directly in route handlers.
5. Store generated package bytes in object storage under an export-package key.
6. Add status/download endpoints and minimal UI polling if needed.

Avoid broad queue abstractions unless they are already present and clearly reusable.

## Validation

Run:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
git diff --check
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
```

Also run any focused export/job tests added by this ticket, for example:

```bash
npm run test -- tests/integration/export-jobs*.test.ts
npm run test -- tests/unit/export*.test.ts
```

If storage services are unavailable in a local environment, document the skipped integration command and run the closest unit coverage instead.
