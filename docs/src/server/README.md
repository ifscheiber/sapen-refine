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
- `src/server/auth/policies.ts` - central project/global role policy used by API/domain code.
- `src/server/auth/loginThrottle.ts` - hashed DB-backed login throttling.
- `src/server/auth/requestGuards.ts` - same-origin mutation guard helpers.
- `src/server/auth/workspaceRedirect.ts` - RB-079 workspace login redirect header and `next` target helpers for stale sessions.
- `src/server/auth/workspaceSession.ts` - page-oriented workspace auth helpers that redirect unauthenticated users and use `notFound()` for missing/unauthorized project access.
- `src/server/domain/review.ts` - RB-052 review transition, permission, decision, and export-readiness helpers.
- `src/server/domain/exports.ts` - RB-053 full-image and RB-091 crop training export readiness, approved-version selection, manifest generation, ZIP packaging, export persistence, and download authorization.
- `src/server/domain/predictionProvenance.ts` - RB-056 model-run, prediction-run, prediction-item provenance validation, authorization, and task-link resolution helpers.
- `src/server/domain/predictionImport.ts` - RB-057 prediction mask import validation, storage write/stat verification, artifact-version creation, provenance linking, and audit events.
- `src/server/domain/predictionImportBatches.ts` - RB-061 ZIP batch prediction import manifest validation, private staging, job/item status updates, retry, and processing through the RB-057 import service.
- `src/server/domain/storageCleanup.ts` - RB-066 temporary-object retention cleanup, protected-object decisions, and cleanup audit events.
- `src/server/domain/correctionTasks.ts` - RB-058 active-learning correction task creation, ordering, assignment/status updates, sanitized serialization, and audit events.
- `src/server/domain/assistedCorrection.ts` - RB-059 correction context loading, prediction mask streaming authorization, human correction save validation, provenance linking, and audit events.
- `src/server/domain/predictionAnalysisExports.ts` - RB-060 prediction-analysis export readiness, manifest/package generation, persistence, and owner/QA download authorization.
- `src/server/domain/predictionAnalysisMetrics.ts` - RB-067 pure semantic/support prediction QA metric helpers.
- `src/server/domain/sliceBboxes.ts` - RB-086 BBox proposal list/create/replace/delete helpers, source-image geometry validation, append-only versioning, and audit events.
- `src/server/domain/sliceCrops.ts` - RB-087 derived slice crop geometry, padding validation, source-image crop generation, private PNG storage, sanitized reads, and audit events.
- `src/server/domain/cropSupportMasks.ts` - RB-088 crop support-mask state, crop-dimension validation, coordinate helper, artifact-version creation, and sanitized latest-version reads.
- `src/server/domain/cropSemanticMasks.ts` - RB-089 crop semantic-mask state, support-lineage validation, mode label validation, outside-support rejection, artifact-version creation, and sanitized latest-version reads.
- `src/server/domain/sliceClassifications.ts` - RB-090 slice-instance manual override APIs, semantic-mask classification derivation, provenance serialization, and audit events.
- `src/server/domain/cropReadiness.ts` - RB-092 shared crop readiness resolver, crop review-action availability, sanitized readiness serialization, and crop export skip policy.
- `src/server/http/apiErrors.ts` - RB-072 flat JSON API error helpers for auth/RBAC/domain route failures.
- `src/server/storage/s3.ts` - active AWS SDK S3/MinIO client setup, presign helpers, object writes/reads, object stat verification, best-effort deletes, and storage readiness check.

## Public Interfaces / Routes / Functions

- `requireUser()` throws `UNAUTHORIZED` for route/domain callers without a valid session.
- `requireProjectRole(projectId, allowed)` enforces project membership roles.
- `requireWorkspaceUser()` and `requireWorkspaceProjectRole(projectId, allowed)` are for App Router workspace pages; they redirect stale/anonymous sessions to login and avoid exposing project existence through raw page errors.
- `presignGetObject(key)` and `presignPutObject(key, contentType)` wrap S3 presigned URLs.
- `putObject(key, body, contentType)` writes app-mediated uploads to S3/MinIO.
- `loadImageReviewStateForUser`, `transitionArtifactVersionForUser`, and `transitionSliceClassificationVersionForUser` implement the minimal review/approval workflow.
- `resolveProjectExportReadiness`, `createTrainingExportForUser`, `getTrainingExportForUser`, and `readTrainingExportFileForUser` implement the owner-only training export workflow, including RB-053 full-image targets and the exclusive RB-091 `crop_training` target.
- `createModelRunForUser`, `getModelRunForUser`, `createPredictionRunForUser`, `listProjectPredictionRunsForUser`, `getPredictionRunForUser`, `createPredictionArtifactProvenance`, and `resolveTaskPredictionProvenance` implement the RB-056 provenance registry service layer.
- `importPredictionMaskForUser` implements the RB-057 one-artifact prediction import path.
- `createPredictionImportBatchFromZipForUser`, `processPredictionImportBatchForUser`, `retryPredictionImportBatchForUser`, and batch list/detail helpers implement the RB-061 single-host DB-backed batch import baseline.
- `runStorageCleanup` implements the RB-066 admin-only dry-run/execute cleanup path for temporary batch staging and abandoned presigned upload objects.
- `createCorrectionTasksForPredictionRunForUser`, `listProjectCorrectionTasksForUser`, `getCorrectionTaskForUser`, and `updateCorrectionTaskForUser` implement the RB-058 correction task queue service layer.
- `loadCorrectionContextForUser`, `readPredictionMaskForCorrectionTask`, and `saveCorrectionForTaskForUser` implement the RB-059 assisted correction service layer.
- `resolveProjectPredictionAnalysisReadiness`, `createPredictionAnalysisExportForUser`, `getPredictionAnalysisExportForUser`, and `readPredictionAnalysisExportFileForUser` implement the RB-060/RB-067 prediction-analysis export service layer with QA metrics in the manifest.
- `listSliceBoundingBoxesForUser`, `createSliceBoundingBoxForUser`, `replaceSliceBoundingBoxForUser`, and `deleteSliceBoundingBoxForUser` implement the RB-086 source-image BBox proposal service layer.
- `generateCropForSliceBBox`, `listSliceCropsForImageForUser`, `getSliceCropForUser`, and `readSliceCropAssetForUser` implement the RB-087 derived slice crop service layer.
- `loadCropSupportMaskStateForUser`, `createCropSupportMaskVersionForUser`, and `cropPixelToSourcePixel` implement the RB-088 crop support-mask service layer.
- `loadCropSemanticMaskStateForUser`, `createCropSemanticMaskVersionForUser`, and `validateSemanticMaskAgainstSupport` implement the RB-089 crop semantic-mask service layer.
- `deriveSliceClassificationFromSemanticMask`, `deriveSliceClassificationForSemanticMaskVersionForUser`, `loadSliceClassificationStateForUser`, and `setSliceInstanceClassificationForUser` implement the RB-090 auto/manual crop workflow classification service layer.
- `resolveCropWorkflowReadiness`, `resolveCropWorkflowReadinessForUser`, and `sanitizeCropWorkflowReadiness` implement the RB-092 shared crop readiness service used by crop editors, project readiness APIs, and crop-training exports.
- `checkReadiness()` checks database and storage availability for `/api/ready`.
- `apiError`, `apiErrorFromPayload`, `apiErrorFromUnknown`, and `withApiErrorHandling` implement the RB-072 route-level JSON error contract.

## Invariants And Constraints

- Server modules must not import client components.
- Every production write should be attributable to a user or explicit system actor.
- Session cookies use `sapen_annotate_session`; older local cookies are intentionally ignored.
- Browser workspace routes redirect to `/login` when a session cookie is missing, stale, or invalid; API routes keep JSON `401` semantics.
- Runtime config must not expose secrets to the client bundle.
- Current artifact integrity checks use `sha256:<hex>` checksums, validated image dimensions, and S3/MinIO object stat checks before database commit where practical.
- API errors use the flat `{ ok: false, error: "CODE" }` response shape for the current trial contract.
- Prediction provenance/import services are proposal services only; they must not mark predictions as approved ground truth or bypass review/export invariants.
- Prediction batch import services must not expose staging keys, must process items through the RB-057 import service, and must not create correction tasks or approved ground truth automatically.
- Storage cleanup must use DB references as the deletion safety boundary and must not delete committed raw images, committed artifact versions, imported prediction artifacts, or export packages.
- Correction task services rank and route prediction correction work only; they do not create approved human artifacts or mark predictions export-ready.
- Assisted correction services create draft human correction artifact versions only; review/approval is still required before export.
- Prediction-analysis export services are QA/debug services only; they mark predictions as proposals, keep prediction/human paths separate, store metrics as evaluation metadata only, and do not change training export eligibility.
- Slice BBox services create crop-planning proposal versions only. They validate source-image pixel bounds, append replacement/deletion versions, and do not create support masks or export-ready ground truth.
- Slice crop services generate private derived PNG crops from current active BBox versions only. They clamp configurable padding to source-image bounds, record requested/applied padding separately, store `CROP_PIXEL` transform metadata, and do not create support geometry.
- Crop support-mask services create draft crop-scoped `SLICE_SUPPORT_MASK` artifact versions only after exact crop-dimension validation. They link saved versions to `DerivedSliceCrop` and `SliceInstance`, use `CROP_PIXEL`, and keep private storage keys out of browser responses.
- Crop semantic-mask services require a current crop support mask, create draft crop-scoped `SEMANTIC_MASK` artifact versions after exact crop-dimension and support-lineage validation, link saved versions to `DerivedSliceCrop`, `SliceInstance`, and `supportMaskVersionId`, use `CROP_PIXEL`, reject non-background semantic bytes outside support, and trigger draft auto slice-classification derivation.
- Slice-classification derivation uses semantic mask bytes and label-schema values only; it stores `AUTO_FROM_SEMANTIC_MASK` provenance, exact semantic/support/crop lineage, stable derivation reasons, and draft review state. Manual overrides append separate `MANUAL` versions.
- Crop readiness is resolved centrally. Crop training exports include only `READY` crop candidates with approved crop support masks, approved crop semantic masks, and approved classifications whose semantic/support/crop lineage is current. `REVIEW_REQUIRED` candidates are skipped with explicit reasons. The manifest version remains `sapen-annotate-crop-training-export-v1`, and browser/API responses do not expose private storage keys.

## Known Gaps

- Audit logging is still not exposed through an admin UI.
- Login has DB-backed throttling; general API write rate limiting remains deferred.
- Training and prediction-analysis export generation are synchronous and intended for trial-sized datasets; large export job handling and metric dashboards remain deferred.
- RB-065 adds an optional single-host worker path for RB-061 batch prediction imports. RB-066 adds temporary staged-object cleanup without a cleanup UI. Production-scale queue infrastructure and slice-classification prediction correction remain deferred.

## Related Tickets / Docs

- [auth.md](auth.md)
- [storage.md](storage.md)
- [../../operations/environment.md](../../operations/environment.md)
