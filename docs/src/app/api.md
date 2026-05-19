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
- `POST /api/projects/[projectId]/images/presign` - creates a presigned raw-image upload URL.
- `POST /api/projects/[projectId]/images/commit` - records an uploaded raw image.
- `POST /api/projects/[projectId]/images/upload` - uploads a raw image through the app server, stores it in S3/MinIO, and records the image row.
- `GET /api/projects/[projectId]/images/[imageId]/view` - returns an app-mediated image asset URL after membership check.
- `GET /api/images/[imageId]` - redirects to the app-mediated image asset route after membership check.
- `GET /api/images/[imageId]/metadata` - returns immutable technical image metadata, acquisition/sample metadata, membership role, edit capability, and readiness summary.
- `PATCH /api/images/[imageId]/metadata` - updates acquisition/sample metadata for editable project roles with typed validation.
- `GET /api/images/[imageId]/view` - returns an app-mediated image asset URL.
- `GET /api/images/[imageId]/asset` - streams image bytes through the app after membership check.
- `GET /api/images/[imageId]/mask/latest` - returns latest mask version metadata and view URL.
- `GET /api/images/[imageId]/mask/versions/[versionId]/asset` - streams mask bytes through the app after membership check.
- `POST /api/images/[imageId]/mask/presign` - creates a presigned mask upload URL.
- `POST /api/images/[imageId]/mask/commit` - records a new mask version.
- `POST /api/images/[imageId]/mask/upload` - uploads mask bytes through the app server and records a new draft semantic `AnnotationArtifactVersion`.
- `GET /api/images/[imageId]/slice` - returns default-slice state, support label values, latest support mask, and latest classification.
- `POST /api/images/[imageId]/slice/ensure` - creates or returns the default slice instance for editable project roles.
- `PATCH /api/images/[imageId]/slice/classification` - appends a draft `SliceClassificationVersion`.
- `GET /api/images/[imageId]/support-mask/latest` - returns latest support-mask version metadata and app-mediated asset URL.
- `POST /api/images/[imageId]/support-mask/upload` - uploads support-mask bytes through the app server and records a draft `SLICE_SUPPORT_MASK` artifact version.
- `GET /api/images/[imageId]/review-state` - returns review permissions, latest versions, latest approved versions, and export-readiness warnings for semantic masks, support masks, and slice classifications.
- `POST /api/artifact-versions/[versionId]/review` - submits, approves, or rejects semantic/support artifact versions after membership and transition checks.
- `POST /api/slice-classification-versions/[versionId]/review` - submits, approves, or rejects slice classification versions after membership and transition checks.

## Invariants And Constraints

- Project and image API routes must enforce authenticated access and project membership.
- Mask commits must remain append-only; do not overwrite historical annotation artifact versions.
- Customer-trial browser upload and read paths should use app-mediated routes so MinIO can stay private on the Docker network.
- Metadata APIs must not accept client-owned changes to immutable upload facts such as storage key, checksum, dimensions, uploader, or validation status.
- Support-mask APIs must not accept semantic mask versions as physical support geometry.
- Review APIs enforce server-side permissions: `OWNER`/`QA` can approve/reject, `OWNER`/`QA`/`LABELER` can submit, and `VIEWER` cannot mutate review state.
- Review APIs only allow `DRAFT -> SUBMITTED` and `SUBMITTED -> APPROVED/REJECTED`; reject requires a comment or reason.
- API routes should return stable error codes that clients can handle.

## Known Gaps

- Upload commit validation is still incomplete for checksum enforcement, dimensions, and object metadata, but RB-046 adds server-side size limits and RB-050 stores app-mediated upload checksums.
- Audit logging is not consistently attached to route mutations.
- Export and task workflows remain deferred; RB-052 implements only the minimal review/approval API and editor controls.

## Related Tickets / Docs

- [../../src/server/README.md](../server/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
