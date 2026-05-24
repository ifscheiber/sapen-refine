# ADR-007 - System Actor Attribution Model

## Status

Accepted for RB-115. RB-115-A implements the current structured audit-details representation.

## Context

SaPen Annotate requires every production write to be attributable to an authenticated user or an explicitly identified system actor. The current implementation is mostly human-user based:

- `User` is the authenticated principal in `prisma/schema.prisma`.
- `AuditLog.actorId` references `User.id` and is nullable for legacy/bootstrap cases.
- Domain rows use user foreign keys such as `createdById`, `uploadedById`, `reviewedById`, `exportedById`, and `generatedById`.
- RB-112 export jobs keep the requesting user in `ExportBatch.exportedById` and add non-secret execution metadata with `processorId` and `processorRunId`.
- RB-061/RB-065 prediction import processing keeps the batch creator in `PredictionImportBatchJob.createdById` and item execution metadata in `processorId`, `processorRunId`, leases, and retry timestamps.
- RB-114 storage cleanup and consistency reporting runs through `POST /api/storage-cleanup` and `npm run storage:cleanup`; it requires an authenticated global `ADMIN` user and records cleanup audit events with that user as `actorId`.
- Current operational scripts authenticate through named user accounts and send processor labels as metadata. They do not create an independent system identity.

This is acceptable for the current single-host customer trial because operator-triggered work is still tied to a named human or job account. Broader unattended automation, scheduled cleanup, and future SaPen Core handoff need a clearer model before becoming production workflows.

## Terms

- `actor` - any entity responsible for causing or performing a write.
- `human user` - an authenticated `User` row representing a real person.
- `operator` - a human running an operational CLI/API path through a named account.
- `processor` - a technical worker execution label such as `sapen-annotate-export-worker`; it is metadata, not an auth principal.
- `system actor` - a named non-human performer for scheduled or unattended work.
- `external system` - a non-SaPen-Annotate source such as future SaPen Core handoff.
- `triggeredBy` - who requested, authorized, or scheduled work.
- `performedBy` - who or what executed the work.

## Options Considered

### Option A - Special `User` Rows For System Actors

Reserved users such as `system:export-worker` would fit current foreign keys with little schema churn. The drawbacks are significant: current users have email/password/session semantics, login-prevention would need additional policy, and UI/audit displays could confuse non-human identities with people.

### Option B - Separate Actor Table Or Actor Type Model

A first-class `Actor` abstraction is semantically clean and future-proof, especially for external systems. It would require broad migrations across audit and domain rows that currently reference `User`, and it is more complexity than the current trial needs.

### Option C - Explicit Actor Context Fields And Structured Metadata

Keep human `User` references for current user-requested records and add explicit actor context where non-human execution matters: actor type, actor label, triggered-by user, external source, processor id, and processor run id. This matches current export/import worker metadata and gives an incremental migration path.

### Option D - Status Quo With Local Conventions

The status quo is usable for the trial, but it is not sufficient as the long-term model. RB-116 and future Core handoff need a shared vocabulary and a clear classification basis.

## Decision

Adopt Option C as the canonical model.

Current human/user foreign keys remain the source for request attribution. Worker metadata remains execution metadata and must not be treated as authenticated identity. The canonical distinction is:

- `triggeredBy` / `requestedBy`: the authenticated human/operator or future scheduled/external source that caused the work.
- `performedBy` / `processedBy`: the worker, processor, system actor, or external system that executed the work.

For current trial workflows:

- Browser/API writes use the authenticated `User` as both trigger and performer unless a worker later processes queued work.
- Operator CLI scripts use the named authenticated account as `triggeredBy`; `processorId` and `processorRunId` describe `performedBy`.
- Export processing after RB-112 uses `ExportBatch.exportedById` as `triggeredBy` and export-job processor metadata as `performedBy`.
- Prediction import processing uses `PredictionImportBatchJob.createdById` as `triggeredBy` and item processor metadata as `performedBy`.
- Storage cleanup and consistency checks use the authenticated global `ADMIN` as `triggeredBy` and current performer; future scheduled cleanup must add explicit system actor context before unattended operation.
- Automatic derivations, classification suggestions, and supersede-on-reset operations triggered inside a human save inherit that human user as `triggeredBy`; the application service is an implementation detail unless the work moves to an unattended queue.
- Future SaPen Core handoff must record external-system provenance and must not write only through nullable user fields or anonymous audit rows.

Do not introduce reserved system `User` rows now. Do not introduce a broad `Actor` table now. Future migrations may add explicit fields or a normalized actor table if audit queries, scheduled automation, or external integrations require it.

## RB-115-A Implementation

RB-115-A keeps `AuditLog.actorId` as the backwards-compatible primary authenticated user/operator reference and stores structured actor context in `AuditLog.details.actorContext` for worker and operator paths that need separate trigger and performer attribution.

The current structured shape is:

```json
{
  "actorContext": {
    "triggeredBy": {
      "type": "USER",
      "userId": "..."
    },
    "performedBy": {
      "type": "WORKER",
      "label": "export-worker",
      "processorId": "...",
      "processorRunId": "..."
    }
  }
}
```

Canonical actor types are `USER`, `OPERATOR`, `SYSTEM`, `WORKER`, and `EXTERNAL_SYSTEM`. Current canonical performer labels are `export-worker`, `prediction-import-worker`, and `storage-cleanup`. Actor context must not contain passwords, tokens, signed URLs, raw headers, cookies, or other secrets.

Implementation evidence:

- `src/server/domain/audit.ts` defines the canonical actor types, labels, validation helper, and `details.actorContext` merge helper.
- `src/server/domain/exportJobs.ts` records export-job processing actor context.
- `src/server/domain/predictionImportBatches.ts` records prediction-import worker actor context.
- `src/server/domain/storageCleanup.ts` records cleanup operator actor context.

## Existing Row Compatibility

Accept as-is for the customer trial:

- Human-created annotation, review, upload, model, prediction-run, export, and project rows with non-null user attribution.
- Export and prediction-import worker rows that have requesting user attribution plus `processorId` / `processorRunId`.
- Cleanup audit rows created by authenticated global `ADMIN` users.

Require follow-up before broader automation:

- Scheduled or unattended worker runs that would not have a real authenticated requester.
- Any future external-system/Core handoff write.
- Any new mutation path that would otherwise rely on nullable `createdById`, nullable `actorId`, or processor metadata alone.

## RB-116 Classification Basis

RB-116 classifies mutation paths in `docs/testing/audit-coverage-matrix.md` using these attribution mechanisms:

- `human-user-domain-row` - append-only domain row with a non-null human user FK.
- `human-user-audit-log` - explicit `AuditLog.actorId` tied to a named user.
- `queued-work-triggered-by-user` - queued row has a requesting user; processor metadata records execution.
- `operator-admin-audit-log` - operational action requires named admin/operator auth and records audit.
- `system-actor-required` - path is scheduled, unattended, or externally triggered and needs follow-up before production use.
- `external-system-required` - path imports from SaPen Core or another system and must record external provenance.

## Consequences

- Existing customer-trial behavior is acceptable as-is because current worker and cleanup scripts require named authenticated accounts.
- `processorId` values are not secrets and are not principals. They can be displayed in operations/debug views as execution labels.
- UI should display human users by normal user name/email and system actors by clear labels such as `System: Export Worker` only after explicit actor context exists.
- Audit and domain docs should use `triggeredBy` and `performedBy` consistently.
- Scheduled cleanup, unattended workers, and Core handoff remain blocked on focused implementation tickets.

## Follow-Up Plan

- RB-115-A adds structured `AuditLog.details.actorContext` for `triggeredBy`, `performedBy`, actor type, actor label, and worker processor metadata.
- RB-115-B should add unattended worker actor context for scheduled export, prediction-import, and cleanup worker operation.
- RB-115-C should define the external-system actor/provenance contract required before SaPen Core handoff implementation.

## Evidence

- `prisma/schema.prisma` - `User`, `AuditLog`, `ExportBatch`, `PredictionImportBatchJob`, and worker processor fields.
- `src/server/domain/audit.ts` - current audit writer.
- `src/server/domain/exportJobs.ts` - RB-112 export processor attribution.
- `src/server/domain/predictionImportBatches.ts` - prediction batch processor attribution.
- `src/server/domain/storageCleanup.ts` - RB-114 cleanup and consistency audit path.
- `scripts/process-export-jobs.mjs`, `scripts/process-prediction-import-batch.mjs`, and `scripts/storage-cleanup.mjs` - current operator-authenticated script paths.
