# RB-114 - Storage/DB Consistency Operations Hardening (Post-RB-112)

## Status

Done

## Priority

P2/P3

## Type

Storage / DB Consistency / Operations / Cleanup / Drift Detection / Observability

## Source

- `tickets/2026-05-23/sapen-annotate-combined-deep-review-2026-05-23.md`
- `tickets/2026-05-23/sapen_annotate_codex_combined_report_verification.md`
- Existing RB-066 storage cleanup baseline.
- Completed RB-110: external handoff archive validation.
- Completed RB-111: high-cost write rate limits and trial caps.
- Completed RB-112: async export job processing.

## Depends On

- Existing storage cleanup baseline from RB-066.
- RB-110 is complete and should not be touched except for cross-link/doc references.
- RB-111 is complete; reuse existing runtime config/logging conventions where relevant.
- RB-112 is complete; include async export package/job artifacts in consistency checks.
- RB-105 should be confirmed before this ticket claims final-key immutability is fully resolved.
  - If RB-105 is not yet implemented, do not fix presigned final-key overwrite here.
  - Instead, document RB-105 as an unresolved precondition and keep deletion rules conservative.

## Blocks

- Reliable long-running trial operations with repeated uploads, mask saves, prediction imports, async exports, and cleanup runs.
- Operator confidence that object storage and DB references do not silently drift over time.
- Safe support/debugging when uploads, exports, or workers fail midway.

## Context

The repository already has storage cleanup tooling and conservative delete behavior. Current object-storage and DB writes remain best-effort consistent, which is normal for this architecture. The next hardening step is operational visibility and safe cleanup, not a storage-layout redesign.

The app has recently gained important infrastructure that must be considered:

- RB-106: protected API errors are now wrapped in stable JSON contracts.
- RB-107: append-only version allocation now uses PostgreSQL advisory locks.
- RB-109: review/export DB integrity constraints are enforced.
- RB-110: handoff archive validation is implemented.
- RB-111: high-cost writes and export creation have DB-backed rate limits and export caps.
- RB-112: export ZIP creation is now async via `ExportBatch` jobs with states such as `PENDING`, `PROCESSING`, `COMPLETED`, and `FAILED`; package generation is behind `exportPackageWriter`.

Therefore, RB-114 should focus on storage/DB drift detection, cleanup observability, and operator runbooks for the current post-RB-112 architecture.

## Goal

Make storage cleanup and DB/object drift detection an explicit, safe, and observable operational practice for trial-to-production hardening.

A successful implementation should let an operator answer:

- Which committed DB records reference missing storage objects?
- Which storage objects appear unreferenced or abandoned?
- Which temporary/staging objects are eligible for cleanup?
- Which async export packages are present, missing, stale, or failed?
- What would cleanup delete in dry-run mode?
- What did cleanup actually delete in execute mode?
- Which objects were intentionally protected and skipped?

## Non-Goals

- Do not delete committed raw images.
- Do not delete committed mask/artifact versions.
- Do not delete approved historical masks, review evidence, prediction artifacts, or completed export packages unless an explicit retention rule already exists.
- Do not introduce HA/object replication.
- Do not redesign object storage layout.
- Do not reimplement RB-110 archive validation.
- Do not rework RB-111 rate-limit infrastructure.
- Do not rework RB-112 async export architecture.
- Do not fix RB-105 presigned final-key immutability in this ticket if it is still open.
- Do not add a broad admin dashboard; this is an operations/tooling/docs ticket.

## Requirements

### 1. Inventory Current Storage Families

Review storage keys and DB references for at least:

- raw uploaded images,
- full-image semantic mask artifact versions,
- crop support masks,
- crop semantic masks,
- derived crop artifacts,
- slice bounding boxes if object-backed,
- slice classifications if object-backed,
- prediction import artifacts,
- assisted correction artifacts,
- async export packages from RB-112,
- temporary/staging/upload leftovers where applicable.

Document which DB table/field owns or references each family and whether the object is protected, temporary, generated, or cleanup-eligible.

### 2. Strengthen Dry-Run Drift Reporting

Ensure cleanup/drift tooling can run in dry-run mode and report without deleting:

- total scanned objects,
- total DB-referenced/protected objects,
- missing referenced objects,
- orphan candidates,
- stale temporary/staging candidates,
- skipped ambiguous objects,
- eligible deletions,
- estimated bytes reclaimable,
- completed export package objects,
- missing export package objects,
- failed/stale export job artifacts.

Dry-run output must be suitable for support/debugging and must not expose secrets.

### 3. Conservative Execute Mode

If execute/delete mode exists or is extended:

- Delete only objects that are definitely temporary, abandoned, expired, or explicitly cleanup-eligible.
- Never delete an object if DB linkage is ambiguous.
- Never delete completed export packages unless an explicit retention rule is documented and tested.
- Log every deletion decision with object key, reason, and byte size, but do not log credentials or signed URLs.
- Keep object-key logging acceptable for operator debugging; if any keys can contain sensitive user input, redact appropriately.

### 4. Async Export Job Consistency After RB-112

Add explicit checks for the async export model:

- `PENDING` jobs older than the configured/expected processing window.
- `PROCESSING` jobs with expired leases.
- `FAILED` jobs with or without package objects.
- `COMPLETED` jobs with missing package objects.
- package objects with no matching `ExportBatch` row.
- package checksum/size mismatch if persisted metadata exists.

This ticket does not need to build a new retry UI. It should surface the state clearly and document the operator action.

### 5. Missing Referenced Object Detection

For protected committed artifacts, the tool should detect and report missing objects instead of trying to repair silently.

Examples:

- DB image asset exists but storage object is missing.
- artifact version row exists but mask object is missing.
- completed export batch points to missing package object.
- prediction artifact metadata points to missing storage object.

These must be reported as drift/errors and not treated as cleanup successes.

### 6. Metrics And Exit Codes

Define predictable CLI behavior:

- dry-run with no drift: exit `0`;
- execute with successful cleanup and no hard drift: exit `0`;
- missing protected referenced objects: non-zero exit or clearly documented warning/error mode;
- invalid config/storage connection: non-zero exit;
- ambiguous objects: no deletion; report count.

If exit-code changes would break existing scripts, document and test the chosen behavior.

### 7. Tests

Add or extend tests for:

- protected committed object is never deleted;
- temporary/staging orphan can be reported and deleted when eligible;
- ambiguous object is skipped;
- missing referenced object is reported;
- completed async export package is protected;
- orphaned async export package is reported as orphan candidate;
- completed export with missing package is reported as drift;
- dry-run does not mutate storage/DB;
- execute mode reports bytes/counts.

Prefer fixture/object-key builders that do not require real customer data.

### 8. Documentation

Update operations docs/runbooks to explain:

- when to run cleanup/drift checks,
- recommended trial cadence,
- dry-run vs execute mode,
- how to interpret summary counts,
- how to handle missing protected objects,
- how async export package artifacts are handled after RB-112,
- what is intentionally not deleted,
- relationship to RB-105 if presigned final-key immutability is not yet complete.

Also update known gaps/backlog entries to distinguish:

- cleanup/drift visibility now implemented,
- any remaining outbox/staging pattern or HA storage work still deferred.

## Acceptance Criteria

- Operators can run a dry-run storage/DB drift report with clear summary counts.
- Operators can run execute mode safely for eligible temporary/orphan cleanup.
- Protected committed artifacts remain undeleted in tests.
- Missing protected DB-referenced objects are detected and reported.
- Async export package/job consistency is covered after RB-112.
- Cleanup output includes scanned/protected/orphan/deleted/skipped/error counts and bytes where practical.
- Docs describe operational cadence and interpretation.
- If RB-105 is still open, docs clearly state that RB-114 does not resolve presigned final-key overwrite risk.

## Validation

Run:

```bash
git status --short
npm run prisma:generate
git diff --check
npm run lint
npm run typecheck
npm run test
npm run storage:cleanup -- --dry-run
npm run handoff:archive -- --dry-run
```

If local object storage services are unavailable, document the skipped cleanup command and run the relevant unit/integration tests instead.

If new migrations are added, also run:

```bash
npm run db:rebuild
npm run prisma:generate
npm run test
```

## Completion Protocol

When implemented:

1. Update the remediation backlog and sprint index.
2. Move the optimized RB-114 ticket to the appropriate `done/` folder.
3. Keep RB-113 open unless real iPad Safari evidence has been provided separately.
4. Do not mark RB-105 as solved unless that ticket was actually implemented.
5. Commit the completed slice.
6. Ensure `npm run handoff:archive -- --dry-run` passes on a clean worktree.

## Notes For Codex

- Treat this as an operations hardening ticket, not a product UI ticket.
- Reuse existing cleanup scripts and storage helpers where possible.
- Be conservative: reporting drift is safer than deleting ambiguous objects.
- Include RB-112 export packages/jobs in the consistency model.
- Do not modify the newly implemented handoff archive validator except for documentation links if needed.
- Do not fabricate RB-113 iPad evidence.
