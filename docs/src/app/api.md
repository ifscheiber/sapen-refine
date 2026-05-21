# API Routes

## Purpose

This page lists the current API route handlers under `src/app/api`.

## Current API Surface

- `GET /api/health` - cheap unauthenticated liveness endpoint; returns status, service, and timestamp without DB access.
- `GET /api/ready` - unauthenticated readiness endpoint; checks database and storage connectivity and returns `503` when a dependency is unavailable.
- `POST /api/auth/login` - validates local credentials, applies login throttling, creates a session, and returns a sanitized `redirectTo`.
- `POST /api/auth/logout` - revokes the current session and clears the cookie.
- `GET /api/auth/me` - returns the current authenticated user.
- `GET /api/projects` - lists projects visible to the current user.
- `POST /api/projects` - creates a project and owner membership.
- `PATCH /api/projects/[projectId]` - updates project name/description for `OWNER` and `QA`; attaches the default active label schema when missing.
- `GET /api/projects/[projectId]/images` - lists images for a project.
- `POST /api/projects/[projectId]/images/presign` - creates a presigned PNG/JPEG raw-image upload URL for compatibility.
- `POST /api/projects/[projectId]/images/commit` - validates a private uploaded PNG/JPEG object and records a validated raw image.
- `POST /api/projects/[projectId]/images/upload` - uploads a PNG/JPEG raw image through the app server, verifies checksum/dimensions/object metadata, stores it in S3/MinIO, and records the validated image row.
- `GET /api/projects/[projectId]/images/[imageId]/view` - returns an app-mediated image asset URL after membership check.
- `GET /api/images/[imageId]` - redirects to the app-mediated image asset route after membership check.
- `GET /api/images/[imageId]/metadata` - returns immutable technical image metadata, acquisition/sample metadata, membership role, edit capability, and readiness summary.
- `PATCH /api/images/[imageId]/metadata` - updates acquisition/sample metadata for editable project roles with typed validation.
- `GET /api/images/[imageId]/view` - returns an app-mediated image asset URL.
- `GET /api/images/[imageId]/asset` - streams image bytes through the app after membership check.
- `GET /api/images/[imageId]/mask/latest` - returns latest mask version metadata and view URL.
- `GET /api/images/[imageId]/mask/versions/[versionId]/asset` - streams mask bytes through the app after membership check.
- `POST /api/images/[imageId]/mask/presign` - creates a presigned mask upload URL.
- `POST /api/images/[imageId]/mask/commit` - validates a private uploaded `u8raw-v1` mask object and records a new draft semantic mask version.
- `POST /api/images/[imageId]/mask/upload` - uploads `u8raw-v1` mask bytes through the app server, verifies byte length/dimensions/checksum/object metadata, and records a new draft semantic `AnnotationArtifactVersion`.
- `GET /api/images/[imageId]/slice` - returns default-slice state, support label values, latest support mask, and latest classification.
- `POST /api/images/[imageId]/slice/ensure` - creates or returns the default slice instance for editable project roles.
- `PATCH /api/images/[imageId]/slice/classification` - appends a draft `SliceClassificationVersion`.
- `GET /api/images/[imageId]/support-mask/latest` - returns latest support-mask version metadata and app-mediated asset URL.
- `POST /api/images/[imageId]/support-mask/upload` - uploads support-mask bytes through the app server, verifies image-sized `u8raw-v1` bytes and support-only values, and records a draft `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/images/[imageId]/review-state` - returns review permissions, latest versions, latest approved versions, and export-readiness warnings for semantic masks, support masks, and slice classifications.
- `POST /api/artifact-versions/[versionId]/review` - submits, approves, or rejects semantic/support artifact versions after membership and transition checks.
- `POST /api/slice-classification-versions/[versionId]/review` - submits, approves, or rejects slice classification versions after membership and transition checks.
- `GET /api/projects/[projectId]/export/readiness` - returns project export readiness, approved artifact/classification counts, candidate warnings, and owner export capability for project members.
- `POST /api/projects/[projectId]/exports` - creates a synchronous RB-053 training export for project owners.
- `GET /api/exports/[exportId]` - returns sanitized export summary and download routes for project owners.
- `GET /api/exports/[exportId]/download?file=manifest|package` - streams the stored manifest JSON or ZIP package through the app for project owners.
- `GET /api/projects/[projectId]/prediction-analysis-export/readiness` - returns prediction-analysis export candidate counts, metric availability counts, prediction-run options, selected target filters, and owner/QA export capability for project members.
- `POST /api/projects/[projectId]/prediction-analysis-exports` - creates a synchronous RB-060/RB-067 prediction-analysis export with QA metrics or not-computed reasons for project `OWNER`/`QA`.
- `GET /api/prediction-analysis-exports/[exportId]` - returns sanitized prediction-analysis export summary and download routes for project `OWNER`/`QA`.
- `GET /api/prediction-analysis-exports/[exportId]/download?file=manifest|package` - streams the prediction-analysis manifest JSON or ZIP package through the app for project `OWNER`/`QA`.
- `POST /api/model-runs` - creates a model/checkpoint/training provenance record for global admins.
- `GET /api/model-runs/[modelRunId]` - returns full model-run provenance for global admins.
- `GET /api/projects/[projectId]/prediction-runs` - lists project-scoped prediction/inference runs for project members.
- `POST /api/projects/[projectId]/prediction-runs` - creates a project-scoped prediction/inference run for project `OWNER` or `QA`.
- `GET /api/prediction-runs/[predictionRunId]` - returns a sanitized prediction-run summary for project members.
- `POST /api/prediction-runs/[predictionRunId]/predictions` - imports one multipart `u8raw-v1` prediction mask proposal for project `OWNER`/`QA`, stores it privately as `PREDICTION_MASK`, and links it to `PredictionArtifactProvenance`.
- `POST /api/prediction-runs/[predictionRunId]/batch-imports` - creates a ZIP-backed RB-061 prediction import batch for project `OWNER`/`QA`; it validates the manifest and privately stages item files without processing every item in the request.
- `GET /api/projects/[projectId]/prediction-import-batches` - lists sanitized RB-061 batch summaries for project `OWNER`/`QA`.
- `GET /api/prediction-import-batches/[batchId]` - returns one sanitized RB-061 batch summary for project `OWNER`/`QA`.
- `GET /api/prediction-import-batches/[batchId]/items` - returns sanitized item summaries and stable error codes without staging/storage keys.
- `POST /api/prediction-import-batches/[batchId]/process` - processes a limited number of pending/retryable/stale-recovered batch items through the existing RB-057 prediction import service using RB-065 processor lease metadata.
- `POST /api/prediction-import-batches/process-due` - worker-oriented endpoint that processes a bounded number of due pending/retry/stale batches for projects where the authenticated account is `OWNER`/`QA`.
- `POST /api/prediction-import-batches/[batchId]/retry` - resets failed/retryable batch items for manual retry without resetting succeeded items.
- `POST /api/storage-cleanup` - admin-only RB-066 operational endpoint for dry-run or execute cleanup of temporary batch staging objects and identifiable abandoned presigned upload objects.
- `POST /api/prediction-runs/[predictionRunId]/correction-tasks` - creates idempotent model-prediction correction tasks from prediction provenance rows for project `OWNER`/`QA`.
- `GET /api/projects/[projectId]/correction-tasks` - lists project correction tasks for project members in deterministic priority/uncertainty/confidence order.
- `GET /api/correction-tasks/[taskId]` - returns one sanitized model-prediction correction task for project members.
- `PATCH /api/correction-tasks/[taskId]` - claims, assigns, starts, dismisses, or reprioritizes a correction task according to project role.
- `GET /api/correction-tasks/[taskId]/correction-context` - returns sanitized assisted correction editor context for editable project roles.
- `GET /api/correction-tasks/[taskId]/prediction-mask` - streams the source prediction mask bytes through the app after task/provenance/source validation.
- `POST /api/correction-tasks/[taskId]/corrections` - saves a semantic/support human correction draft with `HUMAN_CORRECTION` provenance linked to the source prediction and task.

## Invariants And Constraints

- Project and image API routes must enforce authenticated access and project membership.
- Mask commits must remain append-only; do not overwrite historical annotation artifact versions.
- Customer-trial browser upload and read paths should use app-mediated routes so MinIO can stay private on the Docker network.
- Metadata APIs must not accept client-owned changes to immutable upload facts such as storage key, checksum, dimensions, uploader, or validation status.
- Support-mask APIs must not accept semantic mask versions as physical support geometry.
- Review APIs enforce server-side permissions: `OWNER`/`QA` can approve/reject, `OWNER`/`QA`/`LABELER` can submit, and `VIEWER` cannot mutate review state.
- Review APIs only allow `DRAFT -> SUBMITTED` and `SUBMITTED -> APPROVED/REJECTED`; reject requires a comment or reason.
- Export APIs use latest approved semantic/support/classification versions only, keep target concepts separate, and do not treat Copper semantic masks as support geometry.
- Export creation/download is restricted to project `OWNER` in RB-053 and does not expose private MinIO storage keys in browser API responses.
- Prediction-analysis export APIs are separate from RB-053 export targets. They include model proposals for QA only, mark predictions as `groundTruth: false`, include QA metrics as evaluation metadata where approved references exist, restrict create/download to project `OWNER`/`QA`, and do not expose private storage keys or private model checkpoint paths.
- Prediction provenance/import APIs do not approve prediction artifacts and do not expose private storage keys. Direct model-run reads are admin-only because they may include internal checkpoint paths; project members read reduced model summaries through prediction-run responses.
- Prediction batch processing APIs are bounded and DB-lease backed for prediction-import items only; normal browser annotation concurrency does not use this worker path.
- Prediction import accepts only app-mediated multipart upload for RB-057. It does not accept arbitrary client-provided storage keys.
- Prediction batch import accepts only app-mediated RB-061 ZIP uploads. It stages item files under internal private keys, processes items through the RB-057 service, never returns staging keys, and does not create correction tasks automatically.
- Storage cleanup APIs default to dry-run, require global `ADMIN`, use DB references as the deletion safety boundary, never return private URLs, and must not delete raw images, committed artifact versions, imported prediction artifacts, or export packages.
- Correction-task APIs expose prediction/run/provenance summaries but not private artifact storage keys. `OWNER`/`QA` can create and manage tasks; `LABELER` can claim/start/dismiss own or unassigned active tasks; `VIEWER` is read-only.
- Assisted correction APIs are mutation-oriented and therefore allow `OWNER`, `QA`, and eligible `LABELER` users only. Prediction bytes are streamed through the app; storage keys are not returned.
- API routes should return stable error codes that clients can handle.
- RB-055 upload/artifact error codes include `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_TOO_LARGE`, `IMAGE_DIMENSIONS_UNREADABLE`, `CHECKSUM_MISMATCH`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_KEY_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-056 prediction provenance error codes include `FORBIDDEN`, `MODEL_RUN_NOT_FOUND`, `PREDICTION_RUN_NOT_FOUND`, `DUPLICATE_INFERENCE_RUN`, `INVALID_MODEL_TASK_TYPE`, `INVALID_PREDICTION_TARGET_TYPE`, `INVALID_PREDICTION_RUN_STATUS`, `CONFIDENCE_OUT_OF_RANGE`, `UNCERTAINTY_OUT_OF_RANGE`, `PREDICTED_CLASS_REQUIRED`, `PREDICTED_CLASS_TARGET_INVALID`, `ARTIFACT_NOT_PREDICTION`, and `PROJECT_MISMATCH`.
- RB-057 prediction import error codes include `PREDICTION_IMPORT_PAYLOAD_INVALID`, `PREDICTION_IMPORT_FORBIDDEN`, `PREDICTION_TARGET_UNSUPPORTED`, `IMAGE_PROJECT_MISMATCH`, `COORDINATE_SPACE_UNSUPPORTED`, `SEMANTIC_MASK_VALUES_INVALID`, `PREDICTION_IMPORT_FAILED`, plus reused upload/integrity errors such as `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_TOO_LARGE`, `CHECKSUM_MISMATCH`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-061 prediction batch error codes include `PREDICTION_IMPORT_BATCH_PAYLOAD_INVALID`, `BATCH_ZIP_INVALID`, `BATCH_MANIFEST_MISSING`, `BATCH_MANIFEST_INVALID_JSON`, `BATCH_MANIFEST_VERSION_UNSUPPORTED`, `BATCH_PREDICTION_RUN_MISMATCH`, `BATCH_TOO_MANY_ITEMS`, `BATCH_ITEM_TARGET_UNSUPPORTED`, `BATCH_ITEM_FILE_MISSING`, `BATCH_ITEM_IMAGE_NOT_FOUND`, `BATCH_STAGING_READ_FAILED`, `BATCH_NOT_FOUND`, and reused RB-057/upload errors recorded at item level.
- RB-066 storage cleanup error codes include `CLEANUP_FORBIDDEN`, `CLEANUP_FLAG_INVALID`, `CLEANUP_CATEGORY_INVALID`, `CLEANUP_LIMIT_INVALID`, `CLEANUP_COMPLETED_RETENTION_INVALID`, `CLEANUP_FAILED_RETENTION_INVALID`, `CLEANUP_PRESIGNED_RETENTION_INVALID`, `CLEANUP_NOW_INVALID`, and `STORAGE_CLEANUP_FAILED`.
- RB-058 correction-task error codes include `FORBIDDEN`, `PREDICTION_RUN_NOT_FOUND`, `CORRECTION_TASK_NOT_FOUND`, `INVALID_TASK_REASON`, `INVALID_TASK_SCOPE`, `INVALID_TASK_STATUS`, `INVALID_PREDICTION_TARGET_TYPE`, `INVALID_TASK_ACTION`, `INVALID_TASK_PRIORITY`, `INVALID_TASK_STATUS_TRANSITION`, `ASSIGNEE_REQUIRED`, `ASSIGNEE_NOT_PROJECT_MEMBER`, and `CORRECTION_TASK_ALREADY_EXISTS`.
- RB-059 assisted-correction error codes include `CORRECTION_TASK_NOT_FOUND`, `CORRECTION_TASK_IMAGE_MISSING`, `CORRECTION_TARGET_UNSUPPORTED`, `SOURCE_PREDICTION_MISSING`, `SOURCE_PREDICTION_MISMATCH`, `SOURCE_PREDICTION_NOT_FOUND`, `SOURCE_ARTIFACT_NOT_PREDICTION`, `SEMANTIC_MASK_VALUES_INVALID`, and reused upload/object errors.
- RB-060 prediction-analysis export error codes include `FORBIDDEN`, `PROJECT_NOT_FOUND`, `USER_NOT_FOUND`, `PREDICTION_TARGET_INVALID`, `NO_PREDICTION_ANALYSIS_CANDIDATES`, `PREDICTION_ANALYSIS_EXPORT_NOT_FOUND`, `EXPORT_NOT_READY`, and `EXPORT_FILE_NOT_FOUND`.

## Known Gaps

- Audit logging now covers the main auth/project/upload/artifact/metadata/review/export/prediction/correction paths, but no admin audit UI exists yet.
- RB-053 and RB-060/RB-067 exports are synchronous and trial-sized. RB-061/RB-065 cover batch prediction import jobs only; RB-066 covers temporary storage cleanup without adding a cleanup UI. Advanced export filters, export history UI, metrics dashboards, and production-grade queue workers remain deferred.

## Related Tickets / Docs

- [../../src/server/README.md](../server/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
