# RB-066 — Batch & Staging Storage Retention / Cleanup

## Status

Completed by Codex on 2026-05-21

## Priority

High

## Type

Storage / Operations / Cleanup / Prediction Import / Upload Hygiene / Audit / Tests

## Repository

`sapen-annotate`

## Depends on

- RB-061 — Batch Prediction Import & Background Job Baseline
- RB-062 — Repository State & Documentation Consistency Sweep
- RB-064 — Auth, RBAC & Audit Hardening
- RB-065 — Batch Job Runner Hardening

## Blocks

- Customer-trial operations with repeated prediction batch imports
- Long-running single-host storage hygiene
- Future production retention policies

---

## 1. Context

RB-061 introduced DB-backed batch prediction import with ZIP manifests and staged prediction artifacts. RB-065 hardened processing with a single-host Compose worker, DB leases, stale recovery, processor metadata, and idempotency through `PredictionArtifactProvenance.sourceBatchItemId`.

The remaining operational risk is storage lifecycle hygiene.

The original RB-066 draft correctly identifies the current risks:

- RB-061 stages ZIP item files in private object storage.
- Completed or failed batches can leave source files indefinitely.
- Presigned compatibility routes can leave orphan objects if clients upload but never commit.
- Operators do not yet have clear purge or retention runbooks.
- Cleanup must never delete raw images, approved mask versions, export packages, or historical training artifacts.

RB-066 should therefore implement a safe retention/cleanup baseline for **temporary/staged objects only**.

---

## 2. Goal

Define and implement safe cleanup/retention rules for temporary prediction-batch and upload-staging storage objects.

At the end of RB-066:

1. Temporary/staged batch objects have a documented retention policy.
2. Operators can run a dry-run cleanup to see what would be deleted.
3. Operators can run cleanup safely in the single-host trial environment.
4. Cleanup never touches committed raw images, committed artifact versions, export packages, or approved historical artifacts.
5. Cleanup is auditable.
6. Presigned/orphan upload risks are inventoried and either handled or explicitly deferred.
7. Existing import/worker/export/editor workflows remain green.

---

## 3. Non-Goals

Do **not** implement these in this ticket:

- cloud-provider lifecycle rules unavailable in local MinIO,
- high-availability storage,
- object replication,
- deletion of committed raw images,
- deletion of committed annotation artifacts,
- deletion of export packages/manifests,
- deletion of approved or historical training data,
- replacing MinIO/S3 storage,
- model inference,
- batch import semantics changes,
- removing presigned compatibility routes unless proven safe and explicitly documented.

If committed-artifact retention is needed later, create a separate governance ticket.

---

## 4. Required Working Mode

Follow `AGENTS.md`.

Start with:

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
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

Work in focused slices and commit after each meaningful slice.

---

## 5. Cleanup Scope

### 5.1 Objects in scope

RB-066 may clean only temporary/staged objects.

In scope candidates:

```text
prediction batch uploaded ZIP/source objects
prediction batch extracted/staged item objects
failed batch staging objects after retention period
completed batch staging objects after retention period
abandoned presigned upload objects, if identifiable by prefix and age
temporary import manifests not part of committed export/history
```

### 5.2 Objects out of scope / protected

Never delete:

```text
raw ImageAsset storage objects
AnnotationArtifactVersion storage objects
approved semantic/support masks
PREDICTION_MASK artifact versions that were successfully imported
ExportBatch package/manifest objects
training export ZIPs/manifests
prediction-analysis export ZIPs/manifests
backup files
Caddy/Postgres/MinIO volume data
```

If an object is referenced by a committed DB row as durable data, treat it as protected.

### 5.3 Protected-object rule

Cleanup must use DB references as the primary safety boundary.

Before deleting an object, the cleanup service must prove it is:

- under an allowed temporary/staging prefix,
- older than the configured retention threshold,
- not referenced by a committed `ImageAsset`,
- not referenced by an `AnnotationArtifactVersion`,
- not referenced by an `ExportBatch`/manifest/package,
- not referenced by a successful prediction import item,
- not needed by an active/retryable batch.

If proof is incomplete, skip and report.

---

## 6. Retention Policy

Define default retention durations suitable for the Strato/single-host trial.

Suggested defaults:

```text
completed batch staging objects: retain 7 days
failed batch staging objects: retain 14 days
cancelled batch staging objects: retain 14 days
abandoned presigned upload staging objects: retain 24 hours
processing/retryable batch objects: do not clean
```

Make values configurable via runtime config / env where practical:

```env
BATCH_STAGING_COMPLETED_RETENTION_DAYS=7
BATCH_STAGING_FAILED_RETENTION_DAYS=14
PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS=24
STORAGE_CLEANUP_MAX_DELETE_PER_RUN=500
```

If config naming differs, adapt to existing conventions.

---

## 7. Cleanup Service

Create a centralized cleanup service.

Suggested location:

```text
src/server/domain/storageCleanup.ts
```

or:

```text
src/server/storage/cleanup.ts
```

Required capabilities:

### 7.1 Dry run

Dry-run mode returns what would be deleted without deleting anything.

Output should include:

- object key,
- object type/category,
- reason,
- age,
- batch id / item id if applicable,
- protected/skipped reason if not deleted.

### 7.2 Execute mode

Execute mode deletes selected temporary objects.

Rules:

- enforce max delete count per run,
- continue on item-level failures,
- record deleted/skipped/failed counts,
- return stable summary,
- write audit events,
- never delete out-of-scope objects.

### 7.3 Categories

Classify cleanup candidates:

```text
BATCH_SOURCE_ZIP
BATCH_STAGED_ITEM
ABANDONED_PRESIGNED_UPLOAD
UNKNOWN_STAGING_OBJECT
```

If unknown cannot be proven safe, skip.

### 7.4 Error handling

Use stable error codes where useful:

```text
CLEANUP_FORBIDDEN
CLEANUP_DRY_RUN_ONLY
CLEANUP_OBJECT_PROTECTED
CLEANUP_OBJECT_DELETE_FAILED
CLEANUP_OBJECT_STAT_FAILED
CLEANUP_PREFIX_UNSUPPORTED
```

Errors must be sanitized.

---

## 8. Script / API / UI

### 8.1 Operational script

Add or harden script:

```bash
npm run storage:cleanup
```

Recommended options:

```text
--dry-run
--execute
--category batch-staging|presigned-orphans|all
--older-than-days <n>
--limit <n>
--batch <id>
```

Dry-run should be the default unless `--execute` is explicitly provided.

### 8.2 API route

Add minimal owner/QA-protected API if useful:

```text
POST /api/storage-cleanup
```

or project-scoped if all cleanup is project-scoped:

```text
POST /api/projects/[projectId]/storage-cleanup
```

For RB-066, an operational script plus docs is sufficient if API/UI would broaden scope.

If API is added, it must use RB-064 policies and same-origin guard.

### 8.3 UI

A UI is optional.

If added, keep it minimal and admin/QA-only:

- dry-run summary,
- execute cleanup,
- result counts.

Do not build a storage management dashboard.

---

## 9. Presigned Compatibility Route Inventory

RB-066 must inspect current presigned/commit compatibility routes.

Tasks:

1. List current presigned upload routes.
2. Determine their storage prefixes.
3. Determine whether uncommitted objects are identifiable.
4. Decide one of:

```text
handled in RB-066 cleanup
feature-flagged/disabled for trial
kept with documented orphan risk
removed if provably unused and tests pass
```

Do not remove routes if this risks breaking existing E2E or customer workflow.

Document the decision.

---

## 10. Audit & Logging

Add audit events for cleanup operations:

```text
STORAGE_CLEANUP_DRY_RUN
STORAGE_CLEANUP_EXECUTED
STORAGE_CLEANUP_OBJECT_DELETED
STORAGE_CLEANUP_OBJECT_SKIPPED
STORAGE_CLEANUP_OBJECT_DELETE_FAILED
```

Audit metadata may include:

- object category,
- sanitized object key or hashed key if preferred,
- batch id,
- item id,
- retention reason,
- actor/processor id,
- dry-run vs execute.

Do not audit secrets or credentials.

Logs should be operationally useful but not expose private URLs.

---

## 11. Tests

### 11.1 Unit tests

Cover:

- retention threshold calculations,
- candidate classification,
- protected-object decision,
- dry-run output,
- max delete limit,
- unknown staging object skip behavior.

### 11.2 Integration tests

Cover:

- completed batch staging candidate selected after retention period,
- active/retryable batch object not selected,
- successful imported prediction artifact not deleted,
- raw image object not deleted,
- artifact version object not deleted,
- export package not deleted,
- dry-run does not delete,
- execute deletes only eligible staging objects,
- audit events are recorded,
- presigned orphan route behavior if handled.

### 11.3 E2E

No new E2E required unless UI is added.

Existing E2E must remain green.

---

## 12. Documentation Updates

Update:

```text
docs/04-server/batch-prediction-imports.md
docs/04-server/deployment-trial.md
docs/04-server/backup-restore.md
docs/04-server/auth-rbac-audit.md
docs/07-testing/manual-smoke-desktop-browser.md
docs/07-testing/manual-smoke-customer-browser-trial.md
docs/08-adr/remediation-backlog.md
docs/known-gaps.md
.env.example
```

Add if useful:

```text
docs/04-server/storage-retention-cleanup.md
```

Docs must include:

- retention policy,
- protected object rules,
- dry-run command,
- execute command,
- audit behavior,
- presigned route decision,
- what remains deferred,
- warning that committed training artifacts are not cleanup targets.

---

## 13. Acceptance Criteria

This ticket is complete when:

1. `git status --short` is clean before final report.
2. Retention policy is documented.
3. Cleanup service can identify eligible staging objects.
4. Cleanup dry-run is available and is default.
5. Execute mode requires explicit flag/action.
6. Cleanup never deletes raw images, artifact versions, export packages, or approved historical artifacts.
7. Active/retryable batch staging objects are not cleaned.
8. Completed/failed staging objects past retention can be cleaned.
9. Audit events record cleanup actions.
10. Presigned/orphan upload risk is inventoried and either handled or documented.
11. Tests cover cleanup selection and protected-object safety.
12. Existing import/worker/export/editor workflows remain green.
13. Docs and runbooks include copy-paste cleanup commands.
14. Ticket is moved to:

```text
tickets/2026-05-20/done/
```

15. Final validation passes:

```bash
npm run db:rebuild
npm run prisma:generate
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run check:design-hardcoding
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml config
docker compose --env-file deploy/trial.env.example -f deploy/docker-compose.trial.yml --profile worker config
```

16. Final Codex report includes:
    - commits created,
    - cleanup mode implemented,
    - retention defaults,
    - scripts/API/UI added,
    - presigned route decision,
    - audit actions,
    - tests added/changed,
    - validation commands run,
    - pass/fail status,
    - known limitations/backlog entries.

---

## 14. Suggested Commit Sequence

```bash
git commit -m "docs: define storage retention cleanup policy"
git commit -m "feat: add storage cleanup service"
git commit -m "chore: add storage cleanup command"
git commit -m "test: cover storage cleanup safety"
git commit -m "docs: document staging cleanup operations"
git commit -m "chore: finalize storage retention cleanup ticket"
```

---

## 15. Notes for Codex

- Safety is more important than aggressive deletion.
- Dry-run first.
- Never delete committed durable artifacts.
- RB-065 runner hardening is already done; do not change runner semantics here.
- Keep cleanup single-host and MinIO-compatible.
