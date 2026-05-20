# API Routes

## Purpose

This page lists the current API route handlers under `src/app/api`.

## Current API Surface

- `GET /api/health` - cheap unauthenticated liveness endpoint; returns status, service, and timestamp without DB access.
- `GET /api/ready` - unauthenticated readiness endpoint; checks database and storage connectivity and returns `503` when a dependency is unavailable.
- `POST /api/auth/login` - validates local credentials and creates a session.
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
- `POST /api/model-runs` - creates a model/checkpoint/training provenance record for global admins.
- `GET /api/model-runs/[modelRunId]` - returns full model-run provenance for global admins.
- `GET /api/projects/[projectId]/prediction-runs` - lists project-scoped prediction/inference runs for project members.
- `POST /api/projects/[projectId]/prediction-runs` - creates a project-scoped prediction/inference run for project `OWNER` or `QA`.
- `GET /api/prediction-runs/[predictionRunId]` - returns a sanitized prediction-run summary for project members.

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
- Prediction provenance APIs do not import prediction bytes, do not approve prediction artifacts, and do not expose private storage keys. Direct model-run reads are admin-only because they may include internal checkpoint paths; project members read reduced model summaries through prediction-run responses.
- API routes should return stable error codes that clients can handle.
- RB-055 upload/artifact error codes include `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_TOO_LARGE`, `IMAGE_DIMENSIONS_UNREADABLE`, `CHECKSUM_MISMATCH`, `MASK_FORMAT_UNSUPPORTED`, `MASK_BYTE_LENGTH_MISMATCH`, `MASK_DIMENSIONS_MISMATCH`, `SUPPORT_MASK_VALUES_INVALID`, `OBJECT_KEY_INVALID`, `OBJECT_WRITE_FAILED`, and `OBJECT_STAT_FAILED`.
- RB-056 prediction provenance error codes include `FORBIDDEN`, `MODEL_RUN_NOT_FOUND`, `PREDICTION_RUN_NOT_FOUND`, `DUPLICATE_INFERENCE_RUN`, `INVALID_MODEL_TASK_TYPE`, `INVALID_PREDICTION_TARGET_TYPE`, `INVALID_PREDICTION_RUN_STATUS`, `CONFIDENCE_OUT_OF_RANGE`, `UNCERTAINTY_OUT_OF_RANGE`, `PREDICTED_CLASS_REQUIRED`, `PREDICTED_CLASS_TARGET_INVALID`, `ARTIFACT_NOT_PREDICTION`, and `PROJECT_MISMATCH`.

## Known Gaps

- Audit logging is not consistently attached to every route mutation; RB-055 covers the current upload/artifact/export paths.
- Prediction file import, active-learning task APIs/UI, and assisted correction workflows remain deferred. RB-053 export is synchronous and owner-only; advanced export filters, history UI, QA export policy, and job queues remain deferred.

## Related Tickets / Docs

- [../../src/server/README.md](../server/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
