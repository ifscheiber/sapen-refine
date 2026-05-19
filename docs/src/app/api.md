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
- `GET /api/projects/[projectId]/images` - lists images for a project.
- `POST /api/projects/[projectId]/images/presign` - creates a presigned raw-image upload URL.
- `POST /api/projects/[projectId]/images/commit` - records an uploaded raw image.
- `POST /api/projects/[projectId]/images/upload` - uploads a raw image through the app server, stores it in S3/MinIO, and records the image row.
- `GET /api/projects/[projectId]/images/[imageId]/view` - returns an app-mediated image asset URL after membership check.
- `GET /api/images/[imageId]` - redirects to the app-mediated image asset route after membership check.
- `GET /api/images/[imageId]/view` - returns an app-mediated image asset URL.
- `GET /api/images/[imageId]/asset` - streams image bytes through the app after membership check.
- `GET /api/images/[imageId]/mask/latest` - returns latest mask version metadata and view URL.
- `GET /api/images/[imageId]/mask/versions/[versionId]/asset` - streams mask bytes through the app after membership check.
- `POST /api/images/[imageId]/mask/presign` - creates a presigned mask upload URL.
- `POST /api/images/[imageId]/mask/commit` - records a new mask version.
- `POST /api/images/[imageId]/mask/upload` - uploads mask bytes through the app server and records a new draft semantic `AnnotationArtifactVersion`.

## Invariants And Constraints

- Project and image API routes must enforce authenticated access and project membership.
- Mask commits must remain append-only; do not overwrite historical annotation artifact versions.
- Customer-trial browser upload and read paths should use app-mediated routes so MinIO can stay private on the Docker network.
- API routes should return stable error codes that clients can handle.

## Known Gaps

- Upload commit validation is still incomplete for checksums, dimensions, and object metadata, but RB-046 adds server-side size limits and app-mediated trial upload routes.
- Audit logging is not consistently attached to route mutations.
- Review, approval, export, metadata, and task persistence exists after RB-049, but user-facing APIs/workflows remain planned for RB-050+.

## Related Tickets / Docs

- [../../src/server/README.md](../server/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
