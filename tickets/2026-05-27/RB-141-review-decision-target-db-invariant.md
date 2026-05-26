# RB-141 - ReviewDecision Target DB Invariant

Status: Reviewed - Not Active
Priority: Covered by resolved RB-109
Type: Duplicate finding preservation

## Reconciliation Decision

This assistant-side finding is not an active remediation ticket. The same invariant was already implemented by RB-109 before the 2026-05-27 reconciliation.

## Original Finding

The assistant-side review reported that `ReviewDecision` should enforce exactly one target between `artifactVersionId` and `sliceClassificationVersionId` at the database layer.

## Repository Evidence

- `prisma/migrations/20260524090000_review_export_integrity_constraints/migration.sql` adds `ReviewDecision_exactly_one_target_chk`.
- `docs/prisma/schema.md` documents that `ReviewDecision` targets either an `AnnotationArtifactVersion` or a `SliceClassificationVersion` and that the database constraint enforces exactly one target.
- `docs/prisma/README.md` documents the DB-enforced exact-one-target check.
- `tests/integration/review-export-db-constraints.test.ts` covers invalid zero-target and two-target review decisions.
- `docs/adr/remediation-backlog.md` records RB-109 as resolved.

## Outcome

Do not implement this ticket again. If future review-decision invariants are discovered, create a new ticket with a different scope instead of reusing RB-141.

## Validation Commands Used For Reconciliation

```bash
rg -n "ReviewDecision_exactly_one_target_chk|RB-109|exactly one target|num_nonnulls" tests prisma docs
```
