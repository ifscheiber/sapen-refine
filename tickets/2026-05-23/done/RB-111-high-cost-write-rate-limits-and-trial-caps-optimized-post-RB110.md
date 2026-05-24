# RB-111 - High-Cost Write Rate Limits And Trial Caps

## Status

 Done

## Priority

P2

## Type

Security / Operations / API Hardening / Upload, Export, And Batch Limits

## Source

- `docs/adr/remediation-backlog.md` RB-111
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- `docs/known-gaps.md`
- Post-RB-106 implementation report: protected API error contracts are now enforced.
- Post-RB-107 implementation report: append-only version allocation now uses transactional PostgreSQL advisory locks.
- Post-RB-109 implementation report: review/export DB integrity constraints are now enforced.
- Post-RB-110 implementation report: external handoff archive validation is now implemented.

## Depends On

- RB-106 completed, so rate-limit and cap failures can use the stable protected API JSON error contract.
- RB-107 completed, so this ticket must not re-solve version allocation/concurrency.
- RB-109 completed, so this ticket must not rework review/export DB integrity constraints.
- RB-105 should already have addressed presigned final-key immutability and export-time checksum verification. If the current branch does not contain RB-105, preserve compatibility and do not duplicate that work here.

## Blocks

- Safer production exposure of authenticated high-cost write endpoints.
- Clear single-host customer-trial operating limits for uploads, exports, prediction imports, and expensive mutation paths.
- RB-112 export job hardening, because route-triggered export creation needs explicit caps even before async/streaming export jobs exist.

## Context

Login throttling and same-origin mutation protection exist, and RB-106 now enforces stable JSON API error handling for protected API routes. However, the review reports identified that general authenticated write-rate limiting is still missing and that upload/export/import workloads remain trial-sized.

The relevant risk is not ordinary form submission. The risk is repeated or oversized calls to endpoints that consume significant CPU, memory, database writes, or object-storage I/O, especially:

- image uploads,
- semantic/support mask uploads or commits,
- crop support/semantic saves,
- slice bounding-box and classification saves,
- export creation,
- prediction-analysis export creation,
- prediction import batch upload/process/retry,
- storage cleanup or other admin-only expensive operations, if exposed through app routes.

The goal is to make the current single-host trial posture explicit and bounded without prematurely building a full quota, billing, or distributed rate-limiting platform.

## Goal

Add a small, centralized high-cost endpoint limiting layer plus explicit trial item/byte caps so expensive authenticated mutation paths fail predictably and safely under excessive use.

## Non-Goals

- Do not introduce a full multi-tenant quota/billing system.
- Do not introduce Redis or a new distributed infrastructure dependency.
- Do not move exports to background jobs in this ticket; that belongs to RB-112.
- Do not redesign successful API payload shapes.
- Do not change RB-107 version allocation behavior.
- Do not change RB-109 DB constraints or export/reference semantics.
- Do not weaken existing login throttling.
- Do not add malware/content scanning; upload content safety is RB-118.
- Do not rate-limit normal page navigation or read-only GET routes in this slice.
- Do not make editor save UX frustrating by applying overly aggressive limits to legitimate annotation save flows.

## Requirements

### 1. Inventory and classify high-cost routes

- Inventory `src/app/api/**/route.ts` mutation routes.
- Classify each expensive route family as one of:
  - `upload:image`,
  - `upload:mask`,
  - `save:editor-artifact`,
  - `save:crop-artifact`,
  - `save:slice-metadata`,
  - `export:create`,
  - `export:prediction-analysis-create`,
  - `prediction-import:upload`,
  - `prediction-import:process-or-retry`,
  - `operations:cleanup-or-admin`.
- Document any excluded mutation route with a short reason, for example low cost, already protected by a stricter domain condition, or read-only despite POST-like behavior.

### 2. Add a shared high-cost limit helper

- Implement a reusable server-side helper rather than route-local ad hoc counters.
- Prefer reusing an existing login-throttle primitive if it is suitable.
- If the existing throttle is process-local, either:
  - keep the new limiter explicitly single-host/process-local and document that limitation, or
  - add a small DB-backed implementation if that is low-risk in the current codebase.
- Do not add Redis or external infrastructure.
- Use stable logical keys, for example:
  - route family,
  - user ID,
  - project ID where available,
  - optional image/artifact scope where useful.
- Ensure the limiter is safe under normal concurrent requests. It does not need to be a perfect distributed quota system, but it must not be trivially bypassed inside the supported single-host trial mode.

### 3. Stable API error behavior

- Rate-limit failures must return a stable JSON error via the RB-106 API error contract.
- Use HTTP `429`.
- Use a clear machine-readable error code, for example `RATE_LIMITED`.
- Include a safe user-facing message.
- Include `Retry-After` header and/or `retryAfterSeconds` metadata where practical.
- Do not expose internal bucket names, raw user IDs, secrets, request bodies, object keys, or uploaded file contents in the response.

### 4. Add trial caps where missing

Add explicit, configurable caps for expensive creation requests that can otherwise create unbounded work.

Minimum scope:

- export creation item count cap,
- export creation estimated byte-budget cap where practical,
- prediction-analysis export creation cap,
- prediction import batch item count/byte caps if not already fully enforced,
- any missing upload byte caps at the API layer if currently only documented elsewhere.

Notes:

- Existing upload size defaults should be preserved unless a review shows they are not actually enforced.
- Caps should be centralized in runtime config where possible.
- Test configurations should be able to lower the limits deterministically.

### 5. Preserve annotation usability

- Do not apply very low limits to editor/crop save endpoints.
- Save endpoints may receive higher thresholds than export/import endpoints.
- If a save endpoint is limited, the failure must be understandable and not corrupt local editor state.
- Do not add client-side throttling unless needed to display a clearer error; server-side protection is the main requirement.

### 6. Documentation and operations

- Update runtime/config documentation with default limits and tuning guidance.
- Update `docs/known-gaps.md` or equivalent:
  - remove/adjust the statement that no general high-cost write limiting exists,
  - keep clear limitations, especially single-host/non-billing/non-distributed scope.
- Document that RB-112 is still required for production-scale async/streaming export jobs.
- Document any routes intentionally left uncapped and why.

## Suggested Implementation Shape

Codex may adjust the exact filenames to fit the repo, but the implementation should roughly produce:

- a shared limiter module such as `src/server/http/highCostRateLimit.ts` or `src/server/security/highCostRateLimit.ts`,
- runtime config entries for enabled/disabled state and route-family limits,
- route integration in the high-cost protected mutation endpoints,
- unit tests for limiter behavior,
- integration/API tests for representative endpoints,
- docs/backlog updates.

If a DB-backed limiter is chosen, keep the migration narrow and include cleanup/expiry behavior. If a process-local limiter is chosen, document that it is a single-host trial guard and not sufficient for horizontally scaled deployment.

## Acceptance Criteria

- High-cost protected mutation routes have an explicit rate-limit/cap decision: enforced or documented exclusion.
- Excessive repeated requests to representative high-cost endpoints return stable `429` JSON with a machine-readable `RATE_LIMITED` code.
- Export creation requests over configured item/byte caps fail before unbounded ZIP/package generation begins.
- Prediction import/export creation requests over configured caps fail before expensive processing begins.
- Normal happy-path upload, save, export, and prediction-import tests remain green.
- Legitimate editor/crop save flows are not made unusable by overly strict default limits.
- Limits are configurable and documented with single-host trial defaults.
- Known-gaps/backlog docs no longer overclaim missing general write limiting after the implemented slice.
- RB-112 remains open for async/streaming export hardening.

## Required Tests

At minimum add or update tests for:

- limiter allow/deny/reset behavior using low test thresholds,
- stable `429` JSON shape and `Retry-After`/retry metadata,
- one representative upload or mask/crop save route,
- one export creation cap rejection,
- one prediction import or prediction-analysis export cap rejection where applicable,
- normal happy-path requests staying below the limits,
- config parsing/defaults.

## Validation

Run:

```bash
git status --short
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
```

If a DB-backed limiter migration is added, also run:

```bash
npm run db:rebuild
npm run prisma:generate
npm run test
```

## Completion Protocol

- Update `docs/adr/remediation-backlog.md`.
- Update the 2026-05-23 ticket sequence README / sprint index if present.
- Move this optimized ticket into the appropriate `done/` folder after implementation.
- Commit the completed slice.

## Implementation Notes

- Implemented a shared PostgreSQL-backed high-cost write limiter with hashed route-family/user/scope buckets and stable `429 RATE_LIMITED` API responses.
- Added configurable high-cost route limits and training/prediction-analysis export item/byte caps to runtime config and trial env docs.
- Wired the limiter into image upload, mask/editor/crop/slice save, export create, prediction import upload/process/retry, and cleanup/admin routes.
- Added export cap checks before training, crop-training, and prediction-analysis ZIP package generation.
- Added unit/integration coverage for limiter policy, route inventory, API error shape, export cap decisions, and DB-backed limiter persistence.
