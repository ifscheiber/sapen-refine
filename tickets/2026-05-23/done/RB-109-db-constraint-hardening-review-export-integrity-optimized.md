# RB-109 - DB Constraint Hardening For Review And Export Integrity

## Status

Completed

## Priority

P2

## Type

Database / Review Integrity / Export Integrity / Migration Safety / Tests

## Source

- `docs/adr/remediation-backlog.md` RB-109
- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- RB-107 implementation report: append-only version allocation now uses PostgreSQL advisory locks in `src/server/domain/versionAllocation.ts`
- RB-106 implementation report: protected API error contracts are now enforced by `withApiErrorHandling` plus `tests/unit/api-route-error-contracts.test.ts`

## Depends On

- RB-107 completed (`1d135ce`): safe append-only version allocation is already implemented and should not be re-solved here.
- RB-106 completed (`a4e69f6`): stable API error contracts are already available for any new route/test failure surfaces.
- Current review/export service-layer writers and Prisma schema.

## Blocks

- Stronger auditability of review decisions and export package records.
- Confidence that future scripts, migrations, manual maintenance, or new writers cannot persist ambiguous review/export rows.

## Context

The current service layer writes review and export rows in a disciplined way, but some important invariants are not enforced at database level.

Known review invariant:

- `ReviewDecision` currently has nullable `artifactVersionId` and nullable `sliceClassificationVersionId`.
- A valid review decision should target exactly one reviewable object family, not zero and not both.

Known export integrity concern:

- `ExportItem` stores several nullable references such as `imageId`, `artifactVersionId`, `sliceClassificationVersionId`, `predictionProvenanceId`, and `derivedCropId`, plus a free-text `role`.
- Domain code currently controls valid role/reference combinations, but the database does not prevent ambiguous or internally inconsistent rows.

RB-107 already addressed live version-allocation races. This ticket is therefore not a concurrency ticket. Its job is to push low-risk, clearly understood invariants into the database and to document the export item role/reference matrix.

## Goal

Add low-risk DB-level constraints for review/export integrity so persisted audit and export records remain structurally unambiguous even if future code paths, scripts, or migrations bypass the normal service layer.

## Non-Goals

- Do not redesign the whole review/export schema.
- Do not change append-only versioning semantics from RB-107.
- Do not replace the export manifest format unless a narrowly versioned change is unavoidable.
- Do not add new review or export product features.
- Do not over-constrain historical or future artifact lineage that is not yet fully modeled.
- Do not convert `ExportItem.role` to a Prisma enum unless the current role set is fully inventoried and the migration is demonstrably safe; a documented role/reference matrix plus check constraints is sufficient for this slice.

## Required Implementation Approach

### 1. Inventory first

Before writing migrations, inspect and document all current writers/readers for:

- `ReviewDecision`
- `ExportBatch`
- `ExportItem`
- export manifests and export download/package assembly
- review decision creation/update paths
- tests/factories/seeds that create review/export rows

Create or update a short role/reference matrix for current `ExportItem.role` values. For each role, document:

- required references,
- forbidden references,
- optional references,
- whether the role refers to full-image artifacts, crop-derived artifacts, classifications, predictions, images, or package metadata.

Do not guess role semantics from names alone. Derive them from the current export code and tests.

### 2. Add migration preflight checks

Before adding constraints, add preflight SQL checks or a documented migration safety step that detects existing invalid rows, at minimum:

- `ReviewDecision` rows with zero review targets.
- `ReviewDecision` rows with more than one review target.
- `ExportItem` rows whose `role`/reference combination violates the documented matrix for constrained roles.

If invalid rows exist in local/dev data, either fix them in the migration only when the repair is unambiguous or fail with a clear migration note. Do not silently delete audit/export records.

### 3. Add raw SQL constraints where Prisma cannot express them

Add low-risk PostgreSQL check constraints through Prisma migrations/raw SQL.

Minimum required constraint:

- `ReviewDecision` exact-one-target constraint:
  - exactly one of `artifactVersionId`, `sliceClassificationVersionId` is non-null.

Export constraints should be staged but meaningful:

- Add role/reference consistency checks for all currently understood and stable `ExportItem.role` values.
- If a role is ambiguous or intentionally flexible, leave it unconstrained in this slice and document why.
- Prefer small named constraints over one large opaque constraint.
- Constraint names should be stable and descriptive.

### 4. Keep service-layer behavior stable

- Preserve existing valid review/export writes.
- Preserve existing export package selection semantics.
- Preserve existing successful API response shapes.
- Ensure constraint violations in tested API paths surface as stable errors through the RB-106 API error contract where applicable.

### 5. Add focused tests

Add DB/integration tests that prove:

- invalid `ReviewDecision` rows with zero targets are rejected,
- invalid `ReviewDecision` rows with two targets are rejected,
- valid artifact-version review decisions still persist,
- valid slice-classification review decisions still persist,
- invalid constrained `ExportItem` role/reference combinations are rejected,
- valid current export workflows still pass and produce expected manifest/package metadata.

Use raw SQL insertion tests where necessary so the test verifies the database constraint rather than merely service-layer validation.

## Documentation Requirements

Update the relevant docs/backlog entries:

- `docs/prisma/README.md` or equivalent schema documentation.
- Review/export documentation that explains DB-enforced invariants.
- `docs/adr/remediation-backlog.md` / ticket status.

The docs must clearly distinguish:

- invariants enforced by the DB,
- invariants still enforced by service/domain code,
- and intentionally deferred or flexible export-lineage cases.

## Acceptance Criteria

- `ReviewDecision` rows with zero targets cannot be inserted.
- `ReviewDecision` rows with both supported targets cannot be inserted.
- Valid review decisions for each supported target type still work.
- Current valid export workflows still work.
- `ExportItem` role/reference combinations are documented in a matrix.
- DB constraints reject invalid `ExportItem` rows for the constrained current roles.
- Migration is safe for existing trial/dev data or fails with a clear preflight explanation.
- No low-level database constraint error leaks to user-facing API responses in covered paths.
- RB-107 version-allocation behavior remains unchanged.

## Suggested Validation

Run:

```bash
git status --short
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
npm run handoff:archive -- --dry-run
```

If the strict handoff dry-run fails only because of known pre-existing untracked review/design files, also run:

```bash
npm run handoff:archive -- --dry-run --allow-dirty
```

and document the exact reason.

## Codex Notes

- Treat this as a database-integrity slice, not as an export redesign.
- Prefer narrow, testable constraints over broad speculative modeling.
- Start with `ReviewDecision`; then constrain only the export roles whose semantics are clear from current code.
- Avoid a large refactor of export packaging. That belongs to RB-112.
- Avoid rate-limit/cap work. That belongs to RB-111.

## Implementation Notes

- Added `prisma/migrations/20260524090000_review_export_integrity_constraints/migration.sql` with RB-109 preflight checks and named PostgreSQL check constraints.
- Enforced `ReviewDecision` exact-one-target persistence for `artifactVersionId` vs. `sliceClassificationVersionId`.
- Enforced the current stable `ExportItem.role` reference matrix for full-image, crop-training, and prediction-analysis export rows while leaving unknown future roles unconstrained.
- Added raw DB constraint coverage in `tests/integration/review-export-db-constraints.test.ts`.
- Tightened existing export workflow assertions so persisted export rows expose the expected nullable-reference shape.
- Updated persisted schema, server, testing, and remediation-backlog documentation.

## Validation Notes

- Baseline before editing: `git status --short` showed this optimized ticket plus the known untracked review/design source files; focused existing Review/Export/Prediction-Analysis/API tests passed with 24/24 tests.
- `npm run db:rebuild` applied the new migration and seed successfully.
- Focused RB-109 validation passed with 5 files and 28 tests:
  - `tests/integration/review-export-db-constraints.test.ts`
  - `tests/integration/review-workflow.test.ts`
  - `tests/integration/export-workflow.test.ts`
  - `tests/integration/prediction-analysis-export.test.ts`
  - `tests/unit/api-route-error-contracts.test.ts`
- `npm run prisma:generate` passed.
- `git diff --check` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test` passed with 46 files and 236 tests.
- `npm run test:e2e` passed with 12 tests.
- `npm run check:design-hardcoding` passed.
- `npm run handoff:archive -- --dry-run` failed only because the known untracked review/design files keep the worktree dirty.
- `npm run handoff:archive -- --dry-run --allow-dirty` passed and reported 525 files.
