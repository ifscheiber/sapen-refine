# src/server

## Purpose

`src/server` owns server-only infrastructure: database access, authentication/session helpers, RBAC, storage helpers, and server-side domain workflow helpers.

## Important Files

- `src/server/db.ts` - Prisma client and PostgreSQL pool singleton.
- `src/server/auth/constants.ts` - session cookie constants.
- `src/server/auth/session.ts` - session token creation, cookie handling, DB session lookup, and revocation.
- `src/server/auth/rbac.ts` - `requireUser` and `requireProjectRole`.
- `src/server/runtime/config.ts` - server-only runtime config validation.
- `src/server/runtime/health.ts` and `src/server/runtime/readiness.ts` - operational health/readiness helpers.
- `src/server/uploads/validation.ts` - upload size validation shared by image and mask routes.
- `src/server/uploads/integrity.ts` - RB-055 checksum, content-type, image-dimension, mask-dimension, and support-mask value validation helpers.
- `src/server/domain/audit.ts` - small audit writer for append-only `AuditLog` rows.
- `src/server/domain/review.ts` - RB-052 review transition, permission, decision, and export-readiness helpers.
- `src/server/domain/exports.ts` - RB-053 export readiness, approved-version selection, manifest generation, ZIP packaging, export persistence, and download authorization.
- `src/server/domain/predictionProvenance.ts` - RB-056 model-run, prediction-run, prediction-item provenance validation, authorization, and task-link resolution helpers.
- `src/server/domain/predictionImport.ts` - RB-057 prediction mask import validation, storage write/stat verification, artifact-version creation, provenance linking, and audit events.
- `src/server/domain/correctionTasks.ts` - RB-058 active-learning correction task creation, ordering, assignment/status updates, sanitized serialization, and audit events.
- `src/server/domain/assistedCorrection.ts` - RB-059 correction context loading, prediction mask streaming authorization, human correction save validation, provenance linking, and audit events.
- `src/server/storage.ts` - app-level storage wrapper for presigned URLs.
- `src/server/storage/s3.ts` - AWS SDK S3/MinIO client setup, presign helpers, object writes, object stat verification, best-effort deletes, and storage readiness check.

## Public Interfaces / Routes / Functions

- `requireUser()` redirects unauthenticated requests to `/login`.
- `requireProjectRole(projectId, allowed)` enforces project membership roles.
- `getPresignedGetUrl(key)` and `getPresignedPutUrl(key, contentType)` wrap S3 presigned URLs.
- `putObject(key, body, contentType)` writes app-mediated uploads to S3/MinIO.
- `loadImageReviewStateForUser`, `transitionArtifactVersionForUser`, and `transitionSliceClassificationVersionForUser` implement the minimal review/approval workflow.
- `resolveProjectExportReadiness`, `createTrainingExportForUser`, `getTrainingExportForUser`, and `readTrainingExportFileForUser` implement the RB-053 owner-only training export workflow.
- `createModelRunForUser`, `getModelRunForUser`, `createPredictionRunForUser`, `listProjectPredictionRunsForUser`, `getPredictionRunForUser`, `createPredictionArtifactProvenance`, and `resolveTaskPredictionProvenance` implement the RB-056 provenance registry service layer.
- `importPredictionMaskForUser` implements the RB-057 one-artifact prediction import path.
- `createCorrectionTasksForPredictionRunForUser`, `listProjectCorrectionTasksForUser`, `getCorrectionTaskForUser`, and `updateCorrectionTaskForUser` implement the RB-058 correction task queue service layer.
- `loadCorrectionContextForUser`, `readPredictionMaskForCorrectionTask`, and `saveCorrectionForTaskForUser` implement the RB-059 assisted correction service layer.
- `checkReadiness()` checks database and storage availability for `/api/ready`.

## Invariants And Constraints

- Server modules must not import client components.
- Every production write should be attributable to a user or explicit system actor.
- Session cookies use `sapen_annotate_session`; older local cookies are intentionally ignored.
- Runtime config must not expose secrets to the client bundle.
- Current artifact integrity checks use `sha256:<hex>` checksums, validated image dimensions, and S3/MinIO object stat checks before database commit where practical.
- Prediction provenance/import services are proposal services only; they must not mark predictions as approved ground truth or bypass review/export invariants.
- Correction task services rank and route prediction correction work only; they do not create approved human artifacts or mark predictions export-ready.
- Assisted correction services create draft human correction artifact versions only; review/approval is still required before export.

## Known Gaps

- Audit logging is incomplete.
- There is no rate limiting for login or API writes.
- Export generation is synchronous and intended for trial-sized datasets; large export job handling remains deferred.
- Prediction-analysis exports and batch/background prediction imports remain deferred after RB-059. Slice-classification prediction correction remains deferred.

## Related Tickets / Docs

- [auth.md](auth.md)
- [storage.md](storage.md)
- [../../operations/environment.md](../../operations/environment.md)
