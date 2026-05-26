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
- `POST /api/projects` - creates a project and owner membership for global `ADMIN` users or users that already own at least one project; plain Annotator/`LABELER` users receive stable JSON `403 FORBIDDEN`.
- `PATCH /api/projects/[projectId]` - updates project name/description for `OWNER` and `QA`; attaches the default active label schema when missing.
- `GET /api/projects/[projectId]/images` - lists images for a project with browser-safe metadata, mask-version counts, and slice counts.
- `POST /api/projects/[projectId]/images/presign` - disabled legacy/internal compatibility route; after auth/RBAC it returns `410 PRESIGNED_UPLOADS_DISABLED`.
- `POST /api/projects/[projectId]/images/commit` - disabled legacy/internal compatibility route; after auth/RBAC it returns `410 PRESIGNED_UPLOADS_DISABLED`.
- `POST /api/projects/[projectId]/images/upload` - uploads a PNG/JPEG raw image through the app server, verifies checksum/dimensions/object metadata, stores it in S3/MinIO, and records the validated image row.
- `GET /api/projects/[projectId]/images/[imageId]/view` - returns an app-mediated image asset URL after membership check.
- `GET /api/images/[imageId]` - redirects to the app-mediated image asset route after membership check.
- `GET /api/images/[imageId]/metadata` - returns immutable technical image metadata, acquisition/sample metadata, membership role, edit capability, and readiness summary.
- `PATCH /api/images/[imageId]/metadata` - updates acquisition/sample metadata for editable project roles with typed validation.
- `GET /api/images/[imageId]/view` - returns an app-mediated image asset URL. With `variant=bbox-preview`, it may return a BBox-stage downscaled preview URL plus original/preview dimensions and scale metadata; fields are additive and the fallback remains `/api/images/[imageId]/asset`.
- `GET /api/images/[imageId]/asset` - streams image bytes through the app after membership check.
- `GET /api/images/[imageId]/bbox-preview` - streams a private on-demand downscaled BBox-stage preview for large images after membership check. It preserves aspect ratio, never upscales, uses HTTP caching headers, and does not replace the original image used for persisted BBoxes or crop generation.
- `GET /api/images/[imageId]/mask/latest` - returns latest mask version metadata and view URL.
- `GET /api/images/[imageId]/mask/versions/[versionId]/asset` - streams mask bytes through the app after membership check.
- `POST /api/images/[imageId]/mask/presign` - disabled legacy/internal compatibility route; after auth/RBAC it returns `410 PRESIGNED_UPLOADS_DISABLED`.
- `POST /api/images/[imageId]/mask/commit` - disabled legacy/internal compatibility route; after auth/RBAC it returns `410 PRESIGNED_UPLOADS_DISABLED`.
- `POST /api/images/[imageId]/mask/upload` - uploads `u8raw-v1` mask bytes through the app server, verifies byte length/dimensions/checksum/object metadata, and records a new draft semantic `AnnotationArtifactVersion`.
- `GET /api/images/[imageId]/slice` - returns default-slice state, support label values, latest support mask, and latest classification.
- `POST /api/images/[imageId]/slice/ensure` - creates or returns the default slice instance for editable project roles.
- `PATCH /api/images/[imageId]/slice/classification` - appends a draft `SliceClassificationVersion`.
- `GET /api/slices/[sliceInstanceId]/classification` - returns latest classification state for the addressed physical slice instance.
- `POST /api/slices/[sliceInstanceId]/classification` - appends a manual draft `SliceClassificationVersion` for the addressed physical slice instance.
- `GET /api/images/[imageId]/slice-bboxes` - lists current active source-image BBox proposals for project members.
- `POST /api/images/[imageId]/slice-bboxes` - creates a new slice instance plus first active BBox proposal version for editable project roles.
- `POST /api/images/[imageId]/slice-bboxes/confirm` - confirms the current active image-level BBox set as crop workflow planning state for editable project roles; it rejects empty sets with `BBOX_SET_EMPTY`.
- `PATCH /api/slice-bboxes/[bboxVersionId]` - appends a replacement active BBox version when the referenced version is still current; optional `allowDependencyInvalidation` supersedes active downstream slice annotations before replacing a protected BBox.
- `DELETE /api/slice-bboxes/[bboxVersionId]` - appends a deleted BBox version and clears the current slice-instance BBox summary; optional `allowDependencyInvalidation` supersedes active downstream slice annotations before deleting a protected BBox.
- `GET /api/images/[imageId]/slice-crops` - lists sanitized derived slice crop metadata for project members.
- `POST /api/images/[imageId]/slice-crops/ensure` - idempotently ensures current derived crops exist for the image or selected slice, reusing the existing crop generator and returning sanitized crop metadata.
- `POST /api/slice-bboxes/[bboxVersionId]/crop` - generates a private PNG derived crop from a current active BBox version for editable project roles.
- `GET /api/slice-crops/[cropId]` - returns sanitized derived crop metadata for project members.
- `GET /api/slice-crops/[cropId]/asset` - streams the private derived crop PNG through the app after membership check.
- `GET /api/slice-crops/[cropId]/support-mask` - returns crop support-mask readiness, support label bytes, crop metadata, latest crop support-mask metadata, and crop review/readiness actions for project members.
- `POST /api/slice-crops/[cropId]/support-mask/upload` - uploads crop-sized support-mask bytes, verifies `CROP_PIXEL` dimensions and support-only values, and records a draft crop-linked `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/slice-crops/[cropId]/semantic-mask` - returns crop semantic-mask readiness, current support-mask metadata, mode label options, latest crop semantic-mask metadata, latest classification metadata, and crop review/readiness actions for project members.
- `POST /api/slice-crops/[cropId]/semantic-mask/upload` - uploads crop-sized semantic-mask bytes, verifies `CROP_PIXEL` dimensions, validates `x-semantic-mode`, optionally validates `x-support-mask-version-id`, records a draft crop-linked `SEMANTIC_MASK` artifact version, and appends a draft auto-derived slice classification suggestion. Sap/Heartwood saves may be supportless; Copper saves may be draft-supportless but still need approved explicit support for readiness/export.
- `GET /api/images/[imageId]/support-mask/latest` - returns latest support-mask version metadata and app-mediated asset URL.
- `POST /api/images/[imageId]/support-mask/upload` - uploads support-mask bytes through the app server, verifies image-sized `u8raw-v1` bytes and support-only values, and records a draft `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/images/[imageId]/review-state` - returns review permissions, latest versions, latest approved versions, and export-readiness warnings for semantic masks, support masks, and slice classifications.
- `POST /api/artifact-versions/[versionId]/review` - submits, approves, or rejects semantic/support artifact versions after membership and transition checks.
- `POST /api/slice-classification-versions/[versionId]/review` - submits, approves, or rejects slice classification versions after membership and transition checks.
- `GET /api/projects/[projectId]/crop-readiness` - returns sanitized central crop readiness for project members, with optional `imageId` and `sliceInstanceId` filters, stable reason counts, next-action hints, and review action availability.
- `GET /api/projects/[projectId]/export/readiness` - returns project export readiness, approved artifact/classification counts, crop candidate readiness counts, candidate warnings, and owner export capability for project `OWNER`/`QA`; Annotator/`LABELER` users receive `403 FORBIDDEN`.
- `POST /api/projects/[projectId]/exports` - enqueues a training export job for project owners, including full-image RB-053 targets or the exclusive RB-091 `crop_training` target; it returns `202` with a pending export summary. Optional `packageMode` keeps `zip` as the default and allows `manifest_only` for manifest-backed materialization.
- `GET /api/exports/[exportId]` - returns sanitized export summary and download routes for project owners.
- `GET /api/exports/[exportId]/download?file=manifest|package` - streams the stored manifest JSON or ZIP package through the app for project owners.
- `GET /api/exports/[exportId]/materialization-refs` - returns audited private object refs for completed training exports to project owners only; normal export summaries and manifests do not expose those refs.
- `GET /api/projects/[projectId]/prediction-analysis-export/readiness` - returns prediction-analysis export candidate counts, metric availability counts, prediction-run options, selected target filters, and owner/QA export capability for project `OWNER`/`QA`; Annotator/`LABELER` users receive `403 FORBIDDEN`.
- `POST /api/projects/[projectId]/prediction-analysis-exports` - enqueues an RB-060/RB-067 prediction-analysis export job with exact candidate references for project `OWNER`/`QA`; it returns `202` with a pending export summary.
- `GET /api/prediction-analysis-exports/[exportId]` - returns sanitized prediction-analysis export summary and download routes for project `OWNER`/`QA`.
- `GET /api/prediction-analysis-exports/[exportId]/download?file=manifest|package` - streams the prediction-analysis manifest JSON or ZIP package through the app for project `OWNER`/`QA`.
- `POST /api/export-jobs/process-due` - worker-oriented endpoint that processes a bounded number of due training, crop-training, and prediction-analysis export jobs for projects where the authenticated account can export that target; accounts with no eligible project target receive `403 FORBIDDEN`.
- `POST /api/model-runs` - creates a model/checkpoint/training provenance record for global admins.
- `GET /api/model-runs/[modelRunId]` - returns full model-run provenance for global admins.
- `GET /api/projects/[projectId]/prediction-runs` - lists project-scoped prediction/inference runs for project `OWNER`/`QA`.
- `POST /api/projects/[projectId]/prediction-runs` - creates a project-scoped prediction/inference run for project `OWNER` or `QA`.
- `GET /api/prediction-runs/[predictionRunId]` - returns a sanitized prediction-run summary for project `OWNER`/`QA`.
- `POST /api/prediction-runs/[predictionRunId]/predictions` - imports one multipart `u8raw-v1` prediction mask proposal for project `OWNER`/`QA`, stores it privately as `PREDICTION_MASK`, and links it to `PredictionArtifactProvenance`.
- `POST /api/prediction-runs/[predictionRunId]/batch-imports` - creates a ZIP-backed RB-061 prediction import batch for project `OWNER`/`QA`; it validates the manifest and privately stages item files without processing every item in the request.
- `GET /api/projects/[projectId]/prediction-import-batches` - lists sanitized RB-061 batch summaries for project `OWNER`/`QA`.
- `GET /api/prediction-import-batches/[batchId]` - returns one sanitized RB-061 batch summary for project `OWNER`/`QA`.
- `GET /api/prediction-import-batches/[batchId]/items` - returns sanitized item summaries and stable error codes without staging/storage keys.
- `POST /api/prediction-import-batches/[batchId]/process` - processes a limited number of pending/retryable/stale-recovered batch items through the existing RB-057 prediction import service using RB-065 processor lease metadata.
- `POST /api/prediction-import-batches/process-due` - worker-oriented endpoint that processes a bounded number of due pending/retry/stale batches for projects where the authenticated account is `OWNER`/`QA`; accounts without eligible projects receive `403 FORBIDDEN`.
- `POST /api/prediction-import-batches/[batchId]/retry` - resets failed/retryable batch items for manual retry without resetting succeeded items.
- `POST /api/storage-cleanup` - admin-only RB-066/RB-114 operational endpoint for dry-run or execute cleanup of temporary batch staging objects and identifiable abandoned presigned upload objects, plus additive storage/DB consistency reporting.
- `POST /api/prediction-runs/[predictionRunId]/correction-tasks` - creates idempotent model-prediction correction tasks from prediction provenance rows for project `OWNER`/`QA`.
- `GET /api/projects/[projectId]/correction-tasks` - lists project correction tasks for project `OWNER`/`QA` users in deterministic priority/uncertainty/confidence order.
- `GET /api/correction-tasks/[taskId]` - returns one sanitized model-prediction correction task for project `OWNER`/`QA` users.
- `PATCH /api/correction-tasks/[taskId]` - claims, assigns, starts, dismisses, or reprioritizes a correction task for project `OWNER`/`QA` users.
- `GET /api/correction-tasks/[taskId]/correction-context` - returns sanitized assisted correction editor context for project `OWNER`/`QA` users.
- `GET /api/correction-tasks/[taskId]/prediction-mask` - streams the source prediction mask bytes through the app after task/provenance/source validation for project `OWNER`/`QA` users.
- `POST /api/correction-tasks/[taskId]/corrections` - saves a semantic/support human correction draft with `HUMAN_CORRECTION` provenance linked to the source prediction and task for project `OWNER`/`QA` users.

## Invariants And Constraints

- Project and image API routes must enforce authenticated access and project membership.
- RB-111 high-cost mutation families are rate limited through the shared DB-backed limiter after auth and before expensive body/storage/package work. Enforced families are image upload, mask/editor/crop artifact saves, slice metadata/BBox/classification/crop-generation saves, training and prediction-analysis export creation, export job processing, prediction import upload/process/retry, and storage cleanup/admin operations.
- Excluded mutation routes are intentionally low-cost or already strongly bounded by domain semantics: project create/update, review transitions, correction-task status management, model/prediction-run metadata creation, disabled legacy presign/commit compatibility routes, and auth login/logout. Login keeps its separate auth throttle.
- Mask commits must remain append-only; do not overwrite historical annotation artifact versions.
- Customer-trial browser upload and read paths should use app-mediated routes so MinIO can stay private on the Docker network.
- New browser helper code must use the app-mediated upload/read routes. RB-105 keeps the legacy presign/commit route files only as disabled compatibility surface; they return `PRESIGNED_UPLOADS_DISABLED` and must not be used by new UI work.
- Metadata APIs must not accept client-owned changes to immutable upload facts such as storage key, checksum, dimensions, uploader, or validation status.
- Support-mask APIs must not accept semantic mask versions as physical support geometry.
- Slice BBox proposal APIs must validate integer source-image pixel geometry against persisted image dimensions and must not treat BBoxes as support geometry. The browser BBox stage may render a downscaled preview, but API inputs and persisted BBoxes remain original source-image coordinates.
- BBox confirmation APIs record workflow intent only. Confirmation must not be treated as artifact review, support geometry, or export readiness.
- Slice crop APIs must generate crops server-side from stored source images, clamp padding to source-image bounds, return sanitized metadata only, and never expose private crop storage keys.
- Crop support-mask APIs must require `CROP_PIXEL`, validate exact crop dimensions, link saved versions to `DerivedSliceCrop` and `SliceInstance`, reject Copper semantic bytes as support geometry, and never expose private mask storage keys.
- Crop semantic-mask APIs enforce mode-aware support policy: Sap/Heartwood saves can be supportless and derive support geometry from semantic foreground; Copper saves can be draft-supportless but Copper readiness/export requires explicit approved support. APIs validate exact crop dimensions, optional support lineage, mode-specific labels, and never expose private mask storage keys.
- Slice-instance classification APIs append manual override versions only; they do not mutate or approve auto-derived classification suggestions.
- Review APIs enforce server-side permissions: `OWNER`/`QA` can approve/reject, `OWNER`/`QA`/`LABELER` can submit, and `VIEWER` cannot mutate review state.
- Review APIs only allow `DRAFT -> SUBMITTED` and `SUBMITTED -> APPROVED/REJECTED`; reject requires a comment or reason.
- Crop readiness APIs and export readiness use `src/server/domain/cropReadiness.ts` so crop editor review actions, project crop-readiness summaries, and crop-training export skips share the same `READY`/`PARTIAL`/`NOT_READY`/`REVIEW_REQUIRED` decisions without exposing private storage keys.
- Export APIs use latest approved semantic/support/classification versions only, keep target concepts separate, and do not treat Copper semantic masks as support geometry. Crop-training manifests record `supportGeometrySource` as `SEMANTIC_FOREGROUND` for supportless Sap/Heartwood or `EXPLICIT_SUPPORT_MASK` for Copper. The RB-091/RB-092 `crop_training` target is exclusive, uses ready crop candidates only, preserves source-image/crop transform provenance, and lists partial/not-ready/review-required crops in `skippedCropItems`.
- Export creation applies RB-111 trial caps before ZIP packaging: training/crop-training exports default to 500 package items and 512 MiB estimated input bytes; prediction-analysis exports have the same default cap. Cap failures return `413` with the relevant export error code.
- Export ZIP packaging verifies every packaged raw image, artifact version, and derived crop against the persisted checksum and size before adding bytes to the archive. Mismatches fail creation with `EXPORT_OBJECT_INTEGRITY_MISMATCH`; missing checksum/size metadata fails with existing export integrity metadata errors.
- Export creation/download is restricted to project `OWNER` in RB-053 and does not expose private MinIO storage keys in browser API responses. EX-002 materialization refs are a separate audited owner-only endpoint for local operator tooling.
- Prediction-analysis export APIs are separate from RB-053 export targets. They include model proposals for QA only, mark predictions as `groundTruth: false`, include QA metrics as evaluation metadata where approved references exist, restrict create/download to project `OWNER`/`QA`, and do not expose private storage keys or private model checkpoint paths.
- Prediction provenance/import APIs do not approve prediction artifacts and do not expose private storage keys. Direct model-run reads are admin-only because they may include internal checkpoint paths; project `OWNER`/`QA` users read reduced model summaries through prediction-run responses.
- Prediction batch processing APIs are bounded and DB-lease backed for prediction-import items only; normal browser annotation concurrency does not use this worker path.
- Prediction import accepts only app-mediated multipart upload for RB-057. It does not accept arbitrary client-provided storage keys.
- Prediction batch import accepts only app-mediated RB-061 ZIP uploads. It stages item files under internal private keys, processes items through the RB-057 service, never returns staging keys, and does not create correction tasks automatically.
- Storage cleanup APIs default to dry-run, require global `ADMIN`, use DB references as the deletion safety boundary, never return private URLs, and must not delete raw images, committed artifact versions, imported prediction artifacts, or export packages. RB-114 adds `cleanup.consistency` while preserving `cleanup.summary` and `cleanup.results`.
- Correction-task APIs expose prediction/run/provenance summaries but not private artifact storage keys. `OWNER`/`QA` can create, view, manage, and work tasks; `LABELER` users use direct annotation workflows instead.
- Assisted correction APIs are mutation-oriented and therefore allow `OWNER` and `QA` users only. Prediction bytes are streamed through the app; storage keys are not returned.
- API routes should return stable error codes that clients can handle.
- High-cost rate-limit failures return `429 RATE_LIMITED` with `Retry-After` and `retryAfterSeconds`.
- RB-072 standardizes auth/RBAC/domain route failures as flat JSON `{ ok: false, error: "CODE" }`; unauthenticated `/api/**` requests return `401 UNAUTHENTICATED` instead of an HTML/login redirect.
- RB-106 requires every protected API route method to be exported through `withApiErrorHandling` and guarded by the route inventory in `tests/unit/api-route-error-contracts.test.ts`. Public API routes are limited to health/readiness and auth login/logout/me.
- RB-055/RB-081 upload/artifact error codes include `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_TOO_LARGE`, `IMAGE_DIMENSIONS_UNREADABLE`, `IMAGE_DIMENSIONS_UNSUPPORTED`, `CHECKSUM_MISMATCH`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_KEY_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-056 prediction provenance error codes include `FORBIDDEN`, `MODEL_RUN_NOT_FOUND`, `PREDICTION_RUN_NOT_FOUND`, `DUPLICATE_INFERENCE_RUN`, `INVALID_MODEL_TASK_TYPE`, `INVALID_PREDICTION_TARGET_TYPE`, `INVALID_PREDICTION_RUN_STATUS`, `CONFIDENCE_OUT_OF_RANGE`, `UNCERTAINTY_OUT_OF_RANGE`, `PREDICTED_CLASS_REQUIRED`, `PREDICTED_CLASS_TARGET_INVALID`, `ARTIFACT_NOT_PREDICTION`, and `PROJECT_MISMATCH`.
- RB-057 prediction import error codes include `PREDICTION_IMPORT_PAYLOAD_INVALID`, `PREDICTION_IMPORT_FORBIDDEN`, `PREDICTION_TARGET_UNSUPPORTED`, `IMAGE_PROJECT_MISMATCH`, `COORDINATE_SPACE_UNSUPPORTED`, `SEMANTIC_MASK_VALUES_INVALID`, `PREDICTION_IMPORT_FAILED`, plus reused upload/integrity errors such as `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_TOO_LARGE`, `CHECKSUM_MISMATCH`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-061 prediction batch error codes include `PREDICTION_IMPORT_BATCH_PAYLOAD_INVALID`, `BATCH_ZIP_INVALID`, `BATCH_MANIFEST_MISSING`, `BATCH_MANIFEST_INVALID_JSON`, `BATCH_MANIFEST_VERSION_UNSUPPORTED`, `BATCH_PREDICTION_RUN_MISMATCH`, `BATCH_TOO_MANY_ITEMS`, `BATCH_ITEM_TARGET_UNSUPPORTED`, `BATCH_ITEM_FILE_MISSING`, `BATCH_ITEM_IMAGE_NOT_FOUND`, `BATCH_STAGING_READ_FAILED`, `BATCH_NOT_FOUND`, and reused RB-057/upload errors recorded at item level.
- RB-066/RB-114 storage cleanup error codes include `CLEANUP_FORBIDDEN`, `CLEANUP_FLAG_INVALID`, `CLEANUP_CATEGORY_INVALID`, `CLEANUP_LIMIT_INVALID`, `CLEANUP_COMPLETED_RETENTION_INVALID`, `CLEANUP_FAILED_RETENTION_INVALID`, `CLEANUP_PRESIGNED_RETENTION_INVALID`, `CLEANUP_NOW_INVALID`, and `STORAGE_CLEANUP_FAILED`. Consistency drift findings are reported inside the successful cleanup response rather than as API error payloads.
- RB-058 correction-task error codes include `FORBIDDEN`, `PREDICTION_RUN_NOT_FOUND`, `CORRECTION_TASK_NOT_FOUND`, `INVALID_TASK_REASON`, `INVALID_TASK_SCOPE`, `INVALID_TASK_STATUS`, `INVALID_PREDICTION_TARGET_TYPE`, `INVALID_TASK_ACTION`, `INVALID_TASK_PRIORITY`, `INVALID_TASK_STATUS_TRANSITION`, `ASSIGNEE_REQUIRED`, `ASSIGNEE_NOT_PROJECT_MEMBER`, and `CORRECTION_TASK_ALREADY_EXISTS`.
- RB-059 assisted-correction error codes include `CORRECTION_TASK_NOT_FOUND`, `CORRECTION_TASK_IMAGE_MISSING`, `CORRECTION_TARGET_UNSUPPORTED`, `SOURCE_PREDICTION_MISSING`, `SOURCE_PREDICTION_MISMATCH`, `SOURCE_PREDICTION_NOT_FOUND`, `SOURCE_ARTIFACT_NOT_PREDICTION`, `SEMANTIC_MASK_VALUES_INVALID`, and reused upload/object errors.
- RB-060 prediction-analysis export error codes include `FORBIDDEN`, `PROJECT_NOT_FOUND`, `USER_NOT_FOUND`, `PREDICTION_TARGET_INVALID`, `NO_PREDICTION_ANALYSIS_CANDIDATES`, `PREDICTION_ANALYSIS_EXPORT_NOT_FOUND`, `EXPORT_NOT_READY`, and `EXPORT_FILE_NOT_FOUND`.
- RB-111 export cap error codes include `EXPORT_ITEM_LIMIT_EXCEEDED`, `EXPORT_BYTE_LIMIT_EXCEEDED`, `PREDICTION_ANALYSIS_EXPORT_ITEM_LIMIT_EXCEEDED`, and `PREDICTION_ANALYSIS_EXPORT_BYTE_LIMIT_EXCEEDED`.
- RB-086/RB-094 BBox proposal and confirmation error codes include `FORBIDDEN`, `IMAGE_NOT_FOUND`, `BBOX_NOT_FOUND`, `BBOX_VERSION_STALE`, `BBOX_SET_EMPTY`, `IMAGE_DIMENSIONS_REQUIRED`, `BBOX_TOO_SMALL`, `BBOX_OUT_OF_BOUNDS`, and integer-field errors such as `X_INTEGER_REQUIRED`.
- RB-087 slice crop error codes include `FORBIDDEN`, `IMAGE_NOT_FOUND`, `CROP_NOT_FOUND`, `BBOX_NOT_FOUND`, `BBOX_VERSION_STALE`, `BBOX_DELETED`, `IMAGE_DIMENSIONS_REQUIRED`, `BBOX_OUT_OF_BOUNDS`, `CROP_PADDING_INVALID`, `CROP_SOURCE_IMAGE_UNSUPPORTED`, and `CROP_IMAGE_GENERATION_FAILED`.
- RB-088 crop support-mask error codes include `FORBIDDEN`, `CROP_NOT_FOUND`, `CROP_COORDINATE_SPACE_INVALID`, `CROP_LINEAGE_INVALID`, `MASK_SIZE_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-089 crop semantic-mask error codes include `FORBIDDEN`, `CROP_NOT_FOUND`, `CROP_COORDINATE_SPACE_INVALID`, `CROP_LINEAGE_INVALID`, `SUPPORT_MASK_REQUIRED`, `SUPPORT_MASK_LINEAGE_MISMATCH`, `SEMANTIC_MODE_INVALID`, `SEMANTIC_MASK_VALUES_INVALID`, `SEMANTIC_OUTSIDE_SUPPORT`, `MASK_SIZE_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-090 classification derivation and slice-instance classification error codes include `FORBIDDEN`, `SLICE_NOT_FOUND`, `SLICE_LINEAGE_INVALID`, `SLICE_CLASS_INVALID`, `SEMANTIC_MASK_NOT_FOUND`, `SEMANTIC_MASK_LINEAGE_INVALID`, `SEMANTIC_LABELS_MISSING`, `CLASSIFICATION_THRESHOLD_INVALID`, `CLASSIFICATION_DERIVATION_DB_ERROR`, and `CLASSIFICATION_DERIVATION_FAILED`.
- RB-091 crop training export adds the `crop_training` target and `EXPORT_TARGET_COMBINATION_INVALID` when it is mixed with full-image export targets.
- RB-105 disabled legacy presign/commit compatibility uploads with `PRESIGNED_UPLOADS_DISABLED` and added export object-byte verification using `EXPORT_OBJECT_INTEGRITY_MISMATCH` for stored-byte/checksum or size mismatches.

## Known Gaps

- Audit logging now covers the main auth/project/upload/artifact/metadata/review/export/prediction/correction paths, but no admin audit UI exists yet.
- RB-053/RB-091/RB-112 training exports and RB-060/RB-067/RB-112 prediction-analysis exports use async single-host jobs. RB-061/RB-065 cover batch prediction import jobs; RB-066/RB-114 cover temporary cleanup and storage/DB drift reporting without adding a cleanup UI. Advanced export filters, export history UI, metrics dashboards, streaming export jobs, and production-grade queue workers remain deferred.

## Related Tickets / Docs

- [../../src/server/README.md](../server/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
