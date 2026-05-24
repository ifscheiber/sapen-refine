# RB-106 - Protected API Error Contract Completion

## Status

Completed

## Priority

P1

## Type

API / Auth / Error Contracts / Tests / Route Governance

## Source

- `docs/adr/remediation-backlog.md` RB-106
- `tickets/2026-05-23/sapen-annotate-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`

## Depends On

- RB-072 representative API error contract hardening.
- Prefer implementation after RB-105 if RB-105 changes presign/commit routes. If RB-106 is implemented first, rerun the RB-106 route inventory after RB-105 merges.

## Blocks

- Reliable client handling of stale sessions, forbidden access, and domain errors.
- Safe future API route additions.
- RB-111 high-cost write rate limits, because rate-limit responses should use the same stable JSON error convention.
- Lower-risk implementation of future upload/export/import hardening routes.

## Context

RB-072 introduced flat JSON API error helpers and representative route coverage, but the review reports verified that the convention is not yet complete across all protected API routes.

Several route handlers still call `requireUser()` or `requireProjectRole()` before or outside the shared `withApiErrorHandling` wrapper. When a request has a stale or invalid session state, or when access checks fail before a local `try/catch`, the route can escape the stable API response contract and return a generic framework response instead of predictable JSON.

Known examples from the review reports include:

- `src/app/api/correction-tasks/[taskId]/corrections/route.ts`
- `src/app/api/images/[imageId]/slice-bboxes/route.ts`
- `src/app/api/slice-crops/[cropId]/support-mask/route.ts`
- `src/app/api/projects/[projectId]/prediction-import-batches/route.ts`

The issue is broader than those examples. This ticket must therefore start with a full route inventory rather than patching only the listed files.

## Goal

Make stable flat JSON error handling an enforceable convention for every protected API route, so auth, access, validation, conflict, and not-found failures never leak as generic framework HTML/raw exceptions to client-side fetch callers.

## Design Direction

Prefer a small shared protected-route wrapper/factory if it keeps route code clearer and reduces future drift. Direct `withApiErrorHandling` wrapping is acceptable where a factory would be too invasive, but the final state must be mechanically guardable.

Implemented decision: use the existing `withApiErrorHandling` helper directly. This avoided introducing a second protected-route abstraction and kept route-local domain error mapping intact while ensuring auth/RBAC failures are caught before they can escape as framework errors.

The target convention should be simple enough that a reviewer can answer for every `src/app/api/**/route.ts` file:

1. Is this route public or protected?
2. If protected, which wrapper/factory guarantees stable JSON for all thrown auth/access/domain errors?
3. If not wrapped, why is it explicitly allowlisted?

## Non-Goals

- Do not redesign successful API response payloads.
- Do not introduce new roles or permission semantics.
- Do not change browser page redirects or non-API navigation behavior.
- Do not implement general write rate limiting here; that belongs to RB-111.
- Do not rewrite all domain services unless required for consistent error mapping.
- Do not normalize every possible internal exception into a user-facing detailed message; unexpected errors should remain safe and non-leaky.

## Requirements

### 1. Route inventory and classification

- Inventory all `src/app/api/**/route.ts` files.
- Classify each route as one of:
  - `public-api` - intentionally unauthenticated API endpoint,
  - `protected-api` - requires authenticated user and/or project access,
  - `internal/tooling/test-only` - if such routes exist and are intentionally exceptional,
  - `explicitly-allowlisted` - only with a short written reason.
- Treat routes that call `requireUser()`, `requireProjectRole()`, read authenticated user state, mutate project/user data, or expose private artifacts as protected unless there is a documented reason not to.
- Store the inventory close to the guard test or in API/auth documentation so it remains reviewable.

### 2. Protected route error handling

- Ensure every protected API handler is wrapped by `withApiErrorHandling` or an equivalent shared protected-route factory.
- Ensure auth errors, project access errors, validation errors, not-found errors, and conflict/domain errors become stable flat JSON responses.
- Preserve existing successful payload shapes and status codes unless the current route is demonstrably wrong.
- Preserve existing stable error codes where they already exist.
- Use safe generic responses for unexpected internal errors; do not leak stack traces, secrets, storage keys, raw SQL details, or uploaded file contents.

### 3. Error categories to verify

At minimum, the implementation must verify stable JSON behavior for:

- missing session / unauthenticated request,
- stale or invalid session state where the request still reaches the route handler,
- authenticated user without required project role,
- malformed request body or invalid route parameter,
- missing referenced resource,
- domain conflict, for example duplicate/invalid state where an existing domain error already maps to conflict.

### 4. Static or unit guard

- Add a guard that fails when a protected route calls `requireUser()` or `requireProjectRole()` without the approved wrapper/factory.
- The guard may be AST-based, source-text-based, or route-inventory-based, but it must be deterministic and easy to maintain.
- Keep any allowlist short, explicit, and justified in the test or adjacent documentation.
- The guard should fail when a new protected route is added without classification/wrapping.

### 5. Test coverage

- Add focused tests for representative protected routes across different route families, not only one endpoint.
- Include at least one stale-session/invalid-session test that previously could escape the wrapper path.
- Assert response status, JSON body shape, and content type where practical.
- Keep existing E2E workflows green.

### 6. Documentation

- Update API/auth docs or the remediation backlog to describe the protected API route convention.
- Document how future route authors should choose between wrapper/factory/direct allowlist.
- If RB-105 changed presign/commit routes before this ticket, include those routes in the final inventory.

## Acceptance Criteria

- Every protected `src/app/api/**/route.ts` is wrapped by the approved error handler/factory or is explicitly allowlisted with a reason.
- No protected route can call `requireUser()` or `requireProjectRole()` outside the approved protected-handler convention without failing the guard.
- Stale-session and forbidden-access API requests return stable JSON, not framework HTML or raw exceptions.
- Representative negative tests cover auth, forbidden access, validation, conflict, and missing resource cases.
- Successful response payloads remain backward-compatible.
- Docs explain the convention for future API routes.
- Existing unit, integration, E2E, build, and handoff checks remain green.

## Suggested Implementation Notes

- Wrapped every protected API route method with `withApiErrorHandling`.
- Preserved existing successful payloads and streaming/download success responses.
- Kept domain-specific error mappers and converted many route catches to `apiErrorFromPayload(...)`.
- Added `tests/unit/api-route-error-contracts.test.ts` with explicit route classification and wrapper enforcement for protected routes.
- Extended `tests/e2e/api-error-contracts.spec.ts` with stale API session, BBox validation, and BBox empty-confirmation error checks.
- Updated API error docs, API route docs, testing docs, known gaps, and the remediation backlog.

## Validation

Completed validation:

- Baseline before editing: `git status --short` showed the pre-existing untracked optimized RB-106 ticket and two review source reports. `npm run test -- tests/unit/api-errors.test.ts tests/e2e/api-error-contracts.spec.ts` executed the matching Vitest unit test and passed.
- `npm run prisma:generate` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test` passed: 43 files, 227 tests.
- `npm run test:e2e` passed: 12 tests.
- `npm run check:design-hardcoding` passed.
- `npm run handoff:archive -- --dry-run` was attempted after the RB-106 commit and failed because the worktree still contains the two intentionally uncommitted review source reports listed in the baseline. `npm run handoff:archive -- --dry-run --allow-dirty` passed and reported 520 files.

Required command set:

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

If local service availability prevents a subset of tests, document exactly what was skipped and why, and run the closest available unit/static coverage for the route guard.
