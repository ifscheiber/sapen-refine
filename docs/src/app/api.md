# API Routes

## Purpose

This page lists the current API route handlers under `src/app/api`.

## Current API Surface

- `GET /api/health` - returns `{ ok: true, userCount }`.
- `POST /api/auth/login` - validates local credentials and creates a session.
- `POST /api/auth/logout` - revokes the current session and clears the cookie.
- `GET /api/auth/me` - returns the current authenticated user.
- `GET /api/projects` - lists projects visible to the current user.
- `POST /api/projects` - creates a project and owner membership.
- `GET /api/projects/[projectId]/images` - lists images for a project.
- `POST /api/projects/[projectId]/images/presign` - creates a presigned raw-image upload URL.
- `POST /api/projects/[projectId]/images/commit` - records an uploaded raw image.
- `GET /api/projects/[projectId]/images/[imageId]/view` - returns a presigned image view URL after membership check.
- `GET /api/images/[imageId]` - redirects to a presigned image URL after membership check.
- `GET /api/images/[imageId]/view` - returns a presigned image view URL.
- `GET /api/images/[imageId]/mask/latest` - returns latest mask version metadata and view URL.
- `POST /api/images/[imageId]/mask/presign` - creates a presigned mask upload URL.
- `POST /api/images/[imageId]/mask/commit` - records a new mask version.

## Invariants And Constraints

- Project and image API routes must enforce authenticated access and project membership.
- Mask commits must remain append-only; do not overwrite historical mask versions.
- API routes should return stable error codes that clients can handle.

## Known Gaps

- Upload commit validation is incomplete.
- Audit logging is not consistently attached to route mutations.
- Review, approval, export, metadata, and task APIs are planned but missing.

## Related Tickets / Docs

- [../../src/server/README.md](../server/README.md)
- [../../adr/remediation-backlog.md](../../adr/remediation-backlog.md)
